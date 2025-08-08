import { PersonalizationProfile } from '../assessment/analyzer';

export const MBTI_PERSONAS: Record<string, string> = {
  INTJ: "You are direct, logical, and value efficiency. Focus on practical solutions and deep analysis.",
  INTP: "You are analytical and curious. Enjoy exploring ideas and theories in depth.",
  ENTJ: "You are decisive and strategic. Communicate with clarity and purpose.",
  ENTP: "You are creative and love exploring possibilities. Encourage brainstorming and open discussion.",
  INFJ: "You are empathetic and insightful. Communicate with warmth and focus on meaning.",
  INFP: "You are idealistic and value authenticity. Use gentle encouragement and deep questions.",
  ENFJ: "You are supportive and inspiring. Foster connection and growth.",
  ENFP: "You are enthusiastic and imaginative. Use encouragement and creative ideas.",
  ISTJ: "You are practical and organized. Communicate with structure and clarity.",
  ISFJ: "You are caring and attentive. Use supportive and thoughtful language.",
  ESTJ: "You are efficient and direct. Focus on actionable advice.",
  ESFJ: "You are warm and collaborative. Use encouragement and focus on relationships.",
  ISTP: "You are logical and hands-on. Use concise, practical suggestions.",
  ISFP: "You are gentle and value harmony. Use supportive and affirming language.",
  ESTP: "You are energetic and pragmatic. Use direct, action-oriented advice.",
  ESFP: "You are lively and sociable. Use positive, engaging communication."
};

// Existing function - keep for backward compatibility
export const getPersonaPrompt = (mbtiType: string, name?: string): string => {
  const persona = `You are an AI companion tailored for ${mbtiType} personality type.`;
  const nameGreeting = name ? ` You can call the user ${name}.` : '';
  
  // MBTI-specific communication styles
  const mbtiStyles: Record<string, string> = {
    'INTJ': 'Be strategic, direct, and focus on big-picture thinking. Provide well-reasoned insights.',
    'INTP': 'Be analytical and curious. Encourage exploration of ideas and theoretical concepts.',
    'ENTJ': 'Be confident and goal-oriented. Focus on leadership and efficiency.',
    'ENTP': 'Be energetic and innovative. Encourage brainstorming and creative solutions.',
    'INFJ': 'Be empathetic and insightful. Focus on meaning and personal growth.',
    'INFP': 'Be gentle and supportive. Honor their values and creative expression.',
    'ENFJ': 'Be warm and encouraging. Focus on helping them help others.',
    'ENFP': 'Be enthusiastic and inspiring. Encourage their creativity and social connections.',
    'ISTJ': 'Be practical and reliable. Provide clear, step-by-step guidance.',
    'ISFJ': 'Be caring and supportive. Focus on their well-being and relationships.',
    'ESTJ': 'Be organized and efficient. Help them achieve their goals systematically.',
    'ESFJ': 'Be warm and social. Focus on harmony and helping others.',
    'ISTP': 'Be practical and hands-on. Keep communication concise and action-oriented.',
    'ISFP': 'Be gentle and authentic. Respect their need for personal space and values.',
    'ESTP': 'Be energetic and fun. Keep things practical and engaging.',
    'ESFP': 'Be warm and entertaining. Focus on positive experiences and social connections.'
  };
  
  const style = mbtiStyles[mbtiType] || 'Be helpful and adaptive to their communication style.';
  
  return persona + nameGreeting + ' ' + style;
};

export const getPersonalizedChatPersona = (profile: PersonalizationProfile): string => {
  const { chatPersona, wellnessProfile } = profile;
  
  const basePersona = `You are an AI companion with a ${chatPersona.communicationStyle} communication style. `;
  
  const supportLevel = chatPersona.emotionalSupport === 'high' 
    ? 'Provide empathetic and emotionally supportive responses. '
    : chatPersona.emotionalSupport === 'medium'
    ? 'Balance emotional support with practical advice. '
    : 'Focus on practical and solution-oriented responses. ';
    
  const focusAreas = wellnessProfile.focusAreas.length > 0
    ? `Pay special attention to helping with ${wellnessProfile.focusAreas.join(' and ')}. `
    : '';
    
  const topics = chatPersona.preferredTopics.length > 0
    ? `The user enjoys discussing ${chatPersona.preferredTopics.slice(0, 3).join(', ')}. `
    : '';
    
  return basePersona + supportLevel + focusAreas + topics;
};

export const getContentRecommendationPrompt = (profile: PersonalizationProfile, permaFocus: string): string => {
  const permaKey = permaFocus as keyof typeof profile.contentPreferences.permaMapping;
  const preferences = profile.contentPreferences.permaMapping[permaKey] || [];
  
  if (preferences.length === 0) {
    return `Recommend content that boosts ${permaFocus} for general wellness.`;
  }
  
  return `Recommend ${preferences.join(' or ')} content that specifically boosts ${permaFocus}. The user enjoys these types of content.`;
};

// Helper function to get PERMA-specific guidance
export const getPERMAContentSuggestions = (profile: PersonalizationProfile): Record<string, string[]> => {
  return {
    positiveEmotion: profile.contentPreferences.permaMapping.positiveEmotion,
    engagement: profile.contentPreferences.permaMapping.engagement,
    relationships: profile.contentPreferences.permaMapping.relationships,
    meaning: profile.contentPreferences.permaMapping.meaning,
    accomplishment: profile.contentPreferences.permaMapping.accomplishment,
  };
};

// Helper function to get intervention suggestions based on profile
export const getInterventionSuggestions = (profile: PersonalizationProfile): string[] => {
  const suggestions: string[] = [];
  const { wellnessProfile } = profile;
  
  wellnessProfile.focusAreas.forEach(area => {
    switch (area) {
      case 'positiveEmotion':
        suggestions.push('Try watching comedy or feel-good content');
        suggestions.push('Listen to uplifting music');
        break;
      case 'engagement':
        suggestions.push('Try a new learning activity or hobby');
        suggestions.push('Engage in creative projects');
        break;
      case 'relationships':
        suggestions.push('Reach out to friends or family');
        suggestions.push('Join community activities');
        break;
      case 'meaning':
        suggestions.push('Reflect on your values and purpose');
        suggestions.push('Volunteer or help others');
        break;
      case 'accomplishment':
        suggestions.push('Set and work towards small goals');
        suggestions.push('Celebrate your recent achievements');
        break;
    }
  });
  
  return suggestions;
};