import axios from 'axios';
import type { UnifiedPersonalizationProfile } from '../personalization/types';

// Circuit breaker for quota management
let quotaExceeded = false;
let quotaExceededAt = 0;
const QUOTA_RESET_HOURS = 24;

export interface YouTubeVideo {
  videoId: string;
  title: string;
  snippet: string;
  thumbnail: string;
  url: string;
  embedUrl: string; // NEW: Direct embed URL for in-app playbook
  channelTitle?: string;
  publishedAt?: string;
  viewCount?: string;
  likeCount?: string;
  duration?: string;
  isEmbeddable: boolean; // NEW: Ensure video can be embedded
  // Enhanced metadata for personalization
  searchQuery?: string; // Which query found this video
  relevanceScore?: number; // How relevant to user (1-10)
  topicTags?: string[]; // Extracted topics
  permaDimension?: string; // Which PERMA dimension this serves
  recommendationReason?: string; // Why this was recommended
}

export interface VideoSection {
  topicName: string;
  description: string;
  videos: YouTubeVideo[];
  permaDimension: string;
  priority: number;
  generatedAt?: string;
  searchQueries?: string[];
}

export interface UnifiedVideoResponse {
  videos: YouTubeVideo[];
  hasMore: boolean;
  nextPageToken?: string;
  totalResults: number;
  searchContext: {
    queries: string[];
    basedOnInteractions: boolean;
    personalizedLevel: 'high' | 'medium' | 'low';
  };
}

