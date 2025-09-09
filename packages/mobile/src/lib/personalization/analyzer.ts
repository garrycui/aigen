import { 
  UnifiedPersonalizationProfile, 
  PermaScores, 
  UserCore, 
  ContentPreferences, 
  WellnessProfile, 
  ActivityTracking, 
  ServicePreferences,
  ComputedFields
} from './types';

export function generateUnifiedPersonalization(
  responses: Record<string, any>,
  userId: string
): UnifiedPersonalizationProfile {
  
  // 1. Analyze PERMA scores from direct assessment questions
  const permaScores = analyzeDirectPERMA(responses);
  
  // 2. Build user core from MBTI and personality questions
  const userCore = buildUserCore(responses);
  
  // 3. Build content preferences from interests and happiness sources
  const contentPreferences = buildContentPreferences(responses);
  
  // 4. Build wellness profile from PERMA scores and goals
  const wellnessProfile = buildWellnessProfile(permaScores, responses);
  
  // 5. Initialize activity tracking
  const activityTracking = initializeActivityTracking();
  
  // 6. Build service preferences from goals and preferences
  const servicePreferences = buildServicePreferences(responses, userCore);
  
  // 7. Compute derived fields for quick access
  const computed = computeProfileFields(permaScores, contentPreferences, userCore);
  
  return {
    userId,
    version: '3.0',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    userCore,
    contentPreferences,
    wellnessProfile,
    activityTracking,
    servicePreferences,
    computed
  };
}

// PERMA Analysis: Use direct scores from streamlined assessment
function analyzeDirectPERMA(responses: Record<string, any>): PermaScores {
  return {
    positiveEmotion: Math.min(10, Math.max(1, Number(responses.positive_emotion_score || 5))),
    engagement: Math.min(10, Math.max(1, Number(responses.engagement_score || 5))),
    relationships: Math.min(10, Math.max(1, Number(responses.relationships_score || 5))),
    meaning: Math.min(10, Math.max(1, Number(responses.meaning_score || 5))),
    accomplishment: Math.min(10, Math.max(1, Number(responses.accomplishment_score || 5)))
  };
}

// MBTI Analysis: Use direct MBTI questions from streamlined assessment
function inferMBTI(responses: Record<string, any>): string {
  let mbti = '';
  
  // E/I from energy preference
  const energy = responses.mbti_energy;
  mbti += energy?.includes('people') ? 'E' : 'I';
  
  // S/N from information processing preference
  const information = responses.mbti_information;
  mbti += information?.includes('concrete') ? 'S' : 'N';
  
  // T/F from decision making preference
  const decisions = responses.mbti_decisions;
  mbti += decisions?.includes('logical') ? 'T' : 'F';
  
  // J/P from lifestyle preference
  const lifestyle = responses.mbti_lifestyle;
  mbti += lifestyle?.includes('planned') ? 'J' : 'P';
  
  return mbti;
}

// User Core: Build personality and communication profile using types.ts interface
function buildUserCore(responses: Record<string, any>): UserCore {
  const mbtiType = inferMBTI(responses);
  
  // Communication style based on MBTI
  const communicationStyle: UserCore['communicationStyle'] = (() => {
    if (mbtiType.includes('T')) {
      return mbtiType.includes('E') ? 'direct' : 'analytical';
    } else {
      return mbtiType.includes('E') ? 'supportive' : 'creative';
    }
  })();
  
  // Social preference from MBTI energy question
  const socialPreference: UserCore['socialPreference'] = (() => {
    const energyPref = responses.mbti_energy;
    if (energyPref?.includes('people')) return 'social';
    if (energyPref?.includes('quiet')) return 'solo';
    return 'mixed';
  })();
  
  // Challenge level from dedicated question
  const challengeLevel: UserCore['challengeLevel'] = (() => {
    const challengePref = responses.challenge_preference;
    if (challengePref?.includes('stretch')) return 'high';
    if (challengePref?.includes('manageable')) return 'low';
    return 'medium';
  })();
  
  // Emotional support based on PERMA scores and goals
  const emotionalSupport: UserCore['emotionalSupport'] = (() => {
    const happinessSources = responses.happiness_sources || [];
    const mainGoals = responses.main_goals || [];
    
    // High support indicators
    const supportIndicators = [
      'Reduce stress and anxiety',
      'Be happier and more positive',
      'Relaxing and taking time for myself'
    ];
    
    const needsSupport = [...happinessSources, ...mainGoals]
      .some((item: string) => supportIndicators.some(indicator => 
        item.toLowerCase().includes(indicator.toLowerCase().split(' ')[0])
      ));
    
    return needsSupport ? 'high' : 'medium';
  })();
  
  // Learning style from interests and MBTI
  const learningStyle: UserCore['learningStyle'] = (() => {
    const interests = responses.primary_interests || [];
    
    if (interests.includes('Reading & Books') || interests.includes('Science & Discovery')) {
      return 'reading';
    }
    if (interests.includes('Music & Entertainment') || interests.includes('Art & Creativity')) {
      return 'auditory';
    }
    if (interests.includes('DIY & Making Things') || interests.includes('Sports & Athletics')) {
      return 'kinesthetic';
    }
    if (interests.includes('Photography') || interests.includes('Movies & TV Shows')) {
      return 'visual';
    }
    
    // MBTI-based fallback
    if (mbtiType.includes('S')) return 'kinesthetic';
    if (mbtiType.includes('N')) return 'visual';
    return 'mixed';
  })();
  
  return {
    mbtiType,
    communicationStyle,
    socialPreference,
    challengeLevel,
    emotionalSupport,
    learningStyle
  };
}

