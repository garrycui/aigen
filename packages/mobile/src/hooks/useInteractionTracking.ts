import { useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { useUnifiedPersonalization } from './useUnifiedPersonalization';
import { scoreNewChatTopic } from '../lib/personalization/analyzer';

interface ChatInteraction {
  messageId: string;
  userMessage: string;
  aiResponse: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  engagementLevel: number; // 1-10
  timestamp: string;
  threadId?: string;
  runId?: string;
  permaSignals?: Record<string, number>;
}

interface AnalyticsInteraction {
  sessionId: string;
  summary: string;
  permaInsights: any;
  personalizationUpdates: any;
  messageCount: number;
  timestamp: string;
}

interface TopicEngagement {
  topic: string;
  engagementScore: number;
  interactionType: 'mention' | 'followup' | 'dismissal';
  context: string;
}

interface VideoInteraction {
  videoId: string;
  title: string;
  channelTitle?: string;
  interactionType: 'view' | 'like' | 'dislike' | 'skip' | 'complete' | 'watch' | 'scroll_past';
  watchDuration?: number; // seconds watched
  totalDuration?: number; // total video length
  topics?: string[]; // extracted topics from video
  timestamp: string;
  searchQuery?: string; // what search led to this video
  positionInResults?: number; // position when found (1-based)
}

export function useInteractionTracking(userId: string) {
  const { createDocument } = useFirebase();
  const { profile: personalization, updateProfile } = useUnifiedPersonalization(userId);

  // Utility to remove undefined fields (keep in sync with FirebaseContext)
  const removeUndefinedFields = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
    if (obj && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [k, v]) => {
        if (v !== undefined) acc[k] = removeUndefinedFields(v);
        return acc;
      }, {} as any);
    }
    return obj;
  };

  const trackChatInteraction = useCallback(async (interaction: ChatInteraction) => {
    if (!userId) return;
    
    try {
      const cleanInteraction = removeUndefinedFields(interaction);
      await createDocument('userInteractions', {
        userId,
        type: 'chat_interaction',
        data: cleanInteraction,
        timestamp: new Date().toISOString(),
        processed: false
      });
      
      // Update quick personalization signals
      await updateQuickPersonalizationSignals(interaction);
      
      console.log('✅ Chat interaction tracked:', interaction.messageId);
    } catch (error) {
      console.error('❌ Error tracking chat interaction:', error);
    }
  }, [userId, personalization, updateProfile]);

  const trackAnalyticsResult = useCallback(async (analytics: AnalyticsInteraction) => {
    if (!userId) return;
    
    try {
      const cleanAnalytics = removeUndefinedFields(analytics);
      await createDocument('userInteractions', {
        userId,
        type: 'analytics_result',
        data: cleanAnalytics,
        timestamp: new Date().toISOString(),
        processed: false
      });
      
      // Apply personalization updates from analytics
      if (personalization && analytics.personalizationUpdates) {
        await applyAnalyticsUpdates(analytics);
      }
      
      console.log('✅ Analytics result tracked:', analytics.sessionId);
    } catch (error) {
      console.error('❌ Error tracking analytics result:', error);
    }
  }, [userId, personalization, updateProfile]);

  const trackTopicEngagement = useCallback(async (engagement: TopicEngagement) => {
    if (!userId) return;
    
    try {
      const cleanEngagement = removeUndefinedFields(engagement);
      await createDocument('userInteractions', {
        userId,
        type: 'topic_engagement',
        data: cleanEngagement,
        timestamp: new Date().toISOString(),
        processed: false
      });
      
      // Process topic engagement for unified personalization
      if (personalization && engagement.engagementScore >= 7) {
        await processTopicEngagement(engagement);
      }
      
      console.log('✅ Topic engagement tracked:', engagement.topic);
    } catch (error) {
      console.error('❌ Error tracking topic engagement:', error);
    }
  }, [userId, personalization, updateProfile]);

  const trackVideoInteraction = useCallback(async (interaction: VideoInteraction) => {
    if (!userId) return;
    
    try {
      const cleanInteraction = removeUndefinedFields(interaction);
      await createDocument('userInteractions', {
        userId,
        type: 'video_interaction',
        data: cleanInteraction,
        timestamp: new Date().toISOString(),
        processed: false
      });
      
      // Update video metrics and preferences
      await updateVideoPreferences(interaction);
      
      console.log('✅ Video interaction tracked:', interaction.videoId, interaction.interactionType);
    } catch (error) {
      console.error('❌ Error tracking video interaction:', error);
    }
  }, [userId, personalization, updateProfile]);

  const updateQuickPersonalizationSignals = async (interaction: ChatInteraction) => {
    if (!personalization) return;
    
    try {
      const currentTracking = personalization.activityTracking;
      const currentSignals = currentTracking?.chatMetrics || {};
      
      // Enhanced signal updates with decay
      const updatedChatMetrics = {
        totalMessages: (currentSignals.totalMessages || 0) + 1,
        positiveInteractions: interaction.sentiment === 'positive' && interaction.engagementLevel >= 7
          ? Math.min((currentSignals.positiveInteractions || 0) + 1, 100)
          : currentSignals.positiveInteractions || 0,
        engagementStreak: interaction.engagementLevel >= 8
          ? (currentSignals.engagementStreak || 0) + 1
          : interaction.engagementLevel <= 3
            ? 0
            : currentSignals.engagementStreak || 0,
        lastActiveTime: new Date().toISOString(),
        preferredTopics: updatePreferredTopics(
          currentSignals.preferredTopics || [],
          interaction.topics,
          interaction.engagementLevel,
          interaction.permaSignals
        )
      };

      // Update PERMA signals from conversation
      const updatedPermaScores = { ...personalization.wellnessProfile.currentScores };
      if (interaction.permaSignals) {
        Object.entries(interaction.permaSignals).forEach(([dimension, signal]) => {
          if (typeof signal === 'number' && signal > 0) {
            // Apply small incremental updates to PERMA scores
            const currentScore = updatedPermaScores[dimension as keyof typeof updatedPermaScores] || 5;
            const increment = Math.min(0.1, signal * 0.05); // Small increments
            updatedPermaScores[dimension as keyof typeof updatedPermaScores] = 
              Math.min(10, Math.max(1, currentScore + increment));
          }
        });
      }

      await updateProfile({
        activityTracking: {
          ...currentTracking,
          chatMetrics: updatedChatMetrics,
          // Remove lastUpdated from ActivityTracking - not part of interface
        },
        wellnessProfile: {
          ...personalization.wellnessProfile,
          currentScores: updatedPermaScores
        },
        computed: {
          ...personalization.computed,
          overallHappiness: Math.round(
            Object.values(updatedPermaScores).reduce((sum, score) => sum + score, 0) / 5
          ),
          lastEngagementType: 'chat',
          engagementLevel: interaction.engagementLevel >= 8 ? 'high' : 
                          interaction.engagementLevel >= 5 ? 'medium' : 'low'
        },
        lastUpdated: new Date().toISOString() // Move to top level where it belongs
      });
      
      console.log('📊 Updated personalization signals with PERMA insights');
    } catch (error) {
      console.error('❌ Error updating personalization signals:', error);
    }
  };

  // Add the missing applyAnalyticsUpdates function
  const applyAnalyticsUpdates = async (analytics: AnalyticsInteraction) => {
    if (!personalization) return;
    
    try {
      const updates: any = {};
      
      // Update PERMA scores if insights are provided
      if (analytics.permaInsights && typeof analytics.permaInsights === 'object') {
        updates.wellnessProfile = {
          ...personalization.wellnessProfile,
          currentScores: {
            ...personalization.wellnessProfile.currentScores,
            ...analytics.permaInsights
          }
        };
      }
      
      // Apply specific personalization updates
      if (analytics.personalizationUpdates) {
        const { personalizationUpdates } = analytics;
        
        // Update content preferences if provided
        if (personalizationUpdates.contentPreferences) {
          updates.contentPreferences = {
            ...personalization.contentPreferences,
            ...personalizationUpdates.contentPreferences
          };
        }
        
        // Update user core if provided
        if (personalizationUpdates.userCore) {
          updates.userCore = {
            ...personalization.userCore,
            ...personalizationUpdates.userCore
          };
        }
        
        // Update service preferences if provided
        if (personalizationUpdates.servicePreferences) {
          updates.servicePreferences = {
            ...personalization.servicePreferences,
            ...personalizationUpdates.servicePreferences
          };
        }
      }
      
      // Apply updates if any exist
      if (Object.keys(updates).length > 0) {
        await updateProfile({
          ...updates,
          lastUpdated: new Date().toISOString()
        });
        
        console.log('📈 Applied analytics updates to personalization');
      }
    } catch (error) {
      console.error('❌ Error applying analytics updates:', error);
    }
  };

  // Helper function to update preferred topics with engagement scoring
  const updatePreferredTopics = (
    currentTopics: Array<{ topic: string; score: number; permaDimension: string }>,
    newTopics: string[],
    engagementLevel: number,
    permaSignals?: Record<string, number>
  ) => {
    const topicsMap = new Map(currentTopics.map(t => [t.topic, t]));
    
    // Update scores for mentioned topics
    newTopics.forEach(topic => {
      const existing = topicsMap.get(topic);
      const scoreIncrement = engagementLevel / 10; // Convert 1-10 to 0.1-1.0
      
      if (existing) {
        // Boost existing topic score with decay factor
        existing.score = Math.min(10, existing.score * 0.95 + scoreIncrement);
      } else {
        // Add new topic with initial score
        topicsMap.set(topic, {
          topic,
          score: scoreIncrement * 5, // Start with moderate score
          permaDimension: inferPermaDimension(topic, permaSignals)
        });
      }
    });
    
    // Apply decay to all topics and sort by score
    const updatedTopics = Array.from(topicsMap.values())
      .map(t => ({ ...t, score: Math.max(0.1, t.score * 0.99) })) // Gentle decay
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Keep top 20 topics
    
    return updatedTopics;
  };

  // Helper to infer PERMA dimension from topic
  const inferPermaDimension = (topic: string, permaSignals?: Record<string, number>): string => {
    // Use PERMA signals if available
    if (permaSignals) {
      const maxSignal = Object.entries(permaSignals)
        .reduce((max, [dim, signal]) => signal > max.signal ? { dimension: dim, signal } : max, 
                { dimension: 'engagement', signal: 0 });
      if (maxSignal.signal > 0) return maxSignal.dimension;
    }
    
    // Topic-based mapping
    const topicLower = topic.toLowerCase();
    if (topicLower.includes('relationship') || topicLower.includes('social')) return 'relationships';
    if (topicLower.includes('goal') || topicLower.includes('achieve')) return 'accomplishment';
    if (topicLower.includes('meaning') || topicLower.includes('purpose')) return 'meaning';
    if (topicLower.includes('positive') || topicLower.includes('happy')) return 'positiveEmotion';
    
    return 'engagement'; // Default
  };

  const processTopicEngagement = async (engagement: TopicEngagement) => {
    if (!personalization) return;
    
    try {
      // Score new topic based on happiness sources and context
      const happinessScore = scoreNewChatTopic(
        engagement.topic, 
        personalization, 
        engagement.context
      );
      
      // Only add to emerging interests if it scores well
      if (happinessScore >= 7) {
        const currentEmergingInterests = personalization.contentPreferences.emergingInterests || [];
        
        // Add to emerging interests if not already present
        if (!currentEmergingInterests.includes(engagement.topic)) {
          const updatedEmergingInterests = [
            ...currentEmergingInterests.slice(-4), // Keep last 4
            engagement.topic
          ];
          
          // Update topic scores for future reference
          const currentTopicScores = personalization.contentPreferences.topicScores || {};
          const updatedTopicScores = {
            ...currentTopicScores,
            [engagement.topic.toLowerCase()]: Math.max(
              currentTopicScores[engagement.topic.toLowerCase()] || 0,
              happinessScore
            )
          };
          
          await updateProfile({
            contentPreferences: {
              ...personalization.contentPreferences,
              emergingInterests: updatedEmergingInterests,
              topicScores: updatedTopicScores
            }
          });
          
          console.log(`🎯 Topic "${engagement.topic}" added to emerging interests (score: ${happinessScore})`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing topic engagement:', error);
    }
  };

  const updateVideoPreferences = async (interaction: VideoInteraction) => {
    if (!personalization) return;
    
    try {
      const currentVideoMetrics = personalization.activityTracking.videoMetrics || {
        totalWatched: 0,
        completionRate: 0,
        likedTopics: [],
        skipgedTopics: [],
        watchTime: {}
      };
      
      // Calculate engagement score based on interaction type and watch time
      let engagementScore = 5; // neutral baseline
      
      if (interaction.interactionType === 'like') engagementScore = 9;
      else if (interaction.interactionType === 'dislike') engagementScore = 2;
      else if (interaction.interactionType === 'skip') engagementScore = 1;
      else if (interaction.interactionType === 'complete') engagementScore = 10;
      else if (interaction.interactionType === 'view' && interaction.watchDuration && interaction.totalDuration) {
        const completionPercent = interaction.watchDuration / interaction.totalDuration;
        engagementScore = Math.round(completionPercent * 10);
      }
      
      // Extract topics from video title and description
      const extractedTopics = extractTopicsFromVideo(interaction.title, interaction.channelTitle);
      
      // Update video metrics
      const updatedVideoMetrics = {
        totalWatched: currentVideoMetrics.totalWatched + 1,
        completionRate: interaction.watchDuration && interaction.totalDuration 
          ? ((currentVideoMetrics.completionRate * currentVideoMetrics.totalWatched) + 
             (interaction.watchDuration / interaction.totalDuration)) / (currentVideoMetrics.totalWatched + 1)
          : currentVideoMetrics.completionRate,
        likedTopics: interaction.interactionType === 'like' 
          ? [...new Set([...currentVideoMetrics.likedTopics, ...extractedTopics])]
          : currentVideoMetrics.likedTopics,
        skipgedTopics: interaction.interactionType === 'skip' || interaction.interactionType === 'dislike'
          ? [...new Set([...currentVideoMetrics.skipgedTopics, ...extractedTopics])]
          : currentVideoMetrics.skipgedTopics,
        watchTime: {
          ...currentVideoMetrics.watchTime,
          ...extractedTopics.reduce((acc, topic) => ({
            ...acc,
            [topic]: (currentVideoMetrics.watchTime[topic] || 0) + (interaction.watchDuration || 0) / 60 // minutes
          }), {})
        }
      };
      
      // Update preferred topics in chat metrics based on video engagement
      const currentChatMetrics = personalization.activityTracking.chatMetrics || {
        totalMessages: 0,
        positiveInteractions: 0,
        engagementStreak: 0,
        lastActiveTime: new Date().toISOString(),
        preferredTopics: []
      };
      
      const updatedPreferredTopics = updatePreferredTopics(
        currentChatMetrics.preferredTopics || [],
        extractedTopics,
        engagementScore,
        {}
      );
      
      // Update emerging interests based on high engagement
      let updatedEmergingInterests = personalization.contentPreferences.emergingInterests || [];
      if (engagementScore >= 8) {
        extractedTopics.forEach(topic => {
          if (!personalization.contentPreferences.primaryInterests.includes(topic) &&
              !updatedEmergingInterests.includes(topic)) {
            updatedEmergingInterests = [...updatedEmergingInterests.slice(-3), topic]; // Keep last 4 total
          }
        });
      }
      
      // Update topic scores
      const updatedTopicScores = { ...personalization.contentPreferences.topicScores };
      extractedTopics.forEach(topic => {
        const currentScore = updatedTopicScores[topic.toLowerCase()] || 5;
        const scoreChange = (engagementScore - 5) * 0.1; // Small incremental changes
        updatedTopicScores[topic.toLowerCase()] = Math.max(1, Math.min(10, currentScore + scoreChange));
      });
      
      await updateProfile({
        activityTracking: {
          ...personalization.activityTracking,
          videoMetrics: updatedVideoMetrics,
          chatMetrics: {
            ...currentChatMetrics,
            preferredTopics: updatedPreferredTopics
          }
        },
        contentPreferences: {
          ...personalization.contentPreferences,
          emergingInterests: updatedEmergingInterests,
          topicScores: updatedTopicScores
        },
        computed: {
          ...personalization.computed,
          lastEngagementType: 'video',
          engagementLevel: engagementScore >= 8 ? 'high' : engagementScore >= 5 ? 'medium' : 'low'
        },
        lastUpdated: new Date().toISOString()
      });
      
      console.log('📹 Updated video preferences:', {
        engagementScore,
        extractedTopics,
        totalWatched: updatedVideoMetrics.totalWatched,
        emergingInterests: updatedEmergingInterests.length
      });
      
    } catch (error) {
      console.error('❌ Error updating video preferences:', error);
    }
  };

  // Helper function to extract topics from video metadata
  const extractTopicsFromVideo = (title: string, channelTitle?: string): string[] => {
    const topics: string[] = [];
    const text = `${title} ${channelTitle || ''}`.toLowerCase();
    
    // Common topic patterns in video titles
    const topicPatterns = [
      /(?:how to|tutorial|guide).+?([a-z]+(?:\s+[a-z]+){0,2})/gi,
      /([a-z]+(?:\s+[a-z]+){0,2})(?:\s+(?:tips|advice|hacks|secrets))/gi,
      /(?:best|top|amazing|ultimate).+?([a-z]+(?:\s+[a-z]+){0,2})/gi,
      /([a-z]+(?:\s+[a-z]+){0,2})(?:\s+(?:workout|exercise|fitness))/gi,
      /([a-z]+(?:\s+[a-z]+){0,2})(?:\s+(?:cooking|recipe|food))/gi,
      /([a-z]+(?:\s+[a-z]+){0,2})(?:\s+(?:meditation|mindfulness|wellness))/gi,
      /([a-z]+(?:\s+[a-z]+){0,2})(?:\s+(?:productivity|motivation|success))/gi
    ];
    
    topicPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = match.trim();
          if (cleaned.length > 3 && cleaned.length < 25) {
            topics.push(cleaned);
          }
        });
      }
    });
    
    // Extract from channel title (often indicates niche)
    if (channelTitle) {
      const channelTopics = channelTitle.toLowerCase()
        .split(/[\s-_]+/)
        .filter(word => word.length > 3 && word.length < 15)
        .slice(0, 2); // Max 2 topics from channel
      topics.push(...channelTopics);
    }
    
    return [...new Set(topics)].slice(0, 5); // Max 5 unique topics
  };

  return {
    trackChatInteraction,
    trackAnalyticsResult,
    trackTopicEngagement,
    trackVideoInteraction
  };
}