// Enhanced YouTube API search with better quality and language support
export async function searchYouTubeVideos(
  searchTerms: string[], 
  maxResults: number = 15, // Increased from 8
  additionalFilters?: string,
  options?: {
    language?: string;
    region?: string;
    publishedAfter?: Date;
    minDuration?: string; // 'short' | 'medium' | 'long'
    quality?: 'any' | 'high';
    relevanceLanguage?: string;
  }
): Promise<YouTubeVideo[]> {
  // Check quota circuit breaker first
  if (quotaExceeded) {
    const hoursElapsed = (Date.now() - quotaExceededAt) / (1000 * 60 * 60);
    if (hoursElapsed < QUOTA_RESET_HOURS) {
      console.warn('🚫 [VideoRecommender] API quota exceeded, skipping search until reset');
      return [];
    } else {
      // Reset quota after 24 hours
      console.log('🔄 [VideoRecommender] Quota reset period elapsed, re-enabling API calls');
      quotaExceeded = false;
      quotaExceededAt = 0;
    }
  }

  try {
    console.log('🎬 [VideoRecommender] Enhanced search with terms:', searchTerms);
    console.log('🌍 [VideoRecommender] Search options:', options);
    
    const YOUTUBE_API_KEY = 'AIzaSyCFCUsnGGYXbhvpj8wC_gcC0DB3BDphuGE';
    const apiKey = YOUTUBE_API_KEY;
  
    if (!apiKey) {
      console.error('❌ [VideoRecommender] YouTube API key not found');
      return [];
    }
    
    // Enhanced query construction with language and quality indicators
    const baseQuery = searchTerms.join(' ');
    const qualityTerms = options?.quality === 'high' 
      ? ' tutorial guide tips high quality' 
      : ' tutorial guide';
    const query = `${baseQuery}${qualityTerms}${additionalFilters ? ` ${additionalFilters}` : ''}`;
    
    console.log('🔍 [VideoRecommender] Final search query:', query);
    
    // Smart date range - more recent for trending topics, broader for educational content
    const publishedAfter = options?.publishedAfter || (() => {
      const date = new Date();
      const isEducational = baseQuery.includes('tutorial') || baseQuery.includes('guide') || baseQuery.includes('how to');
      date.setDate(date.getDate() - (isEducational ? 730 : 365)); // 2 years for educational, 1 year for others
      return date;
    })();

    console.log('📅 [VideoRecommender] Published after:', publishedAfter.toISOString());

    // Enhanced search parameters - less restrictive to get more results
    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: apiKey,
        q: query,
        part: 'snippet',
        type: 'video',
        maxResults: Math.min(maxResults * 3, 50), // Get 3x more results for better filtering, up to 50
        // Remove restrictive filters that might be causing 0 results
        // videoEmbeddable: 'true',
        // videoSyndicated: 'true',
        videoDefinition: 'any', // Include both HD and SD
        // videoDuration: options?.minDuration || 'medium', // Remove duration restriction
        publishedAfter: publishedAfter.toISOString(),
        relevanceLanguage: options?.relevanceLanguage || options?.language || 'en',
        safeSearch: 'moderate',
        order: 'relevance', // Relevance over recency for quality
        regionCode: options?.region || 'US',
        // Enhanced parameters for quality
        fields: 'items(id,snippet(title,description,channelTitle,publishedAt,thumbnails))',
      },
      timeout: 15000 // Increased timeout for better results
    });

    console.log('📺 [VideoRecommender] YouTube search response:', searchResponse.data?.items?.length || 0, 'videos');
    console.log('📋 [VideoRecommender] YouTube API response status:', searchResponse.status);
    
    if (searchResponse.data?.error) {
      console.error('🚨 [VideoRecommender] YouTube API Error:', searchResponse.data.error);
      return [];
    }

    const videoItems = searchResponse.data.items || [];
    if (videoItems.length === 0) {
      console.warn('⚠️ [VideoRecommender] No video items returned from search');
      return [];
    }

    const videoIds = videoItems.map((item: any) => item.id.videoId).join(',');
    console.log('🆔 [VideoRecommender] Video IDs to fetch details for:', videoIds.substring(0, 100) + '...');

    // Get detailed video information with enhanced filtering
    const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: apiKey,
        id: videoIds,
        part: 'snippet,statistics,contentDetails,status',
        maxResults: 50
      },
      timeout: 15000
    });

    console.log('📊 [VideoRecommender] Video details response:', detailsResponse.data?.items?.length || 0, 'videos');

    const videos = detailsResponse.data.items
      .filter((item: any) => {
        // Enhanced filtering for embeddable videos
        const stats = item.statistics;
        const hasBasicEngagement = parseInt(stats?.viewCount || '0') > 500; // Slightly higher threshold
        const isPublic = item.status?.privacyStatus === 'public';
        const isEmbeddable = item.status?.embeddable !== false; // Allow if not explicitly false
        const notBlocked = !item.contentDetails?.regionRestriction?.blocked?.includes(options?.region || 'US');
        
        // Check if video allows syndication (helps with embedding)
        const allowsSyndication = item.status?.publicStatsViewable !== false;
        
        // Prioritize videos with good engagement
        const hasGoodEngagement = parseInt(stats?.likeCount || '0') > 5 || 
                                 parseInt(stats?.commentCount || '0') > 2;
        
        console.log(`🔍 [VideoRecommender] Video ${item.id}: embeddable=${isEmbeddable}, public=${isPublic}, engagement=${hasGoodEngagement}`);
        
        return isPublic && hasBasicEngagement && notBlocked && (isEmbeddable || allowsSyndication);
      })
      .map((item: any): YouTubeVideo => {
        // Calculate relevance score based on video metadata
        const relevanceScore = calculateRelevanceScore(
          item, 
          searchTerms, 
          options?.language || 'en'
        );
        
        const topicTags = extractVideoTopics(item.snippet.title, item.snippet.description);
        
        return {
          videoId: item.id,
          title: item.snippet.title,
          snippet: (item.snippet.description?.substring(0, 300) + '...' || 'No description available'),
          thumbnail: item.snippet.thumbnails?.maxres?.url ||
                     item.snippet.thumbnails?.high?.url || 
                     item.snippet.thumbnails?.medium?.url || 
                     item.snippet.thumbnails?.default?.url,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          embedUrl: `https://www.youtube.com/embed/${item.id}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&fs=1&autoplay=0&origin=*`,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          viewCount: item.statistics?.viewCount,
          likeCount: item.statistics?.likeCount,
          duration: item.contentDetails?.duration,
          isEmbeddable: item.status?.embeddable !== false, // True if not explicitly false
          // Enhanced metadata
          searchQuery: baseQuery,
          relevanceScore,
          topicTags,
          recommendationReason: `Found via search: "${baseQuery}"`
        };
      })
      .sort((a: any, b: any) => (b.relevanceScore || 0) - (a.relevanceScore || 0)) // Sort by relevance
      .slice(0, maxResults);

    console.log('✅ [VideoRecommender] Final processed videos:', videos.length);
    console.log('📊 [VideoRecommender] Sample video titles:', videos.slice(0, 3).map((v: YouTubeVideo) => v.title));
    
    if (videos.length > 0) {
      console.log('📊 [VideoRecommender] Average relevance score:', 
        videos.reduce((sum: number, v: YouTubeVideo) => sum + (v.relevanceScore || 0), 0) / videos.length);
    }
    
    return videos;

  } catch (error) {
    console.error('❌ [VideoRecommender] Error searching YouTube videos:', error);
    
    // Check for quota exceeded error and activate circuit breaker
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      const errorMessage = error.response?.data?.error?.message || '';
      if (errorMessage.includes('quota')) {
        console.error('🚫 [VideoRecommender] YouTube API quota exceeded - activating circuit breaker');
        quotaExceeded = true;
        quotaExceededAt = Date.now();
      }
    }
    
    if (axios.isAxiosError(error)) {
      console.error('📋 [VideoRecommender] YouTube API Error Details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          params: error.config?.params
        }
      });
    }
    return [];
  }
}

