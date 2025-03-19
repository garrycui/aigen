// imageAPI.ts
import axios from 'axios';

/**
 * Fetch images from the Pexels API based on a search query.
 * Returns an array of image URLs (using the "large2x" size for high quality).
 */
export const getPexelsImage = async (query: string): Promise<string[]> => {
  try {
    // Check if API key is available
    const apiKey = import.meta.env.VITE_PEXELS_API_KEY;
    if (!apiKey) {
      console.error('Pexels API key is missing');
      return [];
    }

    const response = await axios.get('https://api.pexels.com/v1/search', {
      headers: {
        Authorization: apiKey
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
};

/**
 * Fetch videos from the Pexels API based on a search query.
 * Returns an array of video objects with metadata and file information.
 */
export const getPexelsVideo = async (query: string, perPage = 5): Promise<any[]> => {
  try {
    // Check if API key is available
    const apiKey = import.meta.env.VITE_PEXELS_API_KEY;
    if (!apiKey) {
      console.error('Pexels API key is missing');
      return [];
    }
    
    const response = await axios.get('https://api.pexels.com/videos/search', {
      headers: {
        Authorization: apiKey
      },
      params: {
        query: query,
        per_page: perPage,
        orientation: 'landscape',
        size: 'large'
      }
    });
    
    return response.data.videos || [];
  } catch (error) {
    console.error('Error fetching Pexels videos:', error);
    return [];
  }
};
