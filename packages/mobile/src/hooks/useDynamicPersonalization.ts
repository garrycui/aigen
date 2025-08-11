import { useEffect, useState, useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { PersonalizationProfile } from '../lib/assessment/analyzer';

interface DynamicPersonalizationProfile extends PersonalizationProfile {
  // Enhanced with learning data
  chatPersona: PersonalizationProfile['chatPersona'] & {
    learningPatterns: {
      responsePreferences: string[];
      engagementTriggers: string[];
      avoidancePatterns: string[];
    };
  };
  contentPreferences: PersonalizationProfile['contentPreferences'] & {
    dynamicInterests: {
      emerging: string[];
      declining: string[];
      seasonal: Record<string, string[]>;
    };
  };
  wellnessProfile: PersonalizationProfile['wellnessProfile'] & {
    progressTracking: {
      trendingUp: string[];
      needsAttention: string[];
      interventionSuccess: Record<string, number>;
    };
  };
  // Metadata
  baseAssessmentId: string;
  lastUpdated: string;
  updateCount: number;
  version: string;
}

// Cache for personalization data
const personalizationCache: Record<string, DynamicPersonalizationProfile | null> = {};

export function useDynamicPersonalization(userId: string) {
  const { getDocument, updateDocument, createDocument, updateUserPersonalization } = useFirebase();
  const [personalization, setPersonalization] = useState<DynamicPersonalizationProfile | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true

  const fetchPersonalization = useCallback(async (skipCache = false) => {
    if (!userId) {
      console.log('Debug - No userId provided to fetchPersonalization');
      setLoading(false);
      return;
    }
    
    if (!skipCache && personalizationCache[userId] !== undefined) {
      console.log('Debug - Using cached personalization for user:', userId);
      setPersonalization(personalizationCache[userId]);
      setLoading(false);
      return;
    }

    console.log('Debug - Fetching personalization from Firebase for user:', userId);
    setLoading(true);
    try {
      const result = await getDocument('userPersonalization', userId);
      console.log('Debug - Personalization fetch result:', result.success);
      
      if (result.success && result.data) {
        console.log('Debug - Personalization data found');
        personalizationCache[userId] = result.data;
        setPersonalization(result.data);
      } else {
        console.log('Debug - No personalization data found');
        personalizationCache[userId] = null;
        setPersonalization(null);
      }
    } catch (error) {
      console.error('Error fetching personalization:', error);
      personalizationCache[userId] = null;
      setPersonalization(null);
    } finally {
      setLoading(false);
    }
  }, [userId, getDocument]);

  // Update specific personalization aspects
  const updatePersonalization = useCallback(async (
    updates: Partial<DynamicPersonalizationProfile>
  ) => {
    if (!userId || !personalization) return;

    try {
      const updatedData = {
        ...personalization,
        ...updates,
        lastUpdated: new Date().toISOString(),
        updateCount: (personalization.updateCount || 0) + 1
      };

      // Use updateUserPersonalization instead of updateDocument
      const result = await updateUserPersonalization(userId, updatedData);
      
      if (result.success) {
        // Update cache
        personalizationCache[userId] = updatedData;
        setPersonalization(updatedData);
        console.log('Debug - Personalization updated successfully');
      }
      
      return result;
    } catch (error) {
      console.error('Error updating personalization:', error);
      return { success: false, error };
    }
  }, [userId, personalization, updateUserPersonalization]);

  // Initialize from assessment
  const initializeFromAssessment = useCallback(async (
    assessmentResult: any, 
    assessmentId: string
  ) => {
    if (!userId) return;

    console.log('Debug - Initializing personalization from assessment for user:', userId);

    const initialPersonalization: DynamicPersonalizationProfile = {
      ...assessmentResult.personalization,
      chatPersona: {
        ...assessmentResult.personalization.chatPersona,
        learningPatterns: {
          responsePreferences: [],
          engagementTriggers: [],
          avoidancePatterns: []
        }
      },
      contentPreferences: {
        ...assessmentResult.personalization.contentPreferences,
        dynamicInterests: {
          emerging: [],
          declining: [],
          seasonal: {}
        }
      },
      wellnessProfile: {
        ...assessmentResult.personalization.wellnessProfile,
        progressTracking: {
          trendingUp: [],
          needsAttention: [],
          interventionSuccess: {}
        }
      },
      baseAssessmentId: assessmentId,
      lastUpdated: new Date().toISOString(),
      updateCount: 0,
      version: '1.0'
    };

    try {
      // Use updateUserPersonalization to ensure document creation
      const result = await updateUserPersonalization(userId, initialPersonalization);
      
      if (result.success) {
        personalizationCache[userId] = initialPersonalization;
        setPersonalization(initialPersonalization);
        console.log('Debug - Personalization initialized successfully');
      }
      
      return result;
    } catch (error) {
      console.error('Error initializing personalization:', error);
      return { success: false, error };
    }
  }, [userId, updateUserPersonalization]);

  useEffect(() => {
    if (userId) {
      console.log('Debug - useEffect triggered for user:', userId);
      fetchPersonalization();
    } else {
      setLoading(false);
    }
  }, [fetchPersonalization, userId]);

  return {
    personalization,
    loading,
    updatePersonalization,
    initializeFromAssessment,
    refresh: () => fetchPersonalization(true)
  };
}