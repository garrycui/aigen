export interface PersonalizationProfile {
  // Chat personalization - core for AI conversations
  chatPersona: {
    mbtiType: string;
    communicationStyle: 'direct' | 'supportive' | 'analytical' | 'creative';
    preferredTopics: Array<{
      topic: string;
      permaDimension: string;
      score: number;
    }>;
    emotionalSupport: 'high' | 'medium' | 'low';
  };
  
  // Content recommendation - core for video/content suggestions
  contentPreferences: {
    permaMapping: {
      positiveEmotion: string[];
      engagement: string[];
      relationships: string[];
      meaning: string[];
      accomplishment: string[];
    };
    primaryInterests: string[]; // Top interests across all categories
    avoidTopics: string[]; // Topics to avoid based on low scores/preferences
  };
  
  // Wellness targeting - core for happiness improvement
  wellnessProfile: {
    happinessScores: {
      positiveEmotion: number;
      engagement: number;
      relationships: number;
      meaning: number;
      accomplishment: number;
    };
    focusAreas: string[]; // Areas needing improvement
    strengths: string[]; // Areas that are strong
    interventionPreferences: {
      socialPreference: 'solo' | 'social' | 'mixed';
      challengeLevel: 'low' | 'medium' | 'high';
    };
  };
  
  // Service personalization - core for service marketplace recommendations
  servicePersonalization: {
    recommendedServiceTypes: string[]; // Types of services to prioritize
    servicePreferences: {
      deliveryMethod: 'digital' | 'human-guided' | 'hybrid' | 'self-directed';
      sessionLength: 'short' | 'medium' | 'long' | 'flexible';
      frequency: 'daily' | 'weekly' | 'as-needed' | 'intensive';
      costSensitivity: 'budget' | 'moderate' | 'premium';
    };
    wellnessGoals: string[]; // Specific wellness outcomes user is seeking
    avoidancePatterns: string[]; // Service types/approaches to avoid
    engagementStyle: {
      preferredTime: 'morning' | 'afternoon' | 'evening' | 'flexible';
      motivationType: 'self-driven' | 'guided' | 'community' | 'gamified';
      learningPreference: 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'mixed';
    };
  };
}

export interface AssessmentResult {
  mbtiType: string;
  personalInfo: {
    name?: string;
    happyEvents?: string;
    flowActivity?: string;
    proudAchievement?: string;
  };
  
  happinessScores: {
    positiveEmotion: number;
    engagement: number;
    relationships: number;
    meaning: number;
    accomplishment: number;
  };
  
  personalization: PersonalizationProfile;
  
  emotionBaseline: number;
  assessmentDate: string;
  version: string;
}

export const analyzeMBTI = (responses: Record<string, string | string[]>): string => {
  if (typeof responses['mbti_input'] === 'string' && responses['mbti_input'].length === 4) {
    return responses['mbti_input'].toUpperCase();
  }
  let result = '';
  const ei = responses['mbti_ei'];
  result += (typeof ei === 'string' && ei.toLowerCase().includes('others')) ? 'E' : 'I';
  const sn = responses['mbti_sn'];
  result += (typeof sn === 'string' && sn.toLowerCase().includes('tangible')) ? 'S' : 'N';
  const tf = responses['mbti_tf'];
  result += (typeof tf === 'string' && tf.toLowerCase().includes('logical')) ? 'T' : 'F';
  const jp = responses['mbti_jp'];
  result += (typeof jp === 'string' && jp.toLowerCase().includes('plan')) ? 'J' : 'P';
  return result;
};

