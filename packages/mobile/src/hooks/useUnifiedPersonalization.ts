import { useState, useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { UnifiedPersonalizationProfile } from '../lib/personalization/types';
import { generateAllTopicSearchQueries } from '../lib/ai/topicGenerator';

export function useUnifiedPersonalization(userId: string) {
  const { getDocument, updateDocument } = useFirebase();
  const [profile, setProfile] = useState<UnifiedPersonalizationProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async (): Promise<UnifiedPersonalizationProfile | null> => {
    if (!userId) return null;
    
    setLoading(true);
    try {
      const result = await getDocument('userPersonalization', userId);
      if (result.success && result.data) {
        setProfile(result.data);
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('Error loading unified personalization profile:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, getDocument]);

  const updateProfile = useCallback(async (updates: Partial<UnifiedPersonalizationProfile>) => {
    if (!userId || !profile) return { success: false, error: 'No profile to update' };

    try {
      const updatedProfile = {
        ...profile,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      const result = await updateDocument('userPersonalization', userId, updatedProfile);
      if (result.success) {
        setProfile(updatedProfile);
      }
      return result;
    } catch (error) {
      console.error('Error updating unified personalization profile:', error);
      return { success: false, error: 'Failed to update profile' };
    }
  }, [userId, profile, updateDocument]);

  const initializeFromAssessment = useCallback(async (assessmentProfile: UnifiedPersonalizationProfile) => {
    if (!userId) return { success: false, error: 'No user ID' };

    try {
      // Save the initial profile
      const result = await updateDocument('userPersonalization', userId, assessmentProfile);
      
      if (result.success) {
        setProfile(assessmentProfile);
        
        // Generate topic search queries in the background
        generateTopicQueries(assessmentProfile);
        
        console.log('Unified personalization profile initialized successfully');
      }
      
      return result;
    } catch (error) {
      console.error('Error initializing unified personalization profile:', error);
      return { success: false, error: 'Failed to initialize profile' };
    }
  }, [userId, updateDocument]);

  const generateTopicQueries = useCallback(async (profileData?: UnifiedPersonalizationProfile) => {
    const currentProfile = profileData || profile;
    if (!currentProfile || !userId) return;

    try {
      console.log('Generating topic search queries for all user interests...');
      
      // Generate all topic queries in one request
      const batchResult = await generateAllTopicSearchQueries(currentProfile);
      
      if (batchResult.totalQueriesGenerated > 0) {
        // Update the profile with generated queries
        const updatedContentPreferences = {
          ...currentProfile.contentPreferences,
          topicSearchQueries: {
            ...currentProfile.contentPreferences.topicSearchQueries,
            ...batchResult.topicQueries
          },
          queryGeneration: {
            totalQueriesGenerated: batchResult.totalQueriesGenerated,
            generationVersion: batchResult.generationVersion,
            pendingTopics: [] // Clear pending topics
          }
        };

        await updateProfile({
          contentPreferences: updatedContentPreferences
        });

        console.log(`Generated ${batchResult.totalQueriesGenerated} search queries for ${Object.keys(batchResult.topicQueries).length} topics`);
      }
    } catch (error) {
      console.error('Error generating topic queries:', error);
    }
  }, [profile, userId, updateProfile]);

  return {
    profile,
    loading,
    loadProfile,
    updateProfile,
    initializeFromAssessment,
    generateTopicQueries
  };
}
