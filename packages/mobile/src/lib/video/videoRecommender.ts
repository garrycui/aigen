import axios from 'axios';
import { PersonalizationProfile } from '../assessment/analyzer';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  snippet: string;
  thumbnail: string;
  url: string;
  channelTitle?: string;
  publishedAt?: string;
  viewCount?: string;
  likeCount?: string;
  duration?: string;
}

export interface VideoSection {
  topicName: string;
  description: string;
  videos: YouTubeVideo[];
  permaDimension: string;
  priority: number;
}

interface TopicSearchQuery {
  topic: string;
  permaDimension: string;
  searchTerms: string[];
  priority: number;
}

// Extract personalized topics from user profile
function extractPersonalizedTopics(personalization: PersonalizationProfile): TopicSearchQuery[] {
  const topics: TopicSearchQuery[] = [];
  
  // 1. Get focus areas (areas needing improvement) - highest priority
  personalization.wellnessProfile.focusAreas.forEach((dimension, index) => {
    const permaTopics = personalization.contentPreferences.permaMapping[dimension as keyof typeof personalization.contentPreferences.permaMapping] || [];
    if (permaTopics.length > 0) {
      topics.push({
        topic: `${dimension} boost`,
        permaDimension: dimension,
        searchTerms: generateSearchTermsForDimension(dimension, permaTopics.slice(0, 3)),
        priority: 10 - index // Higher priority for first focus areas
      });
    }
  });

  // 2. Get primary interests - medium-high priority
  personalization.contentPreferences.primaryInterests.slice(0, 4).forEach((interest, index) => {
    const dimension = findBestPermaDimension(interest, personalization.contentPreferences.permaMapping);
    topics.push({
      topic: interest,
      permaDimension: dimension,
      searchTerms: generateSearchTermsForInterest(interest),
      priority: 8 - index
    });
  });

  // 3. Get emerging interests from dynamic personalization - medium priority
  const contentPrefs = personalization.contentPreferences as any;
  if (contentPrefs.dynamicInterests?.emerging) {
    contentPrefs.dynamicInterests.emerging.slice(0, 2).forEach((interest: string, index: number) => {
      const dimension = findBestPermaDimension(interest, personalization.contentPreferences.permaMapping);
      topics.push({
        topic: `trending: ${interest}`,
        permaDimension: dimension,
        searchTerms: generateSearchTermsForInterest(interest),
        priority: 6 - index
      });
    });
  }

  // 4. Get MBTI-specific recommendations - lower priority
  const mbtiTopics = generateMBTITopics(personalization.chatPersona.mbtiType);
  mbtiTopics.forEach((mbtiTopic, index) => {
    topics.push({
      topic: `for ${personalization.chatPersona.mbtiType}`,
      permaDimension: mbtiTopic.dimension,
      searchTerms: mbtiTopic.searchTerms,
      priority: 4 - index
    });
  });

  return topics.sort((a, b) => b.priority - a.priority).slice(0, 6); // Top 6 topics
}

// Generate search terms for PERMA dimensions
function generateSearchTermsForDimension(dimension: string, userTopics: string[]): string[] {
  const baseTerms: Record<string, string[]> = {
    positiveEmotion: ['happiness', 'joy', 'fun', 'laughter', 'uplifting', 'feel good'],
    engagement: ['motivation', 'passion', 'flow state', 'skills', 'learning', 'creativity'],
    relationships: ['friendship', 'love', 'connection', 'social', 'community', 'family'],
    meaning: ['purpose', 'values', 'spirituality', 'growth', 'wisdom', 'fulfillment'],
    accomplishment: ['success', 'achievement', 'goals', 'progress', 'confidence', 'mastery']
  };

  const dimensionTerms = baseTerms[dimension as keyof typeof baseTerms] || ['wellbeing', 'happiness'];
  return [...dimensionTerms.slice(0, 3), ...userTopics.slice(0, 2)];
}

// Generate search terms for specific interests
function generateSearchTermsForInterest(interest: string): string[] {
  const interestMap: Record<string, string[]> = {
    'music': ['music therapy', 'relaxing music', 'mood boosting songs'],
    'nature': ['nature sounds', 'outdoor adventure', 'mindfulness in nature'],
    'cooking': ['cooking tutorials', 'healthy recipes', 'comfort food'],
    'exercise': ['workout motivation', 'fitness journey', 'healthy lifestyle'],
    'art': ['art therapy', 'creative inspiration', 'artistic expression'],
    'reading': ['book recommendations', 'reading motivation', 'literary inspiration'],
    'gaming': ['positive gaming', 'game reviews', 'gaming community'],
    'technology': ['tech innovation', 'future technology', 'digital wellbeing'],
    'family': ['family activities', 'parenting tips', 'family bonding'],
    'creativity': ['creative projects', 'inspiration', 'artistic tutorials']
  };

  return interestMap[interest.toLowerCase()] || [interest, `${interest} motivation`, `${interest} inspiration`];
}

// Find best PERMA dimension for an interest
function findBestPermaDimension(interest: string, permaMapping: PersonalizationProfile['contentPreferences']['permaMapping']): string {
  const permaDimensions = Object.keys(permaMapping) as Array<keyof typeof permaMapping>;
  
  for (const dimension of permaDimensions) {
    const topics = permaMapping[dimension];
    if (topics.some(topic => topic.toLowerCase().includes(interest.toLowerCase()))) {
      return dimension;
    }
  }
  return 'positiveEmotion'; // Default fallback
}

