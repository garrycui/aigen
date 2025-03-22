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
  invalidatePostAndForumCaches,
  getForumCacheKey,
  getPostCacheKey
} from '../common/cache';

// ==========================================
// SECTION 1: DATA TYPES & INTERFACES
// ==========================================

export interface PostData {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url?: string;
  video_url?: string;
  likes_count: number;
  comments_count: number;
  createdAt: any;
  userId: string;
  user_name: string;
  is_liked?: boolean;
}

export interface CommentData {
  id: string;
  content: string;
  userId: string;
  user_name: string;
  likes_count: number;
  created_at: any;
  replies?: ReplyData[];
  is_liked?: boolean;
}

export interface ReplyData {
  id: string;
  content: string;
  userId: string;
  user_name: string;
  likes_count: number;
  created_at: any;
  is_liked?: boolean;
}

// ==========================================
// SECTION 2: CACHE MANAGEMENT
// ==========================================
// Removed cache management functions (moved to cache.ts)

// ==========================================
// SECTION 3: DATE/FORMATTING UTILITIES
// ==========================================

/**
 * Format a timestamp to a readable date string 
 */
export const formatDate = (timestamp: any): string => {
  if (!timestamp) return '';
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error, timestamp);
    return '';
  }
};

/**
 * Format a timestamp to a relative time string (e.g., "5m ago")
 */
