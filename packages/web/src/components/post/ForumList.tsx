import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPosts, searchPosts, toggleLike } from '@shared/lib/post/post';
import { forumCache } from '@shared/lib/common/cache'; // Import the cache
import { useAuth } from '@context/AuthContext';
import { MessageSquare, ThumbsUp } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url?: string;
  video_url?: string;
  likes_count: number;
  comments_count: number;
  createdAt: any;
  user_name: string;
  user_id: string;
  is_liked?: boolean;
}

interface ForumListProps {
  searchQuery?: string;
  sortBy?: 'date' | 'likes' | 'comments';
  page?: number;
}

const ForumList: React.FC<ForumListProps> = ({
  searchQuery = '',
  sortBy = 'date',
  page = 1
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [pageHistory, setPageHistory] = useState<{[pageNum: number]: string}>({});
  const [lastVisible, setLastVisible] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [skeletonCount, setSkeletonCount] = useState(3);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        if (!initialLoad) {
          setIsLoading(true);
        }
        
        // Determine lastVisibleId for pagination
        let lastVisibleId = undefined;
        if (currentPage > 1) {
          // Use the stored last document from the previous page
          lastVisibleId = pageHistory[currentPage - 1] || undefined;
        }
        
        // Construct cache key
        const cacheKey = debouncedSearchQuery 
          ? `search-${debouncedSearchQuery}-${sortBy}-page${currentPage}`
          : lastVisibleId
            ? `posts-${sortBy}-after-${lastVisibleId}`
            : `posts-${sortBy}-page${currentPage}`;
          
        // Check if data is available in cache
        const cachedData = forumCache.get(cacheKey);
        
        let response;
        if (cachedData && cachedData.data && Array.isArray(cachedData.data)) {
          // Validate cache response has all required fields
          response = cachedData;
          // Remove cache hit increment
        } else {
          // If not in cache or invalid, fetch from API
          response = debouncedSearchQuery
            ? await searchPosts(debouncedSearchQuery, sortBy, currentPage)
            : await fetchPosts(sortBy, currentPage, lastVisibleId);
          
          // Only cache valid responses
          if (response && response.data) {
            forumCache.set(cacheKey, response);
          }
        }
        
        const { data, pagination } = response;

        // Store the last visible document ID for pagination
        if (pagination?.lastVisible) {
          setLastVisible(pagination.lastVisible);
          setPageHistory(prev => ({...prev, [currentPage]: pagination.lastVisible}));
          setHasMore(pagination.hasMore);
        } else {
          setHasMore(false);
        }

        // Process the data as before
        const formattedData = data.map((post: Record<string, any>) => ({
          id: post.id,
          title: post.title || '',
          content: post.content || '',
          category: post.category || '',
          image_url: post.image_url,
          video_url: post.video_url,
          likes_count: post.likes_count,
          comments_count: post.comments_count,
          createdAt: post.createdAt,
          user_name: post.user_name || '',
          user_id: post.user_id || '',
          is_liked: post.is_liked
        }));
        setPosts(formattedData || []);
        setSkeletonCount(formattedData?.length || 3);
      } catch (err) {
        console.error('Error loading posts:', err);
        setError('Failed to load posts. Please try again later.');
      } finally {
        setIsLoading(false);
        setInitialLoad(false);
      }
    };

    loadPosts();
  }, [sortBy, currentPage, debouncedSearchQuery]);

  const handleLike = async (postId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      // Optimistically update UI
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId
            ? {
                ...post,
                likes_count: post.likes_count + (post.is_liked ? -1 : 1),
                is_liked: !post.is_liked
              }
            : post
        )
      );
      
      // Call API to update like status
      const isLiked = await toggleLike('post', postId, user.id);
      
      // If response doesn't match our optimistic update, correct it
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId
            ? {
                ...post,
                likes_count: post.likes_count + (isLiked ? 1 : -1) - (post.is_liked ? 1 : 0),
                is_liked: isLiked
              }
            : post
        )
      );
      
      // Only invalidate related cache entries, not all forum cache
      const postKey = `post-${postId}`;
      forumCache.delete(postKey);
      
      // Only invalidate the current page in the cache
      const currentPageKey = debouncedSearchQuery 
        ? `search-${debouncedSearchQuery}-${sortBy}-page${currentPage}`
        : `posts-${sortBy}-page${currentPage}`;
      
      forumCache.delete(currentPageKey);
      
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on error
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId
            ? {
                ...post,
                likes_count: post.likes_count + (post.is_liked ? 1 : -1),
                is_liked: !post.is_liked
              }
            : post
        )
      );
    }
  };

  // Skeleton loader component for better UX during loading
  const PostSkeleton = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
          <div className="h-4 w-16 bg-gray-200 rounded"></div>
        </div>
        <div className="h-7 w-3/4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
        <div className="h-4 w-2/3 bg-gray-200 rounded mb-4"></div>
        <div className="h-48 w-full bg-gray-200 rounded-lg mb-4"></div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t">
          <div className="flex items-center space-x-4">
            <div className="h-5 w-14 bg-gray-200 rounded"></div>
            <div className="h-5 w-14 bg-gray-200 rounded"></div>
          </div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );

  if (isLoading && initialLoad) {
    return (
      <div className="space-y-6">
        {[...Array(skeletonCount)].map((_, index) => (
          <PostSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-md">
        <p className="text-gray-600">No posts yet. Be the first to share your story!</p>
      </div>
    );
  }

  // Add UI for cache monitoring info
  return (
    <>
      
      {/* Loading overlay for subsequent page loads */}
      {isLoading && !initialLoad && (
        <div className="fixed inset-0 bg-black/10 flex justify-center items-start z-10">
          <div className="mt-20 bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              <p>Refreshing posts...</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Your existing forum list rendering */}
      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full w-fit">
                  {post.category}
                </span>
                <span className="text-sm text-gray-500">
                  {formatTimeAgo(post.createdAt)}
                </span>
              </div>
              
              <Link to={`/forum/${post.id}`}>
                <h2 className="text-xl font-semibold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
                  {post.title}
                </h2>
              </Link>
              
              <p className="text-gray-600 mb-4">
                {post.content.length > 150 ? `${post.content.slice(0, 150)}...` : post.content}
              </p>

              {post.image_url && (
                <img
                  src={post.image_url}
                  alt="Post illustration"
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center space-x-1 ${
                      post.is_liked
                        ? 'text-indigo-600'
                        : 'text-gray-500 hover:text-indigo-600'
                    }`}
                  >
                    {post.is_liked ? (
                      <ThumbsUp className="h-5 w-5 fill-current" />
                    ) : (
                      <ThumbsUp className="h-5 w-5" />
                    )}
                    <span>{post.likes_count || 0}</span>
                  </button>
                  <div className="flex items-center space-x-1 text-gray-500">
                    <MessageSquare className="h-5 w-5" />
                    <span>{post.comments_count || 0}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Posted by <span className="font-medium">{post.user_name}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Pagination controls */}
      <div className="flex justify-center items-center mt-6 space-x-4">
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span>Page {currentPage}</span>
        <button
          onClick={() => setCurrentPage((p) => p + 1)}
          disabled={!hasMore} // Use hasMore instead of posts.length
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </>
  );
};

export default ForumList;

const formatTimeAgo = (timestamp: any) => {
  if (!timestamp) return '';
  
  let date;
  try {
    // Handle Firestore Timestamp objects
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    }
    // Handle serialized Firestore timestamps (with seconds and nanoseconds)
    else if (timestamp?.seconds !== undefined && timestamp?.nanoseconds !== undefined) {
      // Convert seconds to milliseconds for JavaScript Date
      date = new Date(timestamp.seconds * 1000);
    }
    // Handle other timestamp formats
    else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    }
    else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    else {
      date = new Date(timestamp);
    }
    
    // Additional validation for future dates (possible timezone issues)
    if (date > new Date(Date.now() + 86400000)) { // More than 1 day in the future
      console.warn('Future date detected, may be incorrect:', timestamp);
      return 'Recently';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date encountered:', timestamp);
      return 'Date unavailable';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    return date.toLocaleDateString();
  } catch (error) {
    console.error("Error formatting date:", error, timestamp);
    return 'Date unavailable';
  }
};