export const analyzePERMA = (responses: Record<string, string | string[]>): AssessmentResult['happinessScores'] => {
  // Get selected categories from content_preferences
  const selectedCategories = Array.isArray(responses['content_preferences_categories']) 
    ? responses['content_preferences_categories'] 
    : [];

  // Map category labels to PERMA dimensions (based on your question definition)
  const categoryToDimension: Record<string, string> = {
    "Positive Emotion (PE)": "PE",
    "Engagement (E)": "E", 
    "Relationships (R)": "R",
    "Meaning (M)": "M",
    "Accomplishment (A)": "A"
  };

  // Count categories selected per PERMA dimension
  const permaCategoryCounts = {
    PE: 0,
    E: 0, 
    R: 0,
    M: 0,
    A: 0
  };

  selectedCategories.forEach(category => {
    const dimension = categoryToDimension[category as string];
    if (dimension && permaCategoryCounts[dimension as keyof typeof permaCategoryCounts] !== undefined) {
      permaCategoryCounts[dimension as keyof typeof permaCategoryCounts]++;
    }
  });

  // Positive Emotion (P)
  let positiveEmotion = 0;
  const mood = Number(responses['current_mood'] ?? 5);
  const weekHappiness = Number(responses['past_week_happiness'] ?? 5);
  positiveEmotion = Math.round((mood + weekHappiness) / 2);

  // If user shared happy events, boost score slightly
  if (typeof responses['pe_happy_events'] === 'string' && responses['pe_happy_events'].trim().length > 0) {
    positiveEmotion = Math.min(positiveEmotion + 1, 10);
  }

  // Boost based on PE category selection
  positiveEmotion = Math.min(positiveEmotion + (permaCategoryCounts.PE * 2), 10);

  // Engagement (E)
  let engagement = 0;
  const contentPrefs = Array.isArray(responses['content_preferences']) ? responses['content_preferences'] : [];
  engagement += Math.min(contentPrefs.length * 1, 4); // reduced multiplier since we now count categories too
  if (contentPrefs.includes('Gaming / Live Streams')) engagement += 1;
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Learning')) engagement += 2;
  if (typeof responses['flow_challenge'] === 'string' && responses['flow_challenge'] === 'Yes') engagement += 2;
  if (typeof responses['e_flow_activity'] === 'string' && responses['e_flow_activity'].trim().length > 0) engagement += 1;
  
  // Boost based on E category selection
  engagement = Math.min(engagement + (permaCategoryCounts.E * 2), 10);

  // Relationships (R)
  let relationships = 0;
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Connecting')) relationships += 2;
  if (typeof responses['coping_preference'] === 'string' && responses['coping_preference'].includes('Talk')) relationships += 2;
  const rels = Array.isArray(responses['r_important_relationships']) ? responses['r_important_relationships'] : [];
  relationships += Math.min(rels.length, 4); // up to 4 for relationships selected
  
  // Boost based on R category selection
  relationships = Math.min(relationships + (permaCategoryCounts.R * 2), 10);

  // Meaning (M)
  let meaning = 0;
  const burnout = Number(responses['stress_burnout'] ?? 5);
  meaning += Math.max(10 - burnout, 0); // inverse of stress
  if (typeof responses['meaningful_content'] === 'string' && responses['meaningful_content'].trim().length > 0) meaning += 1;
  const sources = Array.isArray(responses['m_meaning_sources']) ? responses['m_meaning_sources'] : [];
  meaning += Math.min(sources.length, 3); // up to 3 for meaning sources
  
  // Boost based on M category selection
  meaning = Math.min(meaning + (permaCategoryCounts.M * 2), 10);

  // Accomplishment (A)
  let accomplishment = 0;
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Creating')) accomplishment += 2;
  if (typeof responses['reward_preference'] === 'string' && responses['reward_preference'].includes('badge')) accomplishment += 2;
  if (typeof responses['a_proud_achievement'] === 'string' && responses['a_proud_achievement'].trim().length > 0) accomplishment += 2;
  
  // Boost based on A category selection
  accomplishment = Math.min(accomplishment + (permaCategoryCounts.A * 2), 10);

  return {
    positiveEmotion,
    engagement,
    relationships,
    meaning,
    accomplishment,
  };
};

// Streamlined topic extraction focused on chat and content recommendations
const extractTopicsFromResponses = (responses: Record<string, string | string[]>): { topics: string[], scores: Record<string, number> } => {
  const topics: string[] = [];
  const topicScores: Record<string, number> = {};
  
  const addTopic = (topic: string, weight: number = 1) => {
    const cleanTopic = topic.toLowerCase().trim();
    if (cleanTopic.length > 2 && !['the', 'and', 'for', 'with', 'that', 'this'].includes(cleanTopic)) {
      topics.push(cleanTopic);
      topicScores[cleanTopic] = (topicScores[cleanTopic] || 0) + weight;
    }
  };

  // Core content preferences (high weight for video recommendations)
  const contentPrefs = Array.isArray(responses['content_preferences']) ? responses['content_preferences'] : [];
  contentPrefs.forEach(pref => addTopic(pref, 3));
  
  // Happiness drivers (important for chat personalization)
  if (typeof responses['happiness_driver'] === 'string') {
    addTopic(responses['happiness_driver'], 3);
  }
  
  // Text responses (rich source for chat topics)
  const textResponses = {
    pe_happy_events: responses['pe_happy_events'],
    e_flow_activity: responses['e_flow_activity'],
    a_proud_achievement: responses['a_proud_achievement']
  };
  
  Object.values(textResponses).forEach(response => {
    if (typeof response === 'string' && response.trim().length > 0) {
      const keywords = extractKeywordsFromText(response);
      keywords.forEach(keyword => addTopic(keyword, 2));
    }
  });
  
  return { topics: [...new Set(topics)], scores: topicScores };
};