// UPDATED: Use pre-generated search queries from topicSearchQueries
export async function getPersonalizedVideoSections(
  personalization: UnifiedPersonalizationProfile,
  useFirebase: any
): Promise<VideoSection[]> {
  try {
    console.log('🎯 [VideoRecommender] Getting personalized video sections');
    console.log('📊 [VideoRecommender] Profile info:', {
      userId: personalization.userId,
      topicQueriesCount: Object.keys(personalization.contentPreferences.topicSearchQueries || {}).length,
      primaryInterestsCount: personalization.contentPreferences.primaryInterests.length
    });
    
    const sections: VideoSection[] = [];
    
    // Use existing topicSearchQueries from the personalization profile
    const topicSearchQueries = personalization.contentPreferences.topicSearchQueries || {};
    
    if (Object.keys(topicSearchQueries).length === 0) {
      console.log('⚠️ [VideoRecommender] No topic search queries found, using fallback');
      return await createFallbackVideoSections(personalization);
    }

    // Convert topicSearchQueries to video sections with proper type safety
    const topicEntries = Object.entries(topicSearchQueries)
      .sort(([,a], [,b]) => (b.priority || 0) - (a.priority || 0)) // Fix: Handle undefined priority
      .slice(0, 6); // Limit to top 6 topics for better performance

    console.log('📝 [VideoRecommender] Processing topics:', topicEntries.map(([name]) => name));

    // Process topics in batches to avoid rate limiting
    for (const [topicName, topicData] of topicEntries) {
      try {
        console.log(`🔍 [VideoRecommender] Fetching videos for: "${topicName}"`);
        console.log(`📋 [VideoRecommender] Using queries:`, topicData.queries);
        
        // Ensure queries exist and are valid
        if (!topicData.queries || !Array.isArray(topicData.queries) || topicData.queries.length === 0) {
          console.warn(`⚠️ [VideoRecommender] No valid queries for topic: "${topicName}"`);
          continue;
        }
        
        const videos = await searchYouTubeVideos(
          topicData.queries,
          (topicData.priority || 5) >= 8 ? 8 : 6, // Fix: Handle undefined priority
          'tutorial motivation positive' // Additional filter for quality content
        );

        if (videos.length > 0) {
          const section: VideoSection = {
            topicName: formatTopicName(topicName),
            description: generateSectionDescription(topicName, topicData.permaDimension || 'engagement'), // Fix: Handle undefined permaDimension
            videos,
            permaDimension: topicData.permaDimension || 'engagement', // Fix: Handle undefined permaDimension
            priority: topicData.priority || 5, // Fix: Handle undefined priority
            generatedAt: new Date().toISOString(),
            searchQueries: topicData.queries
          };
          
          sections.push(section);
          console.log(`✅ [VideoRecommender] Created section "${section.topicName}" with ${videos.length} embeddable videos`);
        } else {
          console.log(`⚠️ [VideoRecommender] No embeddable videos found for topic: "${topicName}"`);
        }
        
        // Add small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ [VideoRecommender] Error fetching videos for topic ${topicName}:`, error);
      }
    }

    console.log(`🎉 [VideoRecommender] Created ${sections.length} video sections`);
    return sections;

  } catch (error) {
    console.error('❌ [VideoRecommender] Error getting personalized video sections:', error);
    return await createFallbackVideoSections(personalization);
  }
}

