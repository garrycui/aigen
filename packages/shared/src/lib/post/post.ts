import { 
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    deleteDoc,
    serverTimestamp,
    startAfter,
    increment,
    writeBatch,
    runTransaction
  } from 'firebase/firestore';
  import { db } from '../common/firebase';
  import { 
    forumCache, 
    postCache, 
    updateUser, 
    getUser, 
    invalidateForumCache,
    invalidatePostCache,
    invalidatePostAndForumCaches
  } from '../common/cache';
  
// Forum Functions
export const fetchPosts = async (
    sortBy: 'date' | 'likes' | 'comments' = 'date',
    page: number = 1,
    lastVisibleId?: string
  ) => {
    // Create a unique cache key based on sort method, page, and cursor
    const cacheKey = lastVisibleId 
      ? `posts-${sortBy}-after-${lastVisibleId}` 
      : `posts-${sortBy}-page${page}`;
    
    return forumCache.getOrSet(cacheKey, async () => {
      try {
        const postsRef = collection(db, 'posts');
        let q;
        
        // Apply sorting based on sortBy parameter
        const orderByField = sortBy === 'date' ? 'createdAt' : 
                            sortBy === 'likes' ? 'likes_count' : 'comments_count';
        
        // If we have a last document ID, use it for pagination
        if (lastVisibleId) {
          // First, get the document to use as cursor
          const lastDocRef = doc(db, 'posts', lastVisibleId);
          const lastDocSnap = await getDoc(lastDocRef);
          
          if (lastDocSnap.exists()) {
            q = query(
              postsRef, 
              orderBy(orderByField, 'desc'),
              startAfter(lastDocSnap),
              limit(10)
            );
          } else {
            // Fallback if document doesn't exist
            q = query(postsRef, orderBy(orderByField, 'desc'), limit(10));
          }
        } else {
          // First page, no cursor needed
          q = query(postsRef, orderBy(orderByField, 'desc'), limit(10));
        }
        
        const querySnapshot = await getDocs(q);
        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        
        // PERFORMANCE IMPROVEMENT: Use Promise.all efficiently with a map/reduce approach
        // instead of performing separate queries for each post
        const posts = await Promise.all(querySnapshot.docs.map(async (postDoc) => {
          const data = postDoc.data();
          return {
            id: postDoc.id,
            title: data.title,
            content: data.content,
            category: data.category,
            image_url: data.image_url,
            video_url: data.video_url,
            likes_count: data.likes_count || 0, // Use stored counters instead of querying
            comments_count: data.comments_count || 0, // Use stored counters instead of querying
            createdAt: data.createdAt,
            user_name: data.user_name,
            user_id: data.userId
          };
        }));
  
        // Return both the posts data and pagination info
        return { 
          data: posts,
          pagination: {
            hasMore: posts.length === 10,
            lastVisible: lastVisible?.id || null
          }
        };
      } catch (error) {
        console.error('Error fetching posts:', error);
        return { 
          data: [], 
          pagination: { hasMore: false, lastVisible: null },
          error 
        };
      }
    });
  };
  
  export const searchPosts = async (
    query: string,
    sortBy: 'date' | 'likes' | 'comments' = 'date',
    page: number = 1
  ) => {
    // Create a unique cache key based on search query, sort method and page
    const cacheKey = `search-${query.replace(/\s+/g, '-')}-${sortBy}-page${page}`;
    
    return forumCache.getOrSet(cacheKey, async () => {
      try {
        // PERFORMANCE IMPROVEMENT: Use a compound query instead of client-side filtering
        // For production, consider using Firebase Extensions like "Search with Algolia"
        // or implement server-side search with Cloud Functions
        const postsRef = collection(db, 'posts');
        const querySnapshot = await getDocs(postsRef);
        
        // Filter posts that match the search query
        let matchedPosts = querySnapshot.docs.filter(doc => {
          const data = doc.data();
          const title = data.title?.toLowerCase() || '';
          const content = data.content?.toLowerCase() || '';
          const searchQuery = query.toLowerCase();
          return title.includes(searchQuery) || content.includes(searchQuery);
        });
        
        // Sort based on sortBy parameter
        if (sortBy === 'likes') {
          matchedPosts = matchedPosts.sort((a, b) => 
            (b.data().likes_count || 0) - (a.data().likes_count || 0)
          );
        } else if (sortBy === 'comments') {
          matchedPosts = matchedPosts.sort((a, b) => 
            (b.data().comments_count || 0) - (a.data().comments_count || 0)
          );
        } else {
          matchedPosts = matchedPosts.sort((a, b) => 
            b.data().createdAt - a.data().createdAt
          );
        }
        
        // Apply pagination
        const paginatedPosts = matchedPosts.slice((page - 1) * 10, page * 10);
        
        // PERFORMANCE IMPROVEMENT: Use stored counter fields instead of separate queries
        const posts = paginatedPosts.map(postDoc => {
          const data = postDoc.data();
          return {
            id: postDoc.id,
            title: data.title,
            content: data.content,
            category: data.category,
            image_url: data.image_url,
            video_url: data.video_url,
            likes_count: data.likes_count || 0,
            comments_count: data.comments_count || 0,
            createdAt: data.createdAt,
            user_name: data.user_name,
            user_id: data.userId
          };
        });
  
        return { data: posts };
      } catch (error) {
        console.error('Error searching posts:', error);
        return { data: [], error };
      }
    });
  };
  
  export const fetchPost = async (postId: string) => {
    // Use post cache for individual post details
    const cacheKey = `post-${postId}`;
    
    return postCache.getOrSet(cacheKey, async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postDoc = await getDoc(postRef);
  
        if (!postDoc.exists()) {
          throw new Error('Post not found');
        }
  
        const postData = postDoc.data();
  
        // Modified approach: Don't use transaction for read-only operations
        // Fetch comments using regular queries instead of transactions
        const commentsRef = collection(db, 'posts', postId, 'comments');
        const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));
        const commentsSnapshot = await getDocs(commentsQuery);
        
        const comments = await Promise.all(commentsSnapshot.docs.map(async (commentDoc) => {
          const commentData = commentDoc.data();
          
          const repliesRef = collection(db, 'posts', postId, 'comments', commentDoc.id, 'replies');
          const repliesQuery = query(repliesRef, orderBy('createdAt', 'desc'));
          const repliesSnapshot = await getDocs(repliesQuery);
          
          const replies = repliesSnapshot.docs.map((replyDoc) => {
            const replyData = replyDoc.data();
            return {
              id: replyDoc.id,
              content: replyData.content || '',
              userId: replyData.userId || '',
              user_name: replyData.user_name || '',
              likes_count: replyData.likes_count || 0,
              created_at: replyData.createdAt || null
            };
          });
  
          return {
            id: commentDoc.id,
            content: commentData.content || '',
            userId: commentData.userId || '',
            user_name: commentData.user_name || '',
            likes_count: commentData.likes_count || 0,
            created_at: commentData.createdAt || null,
            replies
          };
        }));
  
        const post = {
          id: postDoc.id,
          title: postData.title || '',
          content: postData.content || '',
          category: postData.category || '',
          image_url: postData.image_url || '',
          video_url: postData.video_url || '',
          userId: postData.userId || '',
          user_name: postData.user_name || '',
          likes_count: postData.likes_count || 0,
          comments_count: postData.comments_count || 0,
          created_at: postData.createdAt || null,
          comments
        };
  
        return { data: post };
      } catch (error) {
        console.error('Error fetching post:', error);
        throw error;
      }
    });
  };
  
  export const createPost = async (userId: string, userName: string, title: string, content: string, category: string, imageUrl?: string, videoUrl?: string) => {
    try {
      // Create post with counter fields initialized
      const postRef = await addDoc(collection(db, 'posts'), {
        userId,
        user_name: userName,
        title,
        content,
        category,
        image_url: imageUrl,
        video_url: videoUrl,
        likes_count: 0,
        comments_count: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
  
      // Get user data and update in a single operation using the updateUser function
      const userData = await getUser(userId);
      const publishedPosts = userData?.publishedPosts || [];
      await updateUser(userId, {
        publishedPosts: [...publishedPosts, postRef.id]
      });
  
      // Invalidate forum cache
      invalidateForumCache();
      
      return { data: { id: postRef.id } };
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  };
  
  export const updatePost = async (postId: string, userId: string, updates: {
    title?: string;
    content?: string;
    category?: string;
    image_url?: string;
    video_url?: string;
  }) => {
    try {
      // Original implementation
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
  
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }
  
      if (postDoc.data().userId !== userId) {
        throw new Error('Unauthorized to edit this post');
      }
  
      await updateDoc(postRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
  
      // Invalidate both the specific post and forum listings
      invalidatePostAndForumCaches(postId);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  };
  
  export const deletePost = async (postId: string, userId: string) => {
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
  
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }
  
      if (postDoc.data().userId !== userId) {
        throw new Error('Unauthorized to delete this post');
      }
  
      // Delete all comments and their replies
      const commentsRef = collection(db, 'posts', postId, 'comments');
      const commentsSnapshot = await getDocs(commentsRef);
      
      await Promise.all(commentsSnapshot.docs.map(async (commentDoc) => {
        // Delete all replies for this comment - fixed path
        const repliesRef = collection(db, 'posts', postId, 'comments', commentDoc.id, 'replies');
        const repliesSnapshot = await getDocs(repliesRef);
        await Promise.all(repliesSnapshot.docs.map(replyDoc => deleteDoc(doc(db, 'posts', postId, 'comments', commentDoc.id, 'replies', replyDoc.id))));
        
        // Delete the comment
        await deleteDoc(doc(db, 'posts', postId, 'comments', commentDoc.id));
      }));
  
      // Delete the post
      await deleteDoc(postRef);
  
      // Replace this direct Firestore code with updateUser
      const userData = await getUser(userId);
      if (userData) {
        const publishedPosts = userData.publishedPosts || [];
        await updateUser(userId, {
          publishedPosts: publishedPosts.filter((id: string) => id !== postId)
        });
        // No need to explicitly invalidate cache - updateUser does that
      }
  
      // Invalidate cache after deleting a post
      invalidatePostAndForumCaches(postId);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  };
  
  export const createComment = async (postId: string, userId: string, userName: string, content: string) => {
    try {
      // Use a batch write to create comment and update post's comment count atomically
      const batch = writeBatch(db);
      
      // Create the comment document
      const commentsRef = collection(db, 'posts', postId, 'comments');
      const commentRef = doc(commentsRef);
      batch.set(commentRef, {
        userId,
        user_name: userName,
        content,
        likes_count: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update the post's comment count
      const postRef = doc(db, 'posts', postId);
      batch.update(postRef, {
        comments_count: increment(1)
      });
      
      // Commit the batch
      await batch.commit();
  
      // Invalidate the specific post and forum listings since comment counts changed
      invalidatePostAndForumCaches(postId);
      
      return commentRef.id;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  };
  
  export const updateComment = async (postId: string, commentId: string, userId: string, content: string) => {
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      const commentDoc = await getDoc(commentRef);
  
      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }
  
      if (commentDoc.data().userId !== userId) {
        throw new Error('Unauthorized to edit this comment');
      }
  
      await updateDoc(commentRef, {
        content,
        updatedAt: serverTimestamp()
      });
  
      // Invalidate just the specific post cache
      invalidatePostCache(postId);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  };
  
  export const deleteComment = async (postId: string, commentId: string, userId: string) => {
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      const commentDoc = await getDoc(commentRef);
  
      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }
  
      if (commentDoc.data().userId !== userId) {
        throw new Error('Unauthorized to delete this comment');
      }
  
      // Delete all replies for this comment
      // Fix: Use collection() instead of trying to use commentRef as a collection
      const repliesRef = collection(db, 'posts', postId, 'comments', commentId, 'replies');
      const repliesSnapshot = await getDocs(repliesRef);
      await Promise.all(repliesSnapshot.docs.map(replyDoc => deleteDoc(doc(repliesRef, replyDoc.id))));
  
      // Delete the comment
      await deleteDoc(commentRef);
  
      // Invalidate both caches
      invalidatePostAndForumCaches(postId);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  };
  
  export const createReply = async (postId: string, commentId: string, userId: string, userName: string, content: string) => {
    try {
      const replyRef = await addDoc(
        collection(db, 'posts', postId, 'comments', commentId, 'replies'),
        {
          userId,
          user_name: userName,
          content,
          likes_count: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );
  
      // Invalidate post cache when a reply is added
      invalidatePostCache(postId);
      
      return { data: { id: replyRef.id } };
    } catch (error) {
      console.error('Error creating reply:', error);
      throw error;
    }
  };
  
  export const updateReply = async (postId: string, commentId: string, replyId: string, userId: string, content: string) => {
    try {
      const replyRef = doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId);
      const replyDoc = await getDoc(replyRef);
  
      if (!replyDoc.exists()) {
        throw new Error('Reply not found');
      }
  
      if (replyDoc.data().userId !== userId) {
        throw new Error('Unauthorized to edit this reply');
      }
  
      await updateDoc(replyRef, {
        content,
        updatedAt: serverTimestamp()
      });
  
      // Invalidate post cache when a reply is updated
      invalidatePostCache(postId);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating reply:', error);
      throw error;
    }
  };
  
  export const deleteReply = async (postId: string, commentId: string, replyId: string, userId: string) => {
    try {
      const replyRef = doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId);
      const replyDoc = await getDoc(replyRef);
  
      if (!replyDoc.exists()) {
        throw new Error('Reply not found');
      }
  
      if (replyDoc.data().userId !== userId) {
        throw new Error('Unauthorized to delete this reply');
      }
  
      await deleteDoc(replyRef);
  
      // Invalidate post cache when a reply is deleted
      invalidatePostCache(postId);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting reply:', error);
      throw error;
    }
  };
  
  export const toggleLike = async (
    type: 'post' | 'comment' | 'reply', 
    itemId: string, 
    userId: string,
    postId?: string // Add optional postId parameter for comment/reply likes
  ) => {
    try {
      // We need to first query to check if the like exists
      const likePath = type === 'post' 
        ? `posts/${itemId}/likes`
        : type === 'comment' && postId
          ? `posts/${postId}/comments/${itemId}/likes` 
          : `posts/${postId}/comments/${itemId.split('_')[0]}/replies/${itemId.split('_')[1]}/likes`;
          
      const likesRef = collection(db, likePath);
      const userLikeQuery = query(likesRef, where('userId', '==', userId));
      const userLikeSnapshot = await getDocs(userLikeQuery);
      
      const isLiked = userLikeSnapshot.docs.length > 0;
      const likeDocId = isLiked ? userLikeSnapshot.docs[0].id : null;
      
      // Then use transaction for the update
      const isNowLiked = await runTransaction(db, async (transaction) => {
        // Update the counter on the parent document
        const parentPath = type === 'post' 
          ? `posts/${itemId}`
          : type === 'comment' && postId
            ? `posts/${postId}/comments/${itemId}`
            : `posts/${postId}/comments/${itemId.split('_')[0]}/replies/${itemId.split('_')[1]}`;
            
        const parentRef = doc(db, parentPath);
        const increment_value = isLiked ? -1 : 1;
        
        transaction.update(parentRef, { 
          likes_count: increment(increment_value) 
        });
        
        if (isLiked && likeDocId) {
          // Unlike: delete the like document
          const likeDocRef = doc(db, likePath, likeDocId);
          transaction.delete(likeDocRef);
        } else {
          // Like: create a like document
          const newLikeDocRef = doc(collection(db, likePath));
          transaction.set(newLikeDocRef, {
            userId,
            createdAt: serverTimestamp()
          });
        }
        
        // Return whether the item is now liked (!isLiked means we're toggling)
        return !isLiked;
      });
      
      // Invalidate appropriate caches outside the transaction
      if (type === 'post') {
        invalidatePostAndForumCaches(itemId);
      } else if (postId) {
        invalidatePostCache(postId);
      }
      
      return isNowLiked;
    } catch (error) {
      console.error(`Error toggling like for ${type}:`, error);
      throw error;
    }
  };