// Simplified keyword extraction focused on actionable topics
const extractKeywordsFromText = (text: string): string[] => {
  const keywords: string[] = [];
  const lowercaseText = text.toLowerCase();
  
  // Core activity patterns for content recommendations
  const activityPatterns = [
    'cooking', 'reading', 'writing', 'music', 'exercise', 'travel', 'learning', 
    'gaming', 'art', 'technology', 'nature', 'sports', 'meditation', 'family'
  ];
  
  // Core emotion/topic patterns for chat personalization
  const topicPatterns = [
    'fun', 'joy', 'success', 'creativity', 'growth', 'friendship', 'love',
    'achievement', 'challenge', 'relaxation', 'adventure', 'purpose'
  ];
  
  activityPatterns.forEach(activity => {
    if (lowercaseText.includes(activity)) keywords.push(activity);
  });
  
  topicPatterns.forEach(topic => {
    if (lowercaseText.includes(topic)) keywords.push(topic);
  });
  
  return [...new Set(keywords)];
};

// Focused PERMA mapping for content and chat
const mapTopicsToPerma = (topics: string[], scores: Record<string, number>): Record<string, Array<{topic: string, score: number}>> => {
  const permaTopics = {
    positiveEmotion: [] as Array<{topic: string, score: number}>,
    engagement: [] as Array<{topic: string, score: number}>, 
    relationships: [] as Array<{topic: string, score: number}>,
    meaning: [] as Array<{topic: string, score: number}>,
    accomplishment: [] as Array<{topic: string, score: number}>
  };
  
  topics.forEach(topic => {
    const lowerTopic = topic.toLowerCase();
    const score = scores[lowerTopic] || 1;
    
    // Positive Emotion: entertainment, fun, comfort
    if (['comedy', 'humor', 'music', 'fun', 'joy', 'relax', 'nature', 'animals'].some(pe => lowerTopic.includes(pe))) {
      permaTopics.positiveEmotion.push({topic, score});
    }
    
    // Engagement: learning, creating, challenging activities
    if (['learning', 'creative', 'gaming', 'technology', 'art', 'skill', 'challenge'].some(e => lowerTopic.includes(e))) {
      permaTopics.engagement.push({topic, score});
    }
    
    // Relationships: social connections, family, community
    if (['family', 'friend', 'social', 'community', 'love', 'support'].some(r => lowerTopic.includes(r))) {
      permaTopics.relationships.push({topic, score});
    }
    
    // Meaning: purpose, growth, helping others
    if (['growth', 'purpose', 'help', 'spiritual', 'meaningful', 'impact'].some(m => lowerTopic.includes(m))) {
      permaTopics.meaning.push({topic, score});
    }
    
    // Accomplishment: success, goals, achievements
    if (['success', 'achievement', 'goal', 'career', 'fitness', 'skill'].some(a => lowerTopic.includes(a))) {
      permaTopics.accomplishment.push({topic, score});
    }
  });
  
  // Sort by score for prioritization
  Object.keys(permaTopics).forEach(key => {
    permaTopics[key as keyof typeof permaTopics].sort((a, b) => b.score - a.score);
  });
  
  return permaTopics;
};

// Streamlined emotional support determination
const determineEmotionalSupport = (
  responses: Record<string, string | string[]>,
  happinessScores: AssessmentResult['happinessScores']
): 'high' | 'medium' | 'low' => {
  let supportScore = 0;
  
  // Low happiness indicators
  if (happinessScores.positiveEmotion <= 4) supportScore += 2;
  if (Number(responses['current_mood'] ?? 5) <= 4) supportScore += 2;
  
  // Stress indicators
  if (Number(responses['stress_burnout'] ?? 5) >= 7) supportScore += 2;
  
  // Multiple low PERMA scores indicate need for higher support
  const lowScores = Object.values(happinessScores).filter(score => score <= 4).length;
  if (lowScores >= 2) supportScore += 1;
  
  if (supportScore >= 4) return 'high';
  if (supportScore >= 2) return 'medium';
  return 'low';
};

