import { UnifiedPersonalizationProfile } from '../personalization/types';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

export interface SuggestionRequest {
  userInput: string;
  context?: string;
  personalization?: UnifiedPersonalizationProfile;
  maxSuggestions?: number;
  minInputLength?: number;
  domain?: 'wellness' | 'general' | 'learning' | 'chat';
}

export interface SuggestionResponse {
  suggestions: string[];
  source: 'pattern' | 'contextual' | 'ai' | 'fallback';
  generatedAt: string;
  inputLength: number;
}

/**
 * Main function to generate smart suggestions based on user input and context
 */
export async function generateSmartSuggestions(request: SuggestionRequest): Promise<SuggestionResponse> {
  const {
    userInput,
    context,
    personalization,
    maxSuggestions = 4,
    minInputLength = 3,
    domain = 'wellness'
  } = request;

  console.log('🤖 [SuggestionGenerator] Generating suggestions:', {
    inputLength: userInput.length,
    hasPersonalization: !!personalization,
    hasContext: !!context,
    domain
  });

  // Return empty if input too short
  if (userInput.length < minInputLength) {
    return {
      suggestions: [],
      source: 'fallback',
      generatedAt: new Date().toISOString(),
      inputLength: userInput.length
    };
  }

  try {
    // First, try pattern-based suggestions (fast and free)
    const patternSuggestions = getPatternBasedSuggestions(userInput, domain);
    
    // Then, try contextual suggestions based on personalization
    const contextualSuggestions = getContextualSuggestions(userInput, personalization, domain);
    
    // Combine and deduplicate
    const combinedSuggestions = [
      ...patternSuggestions,
      ...contextualSuggestions
    ].filter((suggestion, index, arr) => 
      arr.findIndex(s => s.toLowerCase() === suggestion.toLowerCase()) === index
    ).slice(0, maxSuggestions);

    if (combinedSuggestions.length > 0) {
      console.log('✅ [SuggestionGenerator] Using pattern/contextual suggestions:', combinedSuggestions.length);
      return {
        suggestions: combinedSuggestions,
        source: contextualSuggestions.length > 0 ? 'contextual' : 'pattern',
        generatedAt: new Date().toISOString(),
        inputLength: userInput.length
      };
    }

    // Fallback to AI-generated suggestions if available
    const aiSuggestions = await generateAISuggestions({
      userInput,
      context,
      personalization,
      maxSuggestions,
      domain
    });

    if (aiSuggestions.length > 0) {
      console.log('✅ [SuggestionGenerator] Using AI suggestions:', aiSuggestions.length);
      return {
        suggestions: aiSuggestions,
        source: 'ai',
        generatedAt: new Date().toISOString(),
        inputLength: userInput.length
      };
    }

    console.log('⚠️ [SuggestionGenerator] No suggestions generated');
    return {
      suggestions: [],
      source: 'fallback',
      generatedAt: new Date().toISOString(),
      inputLength: userInput.length
    };

  } catch (error) {
    console.error('❌ [SuggestionGenerator] Error generating suggestions:', error);
    return {
      suggestions: [],
      source: 'fallback',
      generatedAt: new Date().toISOString(),
      inputLength: userInput.length
    };
  }
}

/**
 * Generate pattern-based suggestions using predefined templates
 */
export function getPatternBasedSuggestions(
  userInput: string, 
  domain: string = 'wellness'
): string[] {
  const input = userInput.toLowerCase().trim();
  const suggestions: string[] = [];

  // Get domain-specific templates focused on happiness
  const templates = getHappinessTemplates(domain);

  // Question starters focused on happiness and growth
  if (input.startsWith('how')) {
    suggestions.push(...templates.how.slice(0, 2));
  }
  
  if (input.startsWith('what')) {
    suggestions.push(...templates.what.slice(0, 2));
  }

  if (input.startsWith('why')) {
    suggestions.push(...templates.why.slice(0, 2));
  }

  if (input.startsWith('i feel') || input.startsWith('i\'m feeling')) {
    suggestions.push(...templates.feeling.slice(0, 2));
  }

  if (input.startsWith('i want') || input.startsWith('i need')) {
    suggestions.push(...templates.want.slice(0, 2));
  }

  // PERMA-based topic suggestions
  Object.entries(templates.permaTopics).forEach(([topic, topicSuggestions]) => {
    if (input.includes(topic) && Array.isArray(topicSuggestions)) {
      suggestions.push(...topicSuggestions);
    }
  });

  return suggestions.slice(0, 3);
}

