import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Helper function to retrieve communication style based on MBTI type
const getCommunicationStyle = (mbtiType: string): string => {
  const styles: { [key: string]: string } = {
    ENTJ: 'Be direct and results-oriented, focusing on goals and efficiency.',
    ENFJ: 'Use empathetic and supportive language, emphasizing collaboration.',
    ESTJ: 'Provide clear, structured information with practical applications.',
    ESFJ: 'Engage warmly, focusing on harmony and personal connections.',
    ENTP: 'Encourage exploration of ideas with an open and enthusiastic tone.',
    ENFP: 'Be enthusiastic and imaginative, supporting their creative pursuits.',
    ESTP: 'Keep communication dynamic and action-oriented, focusing on the present.',
    ESFP: 'Use lively and expressive language, emphasizing experiences and fun.',
    INTJ: 'Communicate with strategic and insightful language, focusing on concepts.',
    INFJ: 'Be compassionate and deep, encouraging meaningful discussions.',
    ISTJ: 'Provide detailed and factual information in a straightforward manner.',
    ISFJ: 'Use considerate and gentle language, focusing on stability and support.',
    INTP: 'Engage in logical analysis, encouraging independent thought.',
    INFP: 'Be sincere and reflective, supporting their values and ideals.',
    ISTP: 'Keep communication concise and practical, focusing on problem-solving.',
    ISFP: 'Use kind and flexible language, emphasizing personal values and experiences.'
  };
  return styles[mbtiType] || 'Use a balanced and adaptable communication style.';
};

// Helper function to retrieve communication strategy based on AI preference
const getAIPreferenceStrategy = (aiPreference: string): string => {
  const strategies: { [key: string]: string } = {
    enthusiastic: 'Encourage their passion for AI by providing advanced insights and opportunities for deeper engagement.',
    optimistic: 'Highlight the benefits of AI and suggest practical ways to integrate it into their interests.',
    cautious: 'Acknowledge their concerns about AI, providing balanced information and emphasizing safety measures.',
    resistant: 'Address their skepticism by building trust, offering clear explanations, and alleviating fears.'
  };
  return strategies[aiPreference] || 'Maintain a neutral and informative approach to AI topics.';
};

const formatMessage = (role: 'system' | 'user' | 'assistant', content: string) => ({
  role,
  content
});

const formatResponse = (response: string): string => {
  // Add line breaks and paragraph breaks for better readability
  const paragraphs = response.split('\n').map(paragraph => paragraph.trim()).filter(paragraph => paragraph.length > 0);
  const formattedParagraphs = [];
  let currentParagraph = '';

  paragraphs.forEach((paragraph, index) => {
    if (paragraph.startsWith('•')) {
      if (index % 2 === 0 && currentParagraph) {
        formattedParagraphs.push(currentParagraph);
        currentParagraph = '';
      }
    }
    currentParagraph += `${paragraph}\n`;
  });

  if (currentParagraph) {
    formattedParagraphs.push(currentParagraph);
  }

  return formattedParagraphs.join('\n\n');
};

export const generateChatResponse = async (
  message: string,
  chatHistory: any[] = [],
  mbtiType?: string,
  aiPreference?: string
) => {
  try {
    // Define the chatbot's persona and objectives with the new empowering, questioning approach
    const persona = `You are an empathetic AI coach who listens carefully and asks thoughtful questions. 
Your main goals are to:
1. Keep your responses brief and concise (2-3 short paragraphs maximum)
2. Ask at least one follow-up question in EVERY response to deepen understanding
3. Create an empowering and positive conversation experience
4. Gather information about the user's challenges, goals, and needs
5. Identify moments to recommend relevant learning resources naturally
6. Help users adapt to the AI era by building their confidence

When the user might benefit from learning resources, mention that you have helpful tutorials/guides available,
but do so conversationally rather than immediately listing them.`;

    // Adjust communication style based on MBTI type
    const communicationStyle = mbtiType ? getCommunicationStyle(mbtiType) : '';

    // Adjust communication strategy based on AI preference
    const aiStrategy = aiPreference ? getAIPreferenceStrategy(aiPreference) : '';

    // Construct the system message
    const systemMessage = `${persona} ${communicationStyle} ${aiStrategy}`;

    // Prepare the messages for the API call
    const messages = [
      formatMessage('system', systemMessage),
      ...chatHistory.map(msg => formatMessage(msg.role as 'user' | 'assistant', msg.content)),
      formatMessage('user', message)
    ];

    // Call the OpenAI API to generate a response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages
    });

    let response = completion.choices[0].message?.content;
    if (!response) {
      throw new Error('No response generated');
    }

    // Format the response
    response = formatResponse(response);

    return { response };
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw error;
  }
};

