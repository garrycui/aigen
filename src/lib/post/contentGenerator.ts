import OpenAI from 'openai';
import axios from 'axios';
import { config } from 'dotenv';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

config();

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
});

// YouTube Video interface
export interface YouTubeVideo {
  title: string;
  url: string;
  snippet: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  videoId: string;
}

export interface ContentCategory {
  id: string;
  name: string;
  description: string;
  searchQueries: string[];
  preferredMediaType: 'both' | 'video' | 'image';
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
  type: 'video';
  videoId: string;
}

export interface GeneratedContent {
  title: string;
  content: string;
  category: string;
  source: Source;
  videoUrl: string;
  imageUrl: string;
}

// INTEGRATED YOUTUBE DATA FUNCTIONS
/**
 * Fetch videos from the YouTube Data API based on a search query.
 */
async function fetchYouTubeVideos(query: string, maxResults = 5): Promise<YouTubeVideo[]> {
  try {
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - 7);
    
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet` +
                      `&q=${encodeURIComponent(query)}` +
                      `&maxResults=${maxResults}` +
                      `&key=${process.env.YOUTUBE_API_KEY}` +
                      `&type=video` +
                      `&videoDuration=medium` +
                      `&videoEmbeddable=true` +
                      `&videoDefinition=high` +
                      `&publishedAfter=${publishedAfter.toISOString()}` +
                      `&relevanceLanguage=en`;
    
    const searchRes = await axios.get(searchUrl);
    const videoItems = searchRes.data.items.filter((item: any) => item.id.kind === 'youtube#video');
    const videoIds = videoItems.map((item: any) => item.id.videoId);
    if (videoIds.length === 0) return [];
    
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics` +
                     `&id=${videoIds.join(',')}` +
                     `&key=${process.env.YOUTUBE_API_KEY}`;
    
    const statsRes = await axios.get(statsUrl);
    const videos: YouTubeVideo[] = statsRes.data.items.map((item: any) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      snippet: item.snippet.description,
      viewCount: parseInt(item.statistics.viewCount, 10),
      likeCount: parseInt(item.statistics.likeCount || '0', 10),
      publishedAt: item.snippet.publishedAt,
      videoId: item.id
    }));
    return videos;
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return [];
  }
}

/**
 * Helper function to calculate the number of days since publication.
 */