// Content Preferences: Map interests to PERMA dimensions and build topic scores using types.ts interface
function buildContentPreferences(responses: Record<string, any>): ContentPreferences {
  const primaryInterests = responses.primary_interests || [];
  const happinessSources = responses.happiness_sources || [];
  
  // Enhanced PERMA mapping using categorizeInterestsByPERMA function
  const categorizedInterests = categorizeInterestsByPERMA(primaryInterests);
  
  const permaMapping: ContentPreferences['permaMapping'] = {
    positiveEmotion: categorizedInterests.positiveEmotion,
    engagement: categorizedInterests.engagement,
    relationships: categorizedInterests.relationships,
    meaning: categorizedInterests.meaning,
    accomplishment: categorizedInterests.accomplishment
  };
  
  // Initialize topic scores based on selection frequency and happiness sources
  const topicScores: ContentPreferences['topicScores'] = {};
  
  primaryInterests.forEach((interest: string) => {
    let baseScore = 6; // Base score for selected interests
    
    // Boost score if related to happiness sources
    if (happinessSources.includes('Learning something new and interesting') && 
        categorizedInterests.engagement.includes(interest)) {
      baseScore += 2;
    }
    if (happinessSources.includes('Being creative or artistic') && 
        interest.includes('Art & Creativity')) {
      baseScore += 2;
    }
    if (happinessSources.includes('Helping others or making a difference') && 
        categorizedInterests.meaning.includes(interest)) {
      baseScore += 2;
    }
    if (happinessSources.includes('Spending time with people I care about') && 
        categorizedInterests.relationships.includes(interest)) {
      baseScore += 2;
    }
    
    topicScores[interest.toLowerCase()] = Math.min(10, baseScore);
  });
  
  // Determine topics to avoid based on what wasn't selected
  const allInterestOptions = [
    "Comedy & Humor", "Music & Entertainment", "Movies & TV Shows", "Gaming & Interactive Content",
    "Sports & Athletics", "Food & Cooking", "Travel & Adventure", "Fashion & Style",
    "Learning New Skills", "Science & Discovery", "Technology & Innovation", "Reading & Books",
    "Art & Creativity", "DIY & Making Things", "Personal Development", "History & Culture",
    "Relationships & Dating", "Family & Parenting", "Community & Social Causes",
    "Spirituality & Mindfulness", "Philosophy & Life Questions", "Volunteering & Helping Others",
    "Career & Professional Growth", "Business & Entrepreneurship", "Money & Finance",
    "Health & Fitness", "Productivity & Organization", "Leadership & Influence",
    "Nature & Environment", "Animals & Pets", "Home & Decor",
    "News & Current Events", "Photography", "Languages & Communication"
  ];
  
  const notSelected = allInterestOptions.filter(option => !primaryInterests.includes(option));
  const avoidTopics = notSelected.length > 15 ? notSelected.slice(0, 5) : []; // Only if very selective
  
  // Initialize empty topic search queries structure - will be populated by unified generator
  const topicSearchQueries: ContentPreferences['topicSearchQueries'] = {};
  
  // Add placeholder entries for primary interests (will be populated by generateAllTopicSearchQueries)
  primaryInterests.forEach((interest: string) => {
    const topicKey = interest.toLowerCase().replace(/\s+/g, '_'); // Fix: Create consistent keys
    topicSearchQueries[topicKey] = {
      queries: [], // Will be populated by generateAllTopicSearchQueries
      platforms: ['youtube'],
      generatedAt: new Date().toISOString(),
      permaDimension: getTopicPermaDimension(interest, categorizedInterests),
      priority: topicScores[topicKey] || 5 // Fix: Ensure priority is always a number
    };
  });
  
  return {
    primaryInterests,
    emergingInterests: [],
    avoidTopics,
    permaMapping,
    topicScores,
    topicSearchQueries,
    queryGeneration: {
      totalQueriesGenerated: 0,
      generationVersion: '3.0',
      pendingTopics: primaryInterests // All interests start as pending for unified generation
    }
  };
}