export const extractKeyword = async (message: string): Promise<string> => {
  if (!message || typeof message !== "string") return "";

  const prompt = `
    Extract the most relevant single keyword from the following search phrase.
    Do not return multiple words, only the most important keyword related to the search.
    If no relevant keyword exists, return an empty string.

    Search Phrase: "${message}"
    Keyword:
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
      ],
      max_tokens: 10
    });

    const keyword = response.choices[0].message?.content?.trim() || "";
    return keyword;
  } catch (error) {
    console.error("Error extracting keyword:", error);
    return "";
  }
};

/**
 * Generate personalized mental well-being suggestions using AI
 */
export const generateMoodSuggestions = async (
  entries: any[],
  trend: string,
  riskLevel: string
): Promise<string[]> => {
  try {
    const prompt = `
      Based on the following mood data:
      - Trend: ${trend}
      - Risk Level: ${riskLevel}
      - Recent moods: ${entries.slice(0, 3).map(e => e.mood).join(', ')}
      - Common tags: ${entries.slice(0, 3).flatMap(e => e.tags).join(', ')}

      Provide 3 specific, actionable suggestions to improve mental well-being.
      Focus on practical steps that can be taken immediately.
      Keep each suggestion concise (under 100 characters).
      Format as a simple list.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a supportive mental health assistant.' },
        { role: 'user', content: prompt }
      ]
    });

    const suggestions = completion.choices[0].message?.content
      ?.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 3) || [];

    return suggestions;
  } catch (error) {
    console.error('Error generating mood suggestions:', error);
    return [
      'Take a few deep breaths and practice mindfulness',
      'Connect with a friend or family member',
      'Do something you enjoy for at least 15 minutes'
    ];
  }
};

/**
 * Uses OpenAI API to fetch very specific, current trending topics (real events/news)
 * in the AI domain for a given query.
 * The prompt instructs OpenAI to return a plain text list of topics.
 */
export async function fetchTrendingTopics(query: string): Promise<string[]> {
  const prompt = `
    You are an AI assistant that provides up-to-date news and events in the AI industry.
    Provide a plain text list of the latest, very specific trending events or news headlines 
    in the AI industry related to "${query}". Each entry should be a real, verifiable event or news item.
    Ensure the topics are current, relevant, and specific to the AI industry.
    Return each topic on a new line without any additional text or formatting. Do not return - or ". 
  `;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that provides up-to-date AI news headlines.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    // Expect OpenAI to respond with a plain text list of topics, e.g., 'Headline 1\nHeadline 2\n...'
    const content = completion.choices[0].message?.content;
    let topics: string[] = [];
    if (content) {
      topics = content.split('\n').map(topic => topic.trim()).filter(topic => topic.length > 0);
    } else {
      console.error('No content received in the response.');
    }
    return topics;
  } catch (error) {
    console.error('Error fetching trending topics via OpenAI API:', error);
    return [];
  }
}

/**
 * Check content meaning using OpenAI
 */
export const checkContentMeaning = async (content: string, type: 'title' | 'content'): Promise<{
  isAppropriate: boolean;
  reason?: string;
  suggestions?: string[];
}> => {
  const prompt = `
    Analyze this ${type} for a community forum post about AI adaptation and learning:
    "${content}"

    Consider:
    1. Relevance to AI/technology learning
    2. Clarity and coherence
    3. Constructive/helpful nature
    4. Professional tone
    5. Appropriate content

    Respond in JSON format:
    {
      "isAppropriate": boolean,
      "reason": string (if not appropriate),
      "suggestions": string[] (improvement suggestions)
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a content moderation assistant.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message?.content || '{}');
  } catch (error) {
    console.error('Error checking content meaning:', error);
    return { isAppropriate: true };
  }
};

/**
 * Use OpenAI's moderation API to check content
 */
export const moderateContentWithAPI = async (content: string): Promise<{
  flagged: boolean;
  category?: string;
}> => {
  try {
    const moderationResponse = await openai.moderations.create({
      input: content
    });

    const results = moderationResponse.results[0];
    if (results.flagged) {
      const flaggedCategory = Object.entries(results.categories)
        .find(([_, flagged]) => flagged)?.[0];

      return {
        flagged: true,
        category: flaggedCategory
      };
    }
    
    return { flagged: false };
  } catch (error) {
    console.error('OpenAI moderation API error:', error);
    return { flagged: false };
  }
};

/**
 * Generate tutorial topics based on a user's learning goal
 * @param title Goal title
 * @param description Goal description
 * @returns Array of suggested tutorial topics
 */
export const generateTutorialTopics = async (
  title: string,
  description: string
): Promise<string[]> => {
  try {
    const prompt = `Based on the user's learning goal: "${title}" - "${description}", suggest a list of highly engaging and necessary tutorial topics to help achieve this goal. Return each topic on a new line.`;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert in suggesting tutorial topics that are really needed and highly eye attractive to users.' },
        { role: 'user', content: prompt }
      ]
    });
    
    const topicsText = response.choices[0].message?.content || '';
    return topicsText.split('\n').map(t => t.trim()).filter(t => t);
  } catch (error) {
    console.error('Error generating tutorial topics:', error);
    return [];
  }
};

