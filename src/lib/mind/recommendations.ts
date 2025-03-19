import { db } from '../common/firebase';
import { 
  collection, 
  addDoc, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  userCache, 
  getUserCacheKey,
  getUserSubcollection,
  getUserSubcollectionDoc,
  updateUserSubcollectionDoc
} from '../common/cache';
import { generateContentRecommendations } from '../common/openai';
import { fetchVideoResources, fetchWebResources } from '../common/google';

/**
 * Interface for content feedback
 */
export interface ContentFeedback {
  contentId: string;
  contentType: 'video' | 'website';
  contentTitle: string;
  contentUrl: string;
  isPositive: boolean;
  createdAt: any;
}

/**
 * Interface for content view tracking
 */
export interface ContentView {
  contentId: string;
  contentType: 'video' | 'website';
  contentTitle: string;
  contentUrl: string;
  createdAt: any;
}

/**
 * Interface for user content preferences
 */
export interface ContentPreferences {
  contentType?: string;
  formalityLevel?: number;
  specificRequest?: string;
  updatedAt: any;
}

/**
 * Interface for video recommendations
 */
export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  views?: number;
  likes?: number;
}

/**
 * Interface for website recommendations
 */
export interface Website {
  id: string;
  title: string;
  description: string;
  url: string;
  image: string;
  category: string;
}

/**
 * Save user feedback on content recommendation
 * @param userId User ID
 * @param contentId Content ID
 * @param contentType Type of content ('video' or 'website')
 * @param contentTitle Content title
 * @param contentUrl Content URL
 * @param isPositive Whether the feedback is positive
 * @returns Promise with the feedback ID
 */
export const saveContentFeedback = async (
  userId: string,
  contentId: string,
  contentType: 'video' | 'website',
  contentTitle: string,
  contentUrl: string,
  isPositive: boolean
): Promise<string> => {
  try {
    const feedbackCollection = collection(db, 'users', userId, 'uplift_contentFeedback');
    const feedbackDoc = await addDoc(feedbackCollection, {
      contentId,
      contentType,
      contentTitle,
      contentUrl,
      isPositive,
      createdAt: serverTimestamp()
    });
    
    // Invalidate related caches to ensure fresh data
    userCache.delete(`user-${userId}-uplift_contentFeedback-list`);
    userCache.delete(`${getUserCacheKey(userId)}-content-recommendations`);
    
    return feedbackDoc.id;
  } catch (error) {
    console.error('Error saving content feedback:', error);
    throw error;
  }
};

/**
 * Track user content view
 * @param userId User ID
 * @param contentId Content ID
 * @param contentType Type of content ('video' or 'website')
 * @param contentTitle Content title
 * @param contentUrl Content URL
 * @returns Promise with the view record ID
 */
export const trackContentView = async (
  userId: string,
  contentId: string,
  contentType: 'video' | 'website',
  contentTitle: string,
  contentUrl: string
): Promise<string> => {
  try {
    const viewsCollection = collection(db, 'users', userId, 'uplift_contentViews');
    const viewDoc = await addDoc(viewsCollection, {
      contentId,
      contentType,
      contentTitle,
      contentUrl,
      createdAt: serverTimestamp()
    });
    
    // No need to invalidate cache for views as they don't affect recommendations directly
    
    return viewDoc.id;
  } catch (error) {
    console.error('Error tracking content view:', error);
    throw error;
  }
};

/**
 * Save or update user content preferences
 * @param userId User ID
 * @param preferences Content preferences object
 * @returns Promise resolving when complete
 */
export const saveContentPreferences = async (
  userId: string,
  preferences: Partial<ContentPreferences>
): Promise<void> => {
  try {
    // Use updateUserSubcollectionDoc which handles both updates and creation
    await updateUserSubcollectionDoc(
      userId,
      'uplift_settings',
      'contentPreferences',
      {
        ...preferences,
        updatedAt: new Date() // serverTimestamp() will be applied by the function
      }
    );
    
    // Invalidate recommendations cache since preferences affect recommendations
    userCache.delete(`${getUserCacheKey(userId)}-content-recommendations`);
  } catch (error) {
    console.error('Error saving content preferences:', error);
    throw error;
  }
};