// Enhanced primary interests determination
const determinePrimaryInterests = (
  responses: Record<string, string | string[]>,
  topicScores: Record<string, number>,
  permaMapping: Record<string, string[]>
): string[] => {
  const interestCandidates: Array<{ topic: string; score: number; source: string }> = [];
  
  // 1. Explicit content preferences (high weight)
  const contentPrefs = Array.isArray(responses['content_preferences']) ? responses['content_preferences'] : [];
  contentPrefs.forEach(pref => {
    interestCandidates.push({ topic: pref, score: 10, source: 'explicit' });
  });
  
  // 2. Happiness drivers (very high weight)
  if (typeof responses['happiness_driver'] === 'string') {
    interestCandidates.push({ topic: responses['happiness_driver'], score: 15, source: 'driver' });
  }
  
  // 3. Flow activities (high weight for engagement)
  if (typeof responses['e_flow_activity'] === 'string' && responses['e_flow_activity'].trim().length > 0) {
    const flowKeywords = extractKeywordsFromText(responses['e_flow_activity']);
    flowKeywords.forEach(keyword => {
      interestCandidates.push({ topic: keyword, score: 12, source: 'flow' });
    });
  }
  
  // 4. Text response topics (medium weight)
  Object.values(topicScores).forEach((score, index) => {
    const topic = Object.keys(topicScores)[index];
    if (score > 1) { // Only topics mentioned multiple times
      interestCandidates.push({ topic, score: score * 3, source: 'text' });
    }
  });
  
  // 5. PERMA dimension topics (weighted by strength)
  Object.entries(permaMapping).forEach(([dimension, topics]) => {
    const isStrengthArea = ['positiveEmotion', 'engagement'].includes(dimension); // Areas typically showing strength
    const weight = isStrengthArea ? 8 : 6;
    
    topics.slice(0, 3).forEach((topic, index) => { // Top 3 per dimension
      const positionBonus = 3 - index;
      interestCandidates.push({ 
        topic, 
        score: weight + positionBonus, 
        source: `perma_${dimension}` 
      });
    });
  });
  
  // Aggregate and deduplicate
  const aggregatedInterests: Record<string, number> = {};
  interestCandidates.forEach(({ topic, score }) => {
    const cleanTopic = topic.toLowerCase().trim();
    aggregatedInterests[cleanTopic] = (aggregatedInterests[cleanTopic] || 0) + score;
  });
  
  // Return top interests sorted by score
  return Object.entries(aggregatedInterests)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8) // Top 8 primary interests
    .map(([topic]) => topic);
};

// Determine topics to avoid based on user patterns
const determineAvoidTopics = (
  responses: Record<string, string | string[]>,
  happinessScores: AssessmentResult['happinessScores'],
  selectedInterests: string[]
): string[] => {
  const avoidCandidates: string[] = [];
  
  // 1. Topics from very low PERMA dimensions
  const veryLowDimensions = Object.entries(happinessScores)
    .filter(([, score]) => score <= 2)
    .map(([dimension]) => dimension);
  
  if (veryLowDimensions.includes('positiveEmotion')) {
    avoidCandidates.push('negative news', 'conflict content', 'stress-inducing');
  }
  
  if (veryLowDimensions.includes('relationships')) {
    avoidCandidates.push('social pressure', 'competitive social');
  }
  
  if (veryLowDimensions.includes('meaning')) {
    avoidCandidates.push('superficial content', 'mindless entertainment');
  }
  
  // 2. High stress indicators
  const stressBurnout = Number(responses['stress_burnout'] ?? 5);
  if (stressBurnout >= 8) {
    avoidCandidates.push('high-pressure activities', 'time-intensive', 'perfectionism-focused');
  }
  
  // 3. Personality-based avoidances
  const mbtiType = responses['mbti_input'] as string || 'XXXX';
  if (mbtiType.includes('I')) {
    avoidCandidates.push('large group activities', 'public speaking');
  }
  if (mbtiType.includes('S')) {
    avoidCandidates.push('abstract theory', 'highly conceptual');
  }
  
  // 4. Avoid content categories not selected (implicit preferences)
  const allContentOptions = [
    'Comedy / Humor', 'Feel-good Content', 'Music / Entertainment', 'Animals / Nature',
    'Gaming / Interactive', 'Learning / Education', 'Technology / Science',
    'Relationships / Social', 'Family / Parenting', 'Community / Events',
    'Philosophy / Deep Topics', 'News / Current Events'
  ];
  
  const notSelected = allContentOptions.filter(option => !selectedInterests.includes(option.toLowerCase()));
  if (notSelected.length > 6) { // Only if they were very selective
    avoidCandidates.push(...notSelected.slice(0, 3).map(opt => opt.toLowerCase()));
  }
  
  return [...new Set(avoidCandidates)].slice(0, 5); // Top 5 avoid topics
};

