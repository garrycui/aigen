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
  const { getDocument, updateDocument, createDocument } = useFirebase();
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
        ...updates,
        lastUpdated: new Date().toISOString(),
        updateCount: (personalization.updateCount || 0) + 1
      };

      await updateDocument('userPersonalization', userId, updatedData);
      
      // Update cache
      const newPersonalization = { ...personalization, ...updatedData };
      personalizationCache[userId] = newPersonalization;
      setPersonalization(newPersonalization);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating personalization:', error);
      return { success: false, error };
    }
  }, [userId, personalization, updateDocument]);

  // Initialize from assessment
  const initializeFromAssessment = useCallback(async (
    assessmentResult: any, 
    assessmentId: string
  ) => {
    if (!userId) return;

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
      await updateDocument('userPersonalization', userId, initialPersonalization);
      personalizationCache[userId] = initialPersonalization;
      setPersonalization(initialPersonalization);
      return { success: true };
    } catch (error) {
      console.error('Error initializing personalization:', error);
      return { success: false, error };
    }
  }, [userId, updateDocument]);

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