/**
 * Get user content preferences
 * @param userId User ID
 * @returns Promise with content preferences
 */
export const getContentPreferences = async (
  userId: string
): Promise<ContentPreferences | null> => {
  try {
    // Use getUserSubcollectionDoc which handles caching automatically
    const preferences = await getUserSubcollectionDoc(
      userId,
      'uplift_settings',
      'contentPreferences',
      30 * 60 * 1000 // 30 minute TTL for preferences
    );
    
    return preferences ? preferences as ContentPreferences : null;
  } catch (error) {
    console.error('Error getting content preferences:', error);
    return null;
  }
};

/**
 * Get user's feedback history for content recommendations
 * @param userId User ID
 * @returns Promise with liked and disliked topics
 */
export const getUserFeedbackHistory = async (
  userId: string
): Promise<{likedTopics: string[], dislikedTopics: string[]}> => {
  const cacheKey = `${getUserCacheKey(userId)}-feedback-history`;
  
  // Use getOrSet pattern with the userCache
  return userCache.getOrSet(cacheKey, async () => {
    try {
      // Use getUserSubcollection which handles caching automatically
      const feedbackData = await getUserSubcollection(
        userId,
        'uplift_contentFeedback',
        [orderBy('createdAt', 'desc'), limit(50)]
      ) as (ContentFeedback & { id: string })[];
      
      // Extract titles for liked and disliked content
      const likedTopics = feedbackData
        .filter(item => item.isPositive)
        .map(item => item.contentTitle)
        .slice(0, 20); // Limit to 20 most recent

      const dislikedTopics = feedbackData
        .filter(item => !item.isPositive)
        .map(item => item.contentTitle)
        .slice(0, 20); // Limit to 20 most recent
      
      return {
        likedTopics,
        dislikedTopics
      };
    } catch (error) {
      console.error('Error getting feedback history:', error);
      return { likedTopics: [], dislikedTopics: [] };
    }
  }, 10 * 60 * 1000); // 10 minute TTL for feedback history
};

/**
 * Determine website category based on title and description content
 * @param title Website title
 * @param description Website description
 * @returns Category label
 */
export const getWebsiteCategory = (title: string, description: string): string => {
  const content = (title + " " + description).toLowerCase();
  
  if (content.includes("meditation") || content.includes("mindful") || content.includes("relax")) {
    return "Mindfulness";
  } else if (content.includes("learn") || content.includes("guide") || content.includes("tutorial")) {
    return "Learning";
  } else if (content.includes("inspiration") || content.includes("motivat")) {
    return "Motivation";
  } else if (content.includes("hobby") || content.includes("craft") || content.includes("diy")) {
    return "Hobbies";
  } else if (content.includes("book") || content.includes("read")) {
    return "Reading";
  } else if (content.includes("exercise") || content.includes("fitness") || content.includes("workout")) {
    return "Fitness";
  } else if (content.includes("recipe") || content.includes("food") || content.includes("cook")) {
    return "Cooking";
  }
  
  return "Resource";
};

/**
 * Get mock videos for a specific MBTI type when API calls fail
 * @param mbtiType MBTI personality type
 * @returns Array of mock videos
 */
export const getMockVideos = (mbtiType: string): Video[] => {
  const videosByType: { [key: string]: Video[] } = {
    'INTJ': [
      {
        id: '1',
        title: 'The Science of Happiness: A Logical Approach',
        description: 'A data-driven exploration of what makes humans happy and how to apply these findings systematically.',
        thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643',
        url: 'https://youtube.com/watch?v=example1',
        views: 150000,
        likes: 12000
      },
    ],
    'INTP': [
      {
        id: '2',
        title: 'Understanding Emotions Through Psychology',
        description: 'A theoretical framework for analyzing and understanding emotional patterns.',
        thumbnail: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d',
        url: 'https://youtube.com/watch?v=example2',
        views: 120000,
        likes: 9500
      },
    ],
  };

  return videosByType[mbtiType] || [];
};