// Enhanced challenge level determination
const determineChallengeLevel = (
  responses: Record<string, string | string[]>,
  happinessScores: AssessmentResult['happinessScores'],
  mbtiType: string
): 'low' | 'medium' | 'high' => {
  let challengeScore = 0;
  
  // 1. Explicit flow challenge preference (strong indicator)
  if (typeof responses['flow_challenge'] === 'string' && responses['flow_challenge'] === 'Yes') {
    challengeScore += 3;
  }
  
  // 2. MBTI patterns that correlate with challenge preference
  if (mbtiType.includes('NT')) challengeScore += 2; // Analysts love challenges
  if (mbtiType.includes('ST')) challengeScore += 1; // Sentinels like structured challenges
  if (mbtiType.includes('F')) challengeScore -= 1; // Feelers prefer gentler approaches
  if (mbtiType.includes('P')) challengeScore += 1; // Perceivers like varied challenges
  
  // 3. Engagement score (higher engagement = can handle more challenge)
  if (happinessScores.engagement >= 7) challengeScore += 2;
  else if (happinessScores.engagement <= 4) challengeScore -= 2;
  
  // 4. Accomplishment score (achievement-oriented people like challenges)
  if (happinessScores.accomplishment >= 7) challengeScore += 1;
  else if (happinessScores.accomplishment <= 4) challengeScore -= 1;
  
  // 5. Stress level (high stress = lower challenge tolerance)
  const stressBurnout = Number(responses['stress_burnout'] ?? 5);
  if (stressBurnout >= 8) challengeScore -= 2;
  else if (stressBurnout <= 3) challengeScore += 1;
  
  // 6. Happiness driver patterns
  const driver = responses['happiness_driver'] as string;
  if (driver?.includes('Learning')) challengeScore += 2;
  if (driver?.includes('Creating')) challengeScore += 1;
  if (driver?.includes('relaxing')) challengeScore -= 1;
  
  // 7. Current mood (good mood = more challenge tolerance)
  const currentMood = Number(responses['current_mood'] ?? 5);
  if (currentMood >= 8) challengeScore += 1;
  else if (currentMood <= 3) challengeScore -= 1;
  
  // Determine final level
  if (challengeScore >= 4) return 'high';
  if (challengeScore <= 0) return 'low';
  return 'medium';
};