/**
 * Generate contextual suggestions based on personalization profile
 */
export function getContextualSuggestions(
  userInput: string,
  personalization?: UnifiedPersonalizationProfile,
  domain: string = 'wellness'
): string[] {
  if (!personalization) return [];
  
  const suggestions: string[] = [];
  const input = userInput.toLowerCase();

  // MBTI-based suggestions
  if (personalization.userCore?.mbtiType) {
    const mbtiSuggestions = getMBTIBasedSuggestions(input, personalization.userCore.mbtiType);
    suggestions.push(...mbtiSuggestions);
  }

  // PERMA focus areas - prioritize what needs improvement
  if (personalization.wellnessProfile?.focusAreas) {
    personalization.wellnessProfile.focusAreas.forEach((area: string) => {
      const areaSuggestions = getPermaFocusSuggestions(area, input);
      suggestions.push(...areaSuggestions);
    });
  }

  // Happiness sources - build on what already works
  if (personalization.wellnessProfile?.happinessSources) {
    personalization.wellnessProfile.happinessSources.forEach((source: string) => {
      if (input.includes(source.toLowerCase().split(' ')[0])) {
        suggestions.push(
          `How can I create more moments like ${source.toLowerCase()}?`,
          `What other activities similar to ${source.toLowerCase()} might I enjoy?`
        );
      }
    });
  }

  // Current happiness level context
  if (personalization.computed?.overallHappiness) {
    const happiness = personalization.computed.overallHappiness;
    const moodSuggestions = getHappinessMoodSuggestions(happiness, input);
    suggestions.push(...moodSuggestions);
  }

  // Communication style - adapt suggestion tone
  if (personalization.userCore?.communicationStyle === 'direct' && input.length < 10) {
    suggestions.push(
      "Give me 3 specific ways to boost my happiness today",
      "What's the fastest way to improve my mood?",
      "Show me proven happiness techniques"
    );
  } else if (personalization.userCore?.communicationStyle === 'supportive' && input.includes('feel')) {
    suggestions.push(
      "I'd like to explore what's affecting my happiness",
      "Can you help me understand my emotions better?",
      "I want to talk through what I'm experiencing"
    );
  }

  return suggestions.slice(0, 2);
}

/**
 * Generate AI-powered suggestions using OpenAI
 */
export async function generateAISuggestions(request: {
  userInput: string;
  context?: string;
  personalization?: UnifiedPersonalizationProfile;
  maxSuggestions?: number;
  domain?: string;
}): Promise<string[]> {
  const { userInput, context, personalization, maxSuggestions = 3, domain = 'wellness' } = request;

  // Only use AI suggestions for longer, more complex inputs to avoid API costs
  if (userInput.length < 8) return [];

  try {
    if (!OPENAI_API_KEY) {
      console.warn('⚠️ [SuggestionGenerator] OpenAI API key not found');
      return [];
    }

    const personalizationContext = personalization ? 
      buildPersonalizationContext(personalization) : '';
    
    const prompt = buildSuggestionPrompt({
      userInput,
      domain,
      personalizationContext,
      additionalContext: context,
      maxSuggestions
    });

    console.log('🤖 [SuggestionGenerator] Calling OpenAI API');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      
      console.log('✅ [SuggestionGenerator] OpenAI response received');
      return parseAIResponse(content);
    } else {
      console.error('❌ [SuggestionGenerator] OpenAI API error:', response.status);
    }
  } catch (error) {
    console.error('❌ [SuggestionGenerator] Error calling OpenAI:', error);
  }
  
  return [];
}