// Generate MBTI-specific topics
function generateMBTITopics(mbtiType: string): Array<{dimension: string, searchTerms: string[]}> {
  const mbtiMap: Record<string, Array<{dimension: string, searchTerms: string[]}>> = {
    'E': [{ dimension: 'relationships', searchTerms: ['social activities', 'group discussions', 'networking'] }],
    'I': [{ dimension: 'meaning', searchTerms: ['self reflection', 'introspection', 'personal growth'] }],
    'N': [{ dimension: 'engagement', searchTerms: ['future possibilities', 'innovation', 'creative thinking'] }],
    'S': [{ dimension: 'accomplishment', searchTerms: ['practical skills', 'hands on learning', 'real world applications'] }],
    'T': [{ dimension: 'engagement', searchTerms: ['logical analysis', 'problem solving', 'systematic thinking'] }],
    'F': [{ dimension: 'relationships', searchTerms: ['emotional intelligence', 'empathy', 'human connection'] }],
    'J': [{ dimension: 'accomplishment', searchTerms: ['goal setting', 'organization', 'planning'] }],
    'P': [{ dimension: 'positiveEmotion', searchTerms: ['spontaneity', 'flexibility', 'exploration'] }]
  };

  const topics: Array<{dimension: string, searchTerms: string[]}> = [];
  for (const letter of mbtiType) {
    if (mbtiMap[letter]) {
      topics.push(...mbtiMap[letter]);
    }
  }
  return topics.slice(0, 2); // Limit to 2 MBTI-based topics
}

// Enhanced YouTube API search with personalization
export async function searchYouTubeVideos(
  searchTerms: string[], 
  maxResults: number = 8,
  additionalFilters?: string
): Promise<YouTubeVideo[]> {
  try {
    console.log('Debug - Searching YouTube with terms:', searchTerms);
    console.log('Debug - YouTube API Key exists:', !!process.env.EXPO_PUBLIC_YOUTUBE_API_KEY);
    
    const query = searchTerms.join(' ') + (additionalFilters ? ` ${additionalFilters}` : '');
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - 60); // Last 60 days for fresher content

    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: process.env.EXPO_PUBLIC_YOUTUBE_API_KEY,
        q: query,
        part: 'snippet',
        type: 'video',
        maxResults,
        videoEmbeddable: true,
        videoDefinition: 'high',
        publishedAfter: publishedAfter.toISOString(),
        relevanceLanguage: 'en',
        safeSearch: 'moderate',
        order: 'relevance'
      }
    });

    console.log('Debug - YouTube search response:', searchResponse.data?.items?.length || 0, 'videos');

    const videoItems = searchResponse.data.items || [];
    if (videoItems.length === 0) return [];

    const videoIds = videoItems.map((item: any) => item.id.videoId).join(',');

    // Get additional video details
    const detailsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: process.env.EXPO_PUBLIC_YOUTUBE_API_KEY,
        id: videoIds,
        part: 'snippet,statistics,contentDetails'
      }
    });

    const videos = detailsResponse.data.items.map((item: any): YouTubeVideo => ({
      videoId: item.id,
      title: item.snippet.title,
      snippet: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      viewCount: item.statistics?.viewCount,
      likeCount: item.statistics?.likeCount,
      duration: item.contentDetails?.duration
    }));

    console.log('Debug - Processed videos:', videos.length);
    return videos;

  } catch (error) {
    console.error('Error searching YouTube videos:', error);
    if (axios.isAxiosError(error)) {
      console.error('YouTube API Error Details:', error.response?.data);
    }
    return [];
  }
}

// Refine topics using OpenAI (optional enhancement)
async function refineTopicsWithAI(
  topics: TopicSearchQuery[], 
  userContext: { mbti: string, focusAreas: string[], interests: string[] }
): Promise<TopicSearchQuery[]> {
  try {
    // This is optional - you can implement OpenAI integration here
    // For now, return topics as-is
    return topics;
  } catch (error) {
    console.error('Error refining topics with AI:', error);
    return topics;
  }
}

// Main function to get personalized video sections
export async function getPersonalizedVideoSections(
  personalization: PersonalizationProfile
): Promise<VideoSection[]> {
  try {
    const topics = extractPersonalizedTopics(personalization);
    const sections: VideoSection[] = [];

    // Optionally refine topics with AI
    const refinedTopics = await refineTopicsWithAI(topics, {
      mbti: personalization.chatPersona.mbtiType,
      focusAreas: personalization.wellnessProfile.focusAreas,
      interests: personalization.contentPreferences.primaryInterests
    });

    // Fetch videos for each topic
    for (const topic of refinedTopics) {
      const videos = await searchYouTubeVideos(
        topic.searchTerms,
        topic.priority >= 8 ? 10 : 6, // More videos for high-priority topics
        'positive motivation wellbeing' // Additional filter for positive content
      );

      if (videos.length > 0) {
        sections.push({
          topicName: topic.topic,
          description: generateSectionDescription(topic.topic, topic.permaDimension),
          videos,
          permaDimension: topic.permaDimension,
          priority: topic.priority
        });
      }
    }

    return sections.sort((a, b) => b.priority - a.priority);

  } catch (error) {
    console.error('Error getting personalized video sections:', error);
    return [];
  }
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
  
  if (topicName.includes('boost')) {
    return `${baseDescription} - Focused on ${permaDimension}`;
  }
  if (topicName.includes('trending')) {
    return `${baseDescription} - Based on your growing interests`;
  }
  if (topicName.includes('for ')) {
    return `${baseDescription} - Tailored for your personality`;
  }
  
  return `${baseDescription} - About ${topicName}`;
}

// Legacy function for backward compatibility
export async function getPersonalizedYouTubeVideos({
  mbti,
  perma,
  interests
}: {
  mbti?: string;
  perma?: any;
  interests?: string[];
}): Promise<YouTubeVideo[]> {
  return [];
}