/**
 * Core function to process a therapy message and generate a response
 * This is the main entry point used by therapychat.ts
 */
export const processTherapyMessage = async (
  message: string,
  chatHistory: any[] = [],
  mbtiType?: string | null,
  therapyStyle?: string | null,
  therapyModality?: string | null,
  communicationTone?: string | null,
  enhancedInstructions?: string | null
): Promise<{ response: string; tags?: string[] }> => {
  try {
    // Input validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return { 
        response: "I didn't catch that. Could you share your thoughts again?",
        tags: ['clarification']
      };
    }
    
    // Crisis content detection
    if (detectCrisisContent(message)) {
      return {
        response: "I notice you may be going through a difficult time. Remember that I'm here to listen, but I'm not a substitute for professional help. If you're in crisis, please consider contacting a mental health professional or a crisis helpline. Would you like to continue our conversation?",
        tags: ['crisis', 'support', 'resources']
      };
    }
    
    // Generate response
    return await generateTherapyResponse(
      message,
      chatHistory,
      mbtiType,
      therapyStyle,
      therapyModality,
      communicationTone,
      enhancedInstructions
    );
  } catch (error) {
    console.error('Error processing therapy message:', error);
    return { 
      response: "I apologize, but I'm having trouble connecting right now. Could we try again in a moment?",
      tags: ['error']
    };
  }
};

// Simple in-memory cache for therapy responses
const therapyResponseCache = new Map<string, {response: string, tags: string[], timestamp: number}>();

/**
 * Generate AI therapy response based on MBTI type and therapy preferences
 * Internal function used by processTherapyMessage
 */
