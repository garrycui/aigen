import axios from 'axios';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  snippet: string;
  thumbnail: string;
  url: string;
}

interface BuildSearchQueryInput {
  mbti?: string;
  perma?: any;
  interests?: string[];
}

function buildSearchQuery({ mbti, perma, interests }: BuildSearchQueryInput): string {
  // Use MBTI, PERMA, and interests to create a positive, personalized query
  let query = 'uplifting happiness motivation';
  if (interests?.length) query += ' ' + interests.slice(0, 2).join(' ');
  if (mbti) query += ` for ${mbti} personality`;
  if (perma?.P?.happyEvents) query += ` ${perma.P.happyEvents}`;
  return query;
}

interface GetPersonalizedYouTubeVideosInput {
  mbti?: string;
  perma?: any;
  interests?: string[];
}

export async function getPersonalizedYouTubeVideos({
  mbti,
  perma,
  interests
}: GetPersonalizedYouTubeVideosInput): Promise<YouTubeVideo[]> {
  const query = buildSearchQuery({ mbti, perma, interests });
  const apiKey = process.env.YOUTUBE_API_KEY || '';
  const maxResults = 10;
  const publishedAfter = new Date();
  publishedAfter.setDate(publishedAfter.getDate() - 14);

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet` +
    `&q=${encodeURIComponent(query)}` +
    `&maxResults=${maxResults}` +
    `&key=${apiKey}` +
    `&type=video` +
    `&videoEmbeddable=true` +
    `&videoDefinition=high` +
    `&publishedAfter=${publishedAfter.toISOString()}` +
    `&relevanceLanguage=en`;

  const searchRes = await axios.get(searchUrl);
  const videoItems = (searchRes.data.items as any[]).filter((item: any) => item.id.kind === 'youtube#video');
  const videoIds = videoItems.map((item: any) => item.id.videoId);

  if (!videoIds.length) return [];

  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics` +
    `&id=${videoIds.join(',')}` +
    `&key=${apiKey}`;

  const statsRes = await axios.get(statsUrl);
  return (statsRes.data.items as any[]).map((item: any): YouTubeVideo => ({
    videoId: item.id,
    title: item.snippet.title,
    snippet: item.snippet.description,
    thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    url: `https://www.youtube.com/watch?v=${item.id}`,
  }));
}