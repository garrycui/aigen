import axios from 'axios';

export interface WebResource {
  title: string;
  url: string;
  description: string;
  thumbnail?: string;
}

export interface VideoResource {
  title: string;
  url: string;
  description: string;
  thumbnail: string;
  videoId: string;
  viewCount?: number;
  likeCount?: number;
}

// Simple cache for API results
const resourceCache = new Map<string, {data: any, timestamp: number}>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get data from cache or fetch from API
 */
const getCachedData = <T>(key: string, fetchFn: () => Promise<T>): Promise<T> => {
  const cached = resourceCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return Promise.resolve(cached.data);
  }
  
  return fetchFn().then(data => {
    resourceCache.set(key, { data, timestamp: Date.now() });
    return data;
  });
};

/**
 * Fetch web resources using Google Custom Search API
 * @param query Search query for web resources
 * @param limit Maximum number of results to return (default: 5)
 * @returns Promise containing an array of WebResource objects
 */
export const fetchWebResources = async (query: string, limit: number = 5): Promise<WebResource[]> => {
  const cacheKey = `web-${query}-${limit}`;
  
  return getCachedData<WebResource[]>(cacheKey, async () => {
    try {
      const sanitizedQuery = query.replace(/^["'](.*)["']$/, '$1');
      const params: any = {
        key: import.meta.env.VITE_GOOGLE_API_KEY,
        cx: import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID,
        q: sanitizedQuery,
        num: limit,
      };

      const response = await axios.get('https://www.googleapis.com/customsearch/v1', { params });

      if (!response.data.items) {
        return [];
      }

      // Default thumbnail for web resources when none is available
      const defaultThumbnail = "https://placehold.co/600x400?text=No+Image";

      return response.data.items.map((item: any) => {
        const resource = {
          title: item.title || 'Untitled Resource',
          url: item.link,
          description: item.snippet || 'No description available',
          thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || 
                     item.pagemap?.cse_image?.[0]?.src || 
                     defaultThumbnail,
        };
        return resource;
      });
    } catch (error) {
      console.error('Error fetching web resources:', error);
      return [];
    }
  });
};

/**
 * Fetch video resources using YouTube Data API
 * @param query Search query for video resources
 * @param limit Maximum number of results to return (default: 3)
 * @returns Promise containing an array of VideoResource objects
 */
export const fetchVideoResources = async (query: string, limit: number = 3): Promise<VideoResource[]> => {
  const cacheKey = `video-${query}-${limit}`;
  
  return getCachedData<VideoResource[]>(cacheKey, async () => {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: import.meta.env.VITE_YOUTUBE_API_KEY,
          q: query,
          part: 'snippet',
          type: 'video',
          videoEmbeddable: true,
          videoDefinition: 'high',
          maxResults: limit
        }
      });

      const videos = response.data.items.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.high.url
      }));
      
      // Fetch additional video details (viewCount, likeCount)
      if (videos.length > 0) {
        const videoIds = videos.map((video: VideoResource) => video.videoId).join(',');
        const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            key: import.meta.env.VITE_YOUTUBE_API_KEY,
            id: videoIds,
            part: 'statistics'
          }
        });
        
        detailsResponse.data.items.forEach((item: any) => {
          const video = videos.find((v: VideoResource) => v.videoId === item.id);
          if (video) {
            video.viewCount = parseInt(item.statistics.viewCount);
            video.likeCount = parseInt(item.statistics.likeCount || '0');
          }
        });
      }

      return videos;
    } catch (error) {
      console.error('Error fetching video resources:', error);
      return [];
    }
  });
};

/**
 * Fetch personalized video resources using YouTube Data API with user preferences
 * @param topics Array of topic strings for personalized search
 * @param userPreferences User preferences including MBTI, interests, etc.
 * @param limit Maximum number of results to return (default: 8)
 * @returns Promise containing an array of VideoResource objects
 */
export const fetchPersonalizedVideoResources = async (
  topics: string[], 
  userPreferences: {
    mbtiType?: string;
    focusAreas?: string[];
    primaryInterests?: string[];
  },
  limit: number = 8
): Promise<VideoResource[]> => {
  const cacheKey = `personalized-video-${topics.join('-')}-${limit}`;
  
  return getCachedData<VideoResource[]>(cacheKey, async () => {
    try {
      // Build enhanced query with user preferences
      let query = topics.join(' ');
      
      // Add positive content filters
      query += ' positive motivation wellbeing happiness';
      
      // Add MBTI-specific terms if available
      if (userPreferences.mbtiType) {
        const mbtiKeywords = getMBTIKeywords(userPreferences.mbtiType);
        query += ` ${mbtiKeywords}`;
      }

      const publishedAfter = new Date();
      publishedAfter.setDate(publishedAfter.getDate() - 30); // Last 30 days

      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: import.meta.env.VITE_YOUTUBE_API_KEY,
          q: query,
          part: 'snippet',
          type: 'video',
          videoEmbeddable: true,
          videoDefinition: 'high',
          maxResults: limit,
          publishedAfter: publishedAfter.toISOString(),
          relevanceLanguage: 'en',
          safeSearch: 'moderate',
          order: 'relevance'
        }
      });

      const videos = response.data.items.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.high.url
      }));
      
      // Fetch additional video details if needed
      if (videos.length > 0) {
        const videoIds = videos.map((video: VideoResource) => video.videoId).join(',');
        const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            key: import.meta.env.VITE_YOUTUBE_API_KEY,
            id: videoIds,
            part: 'statistics'
          }
        });
        
        detailsResponse.data.items.forEach((item: any) => {
          const video = videos.find((v: VideoResource) => v.videoId === item.id);
          if (video) {
            video.viewCount = parseInt(item.statistics.viewCount);
            video.likeCount = parseInt(item.statistics.likeCount || '0');
          }
        });
      }

      return videos;
    } catch (error) {
      console.error('Error fetching personalized video resources:', error);
      return [];
    }
  });
};

// Helper function to get MBTI-specific keywords
function getMBTIKeywords(mbtiType: string): string {
  const keywordMap: Record<string, string> = {
    'E': 'social community group',
    'I': 'personal reflection introspection',
    'N': 'creative innovation future',
    'S': 'practical hands-on real',
    'T': 'logical analytical thinking',
    'F': 'emotional empathy feelings',
    'J': 'organized structured planning',
    'P': 'flexible spontaneous exploration'
  };

  return mbtiType.split('').map(letter => keywordMap[letter] || '').join(' ');
}

/**
 * Clear cached resource data
 */
export const clearResourceCache = () => {
  resourceCache.clear();
};