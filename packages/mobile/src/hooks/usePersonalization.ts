import { useUnifiedPersonalization } from './useUnifiedPersonalization';
import { useInteractionTracking } from './useInteractionTracking';

export function usePersonalization(userId: string) {
  // Main personalization profile
  const {
    profile,
    loading,
    loadProfile,
    updateProfile,
    initializeFromAssessment,
    generateTopicQueries
  } = useUnifiedPersonalization(userId);

  // Real-time interaction tracking
  const {
    trackChatInteraction,
    trackTopicEngagement,
    trackAnalyticsResult
  } = useInteractionTracking(userId);

  return {
    // Core personalization
    profile,
    loading,
    loadProfile,
    updateProfile,
    initializeFromAssessment,
    generateTopicQueries,
    
    // Interaction tracking
    trackChatInteraction,
    trackTopicEngagement,
    trackAnalyticsResult
  };
}
