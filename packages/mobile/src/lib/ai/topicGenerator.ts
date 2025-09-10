import { UnifiedPersonalizationProfile } from '../personalization/types';

export interface TopicSearchQuery {
  queries: string[];
  platforms: string[];
  generatedAt: string;
  permaDimension: string;
  priority: number;
}

export interface TopicGenerationRequest {
  mbtiType: string;
  permaScores: {
    positiveEmotion: number;
    engagement: number;
    relationships: number;
    meaning: number;
    accomplishment: number;
  };
  focusAreas: string[];
  primaryInterests: string[];
  personalContext?: {
    happinessSources?: string[];
    wellnessGoals?: string[];
    avoidTopics?: string[];
  };
  currentMood?: number;
}

export interface BatchTopicResult {
  topicQueries: Record<string, TopicSearchQuery>;
  totalQueriesGenerated: number;
  generationVersion: string;
  generatedAt: string;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

export async function generateAllTopicSearchQueries(
  profile: UnifiedPersonalizationProfile
): Promise<BatchTopicResult> {
  console.log('🎯 [TopicGenerator] Starting batch topic generation');
  console.log('📊 [TopicGenerator] Profile summary:', {
    userId: profile.userId,
    mbtiType: profile.userCore.mbtiType,
    focusAreas: profile.wellnessProfile.focusAreas,
    primaryInterests: profile.contentPreferences.primaryInterests,
    topicCount: Object.keys(profile.contentPreferences.topicSearchQueries || {}).length,
    overallHappiness: profile.computed.overallHappiness
  });

  // Validate required profile data
  if (!profile.contentPreferences?.primaryInterests || profile.contentPreferences.primaryInterests.length === 0) {
    console.error('❌ [TopicGenerator] No primary interests found in profile, using fallback');
    return generateFallbackTopicQueries(profile);
  }

  if (!OPENAI_API_KEY) {
    console.warn('⚠️ [TopicGenerator] OpenAI API key not found, using fallback topic queries');
    return generateFallbackTopicQueries(profile);
  }

  try {
    const request = profileToTopicRequest(profile);
    console.log('📝 [TopicGenerator] Generated request:', {
      mbtiType: request.mbtiType,
      focusAreas: request.focusAreas,
      primaryInterests: request.primaryInterests,
      currentMood: request.currentMood,
      topicsToProcess: profile.contentPreferences.primaryInterests.length,
      personalContext: {
        happinessSourcesCount: request.personalContext?.happinessSources?.length || 0,
        wellnessGoalsCount: request.personalContext?.wellnessGoals?.length || 0,
        avoidTopicsCount: request.personalContext?.avoidTopics?.length || 0
      }
    });

    const systemPrompt = createBatchSystemPrompt();
    const userPrompt = createBatchUserPrompt(request, profile);

    console.log('🤖 [TopicGenerator] Sending request to OpenAI');
    console.log('📏 [TopicGenerator] Prompt lengths:', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      totalTokensEstimate: Math.ceil((systemPrompt.length + userPrompt.length) / 4)
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      console.error('❌ [TopicGenerator] OpenAI API error:', response.status, response.statusText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ [TopicGenerator] Received OpenAI response');
    console.log('📊 [TopicGenerator] Response metadata:', {
      usage: data.usage,
      model: data.model,
      finishReason: data.choices?.[0]?.finish_reason
    });

    let result;
    try {
      result = JSON.parse(data.choices[0].message.content);
      console.log('📋 [TopicGenerator] Parsed OpenAI response:', {
        topicQueriesCount: Object.keys(result.topicQueries || {}).length,
        hasTopicQueries: !!result.topicQueries,
        responseKeys: Object.keys(result)
      });
    } catch (parseError) {
      console.error('❌ [TopicGenerator] Failed to parse OpenAI response:', parseError);
      console.log('🔍 [TopicGenerator] Raw response content:', data.choices[0].message.content);
      throw new Error('Failed to parse OpenAI response');
    }
    
    const processedResult = validateAndProcessBatchResult(result, profile);
    
    console.log('🎉 [TopicGenerator] Topic generation completed successfully');
    console.log('📈 [TopicGenerator] Final results:', {
      topicsGenerated: Object.keys(processedResult.topicQueries).length,
      totalQueries: processedResult.totalQueriesGenerated,
      generationVersion: processedResult.generationVersion,
      averageQueriesPerTopic: processedResult.totalQueriesGenerated / Object.keys(processedResult.topicQueries).length || 0
    });

    return processedResult;

  } catch (error) {
    console.error('❌ [TopicGenerator] Error generating batch topic queries:', error);
    console.log('🔄 [TopicGenerator] Falling back to manual topic generation');
    return generateFallbackTopicQueries(profile);
  }
}

function createBatchSystemPrompt(): string {
  return `You are an expert content curator specializing in personalized video search queries. Your task is to generate optimized search queries for finding engaging, high-quality video content based on a user's interests and psychological profile.

Key Principles:
1. PERMA Alignment: Focus on Positive emotion, Engagement, Relationships, Meaning, and Accomplishment
2. Platform Optimization: Create queries that work well on YouTube and similar platforms
3. Quality Focus: Generate specific queries that surface quality, relevant content
4. Personalization: Tailor queries to user's MBTI type, interests, and wellness goals
5. Variety: Include different content types (tutorials, stories, discussions, inspiration)

Response Format:
Return a JSON object with "topicQueries" containing topic name as keys and query objects as values:

{
  "topicQueries": {
    "topic_name": {
      "queries": ["specific search query 1", "specific search query 2", "specific search query 3"],
      "platforms": ["youtube"],
      "permaDimension": "engagement",
      "priority": 8,
      "reasoning": "why this topic and these queries fit the user"
    }
  }
}

Make queries specific, engaging, and likely to find quality content. Avoid generic terms.`;
}

function createBatchUserPrompt(request: TopicGenerationRequest, profile: UnifiedPersonalizationProfile): string {
  const { mbtiType, permaScores, focusAreas, primaryInterests, personalContext } = request;
  
  // Get all topics from primary interests for initial generation
  const allTopics = profile.contentPreferences.primaryInterests || [];

  console.log('📝 [TopicGenerator] Building user prompt for topics:', allTopics);

  const prompt = `Generate optimized search queries for ALL of these topics for this user:

PERSONALITY PROFILE:
- MBTI Type: ${mbtiType}
- PERMA Scores: ${JSON.stringify(permaScores)}
- Focus Areas (need improvement): ${focusAreas.join(', ')}
- Current Mood: ${request.currentMood || 'unknown'}/10

TOPICS TO GENERATE QUERIES FOR:
${allTopics.map(topic => `- ${topic}`).join('\n')}

PERSONAL CONTEXT:
${personalContext?.happinessSources?.length ? `- Happiness Sources: ${personalContext.happinessSources.join(', ')}` : ''}
${personalContext?.wellnessGoals?.length ? `- Wellness Goals: ${personalContext.wellnessGoals.join(', ')}` : ''}
${personalContext?.avoidTopics?.length ? `- Avoid: ${personalContext.avoidTopics.join(', ')}` : ''}

INSTRUCTIONS:
1. Generate 3-4 specific, high-quality search queries for EACH topic listed above
2. Focus heavily on the user's focus areas (${focusAreas.join(', ')}) - these need improvement
3. Align content style with MBTI preferences (${mbtiType})
4. Prioritize topics that match focus areas with higher priority scores (8-10)
5. Create queries that will find engaging, positive, helpful content
6. Make queries specific enough to avoid generic/low-quality results
7. Consider the user's happiness sources and wellness goals
8. Map each topic to its most relevant PERMA dimension

Generate queries for ALL ${allTopics.length} topics listed above.`;

  console.log('📏 [TopicGenerator] User prompt stats:', {
    topicsCount: allTopics.length,
    promptLength: prompt.length,
    focusAreasCount: focusAreas.length,
    contextItemsCount: (personalContext?.happinessSources?.length || 0) + 
                     (personalContext?.wellnessGoals?.length || 0) + 
                     (personalContext?.avoidTopics?.length || 0)
  });

  return prompt;
}

function validateAndProcessBatchResult(
  result: any, 
  profile: UnifiedPersonalizationProfile
): BatchTopicResult {
  console.log('🔍 [TopicGenerator] Starting validation and processing');
  console.log('📊 [TopicGenerator] Raw result structure:', {
    hasTopicQueries: !!result.topicQueries,
    topicQueriesType: typeof result.topicQueries,
    resultKeys: Object.keys(result),
    expectedTopicsCount: profile.contentPreferences.primaryInterests.length
  });

  const processedQueries: Record<string, TopicSearchQuery> = {};
  let totalQueries = 0;
  let validTopics = 0;
  let invalidTopics = 0;
  
  if (result.topicQueries && typeof result.topicQueries === 'object') {
    Object.entries(result.topicQueries).forEach(([topicName, queryData]: [string, any]) => {
      console.log(`🔍 [TopicGenerator] Processing topic: "${topicName}"`);
      console.log(`📋 [TopicGenerator] Topic data:`, {
        hasQueries: !!queryData.queries,
        queriesType: Array.isArray(queryData.queries),
        queriesLength: queryData.queries?.length || 0,
        hasPermaDimension: !!queryData.permaDimension,
        hasPlatforms: !!queryData.platforms,
        hasPriority: !!queryData.priority,
        hasReasoning: !!queryData.reasoning
      });

      try {
        if (
          queryData.queries && 
          Array.isArray(queryData.queries) && 
          queryData.queries.length > 0
        ) {
          const cleanQueries = queryData.queries
            .map((q: any) => String(q).trim())
            .filter(Boolean);
          
          if (cleanQueries.length > 0) {
            processedQueries[topicName] = {
              queries: cleanQueries,
              platforms: Array.isArray(queryData.platforms) ? queryData.platforms : ['youtube'],
              generatedAt: new Date().toISOString(),
              permaDimension: String(queryData.permaDimension || 'engagement'), // Fix: Provide default
              priority: Math.max(1, Math.min(10, Number(queryData.priority) || 5)) // Fix: Ensure valid number
            };
            totalQueries += cleanQueries.length;
            validTopics++;
            
            console.log(`✅ [TopicGenerator] Successfully processed "${topicName}":`, {
              queriesCount: cleanQueries.length,
              permaDimension: processedQueries[topicName].permaDimension,
              priority: processedQueries[topicName].priority,
              platforms: processedQueries[topicName].platforms
            });
          } else {
            console.warn(`⚠️ [TopicGenerator] No valid queries after cleaning for topic: "${topicName}"`);
            invalidTopics++;
          }
        } else {
          console.warn(`⚠️ [TopicGenerator] Invalid structure for topic: "${topicName}"`, {
            missingQueries: !queryData.queries,
            notArray: !Array.isArray(queryData.queries),
            emptyArray: queryData.queries?.length === 0,
            missingPermaDimension: !queryData.permaDimension
          });
          invalidTopics++;
        }
      } catch (error) {
        console.error(`❌ [TopicGenerator] Error processing topic "${topicName}":`, error);
        console.log(`🔍 [TopicGenerator] Topic data that caused error:`, queryData);
        invalidTopics++;
      }
    });
  } else {
    console.error('❌ [TopicGenerator] Invalid result structure - no topicQueries object found');
    console.log('🔍 [TopicGenerator] Result structure:', result);
  }

  const finalResult = {
    topicQueries: processedQueries,
    totalQueriesGenerated: totalQueries,
    generationVersion: '3.0',
    generatedAt: new Date().toISOString()
  };

  console.log('📊 [TopicGenerator] Validation summary:', {
    totalTopicsProcessed: validTopics + invalidTopics,
    validTopics,
    invalidTopics,
    totalQueriesGenerated: totalQueries,
    averageQueriesPerTopic: validTopics > 0 ? (totalQueries / validTopics).toFixed(1) : '0',
    successRate: `${((validTopics / (validTopics + invalidTopics)) * 100).toFixed(1)}%`
  });

  return finalResult;
}

function generateFallbackTopicQueries(profile: UnifiedPersonalizationProfile): BatchTopicResult {
  console.log('🔄 [TopicGenerator] Generating fallback topic queries');
  console.log('📊 [TopicGenerator] Fallback input:', {
    primaryInterestsCount: profile.contentPreferences?.primaryInterests?.length || 0,
    focusAreasCount: profile.wellnessProfile?.focusAreas?.length || 0,
    userId: profile.userId
  });

  const fallbackQueries: Record<string, TopicSearchQuery> = {};
  
  // Generate fallback queries for primary interests if they exist
  const primaryInterests = profile.contentPreferences?.primaryInterests || [];
  if (primaryInterests.length > 0) {
    primaryInterests.forEach((interest, index) => {
      const topicKey = interest.toLowerCase().replace(/[^a-z0-9]/g, '_'); // Create valid key
      const priority = Math.max(1, 8 - index);
      
      fallbackQueries[topicKey] = {
        queries: [
          `${interest} for beginners`,
          `${interest} motivation and inspiration`,
          `${interest} tips and techniques`
        ],
        platforms: ['youtube'],
        generatedAt: new Date().toISOString(),
        permaDimension: inferPermaDimensionFromTopic(interest),
        priority: priority
      };
      
      console.log(`📝 [TopicGenerator] Created fallback for interest: "${interest}" (priority: ${priority})`);
    });
  } else {
    console.warn('⚠️ [TopicGenerator] No primary interests found, creating basic queries');
    // Create some basic queries if no interests are found
    const basicTopics = ['personal development', 'motivation', 'productivity', 'wellness'];
    basicTopics.forEach((topic, index) => {
      const topicKey = topic.replace(/\s+/g, '_');
      fallbackQueries[topicKey] = {
        queries: [
          `${topic} for beginners`,
          `${topic} tips and advice`,
          `${topic} inspiration`
        ],
        platforms: ['youtube'],
        generatedAt: new Date().toISOString(),
        permaDimension: 'engagement',
        priority: 7 - index
      };
      console.log(`📝 [TopicGenerator] Created basic fallback for: "${topic}"`);
    });
  }

  // Generate queries for focus areas if they exist
  const focusAreas = profile.wellnessProfile?.focusAreas || [];
  focusAreas.forEach((area, index) => {
    const focusQueries = getFallbackQueriesForDimension(area);
    if (focusQueries && focusQueries.length > 0) {
      const priority = 10 - index;
      const topicKey = `${area}_focus`;
      
      fallbackQueries[topicKey] = {
        queries: focusQueries,
        platforms: ['youtube'],
        generatedAt: new Date().toISOString(),
        permaDimension: area,
        priority: priority
      };
      
      console.log(`🎯 [TopicGenerator] Created fallback for focus area: "${area}" (priority: ${priority})`);
    }
  });

  const totalQueries = Object.values(fallbackQueries)
    .reduce((sum, topic) => sum + topic.queries.length, 0);

  const result = {
    topicQueries: fallbackQueries,
    totalQueriesGenerated: totalQueries,
    generationVersion: '3.0-fallback',
    generatedAt: new Date().toISOString()
  };

  console.log('✅ [TopicGenerator] Fallback generation completed:', {
    topicsGenerated: Object.keys(fallbackQueries).length,
    totalQueries: totalQueries,
    averageQueriesPerTopic: Object.keys(fallbackQueries).length > 0 
      ? (totalQueries / Object.keys(fallbackQueries).length).toFixed(1) 
      : '0'
  });

  return result;
}

// Helper function to convert profile to request format
export function profileToTopicRequest(profile: UnifiedPersonalizationProfile): TopicGenerationRequest {
  console.log('🔄 [TopicGenerator] Converting profile to topic request');
  
  const request = {
    mbtiType: profile.userCore.mbtiType,
    permaScores: profile.wellnessProfile.currentScores,
    focusAreas: profile.wellnessProfile.focusAreas,
    primaryInterests: profile.contentPreferences.primaryInterests,
    personalContext: {
      happinessSources: profile.wellnessProfile.happinessSources,
      wellnessGoals: profile.wellnessProfile.wellnessGoals,
      avoidTopics: profile.contentPreferences.avoidTopics
    },
    currentMood: profile.computed.overallHappiness
  };

  console.log('📊 [TopicGenerator] Request conversion summary:', {
    mbtiType: request.mbtiType,
    permaScoresRange: `${Math.min(...Object.values(request.permaScores))}-${Math.max(...Object.values(request.permaScores))}`,
    focusAreasCount: request.focusAreas.length,
    primaryInterestsCount: request.primaryInterests.length,
    currentMood: request.currentMood,
    contextItems: {
      happinessSources: request.personalContext.happinessSources?.length || 0,
      wellnessGoals: request.personalContext.wellnessGoals?.length || 0,
      avoidTopics: request.personalContext.avoidTopics?.length || 0
    }
  });

  return request;
}

function getFallbackQueriesForDimension(dimension: string): string[] {
  const fallbackQueryMap: Record<string, string[]> = {
    positiveEmotion: [
      'positive mindset motivation',
      'happiness and joy content',
      'uplifting inspirational videos'
    ],
    engagement: [
      'focus and productivity tips',
      'engaging hobby tutorials',
      'flow state motivation'
    ],
    relationships: [
      'building meaningful connections',
      'communication skills improvement',
      'relationship advice and tips'
    ],
    meaning: [
      'finding life purpose',
      'meaningful work and career',
      'personal growth journey'
    ],
    accomplishment: [
      'goal achievement strategies',
      'success stories motivation',
      'skill development tutorials'
    ]
  };

  return fallbackQueryMap[dimension] || [
    'personal development',
    'motivation and inspiration',
    'positive life skills'
  ]; // Fix: Always return an array
}

function inferPermaDimensionFromTopic(topic: string): string {
  const topicLower = topic.toLowerCase();
  
  // Topic-based mapping to PERMA dimensions
  if (topicLower.includes('relationship') || topicLower.includes('social') || topicLower.includes('friends') || topicLower.includes('family')) {
    return 'relationships';
  }
  if (topicLower.includes('goal') || topicLower.includes('achieve') || topicLower.includes('success') || topicLower.includes('accomplish')) {
    return 'accomplishment';
  }
  if (topicLower.includes('meaning') || topicLower.includes('purpose') || topicLower.includes('spiritual') || topicLower.includes('volunteer')) {
    return 'meaning';
  }
  if (topicLower.includes('positive') || topicLower.includes('happy') || topicLower.includes('joy') || topicLower.includes('fun')) {
    return 'positiveEmotion';
  }
  
  // Default to engagement for most interests
  return 'engagement';
}