// Helper function to categorize interests by PERMA dimension
function categorizeInterestsByPERMA(interests: string[]): {
  positiveEmotion: string[];
  engagement: string[];
  relationships: string[];
  meaning: string[];
  accomplishment: string[];
} {
  const categories = {
    positiveEmotion: [
      "Comedy & Humor", "Music & Entertainment", "Movies & TV Shows", "Gaming & Interactive Content",
      "Food & Cooking", "Travel & Adventure", "Fashion & Style", "Nature & Environment", 
      "Animals & Pets", "Photography"
    ],
    engagement: [
      "Learning New Skills", "Science & Discovery", "Technology & Innovation", "Reading & Books",
      "Art & Creativity", "DIY & Making Things", "Gaming & Interactive Content", "Sports & Athletics",
      "Photography", "Languages & Communication", "History & Culture"
    ],
    relationships: [
      "Relationships & Dating", "Family & Parenting", "Community & Social Causes",
      "Sports & Athletics", "Travel & Adventure", "Volunteering & Helping Others"
    ],
    meaning: [
      "Personal Development", "Spirituality & Mindfulness", "Philosophy & Life Questions",
      "Community & Social Causes", "History & Culture", "News & Current Events",
      "Volunteering & Helping Others", "Nature & Environment"
    ],
    accomplishment: [
      "Career & Professional Growth", "Business & Entrepreneurship", "Money & Finance",
      "Productivity & Organization", "Leadership & Influence", "Learning New Skills",
      "Health & Fitness"
    ]
  };

  const result = {
    positiveEmotion: [] as string[],
    engagement: [] as string[],
    relationships: [] as string[],
    meaning: [] as string[],
    accomplishment: [] as string[]
  };

  interests.forEach(interest => {
    Object.entries(categories).forEach(([category, items]) => {
      if (items.includes(interest)) {
        result[category as keyof typeof result].push(interest);
      }
    });
  });

  return result;
}

// Helper function to determine PERMA dimension for a topic
function getTopicPermaDimension(interest: string, categorizedInterests: any): string {
  const lowerInterest = interest.toLowerCase();
  
  // Check which PERMA category this interest belongs to
  for (const [dimension, interests] of Object.entries(categorizedInterests)) {
    if (Array.isArray(interests) && interests.some(item => 
      typeof item === 'string' && item.toLowerCase().includes(lowerInterest)
    )) {
      return dimension;
    }
  }
  
  // Default to engagement if no match found
  return 'engagement';
}

// Wellness Profile: Focus areas, strengths, and intervention preferences using types.ts interface
function buildWellnessProfile(permaScores: PermaScores, responses: Record<string, any>): WellnessProfile {
  // Identify focus areas (lowest 2 scores)
  const focusAreas = Object.entries(permaScores)
    .sort(([,a], [,b]) => a - b)
    .slice(0, 2)
    .map(([key]) => key);
  
  // Identify strengths (highest 2 scores)
  const strengths = Object.entries(permaScores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 2)
    .map(([key]) => key);
  
  // Extract happiness sources for future reference
  const happinessSources = Array.isArray(responses.happiness_sources) 
    ? responses.happiness_sources as string[]
    : [];
  
  // Map main goals to wellness goals
  const mainGoals = responses.main_goals || [];
  const wellnessGoals = mainGoals.map((goal: string) => {
    const goalMap: Record<string, string> = {
      'Be happier and more positive': 'increase daily positive emotions',
      'Reduce stress and anxiety': 'improve emotional regulation',
      'Improve my relationships': 'strengthen social connections',
      'Find more meaning and purpose': 'discover life purpose',
      'Achieve important goals': 'accomplish meaningful objectives',
      'Learn new skills or knowledge': 'develop new capabilities',
      'Get healthier and fitter': 'improve physical wellness',
      'Advance my career': 'achieve professional growth',
      'Be more creative': 'enhance creative expression',
      'Have more fun and adventure': 'increase life enjoyment'
    };
    return goalMap[goal] || goal.toLowerCase();
  });
  
  // Build intervention preferences based on assessment responses
  const challengeLevel = responses.challenge_preference;
  const appUsageGoals = responses.app_usage_goals;
  
  const interventionPreferences: WellnessProfile['interventionPreferences'] = {
    frequency: (() => {
      if (appUsageGoals?.includes('day-to-day')) return 'daily';
      if (focusAreas.length >= 2) return 'weekly'; // Multiple focus areas need regular attention
      return 'as-needed';
    })(),
    
    sessionLength: (() => {
      if (challengeLevel?.includes('stretch')) return 'long';
      if (challengeLevel?.includes('manageable')) return 'short';
      return 'medium';
    })(),
    
    preferredTime: 'flexible'
  };
  
  return {
    currentScores: permaScores,
    focusAreas,
    strengths,
    wellnessGoals,
    happinessSources, // NEW: Store happiness sources
    interventionPreferences
  };
}