// UPDATED: Fallback that doesn't regenerate topics, uses basic interest mapping
async function createFallbackVideoSections(
  personalization: UnifiedPersonalizationProfile
): Promise<VideoSection[]> {
  console.log('🔄 [VideoRecommender] Creating fallback video sections');
  
  const sections: VideoSection[] = [];
  
  try {
    // 1. Focus areas get priority (areas needing improvement)
    for (const [index, focusArea] of personalization.wellnessProfile.focusAreas.entries()) {
      const focusQueries = getFallbackQueriesForDimension(focusArea);
      if (focusQueries) {
        const videos = await searchYouTubeVideos(focusQueries, 6);
        if (videos.length > 0) {
          sections.push({
            topicName: `${formatDimensionName(focusArea)} Boost`,
            description: generateSectionDescription(`${focusArea}_boost`, focusArea),
            videos,
            permaDimension: focusArea,
            priority: 10 - index,
            generatedAt: new Date().toISOString(),
            searchQueries: focusQueries
          });
        }
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 2. Primary interests (engagement)
    for (const [index, interest] of personalization.contentPreferences.primaryInterests.slice(0, 2).entries()) {
      const interestQueries = [
        `${interest} beginner tutorial`,
        `${interest} motivation tips`,
        `${interest} guide positive`
      ];
      
      const videos = await searchYouTubeVideos(interestQueries, 5);
      if (videos.length > 0) {
        sections.push({
          topicName: `${interest} Learning`,
          description: generateSectionDescription(interest, 'engagement'),
          videos,
          permaDimension: 'engagement',
          priority: 6 - index,
          generatedAt: new Date().toISOString(),
          searchQueries: interestQueries
        });
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 3. General wellbeing if we don't have enough sections
    if (sections.length < 2) {
      const wellbeingQueries = ['daily happiness habits positive', 'motivation inspiration success'];
      const videos = await searchYouTubeVideos(wellbeingQueries, 6);
      if (videos.length > 0) {
        sections.push({
          topicName: 'General Wellbeing',
          description: 'Content to support your overall happiness and wellbeing 🌟',
          videos,
          permaDimension: 'positiveEmotion',
          priority: 5,
          generatedAt: new Date().toISOString(),
          searchQueries: wellbeingQueries
        });
      }
    }
    
  } catch (error) {
    console.error('❌ [VideoRecommender] Error creating fallback sections:', error);
  }
  
  console.log(`✅ [VideoRecommender] Created ${sections.length} fallback sections`);
  return sections.sort((a, b) => b.priority - a.priority);
}

// Helper: Get basic search queries for PERMA dimensions
function getFallbackQueriesForDimension(dimension: string): string[] | null {
  const dimensionQueries: Record<string, string[]> = {
    positiveEmotion: [
      'daily happiness habits positive',
      'mood boosting meditation', 
      'positive psychology motivation'
    ],
    engagement: [
      'finding passion purpose tutorial',
      'flow state productivity tips',
      'engaging hobby creative'
    ],
    relationships: [
      'building relationships communication',
      'social connection friendship tips', 
      'relationship advice positive'
    ],
    meaning: [
      'finding life purpose meaning',
      'meaningful living philosophy',
      'values clarification personal growth'
    ],
    accomplishment: [
      'goal achievement success strategies',
      'productivity habits successful',
      'confidence building motivation'
    ]
  };
  
  return dimensionQueries[dimension] || null;
}

// Helper: Format topic names for display
function formatTopicName(topicName: string): string {
  return topicName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper: Format dimension names for display
function formatDimensionName(dimension: string): string {
  const dimensionNames: Record<string, string> = {
    positiveEmotion: 'Mood',
    engagement: 'Engagement', 
    relationships: 'Connection',
    meaning: 'Purpose',
    accomplishment: 'Achievement'
  };
  
  return dimensionNames[dimension] || dimension;
}

// Generate friendly section descriptions
export function generateSectionDescription(topicName: string, permaDimension: string): string {
  const descriptions: Record<string, string> = {
    positiveEmotion: 'Videos to brighten your day and boost your mood 🌟',
    engagement: 'Content to spark your curiosity and passion 🔥', 
    relationships: 'Stories about connection and community 💝',
    meaning: 'Inspiring content for purpose and growth 🌱',
    accomplishment: 'Motivational videos for your goals and success 🎯'
  };

  const baseDescription = descriptions[permaDimension] || 'Curated content just for you ✨';
  
  if (topicName.includes('boost') || topicName.includes('Boost')) {
    return `${baseDescription} - Focused on improving your ${formatDimensionName(permaDimension).toLowerCase()}`;
  }
  if (topicName.includes('learning') || topicName.includes('Learning')) {
    return `${baseDescription} - Learn and grow in your interests`;
  }
  if (topicName.includes('focus')) {
    return `${baseDescription} - Targeted content for your focus area`;
  }
  
  return `${baseDescription} - Personalized for ${topicName.toLowerCase()}`;
}

// REMOVED: Legacy functions that are no longer needed
// - generatePersonalizedSearchTopics (now handled by topicGenerator)
// - profileToTopicRequest (now in topicGenerator)
// - refreshTopicsInBackground (topics are generated once by topicGenerator)
// - createBasicFallbackTopics (replaced with createFallbackVideoSections)

// Legacy function for backward compatibility (if needed elsewhere)
export async function getPersonalizedYouTubeVideos({
  mbti,
  perma,
  interests
}: {
  mbti?: string;
  perma?: any;
  interests?: string[];
}): Promise<YouTubeVideo[]> {
  console.log('⚠️ [VideoRecommender] Legacy function called - use getPersonalizedVideoSections instead');
  return [];
}

// NEW: Enhanced unified video recommendation with intelligent mixing
export async function getIntelligentPersonalizedVideos(
  personalization: UnifiedPersonalizationProfile,
  hybridQueries: { profileQueries: string[]; behaviorQueries: string[]; explorationQueries: string[] },
  mixingRatio: { profileWeight: number; behaviorWeight: number; explorationWeight: number },
  options: {
    pageSize?: number;
    userLanguage?: string;
  } = {}
): Promise<UnifiedVideoResponse> {
  const { pageSize = 30, userLanguage = 'en' } = options;
  
  // Check quota status before starting
  const quotaStatus = getQuotaStatus();
  if (quotaStatus.isExceeded) {
    console.warn('🚫 [IntelligentRec] YouTube API quota exceeded, returning empty response');
    return {
      videos: [],
      hasMore: false,
      totalResults: 0,
      searchContext: {
        queries: [],
        basedOnInteractions: false,
        personalizedLevel: 'low' as 'high' | 'medium' | 'low'
      }
    };
  }
  
  try {
    console.log('🧠 [IntelligentRec] Generating videos with mixing ratio:', mixingRatio);
    
    const allVideos: YouTubeVideo[] = [];
    
    // Calculate how many videos from each source
    const profileCount = Math.floor(pageSize * mixingRatio.profileWeight);
    const behaviorCount = Math.floor(pageSize * mixingRatio.behaviorWeight);
    const explorationCount = pageSize - profileCount - behaviorCount;
    
    console.log('📊 [IntelligentRec] Video distribution:', {
      profile: profileCount,
      behavior: behaviorCount,
      exploration: explorationCount
    });

    const searchOptions = {
      language: userLanguage,
      region: getRegionFromLanguage(userLanguage),
      quality: 'any' as 'any' | 'high',
      relevanceLanguage: userLanguage
    };

    // Get profile-based videos
    if (profileCount > 0 && hybridQueries.profileQueries.length > 0) {
      try {
        const profileVideos = await searchYouTubeVideos(
          hybridQueries.profileQueries.slice(0, 3),
          profileCount + 5, // Buffer for filtering
          'high quality educational',
          searchOptions
        );
        
        const enhancedProfileVideos = profileVideos.slice(0, profileCount).map(video => ({
          ...video,
          recommendationReason: 'Based on your interests and goals',
          relevanceScore: (video.relevanceScore || 5) + 1 // Boost profile videos slightly
        }));
        
        allVideos.push(...enhancedProfileVideos);
        console.log(`✅ [IntelligentRec] Added ${enhancedProfileVideos.length} profile videos`);
      } catch (error) {
        console.warn('⚠️ [IntelligentRec] Profile video search failed:', error);
      }
    }

    // Get behavior-based videos
    if (behaviorCount > 0 && hybridQueries.behaviorQueries.length > 0) {
      try {
        const behaviorVideos = await searchYouTubeVideos(
          hybridQueries.behaviorQueries.slice(0, 3),
          behaviorCount + 5,
          'similar trending',
          searchOptions
        );
        
        const enhancedBehaviorVideos = behaviorVideos.slice(0, behaviorCount).map(video => ({
          ...video,
          recommendationReason: 'Based on what you\'ve enjoyed watching',
          relevanceScore: (video.relevanceScore || 5) + 2 // Boost behavior videos more
        }));
        
        allVideos.push(...enhancedBehaviorVideos);
        console.log(`✅ [IntelligentRec] Added ${enhancedBehaviorVideos.length} behavior videos`);
      } catch (error) {
        console.warn('⚠️ [IntelligentRec] Behavior video search failed:', error);
      }
    }

    // Get exploration videos
    if (explorationCount > 0) {
      try {
        const explorationVideos = await searchYouTubeVideos(
          hybridQueries.explorationQueries.slice(0, 2),
          explorationCount + 3,
          'trending popular',
          searchOptions
        );
        
        const enhancedExplorationVideos = explorationVideos.slice(0, explorationCount).map(video => ({
          ...video,
          recommendationReason: 'Discover something new',
          relevanceScore: video.relevanceScore || 5
        }));
        
        allVideos.push(...enhancedExplorationVideos);
        console.log(`✅ [IntelligentRec] Added ${enhancedExplorationVideos.length} exploration videos`);
      } catch (error) {
        console.warn('⚠️ [IntelligentRec] Exploration video search failed:', error);
      }
    }

    // If we don't have enough videos, add some fallback content
    if (allVideos.length < pageSize * 0.3) {
      console.log('📦 [IntelligentRec] Adding fallback content');
      try {
        const fallbackVideos = await searchYouTubeVideos(
          ['personal development', 'wellness', 'productivity tips'],
          pageSize - allVideos.length,
          'tutorial guide',
          searchOptions
        );
        allVideos.push(...fallbackVideos);
      } catch (error) {
        console.warn('⚠️ [IntelligentRec] Fallback search failed:', error);
      }
    }

    // Remove duplicates and shuffle intelligently
    const uniqueVideos = Array.from(
      new Map(allVideos.map(video => [video.videoId, video])).values()
    );

    const shuffledVideos = intelligentShuffle(uniqueVideos, mixingRatio);

    console.log(`🎯 [IntelligentRec] Generated ${shuffledVideos.length} intelligent videos`);
    
    return {
      videos: shuffledVideos.slice(0, pageSize),
      hasMore: shuffledVideos.length >= pageSize,
      totalResults: shuffledVideos.length,
      searchContext: {
        queries: [
          ...hybridQueries.profileQueries.slice(0, 2),
          ...hybridQueries.behaviorQueries.slice(0, 2),
          ...hybridQueries.explorationQueries.slice(0, 1)
        ],
        basedOnInteractions: true,
        personalizedLevel: 'high' as 'high' | 'medium' | 'low'
      }
    };
    
  } catch (error) {
    console.error('❌ [IntelligentRec] Error generating intelligent videos:', error);
    
    // Fallback to simple recommendation
    console.warn('⚠️ [IntelligentRec] Falling back to simple recommendations');
    const fallbackQueries = [
      ...hybridQueries.profileQueries.slice(0, 2),
      ...hybridQueries.behaviorQueries.slice(0, 2),
      'tutorial guide tips'
    ];
    
    const fallbackSearchOptions = {
      language: userLanguage,
      region: getRegionFromLanguage(userLanguage),
      quality: 'any' as 'any' | 'high',
      relevanceLanguage: userLanguage
    };
    
    const fallbackVideos = await searchYouTubeVideos(
      fallbackQueries,
      pageSize,
      'quality educational',
      fallbackSearchOptions
    );
    
    return {
      videos: fallbackVideos,
      hasMore: fallbackVideos.length === pageSize,
      totalResults: fallbackVideos.length,
      searchContext: {
        queries: fallbackQueries,
        basedOnInteractions: true,
        personalizedLevel: 'medium' as 'high' | 'medium' | 'low'
      }
    };
  }
}

// Helper function to extract topic tags from video content
function extractTopicTags(title: string, description: string): string[] {
  const text = `${title} ${description || ''}`.toLowerCase();
  const topics: string[] = [];
  
  const topicMap = {
    'productivity': ['productivity', 'efficient', 'organize', 'time management', 'productivity'],
    'wellness': ['wellness', 'health', 'mindfulness', 'meditation', 'self-care', 'mental health'],
    'learning': ['tutorial', 'guide', 'how to', 'learn', 'education', 'course', 'lesson'],
    'motivation': ['motivation', 'inspiration', 'success', 'goals', 'achievement', 'motivational'],
    'relationships': ['relationship', 'communication', 'social', 'friendship', 'dating'],
    'creativity': ['creative', 'art', 'design', 'innovation', 'imagination', 'artistic'],
    'technology': ['tech', 'digital', 'software', 'app', 'computer', 'coding'],
    'fitness': ['fitness', 'exercise', 'workout', 'training', 'gym', 'health'],
    'finance': ['money', 'finance', 'investment', 'budget', 'financial', 'wealth'],
    'cooking': ['cooking', 'recipe', 'food', 'kitchen', 'chef', 'meal']
  };
  
  Object.entries(topicMap).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => text.includes(keyword))) {
      topics.push(topic);
    }
  });
  
  return topics;
}

// Helper function to calculate video relevance score
function calculateVideoRelevance(video: any, query: string): number {
  let score = 5; // Base score
  
  const title = video.snippet?.title?.toLowerCase() || '';
  const description = video.snippet?.description?.toLowerCase() || '';
  const queryWords = query.toLowerCase().split(' ');
  
  // Title relevance (higher weight)
  queryWords.forEach(word => {
    if (title.includes(word)) score += 1.5;
    if (description.includes(word)) score += 0.5;
  });
  
  // Engagement metrics
  const views = parseInt(video.statistics?.viewCount || '0');
  const likes = parseInt(video.statistics?.likeCount || '0');
  
  if (views > 1000) score += 0.5;
  if (views > 10000) score += 0.5;
  if (views > 100000) score += 0.5;
  if (likes > 50) score += 0.5;
  if (likes > 500) score += 0.5;
  
  // Recency bonus
  if (video.snippet?.publishedAt) {
    const publishDate = new Date(video.snippet.publishedAt);
    const daysSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePublish < 7) score += 1;      // Very recent
    else if (daysSincePublish < 30) score += 0.5;  // Recent
    else if (daysSincePublish < 90) score += 0.2;  // Somewhat recent
  }
  
  // Quality indicators
  if (title.includes('tutorial') || title.includes('guide')) score += 0.5;
  if (title.includes('beginner') || title.includes('tips')) score += 0.3;
  
  return Math.min(10, Math.max(1, score));
}

