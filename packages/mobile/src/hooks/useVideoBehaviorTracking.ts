import { useCallback, useRef, useEffect } from 'react';
import { useInteractionTracking } from './useInteractionTracking';
import { usePersonalization } from './usePersonalization';

interface VideoBehaviorData {
  videoId: string;
  title: string;
  channelTitle?: string;
  topics?: string[];
  duration: number; // seconds viewed
  totalDuration: number; // total video length
  interactionType: 'view' | 'like' | 'dislike' | 'skip' | 'watch' | 'scroll_past';
  viewOrder: number; // position in the feed when viewed
  timeSpentOnScreen: number; // milliseconds
  wasPlayed: boolean;
  scrollDirection?: 'up' | 'down';
}

interface BehaviorPatterns {
  averageViewDuration: number;
  skipRate: number;
  likedTopics: string[];
  dislikedTopics: string[];
  preferredChannels: string[];
  timeOfDayPreferences: Record<number, number>; // hour -> engagement score
  scrollSpeed: number; // videos per minute
  playRate: number; // percentage of videos played vs just viewed
}

interface BackgroundVideoLoader {
  isLoading: boolean;
  queueSize: number;
  preloadedVideos: number;
}

export function useVideoBehaviorTracking(userId: string) {
  const { trackVideoInteraction } = useInteractionTracking(userId);
  const { profile } = usePersonalization(userId);
  
  // Behavior tracking state
  const behaviorQueue = useRef<VideoBehaviorData[]>([]);
  const backgroundLoader = useRef<BackgroundVideoLoader>({
    isLoading: false,
    queueSize: 0,
    preloadedVideos: 0
  });
  
  // Process behavior data in batches to avoid overwhelming the system
  const processBehaviorBatch = useCallback(async () => {
    if (behaviorQueue.current.length === 0 || !profile) return;
    
    const batch = behaviorQueue.current.splice(0, 10); // Process 10 at a time
    console.log('🧠 [BehaviorTracking] Processing batch of', batch.length, 'interactions');
    
    try {
      // Track individual interactions
      for (const behavior of batch) {
        await trackVideoInteraction({
          videoId: behavior.videoId,
          title: behavior.title,
          channelTitle: behavior.channelTitle,
          interactionType: behavior.interactionType,
          watchDuration: behavior.duration,
          totalDuration: behavior.totalDuration,
          timestamp: new Date().toISOString(),
          topics: behavior.topics,
          positionInResults: behavior.viewOrder
        });
      }
      
    } catch (error) {
      console.error('❌ [BehaviorTracking] Error processing batch:', error);
    }
  }, [profile, trackVideoInteraction]);

  // Analyze behavior patterns from recent interactions
  const analyzeBehaviorPatterns = useCallback((behaviors: VideoBehaviorData[]): BehaviorPatterns => {
    const totalBehaviors = behaviors.length;
    if (totalBehaviors === 0) {
      return {
        averageViewDuration: 0,
        skipRate: 0,
        likedTopics: [],
        dislikedTopics: [],
        preferredChannels: [],
        timeOfDayPreferences: {},
        scrollSpeed: 0,
        playRate: 0
      };
    }

    // Calculate average view duration
    const totalViewTime = behaviors.reduce((sum, b) => sum + b.duration, 0);
    const averageViewDuration = totalViewTime / totalBehaviors;

    // Calculate skip rate (scrolled past without playing)
    const skippedCount = behaviors.filter(b => 
      b.interactionType === 'scroll_past' && !b.wasPlayed
    ).length;
    const skipRate = skippedCount / totalBehaviors;

    // Extract topic preferences
    const topicEngagement: Record<string, { likes: number; dislikes: number; views: number }> = {};
    
    behaviors.forEach(behavior => {
      if (behavior.topics) {
        behavior.topics.forEach(topic => {
          if (!topicEngagement[topic]) {
            topicEngagement[topic] = { likes: 0, dislikes: 0, views: 0 };
          }
          
          topicEngagement[topic].views++;
          
          if (behavior.interactionType === 'like' || 
              (behavior.interactionType === 'watch' && behavior.duration > behavior.totalDuration * 0.5)) {
            topicEngagement[topic].likes++;
          } else if (behavior.interactionType === 'dislike' || 
                     behavior.interactionType === 'scroll_past') {
            topicEngagement[topic].dislikes++;
          }
        });
      }
    });

    // Sort topics by engagement
    const likedTopics = Object.entries(topicEngagement)
      .filter(([_, data]) => data.likes > data.dislikes)
      .sort((a, b) => (b[1].likes - b[1].dislikes) - (a[1].likes - a[1].dislikes))
      .slice(0, 10)
      .map(([topic]) => topic);

    const dislikedTopics = Object.entries(topicEngagement)
      .filter(([_, data]) => data.dislikes > data.likes)
      .sort((a, b) => (b[1].dislikes - b[1].likes) - (a[1].dislikes - a[1].likes))
      .slice(0, 5)
      .map(([topic]) => topic);

    // Channel preferences
    const channelEngagement: Record<string, number> = {};
    behaviors.forEach(behavior => {
      if (behavior.channelTitle) {
        channelEngagement[behavior.channelTitle] = 
          (channelEngagement[behavior.channelTitle] || 0) + 
          (behavior.interactionType === 'like' ? 3 : 
           behavior.interactionType === 'watch' ? 2 : 
           behavior.interactionType === 'view' ? 1 : -1);
      }
    });

    const preferredChannels = Object.entries(channelEngagement)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([channel]) => channel);

    // Play rate
    const playedCount = behaviors.filter(b => b.wasPlayed).length;
    const playRate = playedCount / totalBehaviors;

    // Time preferences (simplified)
    const currentHour = new Date().getHours();
    const timeOfDayPreferences = {
      [currentHour]: averageViewDuration
    };

    return {
      averageViewDuration,
      skipRate,
      likedTopics,
      dislikedTopics,
      preferredChannels,
      timeOfDayPreferences,
      scrollSpeed: totalBehaviors / 5, // behaviors per 5 minutes
      playRate
    };
  }, []);

    // Update user personalization based on learned patterns
  const updatePersonalizationFromPatterns = useCallback(async (patterns: BehaviorPatterns) => {
    // Simplified - just log patterns for now
    console.log('📈 [BehaviorTracking] Learned patterns:', {
      likedTopics: patterns.likedTopics.length,
      dislikedTopics: patterns.dislikedTopics.length,
      playRate: patterns.playRate,
      averageViewDuration: patterns.averageViewDuration
    });
  }, []);

  // Queue behavior for processing
  const trackBehavior = useCallback((behavior: VideoBehaviorData) => {
    behaviorQueue.current.push(behavior);
    
    // Process batch when queue gets large enough
    if (behaviorQueue.current.length >= 5) {
      processBehaviorBatch();
    }
  }, [processBehaviorBatch]);

  // Generate smarter search queries based on learned patterns
  const generateAdaptiveQueries = useCallback((): string[] => {
    if (!profile) return [];

    const patterns = analyzeBehaviorPatterns(behaviorQueue.current);
    const queries: string[] = [];

    // Use liked topics with higher weight
    patterns.likedTopics.slice(0, 3).forEach(topic => {
      queries.push(`${topic} tutorial latest`);
      queries.push(`${topic} tips 2024`);
    });

    // Add preferred channels
    patterns.preferredChannels.slice(0, 2).forEach(channel => {
      queries.push(`${channel} latest videos`);
    });

    // Add emerging interests with discovery terms
    const emergingInterests = profile.contentPreferences.emergingInterests || [];
    emergingInterests.slice(0, 2).forEach(interest => {
      queries.push(`${interest} beginner guide`);
    });

    console.log('🎯 [BehaviorTracking] Generated adaptive queries:', queries.length);
    return queries.slice(0, 8); // Max 8 queries
  }, [profile, analyzeBehaviorPatterns]);

  // Process any remaining behaviors periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (behaviorQueue.current.length > 0) {
        processBehaviorBatch();
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [processBehaviorBatch]);

  return {
    trackBehavior,
    generateAdaptiveQueries,
    backgroundLoader: backgroundLoader.current,
    queueSize: behaviorQueue.current.length
  };
}