function daysSince(publishedAt: string): number {
  const published = new Date(publishedAt);
  const now = new Date();
  return Math.floor((now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Rank videos using a quality score formula:
 * score = (viewCount * (likeCount + 1)) / (daysSince(publishedAt) + 1)
 */
function rankVideos(videos: YouTubeVideo[]): YouTubeVideo[] {
  return videos.sort((a, b) => {
    const scoreA = (a.viewCount * (a.likeCount + 1)) / (daysSince(a.publishedAt) + 1);
    const scoreB = (b.viewCount * (b.likeCount + 1)) / (daysSince(b.publishedAt) + 1);
    return scoreB - scoreA;
  });
}

// INTEGRATED TRENDING TOPICS FUNCTION
/**
 * Uses OpenAI API to fetch very specific, current trending topics (real events/news)
 * in the AI domain for a given query.
 */
async function fetchTrendingTopics(query: string): Promise<string[]> {
  const prompt = `
    You are an AI assistant that provides up-to-date news and events in the AI industry.
    Provide a plain text list of the latest, very specific trending events or news headlines 
    in the AI industry related to "${query}". Each entry should be a real, verifiable event or news item.
    Ensure the topics are current, relevant, and specific to the AI industry.
    Return each topic on a new line without any additional text or formatting. Do not return - or ". 
  `;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that provides up-to-date AI news headlines.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const content = completion.choices[0].message?.content;
    let topics: string[] = [];
    if (content) {
      topics = content.split('\n').map(topic => topic.trim()).filter(topic => topic.length > 0);
    } else {
      console.error('No content received in the response.');
    }
    return topics;
  } catch (error) {
    console.error('Error fetching trending topics via OpenAI API:', error);
    return [];
  }
}

// INTEGRATED IMAGES API FUNCTION
/**
 * Fetch images from the Pexels API based on a search query.
 */
async function getPexelsImage(query: string): Promise<string[]> {
  try {
    const response = await axios.get('https://api.pexels.com/v1/search', {
      headers: {
        Authorization: process.env.PEXELS_API_KEY
      },
      params: {
        query: query,
        per_page: 5
      }
    });
    const photos = response.data.photos;
    const imageUrls = photos.map((photo: any) => photo.src.large2x);
    return imageUrls;
  } catch (error) {
    console.error('Error fetching Pexels images:', error);
    return [];
  }
}

// Full set of production-ready content categories:
export const CONTENT_CATEGORIES: ContentCategory[] = [
  {
    id: 'income-opportunities',
    name: 'AI-Powered Income Opportunities',
    description: 'Strategies to leverage AI for financial gain',
    searchQueries: [
      'how to make money with AI tools',
      'AI side hustle opportunities',
      'monetize artificial intelligence skills'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'innovations',
    name: 'Cutting-Edge AI Innovations',
    description: 'Latest developments in AI technology',
    searchQueries: [
      'latest AI breakthroughs',
      'new artificial intelligence research',
      'AI technology innovations'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'future-trends',
    name: 'The Future of AI: Trends and Predictions',
    description: 'Upcoming trends and forecasts in AI',
    searchQueries: [
      'AI industry trends',
      'future of artificial intelligence',
      'AI technology predictions'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'career-transitions',
    name: 'Navigating AI-Induced Career Transitions',
    description: 'Guidance on adapting careers to AI changes',
    searchQueries: [
      'AI career transition strategies',
      'reskilling for AI jobs',
      'AI impact on careers'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'mental-wellbeing',
    name: 'Mental Well-being in the AI Era',
    description: 'Support for managing psychological impacts of AI',
    searchQueries: [
      'coping with AI anxiety',
      'mental health AI workplace',
      'psychological impact of AI'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'ethics',
    name: 'AI Ethics and Responsible Use',
    description: 'Ethical considerations in AI deployment',
    searchQueries: [
      'AI ethics guidelines',
      'responsible AI development',
      'artificial intelligence ethics'
    ],
    preferredMediaType: 'both'
  },
  {
    id: 'success-stories',
    name: 'AI Success Stories and Case Studies',
    description: 'Real-world examples of positive AI outcomes',
    searchQueries: [
      'successful AI implementations',
      'AI transformation case studies',
      'AI business success stories'
    ],
    preferredMediaType: 'both'
  }
];

/**
 * Main content generation function - combines all services
 */
export const generateContent = async (category: ContentCategory): Promise<GeneratedContent[]> => {
  try {
    console.log(`Generating content for category: ${category.name}`);
    
    // Select a random search query from the category's search queries.
    const randomQuery = category.searchQueries[Math.floor(Math.random() * category.searchQueries.length)];
    console.log(`Selected random query: ${randomQuery}`);
    
    // Use the random search query to fetch trending topics.
    const trendingTopics = await fetchTrendingTopics(randomQuery);
    
    const generatedContents: GeneratedContent[] = [];
    const processedQueries = new Set(); // For deduplication

    for (const trendingQuery of trendingTopics) {
      // Skip duplicate topics
      if (processedQueries.has(trendingQuery)) {
        continue;
      }
      processedQueries.add(trendingQuery);
      
      console.log(`Processing trending query: ${trendingQuery}`);
      
      // Fetch YouTube videos in parallel with images for better performance
      const [videos, pexelsImages] = await Promise.all([
        fetchYouTubeVideos(trendingQuery, 5),
        getPexelsImage(trendingQuery)
      ]);
      
      if (videos.length === 0) {
        console.log(`No YouTube videos found for query: ${trendingQuery}`);
        continue;
      }
      
      const rankedVideos = rankVideos(videos);
      const topVideo = rankedVideos[0];

      const source: Source = {
        title: topVideo.title,
        url: topVideo.url,
        snippet: topVideo.snippet,
        type: 'video',
        videoId: topVideo.videoId
      };

      const imageUrl = pexelsImages.length > 0 ? pexelsImages[0] : '';

      // Generate content using GPT-4o with a refined prompt.
      const prompt = `
        You are an AI content writer. Produce a very short, user-friendly article in Markdown format.
        Follow this strict layout:
        
        1. # Title
        2. Short introduction paragraph (2-3 sentences)
        3. ## Key Insights
        4. A few bullet points with actionable insights from the video
        5. ## Discussion
        6. A short concluding line or question prompting user engagement
        
        Important rules:
        - Keep it under 200 words total.
        - Do not show any raw URL or embed code in the final text.
        - The main focus is on the YouTube video. Mention it, but do not reveal the URL.
        - Do not mention or show the image in the text.
        
        Video Info:
        - Title: ${topVideo.title}
        - Description: ${topVideo.snippet}
        - The video is about: "${trendingQuery}"
        - We are discussing: "${category.description}"
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content writer focusing on AI topics. The user wants a very short, strictly formatted Markdown article about a single YouTube video, no images or raw URLs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const response = completion.choices[0].message?.content;
      if (!response) {
        throw new Error('Failed to generate content');
      }

      let title = topVideo.title; // default fallback
      let content = response;

      // If GPT includes a top line with "# " for title, we can parse it:
      const lines = response.split('\n');
      if (lines[0].startsWith('# ')) {
        title = lines[0].replace(/^# /, '').trim();
        content = lines.slice(1).join('\n');
      }

      generatedContents.push({
        title,
        content,
        category: category.name,
        source,
        videoUrl: `https://www.youtube.com/embed/${topVideo.videoId}`,
        imageUrl
      });

      // For brevity, we only produce 3 articles max per call
      if (generatedContents.length >= 3) {
        break;
      }
    }

    if (generatedContents.length < 1) {
      throw new Error('No suitable content generated.');
    }

    return generatedContents;
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
};

export const publishContent = async (content: GeneratedContent, userId: string): Promise<string> => {
  try {
    const postRef = await addDoc(collection(getFirestore(), 'posts'), {
      title: content.title,
      content: content.content,
      category: content.category,
      video_url: content.videoUrl,
      image_url: content.imageUrl,
      source: content.source,
      userId,
      user_name: userId,
      likes_count: 0,
      comments_count: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return postRef.id;
  } catch (error) {
    console.error('Error publishing content:', error);
    throw error;
  }
};