/**
 * Get mock websites for a specific MBTI type when API calls fail
 * @param mbtiType MBTI personality type
 * @returns Array of mock websites
 */
export const getMockWebsites = (mbtiType: string): Website[] => {
  const websitesByType: { [key: string]: Website[] } = {
    'INTJ': [
      {
        id: '1',
        title: 'Mind Journal Analytics',
        description: 'Track and analyze your mental patterns with data visualization.',
        url: 'https://example.com/mind-analytics',
        image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
        category: 'Mental Health'
      },
    ],
    'INTP': [
      {
        id: '2',
        title: 'Cognitive Psychology Resources',
        description: 'Deep dive into the theoretical foundations of mental well-being.',
        url: 'https://example.com/cognitive-psych',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3',
        category: 'Psychology'
      },
    ],
  };

  return websitesByType[mbtiType] || [];
};

/**
 * Get personalized content recommendations for a user
 * @param userId User ID
 * @param mbtiType User's MBTI personality type
 * @param moodData Recent mood data
 * @param preferences Content preferences
 * @param forceRefresh Whether to bypass cache and fetch fresh data
 * @returns Promise with recommended videos and websites
 */
export const getPersonalizedRecommendations = async (
  userId: string,
  mbtiType: string,
  moodData: { rating?: number; mood?: string; tags?: string[] },
  preferences: {
    contentType?: string;
    formalityLevel?: number;
    specificRequest?: string;
  },
  forceRefresh = false
): Promise<{ videos: Video[], websites: Website[] }> => {
  const cacheKey = `${getUserCacheKey(userId)}-content-recommendations`;
  
  // If forcing refresh, delete the cache entry first
  if (forceRefresh) {
    userCache.delete(cacheKey);
  }
  
  // Use getOrSet pattern with userCache
  return userCache.getOrSet(cacheKey, async () => {
    try {
      // Get user feedback history
      const feedbackHistory = await getUserFeedbackHistory(userId);
      
      // Generate personalized search queries
      const { videoQueries, websiteQueries } = await generateContentRecommendations(
        mbtiType,
        moodData,
        preferences,
        feedbackHistory
      );
      
      // Verify we have valid queries, otherwise use fallbacks
      const validVideoQueries = videoQueries?.length > 0 ? videoQueries : ['mindfulness practice', 'positive psychology'];
      const validWebsiteQueries = websiteQueries?.length > 0 ? websiteQueries : ['wellbeing resources', 'personal growth'];
      
      // Fetch resources in parallel for better performance
      const [videoResults, websiteResults] = await Promise.all([
        Promise.all(validVideoQueries.map(query => fetchVideoResources(query, 2))),
        Promise.all(validWebsiteQueries.map(query => fetchWebResources(query, 2)))
      ]);
      
      // Flatten and deduplicate results
      const allVideos = videoResults.flat();
      const allWebsites = websiteResults.flat();
      
      // Convert to our interface format and deduplicate by URL
      const uniqueVideos = Array.from(
        new Map(allVideos.map(video => [video.url, {
          id: video.videoId,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnail,
          url: video.url,
          views: video.viewCount,
          likes: video.likeCount
        }])).values()
      );
      
      const uniqueWebsites = Array.from(
        new Map(allWebsites.map((website, index) => [website.url, {
          id: `website-${index}`,
          title: website.title,
          description: website.description,
          url: website.url,
          image: website.thumbnail || 'https://placehold.co/600x400?text=No+Image',
          category: getWebsiteCategory(website.title, website.description)
        }])).values()
      );
      
      // Create the final recommendations object
      const recommendations = {
        videos: uniqueVideos.slice(0, 6), // Limit to 6
        websites: uniqueWebsites.slice(0, 6) // Limit to 6
      };
      
      return recommendations;
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      
      // Return mock data as fallback
      return {
        videos: getMockVideos(mbtiType),
        websites: getMockWebsites(mbtiType)
      };
    }
  }, 15 * 60 * 1000); // 15 minute TTL for recommendations
};