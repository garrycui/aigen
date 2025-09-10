import { useCallback, useRef, useEffect } from 'react';
import { useInteractionTracking } from './useInteractionTracking';
import { usePersonalization } from './usePersonalization';
import { YouTubeVideo } from '../lib/video/videoRecommender';

interface IntelligentRecommendationEngine {
  calculateMixingRatio(): { profileWeight: number; behaviorWeight: number };
  generateHybridQueries(): { profileQueries: string[]; behaviorQueries: string[]; explorationQueries: string[] };
  updatePersonalizationProfile(interactions: VideoInteraction[]): Promise<void>;
  shouldExploreNewContent(): boolean;
}

interface VideoInteraction {
  videoId: string;
  title: string;
  channelTitle?: string;
  topics?: string[];
  interactionType: 'view' | 'like' | 'dislike' | 'skip' | 'watch' | 'scroll_past';
  engagementScore: number; // 0-10 based on watch time, likes, etc.
  timestamp: string;
}

interface UserEngagementProfile {
  totalInteractions: number;
  avgEngagementScore: number;
  profileAccuracy: number; // How well profile matches behavior
  explorationRate: number; // How open user is to new content
  recentEngagement: VideoInteraction[];
  lastProfileUpdate: string;
}

export function useIntelligentVideoRecommendations(userId: string) {
  const { trackVideoInteraction } = useInteractionTracking(userId);
  const { profile, loading } = usePersonalization(userId);
  
  // Engagement tracking
  const engagementProfile = useRef<UserEngagementProfile>({
    totalInteractions: 0,
    avgEngagementScore: 5.0,
    profileAccuracy: 0.8, // Start with moderate confidence in profile
    explorationRate: 0.3, // 30% exploration initially
    recentEngagement: [],
    lastProfileUpdate: new Date().toISOString()
  });

  // Calculate intelligent mixing ratio between profile and behavior
  const calculateMixingRatio = useCallback((): { profileWeight: number; behaviorWeight: number; explorationWeight: number } => {
    const engagement = engagementProfile.current;
    
    // Start with profile-heavy for new users
    if (engagement.totalInteractions < 10) {
      return { profileWeight: 0.7, behaviorWeight: 0.2, explorationWeight: 0.1 };
    }
    
    // Gradually shift toward behavior as we learn
    if (engagement.totalInteractions < 50) {
      const behaviorConfidence = Math.min(engagement.totalInteractions / 50, 1);
      return {
        profileWeight: 0.6 * (1 - behaviorConfidence) + 0.3 * behaviorConfidence,
        behaviorWeight: 0.3 * behaviorConfidence + 0.1 * (1 - behaviorConfidence),
        explorationWeight: 0.1 + engagement.explorationRate * 0.2
      };
    }
    
    // Mature users: behavior-heavy with smart exploration
    const profileAccuracy = engagement.profileAccuracy;
    return {
      profileWeight: 0.2 + profileAccuracy * 0.3, // 20-50% based on accuracy
      behaviorWeight: 0.5 + (1 - profileAccuracy) * 0.2, // 50-70% 
      explorationWeight: engagement.explorationRate * 0.3 // 0-30%
    };
  }, []);

  // Generate hybrid queries mixing profile, behavior, and exploration
  const generateHybridQueries = useCallback((): { profileQueries: string[]; behaviorQueries: string[]; explorationQueries: string[] } => {
    if (!profile) {
      return { profileQueries: [], behaviorQueries: [], explorationQueries: [] };
    }

    const engagement = engagementProfile.current;
    const weights = calculateMixingRatio();

    // Profile-based queries (from interests and PERMA dimensions)
    const profileQueries: string[] = [];
    if (profile.contentPreferences.primaryInterests) {
      profile.contentPreferences.primaryInterests.slice(0, 3).forEach(interest => {
        profileQueries.push(`${interest} tutorial guide`);
        profileQueries.push(`${interest} tips beginner`);
      });
    }

    // Add PERMA-based queries
    profile.wellnessProfile.focusAreas.slice(0, 2).forEach(area => {
      const permaQueries = getPermaQueries(area);
      profileQueries.push(...permaQueries.slice(0, 2));
    });

    // Behavior-based queries (from recent high-engagement content)
    const behaviorQueries: string[] = [];
    const recentHighEngagement = engagement.recentEngagement
      .filter(interaction => interaction.engagementScore > 7)
      .slice(0, 5);

    recentHighEngagement.forEach(interaction => {
      if (interaction.topics) {
        interaction.topics.forEach(topic => {
          behaviorQueries.push(`${topic} similar content`);
          behaviorQueries.push(`${topic} advanced tips`);
        });
      }
      if (interaction.channelTitle) {
        behaviorQueries.push(`${interaction.channelTitle} latest`);
      }
    });

    // Exploration queries (trending, adjacent topics)
    const explorationQueries: string[] = [
      'trending tutorial 2024',
      'viral educational content',
      'surprising facts',
      'life changing tips',
      'creative inspiration',
      'productivity hacks',
      'wellness motivation',
      'new skills to learn'
    ];

    console.log('🎯 [IntelligentRec] Query distribution:', {
      profile: profileQueries.length,
      behavior: behaviorQueries.length,
      exploration: explorationQueries.length,
      weights
    });

    return { profileQueries, behaviorQueries, explorationQueries };
  }, [profile, calculateMixingRatio]);

  // Calculate engagement score based on user interaction
  const calculateEngagementScore = useCallback((
    interactionType: string,
    watchDuration: number,
    totalDuration: number,
    timeOnScreen: number
  ): number => {
    let score = 5; // Base score

    // Watch time factor (0-4 points)
    const watchRatio = Math.min(watchDuration / totalDuration, 1);
    score += watchRatio * 4;

    // Interaction type factor
    switch (interactionType) {
      case 'like':
        score += 2;
        break;
      case 'watch':
        score += 1.5;
        break;
      case 'view':
        score += 0.5;
        break;
      case 'dislike':
        score -= 2;
        break;
      case 'scroll_past':
        score -= 1;
        break;
      case 'skip':
        score -= 1.5;
        break;
    }

    // Time on screen factor (indicates interest)
    if (timeOnScreen > 10000) score += 1; // 10+ seconds
    if (timeOnScreen > 30000) score += 1; // 30+ seconds

    return Math.max(0, Math.min(10, score));
  }, []);

  // Track video interaction with intelligent learning
  const trackIntelligentInteraction = useCallback(async (
    video: YouTubeVideo,
    interactionType: 'view' | 'like' | 'dislike' | 'skip' | 'watch' | 'scroll_past',
    watchDuration: number = 0,
    timeOnScreen: number = 0
  ) => {
    const totalDuration = parseDuration(video.duration) || 30;
    const engagementScore = calculateEngagementScore(interactionType, watchDuration, totalDuration, timeOnScreen);

    const interaction: VideoInteraction = {
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      topics: video.topicTags,
      interactionType,
      engagementScore,
      timestamp: new Date().toISOString()
    };

    // Update engagement profile
    const engagement = engagementProfile.current;
    engagement.totalInteractions++;
    engagement.recentEngagement.unshift(interaction);
    engagement.recentEngagement = engagement.recentEngagement.slice(0, 20); // Keep last 20

    // Update average engagement
    engagement.avgEngagementScore = (
      engagement.avgEngagementScore * 0.9 + engagementScore * 0.1
    );

    // Calculate profile accuracy (how well initial profile matches behavior)
    if (engagement.totalInteractions > 5) {
      const profileTopics = profile?.contentPreferences.primaryInterests || [];
      const behaviorTopics = engagement.recentEngagement
        .flatMap(i => i.topics || [])
        .filter(topic => {
          const interaction = engagement.recentEngagement
            .find(i => i.topics?.includes(topic));
          return interaction && interaction.engagementScore > 6;
        });

      const overlap = profileTopics.filter(topic => 
        behaviorTopics.some(bt => bt.toLowerCase().includes(topic.toLowerCase()))
      ).length;

      engagement.profileAccuracy = Math.max(0.3, overlap / Math.max(profileTopics.length, 1));
    }

    // Adjust exploration rate based on engagement patterns
    if (engagementScore > 7 && !isProfileRelated(interaction, profile)) {
      // High engagement with non-profile content = increase exploration
      engagement.explorationRate = Math.min(0.5, engagement.explorationRate + 0.05);
    } else if (engagementScore < 4) {
      // Low engagement = reduce exploration, stick to what works
      engagement.explorationRate = Math.max(0.1, engagement.explorationRate - 0.02);
    }

    console.log('📊 [IntelligentRec] Interaction tracked:', {
      type: interactionType,
      score: engagementScore,
      totalInteractions: engagement.totalInteractions,
      avgScore: engagement.avgEngagementScore.toFixed(2),
      profileAccuracy: engagement.profileAccuracy.toFixed(2),
      explorationRate: engagement.explorationRate.toFixed(2)
    });

    // Track with standard system
    await trackVideoInteraction({
      videoId: video.videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      interactionType,
      watchDuration,
      totalDuration,
      timestamp: interaction.timestamp,
      topics: video.topicTags,
      positionInResults: 1
    });

    // Update personalization profile periodically
    if (engagement.totalInteractions % 10 === 0) {
      await updatePersonalizationFromBehavior();
    }

  }, [profile, calculateEngagementScore, trackVideoInteraction]);

  // Update user personalization based on learned behavior
  const updatePersonalizationFromBehavior = useCallback(async () => {
    if (!profile) return;

    const engagement = engagementProfile.current;
    const recentHighEngagement = engagement.recentEngagement
      .filter(i => i.engagementScore > 6)
      .slice(0, 10);

    // Extract emerging interests from high-engagement content
    const emergingTopics = recentHighEngagement
      .flatMap(i => i.topics || [])
      .reduce((acc, topic) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const newEmergingInterests = Object.entries(emergingTopics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);

    console.log('🔄 [IntelligentRec] Updating personalization with emerging interests:', newEmergingInterests);

    // Note: In a real implementation, you'd update the profile here
    // For now, we'll just log the insights
    console.log('📈 [IntelligentRec] Profile insights:', {
      originalInterests: profile.contentPreferences.primaryInterests,
      emergingInterests: newEmergingInterests,
      profileAccuracy: engagement.profileAccuracy,
      explorationRate: engagement.explorationRate
    });

  }, [profile]);

  // Helper functions
  const getPermaQueries = (dimension: string): string[] => {
    const permaMap: Record<string, string[]> = {
      positiveEmotion: ['happiness tips', 'joy practices', 'gratitude exercises'],
      engagement: ['flow state', 'passion projects', 'focused work'],
      relationships: ['communication skills', 'social connection', 'friendship building'],
      meaning: ['life purpose', 'values clarification', 'meaningful work'],
      accomplishment: ['goal achievement', 'success habits', 'personal growth']
    };
    return permaMap[dimension] || ['personal development'];
  };

  const parseDuration = (duration?: string): number => {
    if (!duration) return 30;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 30;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  };

  const isProfileRelated = (interaction: VideoInteraction, userProfile: any): boolean => {
    if (!userProfile?.contentPreferences?.primaryInterests) return false;
    
    const profileTopics = userProfile.contentPreferences.primaryInterests.map((i: string) => i.toLowerCase());
    const videoTopics = interaction.topics?.map(t => t.toLowerCase()) || [];
    
    return videoTopics.some(topic => 
      profileTopics.some((profileTopic: string) => 
        topic.includes(profileTopic) || profileTopic.includes(topic)
      )
    );
  };

  return {
    generateHybridQueries,
    trackIntelligentInteraction,
    calculateMixingRatio,
    getEngagementProfile: () => engagementProfile.current,
    isReady: !loading && !!profile
  };
}