const generateTherapyResponse = async (
  message: string,
  chatHistory: any[] = [],
  mbtiType?: string | null,
  therapyStyle?: string | null,
  therapyModality?: string | null,
  communicationTone?: string | null,
  additionalInstructions?: string | null
): Promise<{ response: string; tags?: string[] }> => {
  try {
    // Define the therapist persona based on MBTI and preferences
    const getMbtiDefaults = (type: string = '') => {
      const defaults: { [key: string]: {style: string, modality: string, tone: string} } = {
        'ISTJ': {style: 'Professional Therapist', modality: 'CBT', tone: 'Direct & Straightforward'},
        'ISFJ': {style: 'Warm & Supportive Clinician', modality: 'Humanistic', tone: 'Warm & Nurturing'},
        'INFJ': {style: 'Philosophical Guide', modality: 'Psychodynamic', tone: 'Warm & Nurturing'},
        'INTJ': {style: 'Professional Therapist', modality: 'CBT', tone: 'Direct & Straightforward'},
        'ISTP': {style: 'Problem-Solver', modality: 'Solution-Focused', tone: 'Direct & Straightforward'},
        'ISFP': {style: 'Empathetic Friend', modality: 'Humanistic', tone: 'Warm & Nurturing'},
        'INFP': {style: 'Philosophical Guide', modality: 'Humanistic', tone: 'Warm & Nurturing'},
        'INTP': {style: 'Professional Therapist', modality: 'CBT', tone: 'Balanced & Adaptable'},
        'ESTP': {style: 'Tough Coach', modality: 'Solution-Focused', tone: 'Direct & Straightforward'},
        'ESFP': {style: 'Empathetic Friend', modality: 'Humanistic', tone: 'Casual & Friendly'},
        'ENFP': {style: 'Empathetic Friend', modality: 'Humanistic', tone: 'Empowering & Motivational'},
        'ENTP': {style: 'Problem-Solver', modality: 'CBT', tone: 'Direct & Straightforward'},
        'ESTJ': {style: 'Professional Therapist', modality: 'CBT', tone: 'Direct & Straightforward'},
        'ESFJ': {style: 'Empathetic Friend', modality: 'Humanistic', tone: 'Warm & Nurturing'},
        'ENFJ': {style: 'Philosophical Guide', modality: 'Humanistic', tone: 'Empowering & Motivational'},
        'ENTJ': {style: 'Professional Therapist', modality: 'Solution-Focused', tone: 'Direct & Straightforward'},
        'default': {style: 'Balanced Therapist', modality: 'Integrative', tone: 'Balanced & Adaptable'},
      };
      
      return defaults[type] || defaults.default;
    };
    
    // Get defaults based on MBTI
    const defaults = getMbtiDefaults(mbtiType || '');
    
    // Use provided preferences or defaults
    const style = therapyStyle || defaults.style;
    const modality = therapyModality || defaults.modality;
    const tone = communicationTone || defaults.tone;
    
    // Build therapeutic persona based on selected styles
    let therapistPersona = `You are an AI-powered therapeutic assistant using a ${style} approach with ${modality} 
techniques and a ${tone} communication style. Your goal is to provide supportive, empathetic responses
that help the user explore their thoughts and feelings.`;
    
    // Add style-specific instructions
    const styleInstructions: { [key: string]: string } = {
      'Professional Therapist': 'Maintain clinical expertise while being approachable. Use evidence-based insights and occasional references to research.',
      'Empathetic Friend': 'Be warm, supportive, and validating. Focus on understanding emotions and providing comfort.',
      'Problem-Solver': 'Help identify actionable steps to address specific issues. Be practical and solutions-oriented.',
      'Philosophical Guide': 'Explore deeper meaning and values. Ask thought-provoking questions about purpose and personal growth.',
      'Mindfulness Guru': 'Emphasize present-moment awareness and acceptance. Incorporate brief mindfulness techniques.',
      'Tough Coach': 'Provide direct feedback and challenge unhelpful patterns while maintaining support and encouragement.',
      'Warm & Supportive Clinician': 'Balance professional expertise with warmth and nurturing support.'
    };
    
    // Add modality-specific instructions
    const modalityInstructions: { [key: string]: string } = {
      'CBT': 'Focus on identifying and challenging negative thought patterns. Connect thoughts, feelings, and behaviors.',
      'Humanistic': 'Emphasize personal growth, self-actualization, and unconditional positive regard.',
      'Psychodynamic': 'Explore how past experiences might influence current feelings and behaviors.',
      'Solution-Focused': 'Concentrate on goals and solutions rather than problems. Use scaling questions and future-oriented thinking.',
      'Mindfulness-Based': 'Incorporate mindful awareness and acceptance practices. Help users observe thoughts without judgment.',
      'Gestalt': 'Focus on present experiences and awareness. Use techniques to increase self-awareness and personal responsibility.',
      'Integrative': 'Draw flexibly from different therapeutic approaches based on the user\'s needs and concerns.'
    };
    
    // Add tone-specific instructions
    const toneInstructions: { [key: string]: string } = {
      'Direct & Straightforward': 'Use clear, concise language without unnecessary frills. Be honest but tactful.',
      'Warm & Nurturing': 'Be gentle and affirming. Use empathetic language and focus on emotional support.',
      'Balanced & Adaptable': 'Adjust between direct and warm communication based on context. Maintain a professional yet accessible tone.',
      'Casual & Friendly': 'Use conversational language and occasional humor. Feel approachable and down-to-earth.',
      'Empowering & Motivational': 'Be encouraging and inspiring. Focus on strengths and potential for positive change.'
    };
    
    // Add MBTI-specific approach adaptations
    const mbtiApproach = mbtiType ? getTherapyApproachForMBTI(mbtiType) : '';
    
    // Compile the full system message
    const systemMessage = `
      ${therapistPersona}
      
      ${styleInstructions[style] || ''}
      ${modalityInstructions[modality] || ''}
      ${toneInstructions[tone] || ''}
      ${mbtiApproach}
      
      Guidelines for your responses:
      1. Keep responses concise (1-3 sentences per paragraph) and conversational
      2. Show empathy for the user's emotions and validate their experiences
      3. Ask a focused follow-up question at the end of most responses to encourage reflection
      4. Maintain appropriate therapeutic boundaries while building rapport
      5. When appropriate, suggest evidence-based techniques without being prescriptive
      6. Use language that respects the user's autonomy and agency
      
      IMPORTANT DISCLAIMER TO ADD OCCASIONALLY: "I'm here to support you, but I'm not a substitute for professional medical help."
      
      ${additionalInstructions || ''}
    `;
    
    // Check cached response first
    const simplifiedMessage = message.trim().toLowerCase();
    const cacheKey = `${simplifiedMessage.slice(0, 30)}|${mbtiType || 'default'}|${style}`;
    const cachedResponse = therapyResponseCache.get(cacheKey);
    
    if (cachedResponse && Date.now() - cachedResponse.timestamp < 3600000) { // Cache for 1 hour
      return { 
        response: cachedResponse.response, 
        tags: cachedResponse.tags 
      };
    }
    
    // Extract context from chat history
    const contextMessages = chatHistory.slice(-5).map(msg => ({
      role: msg.role as 'user' | 'assistant', 
      content: msg.content
    }));
    
    // Prepare the messages for the API call
    const messages = [
      formatMessage('system', systemMessage),
      ...contextMessages,
      formatMessage('user', message)
    ];
    
    // Extract potential therapeutic themes
    const therapeuticTagsPrompt = `
      Based on this user message within a therapy context, identify 1-3 key therapeutic themes or topics present.
      Return ONLY a JSON array of lowercase tag strings, nothing else.
      Example: ["anxiety", "relationships", "self-esteem"]
      
      User message: "${message}"
    `;
    
    // Call the OpenAI API to generate a response and tags concurrently
    const [completion, tagsResponse] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      }),
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a therapeutic content tagger.' },
          { role: 'user', content: therapeuticTagsPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 50
      })
    ]);

    let response = completion.choices[0].message?.content;
    if (!response) {
      throw new Error('No therapy response generated');
    }
    
    // Process tags
    let tags: string[] = [];
    try {
      const tagsObj = JSON.parse(tagsResponse.choices[0].message?.content || '{"tags":[]}');
      tags = Array.isArray(tagsObj.tags) ? tagsObj.tags.slice(0, 3) : [];
    } catch (error) {
      console.error('Error parsing therapy tags:', error);
      tags = [];
    }
    
    // Cache the response
    therapyResponseCache.set(cacheKey, {
      response,
      tags,
      timestamp: Date.now()
    });

    return { response, tags };
  } catch (error) {
    console.error('Error generating therapy response:', error);
    return { 
      response: "I'm having trouble processing your request right now. Could you try sharing your thoughts again?",
      tags: ['error']
    };
  }
};