// Comprehensive service personalization determination
const determineServicePersonalization = (
  responses: Record<string, string | string[]>,
  happinessScores: AssessmentResult['happinessScores'],
  focusAreas: string[],
  mbtiType: string,
  challengeLevel: 'low' | 'medium' | 'high'
): PersonalizationProfile['servicePersonalization'] => {
  
  // 1. Recommended Service Types based on focus areas and patterns
  const recommendedServiceTypes: string[] = [];
  
  focusAreas.forEach(area => {
    switch (area) {
      case 'positiveEmotion':
        recommendedServiceTypes.push('mood-boosting', 'gratitude-practice', 'joy-activities', 'stress-relief');
        break;
      case 'engagement':
        recommendedServiceTypes.push('skill-building', 'creative-workshops', 'learning-platforms', 'flow-activities');
        break;
      case 'relationships':
        recommendedServiceTypes.push('social-connection', 'communication-training', 'relationship-coaching', 'community-building');
        break;
      case 'meaning':
        recommendedServiceTypes.push('purpose-discovery', 'values-clarification', 'spiritual-growth', 'volunteer-matching');
        break;
      case 'accomplishment':
        recommendedServiceTypes.push('goal-setting', 'habit-tracking', 'achievement-coaching', 'productivity-tools');
        break;
    }
  });
  
  // Add general wellness services based on overall scores
  const overallWellness = Object.values(happinessScores).reduce((a, b) => a + b, 0) / 5;
  if (overallWellness <= 5) {
    recommendedServiceTypes.push('mental-health-support', 'wellness-coaching', 'mindfulness-training');
  }
  
  // Add MBTI-specific services
  if (mbtiType.includes('I')) recommendedServiceTypes.push('self-reflection-tools', 'personal-journaling');
  if (mbtiType.includes('E')) recommendedServiceTypes.push('group-activities', 'social-challenges');
  if (mbtiType.includes('N')) recommendedServiceTypes.push('innovation-workshops', 'future-planning');
  if (mbtiType.includes('S')) recommendedServiceTypes.push('practical-skills', 'hands-on-activities');
  if (mbtiType.includes('T')) recommendedServiceTypes.push('data-driven-insights', 'logical-frameworks');
  if (mbtiType.includes('F')) recommendedServiceTypes.push('emotional-intelligence', 'empathy-building');
  
  // 2. Service Preferences
  const servicePreferences = {
    // Delivery method based on social preference and MBTI
    deliveryMethod: (() => {
      const copingPref = responses['coping_preference'] as string;
      if (copingPref?.includes('alone') || mbtiType.includes('I')) return 'self-directed' as const;
      if (copingPref?.includes('someone') || mbtiType.includes('E')) return 'human-guided' as const;
      return 'hybrid' as const;
    })(),
    
    // Session length based on engagement and challenge level
    sessionLength: (() => {
      if (challengeLevel === 'high' && happinessScores.engagement >= 7) return 'long' as const;
      if (challengeLevel === 'low' || happinessScores.positiveEmotion <= 4) return 'short' as const;
      return 'medium' as const;
    })(),
    
    // Frequency based on stress and support needs
    frequency: (() => {
      const stressBurnout = Number(responses['stress_burnout'] ?? 5);
      const emotionalSupport = happinessScores.positiveEmotion <= 4 ? 'high' : 'medium';
      
      if (stressBurnout >= 8 || emotionalSupport === 'high') return 'daily' as const;
      if (focusAreas.length >= 3) return 'weekly' as const;
      return 'as-needed' as const;
    })(),
    
    // Cost sensitivity (placeholder - could be enhanced with actual questions)
    costSensitivity: 'moderate' as const
  };
  
  // 3. Wellness Goals (specific outcomes)
  const wellnessGoals: string[] = [];
  
  focusAreas.forEach(area => {
    switch (area) {
      case 'positiveEmotion':
        wellnessGoals.push('increase daily happiness', 'reduce negative emotions', 'build resilience');
        break;
      case 'engagement':
        wellnessGoals.push('find flow activities', 'develop new skills', 'increase motivation');
        break;
      case 'relationships':
        wellnessGoals.push('improve communication', 'build stronger connections', 'expand social circle');
        break;
      case 'meaning':
        wellnessGoals.push('discover life purpose', 'align with values', 'find meaningful work');
        break;
      case 'accomplishment':
        wellnessGoals.push('achieve personal goals', 'build confidence', 'create lasting impact');
        break;
    }
  });
  
  // 4. Avoidance Patterns (service types to avoid)
  const avoidancePatterns: string[] = [];
  
  const stressBurnout = Number(responses['stress_burnout'] ?? 5);
  if (stressBurnout >= 8) {
    avoidancePatterns.push('high-intensity', 'time-pressured', 'performance-focused');
  }
  
  if (happinessScores.positiveEmotion <= 3) {
    avoidancePatterns.push('challenging-feedback', 'competitive', 'criticism-heavy');
  }
  
  if (mbtiType.includes('I')) {
    avoidancePatterns.push('large-group-required', 'public-presentation');
  }
  
  // 5. Engagement Style
  const engagementStyle = {
    // Preferred time based on usage patterns
    preferredTime: (() => {
      const usageScenarios = Array.isArray(responses['usage_scenario']) ? responses['usage_scenario'] : [];
      if (usageScenarios.includes('Before bed')) return 'evening' as const;
      if (usageScenarios.includes('Lunch break / quick rest')) return 'afternoon' as const;
      return 'flexible' as const;
    })(),
    
    // Motivation type based on reward preference and personality
    motivationType: (() => {
      const rewardPref = responses['reward_preference'] as string;
      if (rewardPref?.includes('badge')) return 'gamified' as const;
      if (rewardPref?.includes('friends')) return 'community' as const;
      if (mbtiType.includes('J')) return 'guided' as const;
      return 'self-driven' as const;
    })(),
    
    // Learning preference based on content preferences and MBTI
    learningPreference: (() => {
      const contentPrefs = Array.isArray(responses['content_preferences']) ? responses['content_preferences'] : [];
      if (contentPrefs.some(pref => pref.includes('Music') || pref.includes('Entertainment'))) return 'auditory' as const;
      if (contentPrefs.some(pref => pref.includes('DIY') || pref.includes('Interactive'))) return 'kinesthetic' as const;
      if (mbtiType.includes('N')) return 'visual' as const;
      return 'mixed' as const;
    })()
  };
  
  return {
    recommendedServiceTypes: [...new Set(recommendedServiceTypes)].slice(0, 8), // Top 8 service types
    servicePreferences,
    wellnessGoals: [...new Set(wellnessGoals)].slice(0, 6), // Top 6 goals
    avoidancePatterns: [...new Set(avoidancePatterns)].slice(0, 4), // Top 4 patterns to avoid
    engagementStyle
  };
};

