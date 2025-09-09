import axios from 'axios';
import type { UnifiedPersonalizationProfile } from '../personalization/types';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  snippet: string;
  thumbnail: string;
  url: string;
  embedUrl: string; // NEW: Direct embed URL for in-app playback
  channelTitle?: string;
  publishedAt?: string;
  viewCount?: string;
  likeCount?: string;
  duration?: string;
  isEmbeddable: boolean; // NEW: Ensure video can be embedded
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

// Enhanced YouTube API search with strict embeddable filtering
export async function searchYouTubeVideos(
  searchTerms: string[], 
  maxResults: number = 8,
  additionalFilters?: string
): Promise<YouTubeVideo[]> {
  try {
    console.log('🎬 [VideoRecommender] Searching YouTube with terms:', searchTerms);
    
    const apiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('❌ [VideoRecommender] YouTube API key not found');
      return [];
    }
    
    const query = searchTerms.join(' ') + (additionalFilters ? ` ${additionalFilters}` : '');
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - 90); // Last 90 days for better content

    // Enhanced search parameters for embeddable videos
    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: apiKey,
        q: query,
        part: 'snippet',
        type: 'video',
        maxResults: Math.min(maxResults * 2, 50), // Get more results to filter for embeddable
        videoEmbeddable: 'true', // Only embeddable videos
        videoDefinition: 'any', // Include both HD and SD
        videoSyndicated: 'true', // Only syndicated videos
        publishedAfter: publishedAfter.toISOString(),
        relevanceLanguage: 'en',
        safeSearch: 'moderate',
        order: 'relevance',
        regionCode: 'US' // Ensure availability in US
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('📺 [VideoRecommender] YouTube search response:', searchResponse.data?.items?.length || 0, 'videos');

    const videoItems = searchResponse.data.items || [];
    if (videoItems.length === 0) return [];

    const videoIds = videoItems.map((item: any) => item.id.videoId).join(',');

    // Get detailed video information including embed status
    const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: apiKey,
        id: videoIds,
        part: 'snippet,statistics,contentDetails,status',
        maxResults: 50
      },
      timeout: 10000
    });

    const videos = detailsResponse.data.items
      .filter((item: any) => {
        // Strict filtering for embeddable videos
        return item.status?.embeddable === true && 
               item.status?.privacyStatus === 'public' &&
               !item.contentDetails?.regionRestriction?.blocked?.includes('US');
      })
      .map((item: any): YouTubeVideo => ({
        videoId: item.id,
        title: item.snippet.title,
        snippet: item.snippet.description?.substring(0, 200) + '...' || 'No description available',
        thumbnail: item.snippet.thumbnails?.high?.url || 
                   item.snippet.thumbnails?.medium?.url || 
                   item.snippet.thumbnails?.default?.url,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        embedUrl: `https://www.youtube.com/embed/${item.id}?rel=0&modestbranding=1&playsinline=1`,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        viewCount: item.statistics?.viewCount,
        likeCount: item.statistics?.likeCount,
        duration: item.contentDetails?.duration,
        isEmbeddable: true
      }))
      .slice(0, maxResults); // Limit to requested number

    console.log('✅ [VideoRecommender] Processed embeddable videos:', videos.length);
    return videos;

  } catch (error) {
    console.error('❌ [VideoRecommender] Error searching YouTube videos:', error);
    if (axios.isAxiosError(error)) {
      console.error('📋 [VideoRecommender] YouTube API Error Details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
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