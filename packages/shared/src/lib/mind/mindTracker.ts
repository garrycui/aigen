import { db } from '../common/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  limit, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  QueryConstraint,
  DocumentData
} from 'firebase/firestore';
import { 
  getUserSubcollection, 
  userCache,
  postCache
} from '../common/cache';
import { generateMoodSuggestions } from '../common/openai';
import { getTutorials } from '../tutorial/tutorials';

export interface MoodEntry {
  id: string;
  rating: number;
  mood: string;
  notes: string;
  tags: string[];
  createdAt: any;
}

export interface MoodAnalysis {
  trend: 'improving' | 'declining' | 'stable';
  averageRating: number;
  commonTags: string[];
  suggestions: string[];
  riskLevel: 'low' | 'moderate' | 'high';
}

// Cache keys
const MOOD_RESOURCES_CACHE_KEY = (userId: string, riskLevel: string) => 
  `mood-resources-${userId}-${riskLevel}`;

/**
 * Save a new mood entry
 */
export const saveMoodEntry = async (
  userId: string,
  rating: number,
  mood: string,
  notes: string,
  tags: string[] = []
) => {
  try {
    const collRef = collection(db, 'users', userId, 'moodEntries');
    const docRef = await addDoc(collRef, {
      rating,
      mood,
      notes,
      tags,
      createdAt: serverTimestamp()
    });
    
    // Invalidate cached mood entries by forcing a refresh on next fetch
    userCache.delete(`user-${userId}-moodEntries-list`);
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving mood entry:', error);
    throw error;
  }
};

/**
 * Get mood entries for a date range
 */
export const getMoodEntries = async (
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<MoodEntry[]> => {
  try {
    // Use the getUserSubcollection function with properly typed constraints
    const queryConstraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (startDate) {
      queryConstraints.push(where('createdAt', '>=', startDate));
    }
    if (endDate) {
      queryConstraints.push(where('createdAt', '<=', endDate));
    }

    return await getUserSubcollection(userId, 'moodEntries', queryConstraints) as MoodEntry[];
  } catch (error) {
    console.error('Error getting mood entries:', error);
    throw error;
  }
};

/**
 * Analyze mood entries and provide insights
 */
export const analyzeMoodEntries = async (entries: MoodEntry[]): Promise<MoodAnalysis> => {
  if (entries.length === 0) {
    return {
      trend: 'stable',
      averageRating: 0,
      commonTags: [],
      suggestions: [],
      riskLevel: 'low'
    };
  }

  // Calculate trend
  const ratings = entries.map(e => e.rating);
  const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  
  // Calculate trend using linear regression
  const xValues = Array.from({ length: ratings.length }, (_, i) => i);
  const slope = calculateSlope(xValues, ratings);
  
  const trend = slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable';

  // Get common tags
  const tagCounts = new Map<string, number>();
  entries.forEach(entry => {
    entry.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const commonTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  // Determine risk level
  const recentEntries = entries.slice(0, 7); // Last 7 entries
  const recentAverage = recentEntries.reduce((sum, entry) => sum + entry.rating, 0) / recentEntries.length;
  const riskLevel = recentAverage <= 3 ? 'high' : recentAverage <= 5 ? 'moderate' : 'low';

  // Get AI-powered suggestions using the imported function from openai.ts
  const suggestions = await generateMoodSuggestions(entries, trend, riskLevel);

  return {
    trend,
    averageRating,
    commonTags,
    suggestions,
    riskLevel
  };
};

/**
 * Calculate slope for trend analysis
 */
const calculateSlope = (x: number[], y: number[]): number => {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
};

/**
 * Get recommended resources based on mood analysis
 */
export const getRecommendedResources = async (userId: string, analysis: MoodAnalysis) => {
  // Use the cache with a unique key based on user and risk level
  const cacheKey = MOOD_RESOURCES_CACHE_KEY(userId, analysis.riskLevel);
  
  return userCache.getOrSet(cacheKey, async () => {
    let relevantTutorials: any[] = [];
    let relevantPosts: any[] = [];

    // Add tutorial recommendations based on risk level
    if (analysis.riskLevel === 'high') {
      // Use getTutorials with a filter for Mental Well-being category
      const tutorials = await getTutorials(
        1, // page 
        2, // limit
        '', // searchQuery
        ['Mental Well-being'], // categories
        undefined, // difficulties
        'likes', // sortField
        'desc' // sortDirection
      );
      
      relevantTutorials = tutorials;
    }

    // Add community post recommendations from cache if possible
    try {
      // Use a cached query for support posts
      const postCacheKey = 'support-posts';
      relevantPosts = await postCache.getOrSet(postCacheKey, async () => {
        // If not in cache, fetch from Firestore
        const postsRef = collection(db, 'posts');
        const supportPosts = query(
          postsRef,
          where('category', '==', 'Support'),
          orderBy('likes_count', 'desc'),
          limit(2)
        );
        const postsSnapshot = await getDocs(supportPosts);
        return postsSnapshot.docs.map((doc: DocumentData) => ({
          id: doc.id,
          ...doc.data()
        }));
      }, 30 * 60 * 1000); // 30 minute TTL for post cache
    } catch (error) {
      console.error('Error fetching support posts:', error);
      relevantPosts = [];
    }

    return {
      tutorials: relevantTutorials,
      posts: relevantPosts
    };
  }, 2 * 60 * 60 * 1000); // 2 hour TTL for mood resources
};