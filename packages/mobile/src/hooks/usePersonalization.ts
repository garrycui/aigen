import { useUnifiedPersonalization } from './useUnifiedPersonalization';
import { useInteractionTracking } from './useInteractionTracking';
import { useEffect } from 'react';

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

  // Load profile on mount or when userId changes
  useEffect(() => {
    if (userId && !profile && !loading) {
      loadProfile();
    }
  }, [userId, profile, loading, loadProfile]);

  // Real-time interaction tracking
  const {
    trackChatInteraction,
    trackTopicEngagement,
    trackAnalyticsResult
  } = useInteractionTracking(userId);

  // Check if user has completed assessment
  const hasCompletedAssessment = Boolean(
    profile?.userCore?.mbtiType && 
    profile.userCore.mbtiType !== 'unknown' &&
    profile.contentPreferences?.primaryInterests &&
    profile.contentPreferences.primaryInterests.length > 0
  );

  return {
    // Core personalization
    profile,
    loading,
    loadProfile,
    updateProfile,
    initializeFromAssessment,
    generateTopicQueries,
    hasCompletedAssessment,
    
    // Interaction tracking
    trackChatInteraction,
    trackTopicEngagement,
    trackAnalyticsResult
  };
}