// Enhanced intelligent shuffle function
function intelligentShuffle(videos: YouTubeVideo[], mixingRatio: any): YouTubeVideo[] {
  if (videos.length === 0) return [];
  
  const profileVideos = videos.filter(v => v.recommendationReason?.includes('interests') || v.recommendationReason?.includes('goals'));
  const behaviorVideos = videos.filter(v => v.recommendationReason?.includes('enjoyed') || v.recommendationReason?.includes('watching'));
  const explorationVideos = videos.filter(v => v.recommendationReason?.includes('Discover') || v.recommendationReason?.includes('new'));
  const otherVideos = videos.filter(v => 
    !profileVideos.includes(v) && !behaviorVideos.includes(v) && !explorationVideos.includes(v)
  );
  
  const shuffled: YouTubeVideo[] = [];
  const maxLength = Math.max(profileVideos.length, behaviorVideos.length, explorationVideos.length, otherVideos.length);
  
  // Intelligent interleaving based on mixing ratio
  for (let i = 0; i < maxLength; i++) {
    // Prioritize behavior videos (highest engagement potential)
    if (i < behaviorVideos.length && Math.random() < mixingRatio.behaviorWeight * 2) {
      shuffled.push(behaviorVideos[i]);
    }
    
    // Add profile videos (reliable interest)
    if (i < profileVideos.length && Math.random() < mixingRatio.profileWeight * 1.5) {
      shuffled.push(profileVideos[i]);
    }
    
    // Sprinkle in exploration videos
    if (i < explorationVideos.length && Math.random() < mixingRatio.explorationWeight * 3) {
      shuffled.push(explorationVideos[i]);
    }
    
    // Add other videos to fill gaps
    if (i < otherVideos.length) {
      shuffled.push(otherVideos[i]);
    }
  }
  
  // Add any remaining videos that weren't selected
  const remainingVideos = videos.filter(v => !shuffled.includes(v));
  shuffled.push(...remainingVideos);
  
  // Sort by relevance score within groups to ensure quality
  return shuffled.sort((a, b) => {
    const scoreA = a.relevanceScore || 5;
    const scoreB = b.relevanceScore || 5;
    return scoreB - scoreA;
  });
}

