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
      // Profile doesn't exist - user needs to complete assessment
      setProfile(null);
      return null;
    } catch (error) {
      console.error('Error loading unified personalization profile:', error);
      setProfile(null);
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

  const generateTopicQueries = useCallback(async (profileData?: UnifiedPersonalizationProfile) => {
    const currentProfile = profileData || profile;
    if (!currentProfile || !userId) {
      console.warn('🚫 Cannot generate topic queries: missing profile or userId');
      return;
    }

    const pendingTopics = currentProfile.contentPreferences?.queryGeneration?.pendingTopics || [];
    if (pendingTopics.length === 0) {
      console.log('✅ No pending topics to process for topic query generation');
      return;
    }

    // Validate that we have the required profile data
    if (!currentProfile.contentPreferences?.primaryInterests || currentProfile.contentPreferences.primaryInterests.length === 0) {
      console.error('❌ Cannot generate queries: no primary interests found in profile');
      return;
    }

    try {
      console.log('🎯 Generating topic search queries for all user interests...');
      console.log('📊 Processing topics:', {
        pendingTopicsCount: pendingTopics.length,
        pendingTopics: pendingTopics,
        userId: userId,
        primaryInterestsCount: currentProfile.contentPreferences.primaryInterests.length
      });
      
      // Generate all topic queries in one request
      const batchResult = await generateAllTopicSearchQueries(currentProfile);
      
      console.log('📈 Topic generation result:', {
        totalQueriesGenerated: batchResult.totalQueriesGenerated,
        topicsGenerated: Object.keys(batchResult.topicQueries).length,
        generationVersion: batchResult.generationVersion
      });
      
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
            pendingTopics: [], // Clear pending topics
            lastGeneratedAt: new Date().toISOString()
          }
        };

        console.log('💾 Updating profile with generated queries...');
        const updateResult = await updateDocument('userPersonalization', userId, {
          contentPreferences: updatedContentPreferences,
          lastUpdated: new Date().toISOString()
        });

        if (updateResult.success) {
          // Update local state with the new data
          setProfile(prev => prev ? {
            ...prev,
            contentPreferences: updatedContentPreferences,
            lastUpdated: new Date().toISOString()
          } : null);
          
          console.log(`✅ Successfully generated ${batchResult.totalQueriesGenerated} search queries for ${Object.keys(batchResult.topicQueries).length} topics`);
        } else {
          console.error('❌ Failed to save generated queries to profile:', updateResult.error);
        }
      } else {
        console.warn('⚠️ No queries were generated, updating last attempt timestamp');
        await updateDocument('userPersonalization', userId, {
          contentPreferences: {
            ...currentProfile.contentPreferences,
            queryGeneration: {
              ...currentProfile.contentPreferences.queryGeneration,
              lastGeneratedAt: new Date().toISOString()
            }
          },
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ Error generating topic queries:', error);
      
      // Update last attempt timestamp even on failure
      try {
        await updateDocument('userPersonalization', userId, {
          contentPreferences: {
            ...currentProfile.contentPreferences,
            queryGeneration: {
              ...currentProfile.contentPreferences.queryGeneration,
              lastGeneratedAt: new Date().toISOString()
            }
          },
          lastUpdated: new Date().toISOString()
        });
      } catch (updateError) {
        console.error('❌ Failed to update last attempt timestamp:', updateError);
      }
    }
  }, [profile, userId, updateDocument]);

  const initializeFromAssessment = useCallback(async (assessmentProfile: UnifiedPersonalizationProfile) => {
    if (!userId) return { success: false, error: 'No user ID' };

    try {
      // Ensure the profile has pending topics set up for generation
      const profileWithPendingTopics = {
        ...assessmentProfile,
        contentPreferences: {
          ...assessmentProfile.contentPreferences,
          topicSearchQueries: {},
          queryGeneration: {
            totalQueriesGenerated: 0,
            generationVersion: '3.0',
            pendingTopics: assessmentProfile.contentPreferences.primaryInterests || [],
            lastGeneratedAt: new Date().toISOString()
          }
        }
      };

      console.log('💾 Saving initial profile with pending topics:', {
        userId,
        pendingTopicsCount: profileWithPendingTopics.contentPreferences.queryGeneration.pendingTopics.length,
        primaryInterestsCount: assessmentProfile.contentPreferences.primaryInterests.length,
        pendingTopics: profileWithPendingTopics.contentPreferences.queryGeneration.pendingTopics,
        profileStructure: {
          hasContentPreferences: !!profileWithPendingTopics.contentPreferences,
          hasQueryGeneration: !!profileWithPendingTopics.contentPreferences.queryGeneration,
          hasWellnessProfile: !!profileWithPendingTopics.wellnessProfile,
          hasUserCore: !!profileWithPendingTopics.userCore
        }
      });

      // Save the initial profile
      const result = await updateDocument('userPersonalization', userId, profileWithPendingTopics);
      
      if (result.success) {
        setProfile(profileWithPendingTopics);
        
        console.log('✅ Unified personalization profile initialized successfully');
        console.log('🎯 Starting topic search queries generation...');
        
        // Generate topic search queries in the background with a small delay
        setTimeout(() => {
          generateTopicQueries(profileWithPendingTopics).catch(error => {
            console.error('⚠️ Topic generation failed but profile was saved:', error);
          });
        }, 1000); // 1 second delay to ensure profile is fully saved
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error initializing unified personalization profile:', error);
      return { success: false, error: 'Failed to initialize profile' };
    }
  }, [userId, updateDocument, generateTopicQueries]);

  return {
    profile,
    loading,
    loadProfile,
    updateProfile,
    initializeFromAssessment,
    generateTopicQueries
  };
}