// Helper function for MBTI-specific therapy approaches
const getTherapyApproachForMBTI = (mbtiType: string): string => {
  const approaches: { [key: string]: string } = {
    'INTJ': 'This person values logic and evidence. Provide clear reasoning behind therapeutic suggestions. Avoid overly emotional language while still acknowledging feelings.',
    'INTP': 'This person appreciates theoretical frameworks and intellectual exploration. Connect therapeutic concepts to broader systems of thought and encourage analytical reflection.',
    'ENTJ': 'This person values efficiency and structure. Provide clear action steps and measurable goals. Be direct about what works and what doesn\'t.',
    'ENTP': 'This person enjoys exploring possibilities. Present multiple therapeutic approaches and allow them to choose. Engage with their ideas and build upon them.',
    'INFJ': 'This person seeks meaning and depth. Connect therapeutic insights to their personal values and long-term growth. Acknowledge the uniqueness of their experience.',
    'INFP': 'This person is guided by personal values and authenticity. Honor their individual journey and emotional depth. Avoid prescriptive approaches in favor of collaborative exploration.',
    'ENFJ': 'This person is motivated by supporting others and personal growth. Connect therapeutic insights to their relationships and impact on others. Provide positive reinforcement.',
    'ENFP': 'This person thrives on possibilities and connection. Keep the conversation dynamic and authentic. Connect therapeutic insights to their values and potential futures.',
    'ISTJ': 'This person values reliability and practicality. Provide clear, structured therapeutic approaches with specific steps. Respect their preference for proven methods.',
    'ISFJ': 'This person values tradition and caring for others. Acknowledge their efforts and provide gentle, practical guidance. Connect insights to their important relationships.',
    'ESTJ': 'This person appreciates clear structure and efficiency. Provide straightforward therapeutic approaches with measurable outcomes. Be direct and practical.',
    'ESFJ': 'This person values harmony and supporting others. Acknowledge their feelings about relationships and provide constructive ways to maintain connections while attending to their needs.',
    'ISTP': 'This person values practical problem-solving. Focus on actionable strategies and respect their independence. Be concise and avoid abstract theories.',
    'ISFP': 'This person lives in the moment and values authenticity. Honor their unique perspective and provide space for self-expression. Avoid rigid structures.',
    'ESTP': 'This person is action-oriented and pragmatic. Focus on immediate, practical solutions and tangible results. Keep the conversation dynamic and relevant.',
    'ESFP': 'This person enjoys experiences and connecting with others. Keep therapeutic approaches engaging and positive. Connect insights to improving their important relationships.'
  };
  
  return approaches[mbtiType] || '';
};