// Helper: Calculate relevance score for a video
function calculateRelevanceScore(
  videoItem: any, 
  searchTerms: string[], 
  userLanguage: string
): number {
  let score = 5; // Base score
  
  const title = videoItem.snippet.title.toLowerCase();
  const description = videoItem.snippet.description?.toLowerCase() || '';
  const channelTitle = videoItem.snippet.channelTitle.toLowerCase();
  
  // Term matching in title (high weight)
  searchTerms.forEach(term => {
    if (title.includes(term.toLowerCase())) score += 2;
    if (description.includes(term.toLowerCase())) score += 1;
  });
  
  // Engagement metrics
  const viewCount = parseInt(videoItem.statistics?.viewCount || '0');
  const likeCount = parseInt(videoItem.statistics?.likeCount || '0');
  
  if (viewCount > 100000) score += 1;
  if (viewCount > 1000000) score += 1;
  if (likeCount > 1000) score += 0.5;
  
  // Quality indicators in title
  const qualityTerms = ['tutorial', 'guide', 'complete', 'ultimate', 'comprehensive'];
  qualityTerms.forEach(term => {
    if (title.includes(term)) score += 0.5;
  });
  
  // Language preference
  const isEnglish = /^[a-zA-Z0-9\s\-_'",.:;!?()&]+$/.test(title);
  if (userLanguage === 'en' && isEnglish) score += 1;
  else if (userLanguage !== 'en' && !isEnglish) score += 1;
  
  return Math.min(10, Math.max(1, score));
}

// Helper: Extract topics from video content
function extractVideoTopics(title: string, description?: string): string[] {
  const text = `${title} ${description || ''}`.toLowerCase();
  const topics: string[] = [];
  
  // Enhanced topic extraction patterns
  const patterns = [
    /(?:how to|tutorial|guide)\s+([a-z\s]{3,20})/gi,
    /([a-z\s]{3,15})\s+(?:tips|advice|hacks|secrets|guide)/gi,
    /(?:best|top|ultimate)\s+([a-z\s]{3,20})/gi,
    /([a-z\s]{3,15})\s+(?:workout|exercise|training)/gi,
    /([a-z\s]{3,15})\s+(?:cooking|recipe|food|meal)/gi,
    /([a-z\s]{3,15})\s+(?:meditation|mindfulness|wellness|health)/gi,
    /([a-z\s]{3,15})\s+(?:productivity|motivation|success|business)/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        const topic = match[1].trim();
        if (topic.length > 2 && topic.length < 25) {
          topics.push(topic);
        }
      }
    });
  });
  
  return [...new Set(topics)].slice(0, 3);
}

