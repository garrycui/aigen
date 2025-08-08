import { useEffect, useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { AssessmentResult, PersonalizationProfile } from '../lib/assessment/analyzer';

// Simple in-memory cache for latest assessment per user
const assessmentCache: Record<string, AssessmentResult | null> = {};

// Function to clear cache for a specific user
export const clearAssessmentCache = (userId: string) => {
  delete assessmentCache[userId];
};

// Function to clear all cache
export const clearAllAssessmentCache = () => {
  Object.keys(assessmentCache).forEach(key => delete assessmentCache[key]);
};

export function useLatestAssessment(userId: string) {
  const { getUserAssessment } = useFirebase();
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAssessment = async (skipCache = false) => {
    if (!userId) return;
    
    // Check cache first
    if (!skipCache && assessmentCache[userId] !== undefined) {
      setAssessment(assessmentCache[userId]);
      return;
    }

    setLoading(true);
    
    try {
      const res = await getUserAssessment(userId);
      if (res.success && res.data.length > 0) {
        // Sort by creation date to get latest
        const sorted = res.data.slice().sort((a: any, b: any) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });
        
        const latest = sorted[0];
        
        // New analyzer always stores complete result object
        if (latest.result) {
          assessmentCache[userId] = latest.result;
          setAssessment(latest.result);
        } else {
          assessmentCache[userId] = null;
          setAssessment(null);
        }
      } else {
        assessmentCache[userId] = null;
        setAssessment(null);
      }
    } catch (error) {
      console.error('Error fetching assessment:', error);
      assessmentCache[userId] = null;
      setAssessment(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    
    // Check if we have cached data
    if (assessmentCache[userId] !== undefined) {
      setAssessment(assessmentCache[userId]);
    } else {
      fetchAssessment(false);
    }
  }, [userId]);

  // Core assessment status helpers
  const hasAssessment = !!assessment;
  const isLoaded = !loading && assessmentCache[userId] !== undefined;

  // === CHAT PERSONALIZATION HELPERS ===
  const getChatPersona = () => assessment?.personalization?.chatPersona;
  
  const getChatPrompt = () => {
    const persona = getChatPersona();
    if (!persona) return null;
    
    const basePersona = `You are an AI companion with a ${persona.communicationStyle} communication style. `;
    const supportLevel = persona.emotionalSupport === 'high' 
      ? 'Provide empathetic and emotionally supportive responses. '
      : persona.emotionalSupport === 'medium'
      ? 'Balance emotional support with practical advice. '
      : 'Focus on practical and solution-oriented responses. ';
    const topics = persona.preferredTopics.length > 0
      ? `The user enjoys discussing ${persona.preferredTopics.slice(0, 3).map(t => t.topic).join(', ')}. `
      : '';
    
    return basePersona + supportLevel + topics;
  };

  const getChatTopics = () => getChatPersona()?.preferredTopics || [];
  
  const getCommunicationStyle = () => getChatPersona()?.communicationStyle || 'supportive';
  
  const getEmotionalSupportLevel = () => getChatPersona()?.emotionalSupport || 'medium';

  // === CONTENT RECOMMENDATION HELPERS ===
  const getContentPreferences = () => assessment?.personalization?.contentPreferences;
  
  const getPrimaryInterests = () => getContentPreferences()?.primaryInterests || [];
  
  const getAvoidTopics = () => getContentPreferences()?.avoidTopics || [];
  
  const getContentByPERMA = (dimension: keyof PersonalizationProfile['contentPreferences']['permaMapping']) => {
    return getContentPreferences()?.permaMapping[dimension] || [];
  };
  
  const getContentForFocusAreas = () => {
    const focusAreas = getFocusAreas();
    const contentPrefs = getContentPreferences();
    if (!contentPrefs || !focusAreas.length) return [];
    
    const suggestions: string[] = [];
    focusAreas.forEach(area => {
      const areaContent = contentPrefs.permaMapping[area as keyof typeof contentPrefs.permaMapping] || [];
      suggestions.push(...areaContent.slice(0, 3)); // Top 3 per focus area
    });
    return [...new Set(suggestions)];
  };

  // === WELLNESS PROFILE HELPERS ===
  const getWellnessProfile = () => assessment?.personalization?.wellnessProfile;
  
  const getHappinessScores = () => getWellnessProfile()?.happinessScores || assessment?.happinessScores;
  
  const getFocusAreas = () => getWellnessProfile()?.focusAreas || [];
  
  const getStrengths = () => getWellnessProfile()?.strengths || [];
  
  const getSocialPreference = () => getWellnessProfile()?.interventionPreferences?.socialPreference || 'mixed';
  
  const getChallengeLevel = () => getWellnessProfile()?.interventionPreferences?.challengeLevel || 'medium';
  
  const getLowestPERMAScore = () => {
    const scores = getHappinessScores();
    if (!scores) return null;
    
    return Object.entries(scores).reduce((lowest, [dimension, score]) => 
      score < lowest.score ? { dimension, score } : lowest,
      { dimension: '', score: 10 }
    );
  };
  
  const getHighestPERMAScore = () => {
    const scores = getHappinessScores();
    if (!scores) return null;
    
    return Object.entries(scores).reduce((highest, [dimension, score]) => 
      score > highest.score ? { dimension, score } : highest,
      { dimension: '', score: 0 }
    );
  };

  // === SERVICE PERSONALIZATION HELPERS ===
  const getServicePersonalization = () => assessment?.personalization?.servicePersonalization;
  
  const getRecommendedServices = () => getServicePersonalization()?.recommendedServiceTypes || [];
  
  const getWellnessGoals = () => getServicePersonalization()?.wellnessGoals || [];
  
  const getServicePreferences = () => getServicePersonalization()?.servicePreferences;
  
  const getEngagementStyle = () => getServicePersonalization()?.engagementStyle;
  
  const getAvoidancePatterns = () => getServicePersonalization()?.avoidancePatterns || [];

  // === MBTI & PERSONALITY HELPERS ===
  const getMBTIType = () => assessment?.mbtiType;
  
  const getPersonalInfo = () => assessment?.personalInfo;
  
  const getUserName = () => getPersonalInfo()?.name;
  
  const getEmotionBaseline = () => assessment?.emotionBaseline || 5;

  // === COMPOSITE HELPERS FOR SPECIFIC USE CASES ===
  
  // For ProfileScreen display
  const getProfileData = () => ({
    hasAssessment,
    mbtiType: getMBTIType(),
    happinessScores: getHappinessScores(),
    focusAreas: getFocusAreas(),
    strengths: getStrengths(),
    primaryInterests: getPrimaryInterests(),
    communicationStyle: getCommunicationStyle(),
    emotionalSupport: getEmotionalSupportLevel(),
    recommendedServices: getRecommendedServices().slice(0, 3),
    wellnessGoals: getWellnessGoals().slice(0, 3),
    servicePreferences: getServicePreferences(),
    userName: getUserName()
  });
  
  // For ChatScreen personalization
  const getChatConfig = () => ({
    persona: getChatPrompt(),
    topics: getChatTopics().slice(0, 5),
    communicationStyle: getCommunicationStyle(),
    emotionalSupport: getEmotionalSupportLevel(),
    focusAreas: getFocusAreas(),
    userName: getUserName()
  });
  
  // For ContentScreen recommendations
  const getContentConfig = () => ({
    primaryInterests: getPrimaryInterests(),
    focusAreaContent: getContentForFocusAreas(),
    avoidTopics: getAvoidTopics(),
    permaMapping: getContentPreferences()?.permaMapping,
    lowestScore: getLowestPERMAScore(),
    socialPreference: getSocialPreference()
  });
  
  // For WellnessScreen interventions
  const getWellnessConfig = () => ({
    focusAreas: getFocusAreas(),
    strengths: getStrengths(),
    happinessScores: getHappinessScores(),
    challengeLevel: getChallengeLevel(),
    socialPreference: getSocialPreference(),
    recommendedServices: getRecommendedServices(),
    wellnessGoals: getWellnessGoals(),
    avoidancePatterns: getAvoidancePatterns()
  });

  // === ASSESSMENT METADATA ===
  const getAssessmentDate = () => assessment?.assessmentDate;
  const getAssessmentVersion = () => assessment?.version;
  const needsUpdate = () => {
    const version = getAssessmentVersion();
    return !version || version < '2.0';
  };

  return { 
    // Core data
    assessment,
    loading,
    hasAssessment,
    isLoaded,
    
    // Refresh function
    refresh: () => fetchAssessment(true),
    
    // Individual data accessors
    getChatPersona,
    getContentPreferences,
    getWellnessProfile,
    getServicePersonalization,
    getMBTIType,
    getPersonalInfo,
    
    // Specific data helpers
    getChatPrompt,
    getChatTopics,
    getCommunicationStyle,
    getEmotionalSupportLevel,
    getPrimaryInterests,
    getAvoidTopics,
    getContentByPERMA,
    getContentForFocusAreas,
    getHappinessScores,
    getFocusAreas,
    getStrengths,
    getSocialPreference,
    getChallengeLevel,
    getLowestPERMAScore,
    getHighestPERMAScore,
    getRecommendedServices,
    getWellnessGoals,
    getServicePreferences,
    getEngagementStyle,
    getAvoidancePatterns,
    getUserName,
    getEmotionBaseline,
    
    // Composite helpers for screens
    getProfileData,
    getChatConfig,
    getContentConfig,
    getWellnessConfig,
    
    // Metadata
    getAssessmentDate,
    getAssessmentVersion,
    needsUpdate
  };
}