// Activity Tracking: Initialize empty tracking structure using types.ts interface
function initializeActivityTracking(): ActivityTracking {
  return {
    chatMetrics: {
      totalMessages: 0,
      positiveInteractions: 0,
      engagementStreak: 0,
      lastActiveTime: new Date().toISOString(),
      preferredTopics: []
    },
    videoMetrics: {
      totalWatched: 0,
      completionRate: 0,
      likedTopics: [],
      skipgedTopics: [],
      watchTime: {}
    },
    progressTracking: {
      permaImprovement: {},
      streaks: {},
      milestones: []
    }
  };
}

// Service Preferences: Map goals and preferences to service recommendations using types.ts interface
function buildServicePreferences(responses: Record<string, any>, userCore: UserCore): ServicePreferences {
  const mainGoals = responses.main_goals || [];
  const appUsageGoals = responses.app_usage_goals;
  
  // Map goals to recommended service types
  const recommendedTypes: string[] = [];
  
  mainGoals.forEach((goal: string) => {
    const serviceMap: Record<string, string[]> = {
      'Be happier and more positive': ['mood-boosting', 'positive-psychology'],
      'Reduce stress and anxiety': ['stress-relief', 'mindfulness-training'],
      'Improve my relationships': ['relationship-coaching', 'social-skills'],
      'Find more meaning and purpose': ['purpose-discovery', 'values-clarification'],
      'Achieve important goals': ['goal-setting', 'accountability-coaching'],
      'Learn new skills or knowledge': ['skill-building', 'learning-platforms'],
      'Get healthier and fitter': ['fitness-coaching', 'wellness-programs'],
      'Advance my career': ['career-coaching', 'professional-development'],
      'Be more creative': ['creativity-workshops', 'artistic-expression'],
      'Have more fun and adventure': ['experience-planning', 'adventure-coaching']
    };
    
    if (serviceMap[goal]) {
      recommendedTypes.push(...serviceMap[goal]);
    }
  });
  
  // Build service preferences based on personality and goals
  const deliveryMethod: ServicePreferences['deliveryMethod'] = (() => {
    if (userCore.socialPreference === 'social') return 'human';
    if (userCore.socialPreference === 'solo') return 'digital';
    return 'hybrid';
  })();
  
  const budget: ServicePreferences['budget'] = 'medium'; // Could be enhanced with actual budget questions in future
  
  const urgency: ServicePreferences['urgency'] = (() => {
    if (appUsageGoals?.includes('day-to-day')) return 'immediate';
    if (appUsageGoals?.includes('personal growth')) return 'planned';
    return 'exploratory';
  })();
  
  return {
    recommendedTypes: [...new Set(recommendedTypes)], // Remove duplicates
    budget,
    deliveryMethod,
    urgency
  };
}

// Computed Fields: Generate quick-access analytics using types.ts interface
function computeProfileFields(
  permaScores: PermaScores, 
  contentPreferences: ContentPreferences, 
  userCore: UserCore
): ComputedFields {
  const scores = Object.values(permaScores);
  const overallHappiness = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  
  // Primary PERMA dimension (highest score)
  const primaryPermaDimension = Object.entries(permaScores)
    .sort(([,a], [,b]) => b - a)[0][0];
  
  // Areas needing attention (scores <= 4)
  const needsAttention = Object.entries(permaScores)
    .filter(([,score]) => score <= 4)
    .map(([key]) => key);
  
  // Engagement level based on overall happiness and specific engagement score
  const engagementLevel: ComputedFields['engagementLevel'] = (() => {
    const engagementScore = permaScores.engagement;
    if (engagementScore >= 8 && overallHappiness >= 7) return 'high';
    if (engagementScore >= 6 && overallHappiness >= 5) return 'medium';
    return 'low';
  })();
  
  return {
    overallHappiness,
    primaryPermaDimension,
    needsAttention,
    engagementLevel,
    lastEngagementType: null
  };
}