export const generatePersonalizationProfile = (
  responses: Record<string, string | string[]>,
  mbtiType: string,
  happinessScores: AssessmentResult['happinessScores']
): PersonalizationProfile => {
  
  const { topics: extractedTopics, scores: topicScores } = extractTopicsFromResponses(responses);
  const permaTopicMapping = mapTopicsToPerma(extractedTopics, topicScores);
  
  const selectedOptions = Array.isArray(responses['content_preferences']) 
    ? responses['content_preferences'] as string[]
    : [];

  // Build PERMA mapping for content recommendations
  const permaMapping = {
    positiveEmotion: [
      ...selectedOptions.filter(option => 
        ['Comedy / Humor', 'Feel-good Content', 'Music / Entertainment', 'Animals / Nature'].includes(option)
      ),
      ...permaTopicMapping.positiveEmotion.map(item => item.topic)
    ],
    engagement: [
      ...selectedOptions.filter(option => 
        ['Gaming / Interactive', 'DIY / Creative Projects', 'Learning / Education', 'Technology / Science'].includes(option)
      ),
      ...permaTopicMapping.engagement.map(item => item.topic)
    ],
    relationships: [
      ...selectedOptions.filter(option => 
        ['Relationships / Social', 'Family / Parenting', 'Community / Events'].includes(option)
      ),
      ...permaTopicMapping.relationships.map(item => item.topic)
    ],
    meaning: [
      ...selectedOptions.filter(option => 
        ['Inspiration / Growth', 'Mindfulness / Spirituality', 'Philosophy / Deep Topics'].includes(option)
      ),
      ...permaTopicMapping.meaning.map(item => item.topic)
    ],
    accomplishment: [
      ...selectedOptions.filter(option => 
        ['Self-Improvement', 'Career / Success', 'Health / Wellness'].includes(option)
      ),
      ...permaTopicMapping.accomplishment.map(item => item.topic)
    ],
  };

  // Identify focus areas and strengths for targeted interventions
  const focusAreas = Object.entries(happinessScores)
    .sort(([,a], [,b]) => a - b)
    .slice(0, 2)
    .map(([key]) => key);
    
  const strengths = Object.entries(happinessScores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 2)
    .map(([key]) => key);

  // Enhanced primary interests determination
  const primaryInterests = determinePrimaryInterests(responses, topicScores, permaMapping);
  
  // Determine topics to avoid
  const avoidTopics = determineAvoidTopics(responses, happinessScores, primaryInterests);
  
  // Enhanced challenge level determination
  const challengeLevel = determineChallengeLevel(responses, happinessScores, mbtiType);
  
  // Comprehensive service personalization
  const servicePersonalization = determineServicePersonalization(
    responses, 
    happinessScores, 
    focusAreas, 
    mbtiType, 
    challengeLevel
  );

  // Build comprehensive topic list for chat with PERMA classification
  const preferredTopics: Array<{
    topic: string;
    permaDimension: string;
    score: number;
  }> = [];
  
  const addedTopics = new Set<string>();
  
  Object.entries(permaMapping).forEach(([permaDimension, topics]) => {
    topics.forEach(topic => {
      const topicKey = topic.toLowerCase().trim();
      if (!addedTopics.has(topicKey)) {
        let finalScore = topicScores[topicKey] || 1;
        
        // Boost score for focus areas (areas needing improvement)
        if (focusAreas.includes(permaDimension)) {
          finalScore *= 2;
        }
        
        preferredTopics.push({
          topic: topic,
          permaDimension: permaDimension,
          score: finalScore
        });
        addedTopics.add(topicKey);
      }
    });
  });
  
  preferredTopics.sort((a, b) => b.score - a.score);

  // Determine communication style based on MBTI
  const getCommunicationStyle = (mbti: string): PersonalizationProfile['chatPersona']['communicationStyle'] => {
    if (mbti.includes('T')) return mbti.includes('E') ? 'direct' : 'analytical';
    return mbti.includes('E') ? 'supportive' : 'creative';
  };

  return {
    chatPersona: {
      mbtiType,
      communicationStyle: getCommunicationStyle(mbtiType),
      preferredTopics: preferredTopics,
      emotionalSupport: determineEmotionalSupport(responses, happinessScores)
    },
    
    contentPreferences: {
      permaMapping,
      primaryInterests, // Now intelligently determined
      avoidTopics, // Now properly populated
    },
    
    wellnessProfile: {
      happinessScores,
      focusAreas,
      strengths,
      interventionPreferences: {
        socialPreference: typeof responses['coping_preference'] === 'string' && 
                         responses['coping_preference'].includes('Talk') ? 'social' : 'solo',
        challengeLevel // Now intelligently determined
      }
    },
    
    servicePersonalization // Comprehensive service recommendations
  };
};