/**
 * Build personalization context string from profile
 */
export function buildPersonalizationContext(personalization: UnifiedPersonalizationProfile): string {
  const context: string[] = [];
  
  if (personalization.wellnessProfile?.focusAreas?.length) {
    context.push(`User wants to improve: ${personalization.wellnessProfile.focusAreas.join(', ')}`);
  }
  
  if (personalization.contentPreferences?.primaryInterests?.length) {
    context.push(`User interests: ${personalization.contentPreferences.primaryInterests.slice(0, 3).join(', ')}`);
  }
  
  if (personalization.userCore?.communicationStyle) {
    context.push(`Communication style: ${personalization.userCore.communicationStyle}`);
  }

  if (personalization.computed?.overallHappiness) {
    context.push(`Current happiness level: ${personalization.computed.overallHappiness}/10`);
  }
  
  return context.join('. ');
}

/**
 * Build suggestion prompt for AI focused on happiness and PERMA
 */
export function buildSuggestionPrompt(params: {
  userInput: string;
  domain: string;
  personalizationContext?: string;
  additionalContext?: string;
  maxSuggestions?: number;
}): string {
  const { userInput, domain, personalizationContext, additionalContext, maxSuggestions = 3 } = params;
  
  return `Given this partial user input: "${userInput}"

Context: This is for a happiness-focused AI companion app based on MBTI personality types and the PERMA model (Positive emotion, Engagement, Relationships, Meaning, Accomplishment). Our goal is to help users become happier, not provide therapy or mental health treatment.

${personalizationContext || ''} ${additionalContext || ''}

Generate ${maxSuggestions} natural, happiness-focused question completions that:
1. Help users explore what makes them uniquely happy
2. Align with their MBTI personality type and PERMA focus areas
3. Feel like natural completions of what they started typing
4. Focus on growth, joy, strengths, and positive possibilities
5. Are actionable and encouraging
6. Match the tone of the input

Avoid: Therapy language, clinical terms, mental health diagnoses, negative focus

Return only a JSON array of strings, no other text:`;
}

/**
 * Parse AI response and extract suggestions
 */