// Helper function to detect crisis content
const detectCrisisContent = (message: string): boolean => {
  const lowercaseMsg = message.toLowerCase();
  const crisisKeywords = [
    'kill myself', 'suicide', 'want to die', 'end my life',
    'no reason to live', 'better off dead', 'hurt myself',
    'self harm', 'cutting myself'
  ];
  
  return crisisKeywords.some(keyword => lowercaseMsg.includes(keyword));
};

/**
 * Generate personalized content search queries based on MBTI type, mood and user preferences
 */
export const generateContentRecommendations = async (
  mbtiType: string,
  moodData?: { 
    rating?: number,
    mood?: string,
    tags?: string[]
  },
  userPreferences?: {
    contentType?: string,
    formalityLevel?: number, // 1-5: 1=casual, 5=formal
    specificRequest?: string
  },
  previousFeedback?: {
    likedTopics?: string[],
    dislikedTopics?: string[]
  }
): Promise<{videoQueries: string[], websiteQueries: string[]}> => {
  try {
    // Default mood if none provided
    const mood = moodData?.mood || 'neutral';
    const rating = moodData?.rating || 5;
    const tags = moodData?.tags || [];
    
    // Extract user preferences
    const contentType = userPreferences?.contentType || '';
    const formalityLevel = userPreferences?.formalityLevel || 3; // Default medium formality
    const specificRequest = userPreferences?.specificRequest || '';
    
    // Extract previous feedback
    const likedTopics = previousFeedback?.likedTopics || [];
    const dislikedTopics = previousFeedback?.dislikedTopics || [];
    
    // Determine tone based on formality level
    let toneSuggestion = '';
    if (formalityLevel === 1) toneSuggestion = 'Use a very casual, fun tone with humor and lighthearted content';
    else if (formalityLevel === 2) toneSuggestion = 'Use a casual, friendly tone';
    else if (formalityLevel === 3) toneSuggestion = 'Balance formal and casual elements';
    else if (formalityLevel === 4) toneSuggestion = 'Use a mostly formal tone with professional resources';
    else if (formalityLevel === 5) toneSuggestion = 'Use a very formal, educational tone with scholarly content';
    
    // Create a prompt for OpenAI
    const prompt = `
      You are an AI trained to suggest personalized content to improve user wellbeing.
      
      User Profile:
      - MBTI Type: ${mbtiType}
      - Current Mood: ${mood} (${rating}/10)
      - Related feelings/topics: ${tags.join(', ')}
      
      User Preferences:
      - Content type preference: ${contentType || 'No specific preference'}
      - Formality level (1-5): ${formalityLevel} - ${toneSuggestion}
      - Specific request: ${specificRequest || 'None provided'}
      
      User Feedback History:
      - Previously liked topics: ${likedTopics.length > 0 ? likedTopics.join(', ') : 'No data available'}
      - Previously disliked topics: ${dislikedTopics.length > 0 ? dislikedTopics.join(', ') : 'No data available'}
      
      Based on your knowledge of ${mbtiType} personality traits and preferences:
      1. Generate three specific search queries for videos that would appeal to this personality type and help with their current mood
      2. Generate three specific search queries for websites/articles that would resonate with this personality type's interests and needs
      
      IMPORTANT: DO NOT explicitly mention MBTI or personality types in the queries. Instead, create queries that naturally align with the preferences, values, and interests typical of this personality type.
      
      The queries should:
      - Respect the user's formality preference (${formalityLevel}/5)
      - Incorporate their specific request: "${specificRequest}" (if provided)
      - Include their preferred content type: "${contentType}" (if provided)
      - Build on topics they previously liked
      - Avoid topics they previously disliked
      
      Format your response as a JSON object with the following structure:
      {
        "videoQueries": ["query1", "query2", "query3"],
        "websiteQueries": ["query1", "query2", "query3"]
      }
      
      Ensure queries address the user's current mood state:
      - If mood is positive (rating > 7), focus on maintaining or enhancing that state
      - If mood is neutral (rating 4-7), focus on engagement and enrichment
      - If mood is negative (rating < 4), focus on comfort, improvement, and support
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that suggests personalized content.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const response = JSON.parse(completion.choices[0].message?.content || '{"videoQueries":[], "websiteQueries":[]}');
    
    return {
      videoQueries: response.videoQueries.slice(0, 3),
      websiteQueries: response.websiteQueries.slice(0, 3)
    };
  } catch (error) {
    console.error('Error generating content recommendations:', error);
    // Provide default recommendations based on MBTI type if AI fails
    const defaultQueries = getDefaultQueries(mbtiType);
    return defaultQueries;
  }
};

// Helper function to provide fallback queries based on MBTI type
const getDefaultQueries = (mbtiType: string): {videoQueries: string[], websiteQueries: string[]} => {
  const firstLetter = mbtiType.charAt(0);
  const lastLetter = mbtiType.charAt(3);
  
  // Basic personality categorization for defaults
  let videoQueries = ['positive mindfulness practices', 'relaxing nature videos', 'uplifting music playlist'];
  let websiteQueries = ['productivity tools', 'mental wellbeing tips', 'inspirational stories'];
  
  // Adjust based on I/E (Introversion/Extraversion)
  if (firstLetter === 'I') {
    videoQueries = ['solo creativity projects', 'calming meditation guides', 'deep thinking lectures'];
    websiteQueries = ['self-care tips', 'quiet productivity systems', 'meaningful reading lists'];
  } else if (firstLetter === 'E') {
    videoQueries = ['energetic workout routines', 'social skill tutorials', 'group activity ideas'];
    websiteQueries = ['social event planning', 'communication enhancement', 'team building exercises'];
  }
  
  // Adjust based on J/P (Judging/Perceiving)
  if (lastLetter === 'J') {
    videoQueries[0] = videoQueries[0] + ' structured';
    websiteQueries[0] = websiteQueries[0] + ' organized';
  } else if (lastLetter === 'P') {
    videoQueries[0] = videoQueries[0] + ' flexible';
    websiteQueries[0] = websiteQueries[0] + ' adaptable';
  }
  
  return { videoQueries, websiteQueries };
};

/**
 * Generate personalized meditation guidance based on MBTI type and focus
 */
export const generateMeditationGuidance = async (
  mbtiType: string,
  focus: string,
  duration: number
): Promise<string> => {
  try {
    // Create tailored meditation style based on MBTI type
    const meditationApproach = getMeditationApproachForMBTI(mbtiType);
    
    const prompt = `
      Create an immersive guided meditation script for a ${duration}-minute session.
      
      MEDITATION FOCUS: ${focus}
      
      PERSONALITY STYLE: ${meditationApproach}
      
      STRUCTURE:
      1. Opening (30 seconds): Gentle welcome and settling in with initial breathing guidance
      2. Body (${duration-1} minutes): Main guidance focused on "${focus}" with regular breathing cues
      3. Closing (30 seconds): Gentle return to awareness and completion
      
      IMPORTANT FORMATTING REQUIREMENTS:
      - Include explicit breathing instructions throughout ("Breathe in deeply...", "Exhale slowly...")
      - Add natural pauses using [pause] markers after significant moments 
      - Keep sentences short and conversational - as if speaking directly to the listener
      - Space out instructions to allow for reflection time
      - For a ${duration}-minute meditation, include approximately ${Math.ceil(duration/2)} breathing cycles
      
      TONE:
      - Warm, calming, and present-moment focused
      - Use second-person perspective ("you") to create connection
      - Speak as if guiding the listener in real-time
      
      Create a meditation that feels deeply personalized and flows naturally with proper pacing for a guided experience.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert meditation guide who creates personalized, immersive meditation scripts with natural pacing.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,  // Slightly increased for more natural language variation
      max_tokens: Math.min(2000, 250 * Math.ceil(duration/5)),  // Scale token limit with duration
    });

    const meditationGuide = completion.choices[0].message?.content || getDefaultMeditationGuidance();
    
    // Post-process to ensure proper formatting
    return enhanceMeditationScript(meditationGuide);
  } catch (error) {
    console.error("Error generating meditation guidance:", error);
    return getDefaultMeditationGuidance();
  }
};