export const formatTimeAgo = (timestamp: any): string => {
  if (!timestamp) return '';
  
  try {
    // Handle various timestamp formats
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp?.seconds !== undefined && timestamp?.nanoseconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    // Validate date
    if (isNaN(date.getTime())) {
      return 'Date unavailable';
    }
    
    // Handle future dates (potential timezone issues)
    if (date > new Date(Date.now() + 86400000)) {
      return 'Recently';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting relative time:", error, timestamp);
    return 'Date unavailable';
  }
};

// ==========================================
// SECTION 4: BUSINESS LOGIC UTILITIES
// ==========================================

/**
 * Handle post like with optimistic updates
 */
export const handlePostLike = async (
  posts: PostData[],
  postId: string,
  userId: string,
  updatePosts: (posts: PostData[]) => void
): Promise<void> => {
  try {
    // Store original state before optimistic update
    const originalPost = posts.find(p => p.id === postId);
    if (!originalPost) return;
    
    const originalIsLiked = originalPost.is_liked;
    const originalCount = originalPost.likes_count;
    
    // Apply simple optimistic update - just flip the state
    updatePosts(
      posts.map(post =>
        post.id === postId
          ? {
              ...post,
              is_liked: !post.is_liked,
              likes_count: Math.max(0, post.likes_count + (post.is_liked ? -1 : 1))
            }
          : post
      )
    );
    
    // Call API to update like status
    const isLiked = await toggleLike('post', postId, userId);
    
    // If server state doesn't match our prediction, correct it
    if (isLiked !== !originalIsLiked) {
      updatePosts(
        posts.map(post =>
          post.id === postId
            ? {
                ...post,
                is_liked: isLiked,
                likes_count: isLiked ? originalCount + 1 : Math.max(0, originalCount - 1)
              }
            : post
        )
      );
    }
    
    // Only invalidate related cache entries
    invalidatePostCache(postId);
  } catch (error) {
    console.error('Error toggling post like:', error);
    // Revert optimistic update on error
    updatePosts(
      posts.map(post =>
        post.id === postId
          ? {
              ...post,
              is_liked: !post.is_liked,
              likes_count: Math.max(0, post.likes_count + (post.is_liked ? 1 : -1))
            }
          : post
      )
    );
  }
};

/**
 * Handle comment like with optimistic updates
 */
export const handleCommentLike = async (
  postId: string,
  commentId: string,
  userId: string,
  post: { id: string, comments: CommentData[] },
  updatePost: (post: any) => void
): Promise<void> => {
  try {
    // Apply optimistic update
    updatePost({
      ...post,
      comments: post.comments.map(comment =>
        comment.id === commentId
          ? {
              ...comment,
              likes_count: comment.likes_count + (comment.is_liked ? -1 : 1),
              is_liked: !comment.is_liked
            }
          : comment
      )
    });
    
    // Call API
    const isLiked = await toggleLike('comment', commentId, userId, postId);
    
    // Correct if necessary
    updatePost({
      ...post,
      comments: post.comments.map(comment =>
        comment.id === commentId
          ? {
              ...comment,
              likes_count: comment.likes_count + (isLiked ? 1 : -1) - (comment.is_liked ? 1 : 0),
              is_liked: isLiked
            }
          : comment
      )
    });
  } catch (error) {
    console.error('Error toggling comment like:', error);
    // Revert on error
    updatePost({
      ...post,
      comments: post.comments.map(comment =>
        comment.id === commentId
          ? {
              ...comment,
              likes_count: comment.likes_count + (comment.is_liked ? 1 : -1),
              is_liked: !comment.is_liked
            }
          : comment
      )
    });
  }
};

/**
 * Handle reply like with optimistic updates
 */
export const handleReplyLike = async (
  postId: string,
  commentId: string,
  replyId: string,
  userId: string,
  post: { id: string, comments: CommentData[] },
  updatePost: (post: any) => void
): Promise<void> => {
  try {
    // Apply optimistic update
    updatePost({
      ...post,
      comments: post.comments.map(comment => 
        comment.id === commentId
          ? {
              ...comment,
              replies: comment.replies?.map(reply =>
                reply.id === replyId
                  ? {
                      ...reply,
                      likes_count: reply.likes_count + (reply.is_liked ? -1 : 1),
                      is_liked: !reply.is_liked
                    }
                  : reply
              )
            }
          : comment
      )
    });
    
    // Call API - combine commentId and replyId for API call
    const combinedId = `${commentId}_${replyId}`;
    const isLiked = await toggleLike('reply', combinedId, userId, postId);
    
    // Correct if necessary
    updatePost({
      ...post,
      comments: post.comments.map(comment =>
        comment.id === commentId
          ? {
              ...comment,
              replies: comment.replies?.map(reply =>
                reply.id === replyId
                  ? {
                      ...reply,
                      likes_count: reply.likes_count + (isLiked ? 1 : -1) - (reply.is_liked ? 1 : 0),
                      is_liked: isLiked
                    }
                  : reply
              )
            }
          : comment
      )
    });
  } catch (error) {
    console.error('Error toggling reply like:', error);
    // Revert on error
    updatePost({
      ...post,
      comments: post.comments.map(comment =>
        comment.id === commentId
          ? {
              ...comment,
              replies: comment.replies?.map(reply =>
                reply.id === replyId
                  ? {
                      ...reply,
                      likes_count: reply.likes_count + (reply.is_liked ? 1 : -1),
                      is_liked: !reply.is_liked
                    }
                  : reply
              )
            }
          : comment
      )
    });
  }
};

// Add this new utility function for optimistic post like handling
export const optimisticLikeToggle = async <T extends { id: string, is_liked?: boolean, likes_count: number }>(
  item: T,
  updateFn: (item: T | null) => void,
  toggleFn: () => Promise<boolean>
): Promise<void> => {
  // Store original values outside of the try block so they're accessible in catch
  const originalIsLiked = item.is_liked;
  const originalCount = item.likes_count;
  
  try {
    // Optimistic update - just toggle the state
    updateFn({
      ...item,
      is_liked: !originalIsLiked,
      likes_count: Math.max(0, item.likes_count + (originalIsLiked ? -1 : 1))
    });
    
    // Call API
    const isLiked = await toggleFn();
    
    // Reset to correct state if API result differs from our prediction
    if (isLiked !== !originalIsLiked) {
      updateFn({
        ...item,
        is_liked: isLiked,
        likes_count: isLiked ? originalCount + 1 : Math.max(0, originalCount - 1)
      });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    
    // Revert on error - now originalIsLiked and originalCount are in scope
    updateFn({
      ...item,
      is_liked: originalIsLiked,
      likes_count: originalCount
    });
  }
};

// Add this new utility function for comment deletion with optimistic updates
export const optimisticCommentDelete = async (
  postId: string,
  commentId: string,
  userId: string,
  post: PostData & { comments: CommentData[] },
  updatePostFn: (post: (PostData & { comments: CommentData[] }) | null) => void
): Promise<void> => {
  try {
    // Store original values
    const originalCount = post.comments_count;
    
    // Optimistic update
    updatePostFn({
      ...post,
      comments: post.comments.filter(c => c.id !== commentId),
      comments_count: Math.max(0, originalCount - 1)
    });
    
    // Call API
    await deleteComment(postId, commentId, userId);
    
    // No need to refresh - optimistic update is sufficient if successful
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// ==========================================
// SECTION 5: DATA ACCESS FUNCTIONS
// ==========================================

/**
 * Fetch posts with pagination and sorting
 */
export const fetchPosts = async (
  sortBy: 'date' | 'likes' | 'comments' = 'date',
  page: number = 1,
  lastVisibleId?: string
) => {
  // Create a unique cache key based on sort method, page, and cursor
  const cacheKey = getForumCacheKey('', sortBy, page, lastVisibleId);
  
  return forumCache.getOrSet(cacheKey, async () => {
    try {
      // ...existing code for fetching posts...
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
      
      // Map documents to post objects with consistent field naming
      const posts = querySnapshot.docs.map((postDoc) => {
        const data = postDoc.data();
        return {
          id: postDoc.id,
          title: data.title || '',
          content: data.content || '',
          category: data.category || '',
          image_url: data.image_url,
          video_url: data.video_url,
          likes_count: data.likes_count || 0,
          comments_count: data.comments_count || 0,
          createdAt: data.createdAt,
          user_name: data.user_name || '',
          userId: data.userId || '' // Ensure we use userId consistently
        };
      });

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

/**
 * Search posts with text query
 */
export const searchPosts = async (
  query: string,
  sortBy: 'date' | 'likes' | 'comments' = 'date',
  page: number = 1
) => {
  // Create a unique cache key based on search query, sort method and page
  const cacheKey = getForumCacheKey(query, sortBy, page);
  
  return forumCache.getOrSet(cacheKey, async () => {
    try {
      // ...existing code for searching posts...
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
      
      // Map to post objects with consistent field naming
      const posts = paginatedPosts.map(postDoc => {
        const data = postDoc.data();
        return {
          id: postDoc.id,
          title: data.title || '',
          content: data.content || '',
          category: data.category || '',
          image_url: data.image_url,
          video_url: data.video_url,
          likes_count: data.likes_count || 0,
          comments_count: data.comments_count || 0,
          createdAt: data.createdAt,
          user_name: data.user_name || '',
          userId: data.userId || '' // Ensure we use userId consistently
        };
      });

      return { data: posts };
    } catch (error) {
      console.error('Error searching posts:', error);
      return { data: [], error };
    }
  });
};

/**
 * Fetch a single post with all comments and replies
 */
export const fetchPost = async (postId: string) => {
  // Use post cache for individual post details
  const cacheKey = getPostCacheKey(postId);
  
  return postCache.getOrSet(cacheKey, async () => {
    try {
      // ...existing fetchPost code...
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data();

      // Fetch comments using regular queries
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

// Other data access functions (unchanged)
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

    // Use a batch to ensure atomic operations
    const batch = writeBatch(db);
    
    // Delete all replies for this comment
    const repliesRef = collection(db, 'posts', postId, 'comments', commentId, 'replies');
    const repliesSnapshot = await getDocs(repliesRef);
    await Promise.all(repliesSnapshot.docs.map(replyDoc => 
      deleteDoc(doc(db, 'posts', postId, 'comments', commentId, 'replies', replyDoc.id))
    ));

    // Delete the comment
    batch.delete(commentRef);
    
    // Update the comment count on the post
    const postRef = doc(db, 'posts', postId);
    batch.update(postRef, {
      comments_count: increment(-1)
    });
    
    // Commit the batch
    await batch.commit();

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
      // Get the current document data
      const parentPath = type === 'post' 
        ? `posts/${itemId}`
        : type === 'comment' && postId
          ? `posts/${postId}/comments/${itemId}`
          : `posts/${postId}/comments/${itemId.split('_')[0]}/replies/${itemId.split('_')[1]}`;
          
      const parentRef = doc(db, parentPath);
      const parentDoc = await transaction.get(parentRef);
      
      if (!parentDoc.exists()) {
        throw new Error('Parent document not found');
      }
      
      // Get current like count and calculate new value
      const currentLikes = parentDoc.data().likes_count || 0;
      const newLikes = Math.max(0, isLiked ? currentLikes - 1 : currentLikes + 1);
      
      // Update with exact value instead of using increment
      transaction.update(parentRef, { 
        likes_count: newLikes
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
      
      // Return whether the item is now liked
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