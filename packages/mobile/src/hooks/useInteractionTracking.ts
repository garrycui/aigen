import { useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { useDynamicPersonalization } from './useDynamicPersonalization';

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

export function useInteractionTracking(userId: string) {
  const { createDocument } = useFirebase();
  const { personalization, updatePersonalization } = useDynamicPersonalization(userId);

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
        type: 'message',
        data: cleanInteraction,
        timestamp: new Date().toISOString(),
        processed: false
      });
      await updateQuickPersonalizationSignals(interaction);
    } catch (error) {
      console.error('Error tracking chat interaction:', error);
    }
  }, [userId, personalization]);

  const trackAnalyticsResult = useCallback(async (analytics: AnalyticsInteraction) => {
    if (!userId) return;
    try {
      await createDocument('userInteractions', {
        userId,
        type: 'analytics_result',
        data: analytics,
        timestamp: new Date().toISOString(),
        processed: false
      });
      if (personalization && analytics.personalizationUpdates) {
        const updates: any = {};
        if (analytics.personalizationUpdates.chatPersona) {
          updates.chatPersona = {
            ...personalization.chatPersona,
            ...analytics.personalizationUpdates.chatPersona
          };
        }
        if (analytics.personalizationUpdates.contentPreferences) {
          updates.contentPreferences = {
            ...personalization.contentPreferences,
            ...analytics.personalizationUpdates.contentPreferences
          };
        }
        if (analytics.personalizationUpdates.wellnessProfile) {
          updates.wellnessProfile = {
            ...personalization.wellnessProfile,
            ...analytics.personalizationUpdates.wellnessProfile
          };
        }
        Object.keys(analytics.personalizationUpdates).forEach(key => {
          if (!['chatPersona', 'contentPreferences', 'wellnessProfile'].includes(key)) {
            updates[key] = analytics.personalizationUpdates[key];
          }
        });
        updates.wellnessProfile = {
          ...updates.wellnessProfile,
          permaScores: analytics.permaInsights,
          lastAnalysis: new Date().toISOString()
        };
        if (Object.keys(updates).length > 0) {
          await updatePersonalization(updates);
        }
      }
    } catch (e) {
      console.error('Error tracking analytics result:', e);
    }
  }, [userId, personalization, updatePersonalization]);

  const updateQuickPersonalizationSignals = async (interaction: ChatInteraction) => {
    if (!personalization) return;
    const quick: any = {
      signals: {
        lastActiveTime: new Date().toISOString(),
        dailyMessageCount: (personalization.signals?.dailyMessageCount || 0) + 1,
        recentPositiveInteractions:
          interaction.sentiment === 'positive' && interaction.engagementLevel >= 7
            ? Math.min((personalization.signals?.recentPositiveInteractions || 0) + 1, 10)
            : personalization.signals?.recentPositiveInteractions || 0,
        highEngagementStreak:
          interaction.engagementLevel >= 8
            ? (personalization.signals?.highEngagementStreak || 0) + 1
            : interaction.engagementLevel <= 3
              ? 0
              : personalization.signals?.highEngagementStreak || 0
      }
    };
    await updatePersonalization(quick);
  };

  return {
    trackChatInteraction,
    trackAnalyticsResult
  };
}