/**
 * Get meditation approach tailored to MBTI type
 */
const getMeditationApproachForMBTI = (mbtiType: string): string => {
  const approaches: Record<string, string> = {
    // Analysts (NT)
    'INTJ': 'Analytical and strategic. Focus on clarity and insight. Prefers logical frameworks over emotional language. Responds well to purpose-driven meditation with clear benefits.',
    'INTP': 'Conceptual and curious. Enjoys exploring ideas and patterns. Appreciates intellectual frameworks. Use metaphors and mental models to engage their thinking process.',
    'ENTJ': 'Goal-oriented and structured. Values efficiency and clear outcomes. Respond well to meditation that emphasizes practical benefits and measurable progress.',
    'ENTP': 'Innovative and adaptable. Enjoys conceptual exploration and possibilities. Use creative visualization and varied approaches to maintain engagement.',
    
    // Diplomats (NF)
    'INFJ': 'Insightful and compassionate. Deeply values meaning and personal growth. Responds well to meditation that connects to deeper purpose and spiritual themes.',
    'INFP': 'Idealistic and empathetic. Values authenticity and personal alignment. Appreciate imaginative guidance that honors individual experience and inner feelings.',
    'ENFJ': 'Empathetic and growth-oriented. Values harmony and connection. Responds well to warm, supportive language that emphasizes positive impact.',
    'ENFP': 'Enthusiastic and people-centered. Values authentic expression and possibilities. Enjoys creative and inspiring guidance with room for personal interpretation.',
    
    // Sentinels (SJ)
    'ISTJ': 'Practical and detail-oriented. Values consistency and reliability. Prefers straightforward, structured meditation with clear steps and minimal abstractions.',
    'ISFJ': 'Supportive and detail-conscious. Values harmony and security. Responds well to gentle, nurturing guidance with predictable patterns.',
    'ESTJ': 'Organized and practical. Values clarity and efficiency. Prefers no-nonsense approach with clear benefits and structured progression.',
    'ESFJ': 'Supportive and harmony-seeking. Values connection and belonging. Responds well to warm, affirming language that emphasizes care and togetherness.',
    
    // Explorers (SP)
    'ISTP': 'Pragmatic and adaptable. Values efficiency and immediate utility. Prefers concise, practical guidance without unnecessary embellishment.',
    'ISFP': 'Gentle and experience-focused. Values personal authenticity and sensory experience. Responds well to guidance that honors individuality and present moment.',
    'ESTP': 'Action-oriented and present-focused. Values immediate experience and practicality. Prefers dynamic meditation with physical awareness components.',
    'ESFP': 'Enthusiastic and people-oriented. Values enjoyment and shared experience. Responds well to upbeat, sensory-rich guidance that feels engaging.'
  };
  
  return approaches[mbtiType] || 'Balanced approach with equal emphasis on logic and emotion. Provide clear guidance while honoring personal experience. Include both practical benefits and emotional aspects.';
};