// Helper: Get region from language
function getRegionFromLanguage(language: string): string {
  const regionMap: Record<string, string> = {
    'en': 'US', 'es': 'ES', 'fr': 'FR', 'de': 'DE', 'it': 'IT',
    'pt': 'BR', 'ja': 'JP', 'ko': 'KR', 'zh': 'CN'
  };
  return regionMap[language] || 'US';
}

export default {
  getPersonalizedVideoSections,
  getIntelligentPersonalizedVideos,
  searchYouTubeVideos
};

// Helper: Check if quota is exceeded and return status
export function getQuotaStatus(): {
  isExceeded: boolean;
  message: string;
  hoursUntilReset: number;
} {
  if (!quotaExceeded) {
    return {
      isExceeded: false,
      message: 'API quota available',
      hoursUntilReset: 0
    };
  }

  const hoursElapsed = (Date.now() - quotaExceededAt) / (1000 * 60 * 60);
  const hoursUntilReset = Math.max(0, QUOTA_RESET_HOURS - hoursElapsed);

  return {
    isExceeded: true,
    message: `YouTube API quota exceeded. Videos will be available again in ${Math.ceil(hoursUntilReset)} hours.`,
    hoursUntilReset: Math.ceil(hoursUntilReset)
  };
}

// Helper: Reset quota manually (for testing or manual intervention)
export function resetQuota(): void {
  quotaExceeded = false;
  quotaExceededAt = 0;
  console.log('🔄 [VideoRecommender] Quota manually reset');
}