// Helper function to create topic generation request for AI topic generator
export function profileToTopicRequest(profile: UnifiedPersonalizationProfile): any {
  return {
    mbtiType: profile.userCore.mbtiType,
    permaScores: profile.wellnessProfile.currentScores,
    focusAreas: profile.wellnessProfile.focusAreas,
    primaryInterests: profile.contentPreferences.primaryInterests,
    personalContext: {
      // Could be enhanced with more personal context from assessment
    },
    avoidTopics: profile.contentPreferences.avoidTopics,
    currentMood: profile.computed.overallHappiness
  };
}

// NEW: Enhanced happiness source matching for dynamic topic scoring
export function scoreTopicBasedOnHappinessSources(
  topic: string,
  happinessSources: string[],
  context?: string
): number {
  let score = 5; // Base score
  
  const topicLower = topic.toLowerCase();
  
  // Comprehensive happiness source mappings
  const happinessMapping: Record<string, string[]> = {
    'Learning something new and interesting': [
      'learning', 'education', 'tutorial', 'course', 'skill', 'knowledge', 
      'discovery', 'research', 'study', 'academic', 'science', 'technology'
    ],
    'Being creative or artistic': [
      'art', 'creative', 'creativity', 'design', 'music', 'writing', 'photography',
      'painting', 'drawing', 'craft', 'diy', 'artistic', 'maker'
    ],
    'Helping others or making a difference': [
      'helping', 'volunteer', 'charity', 'community', 'service', 'impact',
      'social cause', 'activism', 'nonprofit', 'giving back', 'support'
    ],
    'Spending time with people I care about': [
      'relationship', 'family', 'friends', 'social', 'connection', 'together',
      'bonding', 'quality time', 'loved ones', 'community'
    ],
    'Achieving goals I\'ve set for myself': [
      'goal', 'achievement', 'success', 'accomplishment', 'progress',
      'milestone', 'target', 'objective', 'completion', 'victory'
    ],
    'Having fun and laughing': [
      'fun', 'humor', 'comedy', 'entertainment', 'laughter', 'joy',
      'playful', 'amusing', 'enjoyable', 'lighthearted'
    ],
    'Relaxing and taking time for myself': [
      'relaxation', 'meditation', 'mindfulness', 'self-care', 'peaceful',
      'calm', 'tranquil', 'rest', 'solo time', 'reflection'
    ],
    'Exploring new places or experiences': [
      'travel', 'adventure', 'exploration', 'new experiences', 'discovery',
      'journey', 'wanderlust', 'culture', 'places', 'exotic'
    ],
    'Working on challenging problems': [
      'challenge', 'problem solving', 'puzzle', 'complex', 'difficult',
      'brain teaser', 'analytical', 'critical thinking', 'solution'
    ],
    'Being recognized for my accomplishments': [
      'recognition', 'appreciation', 'acknowledgment', 'praise', 'award',
      'achievement', 'success story', 'spotlight', 'celebration'
    ]
  };
  
  // Check each happiness source against the topic
  happinessSources.forEach(source => {
    const keywords = happinessMapping[source] || [];
    const matchCount = keywords.filter(keyword => 
      topicLower.includes(keyword) || keyword.includes(topicLower)
    ).length;
    
    if (matchCount > 0) {
      // Boost score based on relevance strength
      score += matchCount * 2; // +2 per keyword match
      
      // Extra boost for exact matches
      if (keywords.some(keyword => topicLower === keyword)) {
        score += 3;
      }
    }
  });
  
  return Math.min(10, score);
}

// Enhanced function for chat-extracted topics
export function scoreNewChatTopic(
  topic: string,
  userPersonalization: any,
  chatContext?: string
): number {
  // Get happiness sources from wellness profile
  const happinessSources = userPersonalization.wellnessProfile?.happinessSources || [];
  
  if (happinessSources.length === 0) {
    return 5; // Default score if no happiness sources available
  }
  
  return scoreTopicBasedOnHappinessSources(topic, happinessSources, chatContext);
}