export function parseAIResponse(content: string): string[] {
  try {
    const suggestions = JSON.parse(content);
    return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
  } catch {
    // If JSON parsing fails, extract suggestions manually
    const lines = content.split('\n').filter((line: string) => 
      line.trim().startsWith('"') || line.trim().startsWith("'")
    );
    return lines.map((line: string) => 
      line.trim().replace(/^["']|["']$/g, '')
    ).slice(0, 3);
  }
}

// Helper functions

function getHappinessTemplates(domain: string) {
  const templates: Record<string, any> = {
    wellness: {
      how: [
        "How can I boost my happiness today?",
        "How do I create more positive emotions?",
        "How can I find flow in my daily activities?",
        "How do I strengthen my relationships?",
        "How can I discover more meaning in life?",
        "How do I celebrate my accomplishments better?",
        "How can I turn my strengths into happiness?",
        "How do I align my personality with my goals?"
      ],
      what: [
        "What activities bring me the most joy?",
        "What are my natural happiness patterns?",
        "What small changes could boost my mood?",
        "What relationships matter most to my wellbeing?",
        "What gives my life purpose and meaning?",
        "What achievements make me feel proudest?",
        "What PERMA areas should I focus on improving?",
        "What does happiness look like for my personality type?"
      ],
      why: [
        "Why do some activities energize me more than others?",
        "Why do I feel happiest in certain situations?",
        "Why is it important to understand my MBTI type?",
        "Why do my relationships affect my mood so much?",
        "Why do I sometimes struggle to feel accomplished?",
        "Why does meaning matter for long-term happiness?"
      ],
      feeling: [
        "I feel like I want to be happier overall",
        "I feel energized and want to build on this mood",
        "I feel disconnected from what brings me joy",
        "I feel like my personality isn't being expressed",
        "I feel ready to work on my happiness goals",
        "I feel curious about what makes me truly happy",
        "I feel like I need more positive moments in my day"
      ],
      want: [
        "I want to understand what makes me uniquely happy",
        "I want to build stronger, more meaningful relationships",
        "I want to find activities that create flow states",
        "I want to feel more accomplished in my daily life",
        "I want to discover my deeper life purpose",
        "I want to leverage my personality strengths",
        "I want to create sustainable happiness habits"
      ],
      permaTopics: {
        happy: [
          "What specific activities reliably boost my happiness?",
          "How can I create more moments of genuine joy?",
          "What's my personal happiness blueprint?"
        ],
        positive: [
          "How do I cultivate more positive emotions daily?",
          "What gratitude practices work for my personality?",
          "How can I reframe challenges more positively?"
        ],
        energy: [
          "What activities give me the most energy and engagement?",
          "How do I find my flow state more often?",
          "What hobbies align with my natural interests?"
        ],
        friends: [
          "How can I deepen my most meaningful friendships?",
          "What social activities bring me the most joy?",
          "How do I build connections that energize me?"
        ],
        purpose: [
          "What gives my life the deepest sense of meaning?",
          "How do I align my daily actions with my values?",
          "What legacy do I want to create?"
        ],
        goals: [
          "How do I set goals that truly excite me?",
          "What achievements would make me feel most proud?",
          "How can I celebrate progress along the way?"
        ],
        personality: [
          "How does my MBTI type influence my happiness?",
          "What environments help my personality thrive?",
          "How can I honor my natural preferences?"
        ],
        strengths: [
          "How can I use my top strengths more in daily life?",
          "What activities let me shine with my natural talents?",
          "How do I build on what I'm already good at?"
        ]
      }
    }
  };

  return templates[domain] || templates.wellness;
}

function getMBTIBasedSuggestions(input: string, mbtiType: string): string[] {
  const suggestions: string[] = [];
  
  // Extraversion vs Introversion
  if (mbtiType.startsWith('E') && (input.includes('social') || input.includes('people') || input.includes('energy'))) {
    suggestions.push(
      "How can I create more energizing social experiences?",
      "What group activities would boost my happiness?",
      "How do I balance social time with personal goals?"
    );
  } else if (mbtiType.startsWith('I') && (input.includes('quiet') || input.includes('alone') || input.includes('recharge'))) {
    suggestions.push(
      "How can I create more meaningful alone time?",
      "What solitary activities bring me the most joy?",
      "How do I honor my need for quiet reflection?"
    );
  }
  
  // Sensing vs Intuition
  if (mbtiType.includes('S') && (input.includes('practical') || input.includes('real') || input.includes('detail'))) {
    suggestions.push(
      "What concrete steps can I take to increase happiness?",
      "How do I find joy in everyday practical activities?",
      "What tangible goals would make me feel accomplished?"
    );
  } else if (mbtiType.includes('N') && (input.includes('future') || input.includes('possibility') || input.includes('creative'))) {
    suggestions.push(
      "How can I explore new possibilities for happiness?",
      "What creative pursuits align with my vision?",
      "How do I turn my big ideas into joyful realities?"
    );
  }
  
  // Thinking vs Feeling
  if (mbtiType.includes('T') && (input.includes('logic') || input.includes('efficient') || input.includes('analyze'))) {
    suggestions.push(
      "What's the most logical approach to increasing my happiness?",
      "How can I systematically improve my wellbeing?",
      "What metrics can I use to track my happiness progress?"
    );
  } else if (mbtiType.includes('F') && (input.includes('values') || input.includes('harmony') || input.includes('people'))) {
    suggestions.push(
      "How can I align my happiness goals with my values?",
      "What brings harmony and joy to my relationships?",
      "How do I honor my emotional needs for happiness?"
    );
  }
  
  // Judging vs Perceiving
  if (mbtiType.includes('J') && (input.includes('plan') || input.includes('structure') || input.includes('organize'))) {
    suggestions.push(
      "How can I create a structured happiness routine?",
      "What planning strategies support my wellbeing goals?",
      "How do I organize my life to maximize joy?"
    );
  } else if (mbtiType.includes('P') && (input.includes('flexible') || input.includes('spontaneous') || input.includes('adapt'))) {
    suggestions.push(
      "How can I stay open to unexpected sources of happiness?",
      "What flexible approaches help me find joy?",
      "How do I adapt my happiness strategies as I grow?"
    );
  }
  
  return suggestions.slice(0, 2);
}

function getPermaFocusSuggestions(area: string, input: string): string[] {
  const suggestions: string[] = [];
  
  if (area === 'positiveEmotion' && (input.includes('mood') || input.includes('happy') || input.includes('joy') || input.includes('feel'))) {
    suggestions.push(
      "What are 3 simple ways I can boost my mood right now?",
      "How can I create more moments of genuine joy today?",
      "What gratitude practice would work best for my personality?"
    );
  }
  
  if (area === 'engagement' && (input.includes('focus') || input.includes('flow') || input.includes('passion') || input.includes('hobby'))) {
    suggestions.push(
      "What activities help me lose track of time in the best way?",
      "How can I find more flow states in my daily life?",
      "What skills do I want to develop that would bring me joy?"
    );
  }

  if (area === 'relationships' && (input.includes('friend') || input.includes('family') || input.includes('social') || input.includes('connect'))) {
    suggestions.push(
      "How can I deepen one meaningful relationship this week?",
      "What social activities align with my personality and bring joy?",
      "How do I create more quality time with people I care about?"
    );
  }

  if (area === 'meaning' && (input.includes('purpose') || input.includes('meaningful') || input.includes('why') || input.includes('values'))) {
    suggestions.push(
      "What daily activities could feel more meaningful to me?",
      "How do I connect my personal values to my happiness goals?",
      "What legacy do I want to build that brings me joy?"
    );
  }

  if (area === 'accomplishment' && (input.includes('achieve') || input.includes('success') || input.includes('goal') || input.includes('proud'))) {
    suggestions.push(
      "What small win can I celebrate today?",
      "How do I set happiness-focused goals that excite me?",
      "What achievement would make me feel genuinely proud?"
    );
  }

  return suggestions;
}

function getHappinessMoodSuggestions(happiness: number, input: string): string[] {
  const suggestions: string[] = [];
  
  if (happiness <= 4 && (input.includes('help') || input.includes('better') || input.includes('improve'))) {
    suggestions.push(
      "What's one small thing that could brighten my day?",
      "How can I tap into my natural strengths to feel better?",
      "What past happy moments can I recreate today?"
    );
  } else if (happiness >= 7 && (input.includes('more') || input.includes('grow') || input.includes('build'))) {
    suggestions.push(
      "How can I amplify this positive energy I'm feeling?",
      "What new happiness habits can I build on this momentum?",
      "How can I share this good mood with others?"
    );
  } else if (happiness >= 5 && happiness <= 6) {
    suggestions.push(
      "What would move my happiness from good to great today?",
      "How can I build on the positive things already working?",
      "What one new joy-bringing activity could I try?"
    );
  }
  
  return suggestions;
}

/**
 * Build fallback queries for underrepresented PERMA dimensions
 */
export function getFallbackQueriesForDimension(dimension: string): string[] {
  const fallbackQueryMap: Record<string, string[]> = {
    positiveEmotion: [
      'daily happiness boosters',
      'simple joy activities',
      'mood lifting techniques'
    ],
    engagement: [
      'finding your flow state',
      'passion discovery activities',
      'engaging hobby ideas'
    ],
    relationships: [
      'building meaningful connections',
      'friendship strengthening ideas',
      'social happiness tips'
    ],
    meaning: [
      'discovering life purpose',
      'meaningful daily activities',
      'values-based living'
    ],
    accomplishment: [
      'celebrating small wins',
      'personal achievement ideas',
      'strength-based success'
    ]
  };

  return fallbackQueryMap[dimension] || [
    'personality-based happiness',
    'MBTI strengths development',
    'positive life enhancement'
  ];
}