/**
 * Default meditation guidance as fallback
 */
const getDefaultMeditationGuidance = (): string => {
  return `
    Take a moment to settle into a comfortable position. [pause]
    
    Begin by taking a deep breath in through your nose. [pause]
    
    And exhale slowly through your mouth, releasing any tension. [pause]
    
    Continue breathing naturally, allowing each breath to bring you deeper into this moment. [pause]
    
    Notice the sensations in your body as you breathe. [pause]
    
    With each inhale, feel a sense of renewal. [pause]
    
    With each exhale, let go of what you don't need. [pause]
    
    Allow your thoughts to come and go, without judgment. [pause]
    
    When your mind wanders, gently return your focus to your breath. [pause]
    
    Take another deep breath in. [pause]
    
    And release, feeling yourself becoming more present. [pause]
    
    Continue at your own pace, simply being in this moment. [pause]
    
    When you're ready, bring your awareness back to your surroundings.
  `;
};

/**
 * Enhance meditation script with proper formatting and pacing
 */
const enhanceMeditationScript = (script: string): string => {
  let enhanced = script;
  
  // Ensure proper pause markers if they're missing
  if (!enhanced.includes('[pause]')) {
    enhanced = enhanced.replace(/\.\s+(?=[A-Z])/g, '. [pause]\n\n');
  }
  
  // Ensure breathing cues if they're missing
  if (!enhanced.toLowerCase().includes('breath')) {
    const breathingCues = [
      "\n\nTake a deep breath in... [pause]",
      "\n\nExhale slowly, letting go of any tension... [pause]",
      "\n\nBreathe in deeply through your nose... [pause]",
      "\n\nAnd breathe out through your mouth... [pause]"
    ];
    
    // Add breathing cues approximately every 5 sentences
    const sentences = enhanced.split(/[.!?]\s+/);
    let resultWithBreathing = '';
    
    sentences.forEach((sentence, i) => {
      resultWithBreathing += sentence.trim() + '. ';
      if (i > 0 && i % 5 === 0) {
        resultWithBreathing += breathingCues[i % breathingCues.length];
      }
    });
    
    enhanced = resultWithBreathing;
  }
  
  // Normalize whitespace and line breaks for better display
  enhanced = enhanced
    .replace(/\[pause\]/g, ' [pause]')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return enhanced;
};