export const generateAssessmentResult = (responses: Record<string, string | string[]>): AssessmentResult => {
  const mbtiType = analyzeMBTI(responses);
  const happinessScores = analyzePERMA(responses);
  const personalization = generatePersonalizationProfile(responses, mbtiType, happinessScores);

  return {
    mbtiType,
    personalInfo: {
      name: typeof responses['nickname'] === 'string' ? responses['nickname'] : '',
      happyEvents: typeof responses['pe_happy_events'] === 'string' ? responses['pe_happy_events'] : '',
      flowActivity: typeof responses['e_flow_activity'] === 'string' ? responses['e_flow_activity'] : '',
      proudAchievement: typeof responses['a_proud_achievement'] === 'string' ? responses['a_proud_achievement'] : '',
    },
    happinessScores,
    personalization,
    emotionBaseline: Number(responses['current_mood'] ?? 5),
    assessmentDate: new Date().toISOString(),
    version: '2.0'
  };
};

/**
 * Analyze responses, save to Firestore, and update user profile.
 * @param userId string
 * @param responses Record<string, string | string[]>
 * @param firebase FirebaseContextType (from useFirebase())
 * @returns Promise<AssessmentResult>
 */
export async function analyzeAndSaveAssessment(
  userId: string,
  responses: Record<string, string | string[]>,
  firebase: {
    saveAssessment: (userId: string, data: any) => Promise<any>,
    updateUserProfile: (userId: string, data: any) => Promise<any>
  }
): Promise<AssessmentResult> {
  const result = generateAssessmentResult(responses);
  
  // Save the assessment with both raw responses and computed result
  const assessmentData = {
    userId,
    responses, // Raw assessment responses
    result, // Computed assessment result with personalization
    createdAt: new Date(),
  };

  console.log('Debug - Saving assessment data to Firebase...');
  const saveResult = await firebase.saveAssessment(userId, assessmentData);
  
  if (!saveResult.success) {
    throw new Error(`Failed to save assessment: ${saveResult.error}`);
  }
  
  console.log('Debug - Updating user profile...');
  const profileResult = await firebase.updateUserProfile(userId, {
    hasCompletedAssessment: true,
    mbtiType: result.mbtiType,
    name: result.personalInfo.name,
    lastAssessmentDate: new Date().toISOString(),
  });
  
  if (!profileResult.success) {
    console.warn('Failed to update user profile:', profileResult.error);
    // Don't fail the whole process for profile update failure
  }

  // Return the assessment result with the Firebase document ID for reference
  return {
    ...result,
    assessmentDate: saveResult.data?.id || result.assessmentDate
  };
}
