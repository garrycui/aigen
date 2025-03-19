import { processTherapyMessage as processMessageFromOpenAI } from '../common/openai';
import { db } from '../common/firebase';
import { 
  collection, addDoc, getDocs, 
  query, orderBy, serverTimestamp, Timestamp, where, limit 
} from 'firebase/firestore';
// Add imports from cache service
import {
  getUserSubcollection, 
  getUserSubcollectionDoc,
  updateUserSubcollectionDoc,
  userCache
} from '../common/cache';

// Message interface definition
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  tags?: string[];
  isTyping?: boolean; // Flag for typing animation
  displayedContent?: string; // Partial content during typing
}

// Constants for typing animation
export const TYPING_SPEED_MS = 15; // Speed of typing animation (ms per character)
export const TYPING_DELAY_MS = 800; // Initial delay before typing starts

// Therapy style options
export const THERAPY_STYLES = [
  'Professional Therapist',
  'Empathetic Friend',
  'Problem-Solver',
  'Philosophical Guide',
  'Warm & Supportive Clinician',
  'Tough Coach',
  'Mindfulness Guru'
];

// Therapy modality options
export const THERAPY_MODALITIES = [
  'CBT',
  'Humanistic',
  'Psychodynamic',
  'Solution-Focused',
  'Mindfulness-Based',
  'Gestalt',
  'Integrative'
];

// Communication tone options
export const COMMUNICATION_TONES = [
  'Direct & Straightforward',
  'Warm & Nurturing',
  'Balanced & Adaptable',
  'Casual & Friendly',
  'Empowering & Motivational'
];

/**
 * Get default preferences based on MBTI type
 */
export const getDefaultPreferencesForMBTI = (mbtiType: string): {
  therapyStyle: string;
  therapyModality: string;
  communicationTone: string;
} => {
  const defaults: { [key: string]: {
    therapyStyle: string;
    therapyModality: string;
    communicationTone: string;
  }} = {
    'ISTJ': {
      therapyStyle: 'Professional Therapist',
      therapyModality: 'CBT',
      communicationTone: 'Direct & Straightforward'
    },
    'ISFJ': {
      therapyStyle: 'Warm & Supportive Clinician',
      therapyModality: 'Humanistic',
      communicationTone: 'Warm & Nurturing'
    },
    'INFJ': {
      therapyStyle: 'Philosophical Guide',
      therapyModality: 'Psychodynamic',
      communicationTone: 'Warm & Nurturing'
    },
    'INTJ': {
      therapyStyle: 'Professional Therapist',
      therapyModality: 'CBT',
      communicationTone: 'Direct & Straightforward'
    },
    'ISTP': {
      therapyStyle: 'Problem-Solver',
      therapyModality: 'Solution-Focused',
      communicationTone: 'Direct & Straightforward'
    },
    'ISFP': {
      therapyStyle: 'Empathetic Friend',
      therapyModality: 'Humanistic',
      communicationTone: 'Warm & Nurturing'
    },
    'INFP': {
      therapyStyle: 'Philosophical Guide',
      therapyModality: 'Humanistic',
      communicationTone: 'Warm & Nurturing'
    },
    'INTP': {
      therapyStyle: 'Professional Therapist',
      therapyModality: 'CBT',
      communicationTone: 'Balanced & Adaptable'
    },
    'ESTP': {
      therapyStyle: 'Tough Coach',
      therapyModality: 'Solution-Focused',
      communicationTone: 'Direct & Straightforward'
    },
    'ESFP': {
      therapyStyle: 'Empathetic Friend',
      therapyModality: 'Humanistic',
      communicationTone: 'Casual & Friendly'
    },
    'ENFP': {
      therapyStyle: 'Empathetic Friend',
      therapyModality: 'Humanistic',
      communicationTone: 'Empowering & Motivational'
    },
    'ENTP': {
      therapyStyle: 'Problem-Solver',
      therapyModality: 'CBT',
      communicationTone: 'Direct & Straightforward'
    },
    'ESTJ': {
      therapyStyle: 'Professional Therapist',
      therapyModality: 'CBT',
      communicationTone: 'Direct & Straightforward'
    },
    'ESFJ': {
      therapyStyle: 'Empathetic Friend',
      therapyModality: 'Humanistic',
      communicationTone: 'Warm & Nurturing'
    },
    'ENFJ': {
      therapyStyle: 'Philosophical Guide',
      therapyModality: 'Humanistic',
      communicationTone: 'Empowering & Motivational'
    },
    'ENTJ': {
      therapyStyle: 'Professional Therapist',
      therapyModality: 'Solution-Focused',
      communicationTone: 'Direct & Straightforward'
    },
    'default': {
      therapyStyle: 'Balanced Therapist',
      therapyModality: 'Integrative',
      communicationTone: 'Balanced & Adaptable'
    }
  };
  
  return defaults[mbtiType] || defaults.default;
};

/**
 * Get personalized welcome message based on MBTI
 */
export const getPersonalizedWelcome = (mbtiType: string): string => {
  const welcomeMessages: { [key: string]: string } = {
    'INTJ': "Welcome. I understand you prefer deep, analytical conversations. Let's explore your thoughts systematically and find practical solutions together. How are you feeling today?",
    'INTP': "Hi there. I appreciate your logical approach to understanding emotions. We can examine your experiences from multiple perspectives. What's on your mind today?",
    'ENTJ': "Hello! I know you value efficiency and clear progress. Let's work together to identify and achieve your mental wellness goals. What would you like to focus on today?",
    'ENTP': "Welcome! I'm excited to explore different possibilities with you and find creative ways to enhance your mental well-being. What brings you here today?",
    'INFJ': "Hello. I understand you value deep, meaningful conversations about what truly matters. I'm here to help you explore your inner world. How are you feeling right now?",
    'INFP': "Welcome to our safe space. I honor your unique perspective and emotional depth. Let's explore what's meaningful to you at your own pace. How are you feeling today?",
    'ENFJ': "Hello! I appreciate your desire for growth and connection. We can work together to nurture both your relationships and your personal journey. What would you like to discuss?",
    'ENFP': "Welcome! I'm excited to join you on this journey of exploration and growth. Let's discover new possibilities together. What's on your mind today?",
    'ISTJ': "Hello. I'll provide practical, structured support as we work through your concerns methodically. What specific issues would you like to address today?",
    'ISFJ': "Welcome to our conversation. I appreciate your thoughtfulness and care for others. Let's create a supportive space for you too. How are you feeling?",
    'ESTJ': "Hello! I'll be direct and practical in helping you address your concerns efficiently. What specific goals would you like to work on today?",
    'ESFJ': "Welcome! I appreciate your care for relationships and harmony. This is a space where your needs matter too. What would you like to talk about today?",
    'ISTP': "Hi there. I'll respect your independence and focus on practical solutions. What specific situation would you like to work through today?",
    'ISFP': "Welcome to our conversation. This is a space where you can express yourself freely, without judgment. What feelings or experiences would you like to explore?",
    'ESTP': "Hi! Let's get right to it and focus on practical solutions that work for you right now. What's the most pressing issue you'd like to address?",
    'ESFP': "Welcome! I'm looking forward to our engaging conversation. This is a space where you can be yourself and explore what matters to you. How are you feeling today?",
    'default': "Hello! I'm here to listen and support you on your journey to better mental well-being. Your privacy is important to me, and I'm here to provide a safe space for our conversation. How are you feeling today?"
  };

  return welcomeMessages[mbtiType] || welcomeMessages.default;
};

/**
 * Generate AI therapy response based on MBTI type and therapy preferences
 */
export const generateTherapyResponse = async (
  message: string,
  chatHistory: any[] = [],
  mbtiType?: string | null,
  therapyStyle?: string | null,
  therapyModality?: string | null,
  communicationTone?: string | null
) => {
  return processMessageFromOpenAI(
    message,
    chatHistory,
    mbtiType,
    therapyStyle,
    therapyModality,
    communicationTone
  );
};

/**
 * Process therapy chat message and generate a response
 */
export const processTherapyMessage = async (
  message: string,
  chatHistory: any[] = [],
  mbtiType?: string | null,
  therapyStyle?: string | null,
  therapyModality?: string | null,
  communicationTone?: string | null,
  sessionStage?: string | null
) => {
  try {
    // Count how many exchanges have happened so far
    const messageCount = chatHistory.filter(msg => msg.role === 'user').length;
    
    // Determine the appropriate conversation stage
    let stage = sessionStage || 'initial';
    
    if (!sessionStage) {
      if (messageCount <= 2) {
        stage = 'initial';
      } else if (messageCount <= 6) {
        stage = 'information_gathering';
      } else if (messageCount <= 10) {
        stage = 'insight_providing';
      } else {
        stage = 'action_planning';
      }
    }
    
    // Create stage-specific instructions for the AI
    let stageInstructions = '';
    
    switch (stage) {
      case 'initial':
        stageInstructions = `
          You're at the beginning of a therapy conversation. 
          Focus on building rapport and understanding the user's immediate concerns.
          Keep your responses short (2-3 sentences maximum) and ask 1-2 specific follow-up questions.
          Be warm and inviting while gathering initial information about what brought them here today.
        `;
        break;
        
      case 'information_gathering':
        stageInstructions = `
          You're in the information gathering stage of therapy.
          Focus on asking thoughtful, targeted questions to better understand the user's situation.
          Reflect back what you've heard to show understanding, but keep your responses concise.
          Ask specific questions about thoughts, feelings, behaviors, and patterns related to their concerns.
        `;
        break;
        
      case 'insight_providing':
        stageInstructions = `
          Based on the information gathered so far, begin offering gentle insights and perspectives.
          Connect different aspects of what the user has shared to help them see patterns.
          Balance validation with gentle challenges to their thinking when appropriate.
          Continue asking questions but shift toward helping them develop new perspectives.
        `;
        break;
        
      case 'action_planning':
        stageInstructions = `
          Help the user develop small, concrete action steps based on your conversation.
          Focus on practical, achievable changes they might consider.
          Summarize key insights from your conversation and how they relate to possible actions.
          Empower them to choose what feels right rather than prescribing solutions.
        `;
        break;
    }
    
    // Add to the API request
    const enhancedPrompt = `
      ${stageInstructions}
      
      Remember:
      1. Keep your responses brief and conversational (no more than 3 short paragraphs)
      2. Be focused and direct rather than verbose
      3. Ask at most 1-2 thoughtful follow-up questions
      4. Avoid summarizing too much of what the user has already said
      5. Make your responses feel like a real conversation, not a written essay
    `;
    
    // Pass the enhanced instructions to the OpenAI processing function
    const result = await processMessageFromOpenAI(
      message,
      chatHistory,
      mbtiType,
      therapyStyle,
      therapyModality,
      communicationTone,
      enhancedPrompt
    );
    
    return {
      ...result,
      sessionStage: stage
    };
  } catch (error) {
    console.error('Error in enhanced therapy message processing:', error);
    throw error;
  }
};

/**
 * Therapy chat session interface
 */
export interface TherapySession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'archived';
  summary?: string;
  insightsGained?: string[];
  topicsTags?: string[];
  sessionStage?: 'initial' | 'information_gathering' | 'insight_providing' | 'action_planning';
}

/**
 * Create a new therapy chat session
 */
export const createTherapySession = async (userId: string, mbtiType?: string | null): Promise<TherapySession> => {
  try {
    // Create session data object
    const sessionData = {
      title: `Companion Session - ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      mbtiType: mbtiType || null,
      sessionStage: 'initial'
    };
    
    // Create the session document using Firestore
    const sessionsRef = collection(db, 'users', userId, 'therapy_sessions');
    const sessionDoc = await addDoc(sessionsRef, {
      ...sessionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Invalidate the sessions cache
    userCache.delete(`user-${userId}-therapy_sessions-list`);
    
    // Return the session
    return {
      id: sessionDoc.id,
      ...sessionData
    } as TherapySession;
  } catch (error) {
    console.error('Error creating Companion Session:', error);
    throw error;
  }
};

/**
 * Get all Companion Sessions for a user
 */
// Interface for raw therapy session data from Firestore
interface RawTherapySession {
  id: string;
  title: string;
  createdAt: Date | any;
  updatedAt: Date | any;
  status?: 'active' | 'completed' | 'archived';
  summary?: string;
  insightsGained?: string[];
  topicsTags?: string[];
  sessionStage?: string;
}

export const getTherapySessions = async (userId: string): Promise<TherapySession[]> => {
  try {
    // Use cache service to get sessions
    const sessions = await getUserSubcollection(userId, 'therapy_sessions', [orderBy('updatedAt', 'desc')]);
    
    // Transform data to ensure proper types
    return sessions.map((session: RawTherapySession) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt),
      updatedAt: session.updatedAt instanceof Date ? session.updatedAt : new Date(session.updatedAt),
      status: session.status || 'active',
      summary: session.summary,
      insightsGained: session.insightsGained,
      topicsTags: session.topicsTags,
      sessionStage: session.sessionStage || 'initial'
    }));
  } catch (error) {
    console.error('Error getting Companion Sessions:', error);
    
    // Fallback to direct Firestore query if cache fails
    try {
      const sessionsRef = collection(db, 'users', userId, 'therapy_sessions');
      const q = query(sessionsRef, orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          status: data.status || 'active',
          summary: data.summary,
          insightsGained: data.insightsGained,
          topicsTags: data.topicsTags,
          sessionStage: data.sessionStage || 'initial'
        };
      });
    } catch (fallbackError) {
      console.error('Fallback retrieval also failed:', fallbackError);
      return [];
    }
  }
};

/**
 * Get a specific Companion Session
 */
export const getTherapySession = async (userId: string, sessionId: string): Promise<TherapySession | null> => {
  try {
    // Use cache service to get specific session
    const session = await getUserSubcollectionDoc(userId, 'therapy_sessions', sessionId);
    
    if (!session || !session.title) {
      return null;
    }
    
    return {
      id: sessionId,
      title: session.title,
      createdAt: session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt),
      updatedAt: session.updatedAt instanceof Date ? session.updatedAt : new Date(session.updatedAt),
      status: session.status || 'active',
      summary: session.summary,
      insightsGained: session.insightsGained,
      topicsTags: session.topicsTags,
      sessionStage: session.sessionStage || 'initial'
    };
  } catch (error) {
    console.error('Error getting Companion Session:', error);
    throw error;
  }
};

/**
 * Get the latest active Companion Session or create a new one
 */
export const getOrCreateActiveSession = async (userId: string, mbtiType?: string | null): Promise<TherapySession> => {
  try {
    // Use cache service with custom query constraints
    const activeSessions = await getUserSubcollection(userId, 'therapy_sessions', [
      where('status', '==', 'active'),
      orderBy('updatedAt', 'desc'),
      limit(1)
    ]);
    
    if (activeSessions && activeSessions.length > 0) {
      const session = activeSessions[0];
      return {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt),
        updatedAt: session.updatedAt instanceof Date ? session.updatedAt : new Date(session.updatedAt),
        status: session.status || 'active',
        summary: session.summary,
        insightsGained: session.insightsGained,
        topicsTags: session.topicsTags,
        sessionStage: session.sessionStage || 'initial'
      };
    }
    
    // No active session found, create a new one
    return createTherapySession(userId, mbtiType);
  } catch (error) {
    console.error('Error getting or creating active Companion Session:', error);
    throw error;
  }
};

/**
 * Add a message to a Companion Session
 */
export const addTherapyMessage = async (
  userId: string, 
  sessionId: string, 
  message: Message
): Promise<Message> => {
  try {
    // Direct Firestore operation to add the message (messages are high-volume, so using Firestore directly)
    const messagesRef = collection(db, 'users', userId, 'therapy_sessions', sessionId, 'messages');
    
    const messageData = {
      content: message.content,
      role: message.role,
      timestamp: serverTimestamp(),
      tags: message.tags || []
    };
    
    const messageDoc = await addDoc(messagesRef, messageData);
    
    // Update the session's updatedAt field using cache service
    await updateUserSubcollectionDoc(userId, 'therapy_sessions', sessionId, {
      updatedAt: new Date()
    });
    
    // Invalidate messages cache if we've implemented it
    userCache.delete(`user-${userId}-therapy_sessions-${sessionId}-messages-list`);
    
    // Return the added message with its ID
    return {
      ...message,
      id: messageDoc.id
    };
  } catch (error) {
    console.error('Error adding therapy message:', error);
    throw error;
  }
};

/**
 * Get messages for a Companion Session
 */
export const getTherapyMessages = async (userId: string, sessionId: string): Promise<Message[]> => {
  try {
    // Define a cache key for messages
    const cacheKey = `user-${userId}-therapy_sessions-${sessionId}-messages-list`;
    
    // Try to get from cache first
    const cachedMessages = userCache.get(cacheKey);
    if (cachedMessages) {
      return cachedMessages;
    }
    
    // Fallback to Firestore
    const messagesRef = collection(db, 'users', userId, 'therapy_sessions', sessionId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const querySnapshot = await getDocs(q);
    
    const messages = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        content: data.content,
        role: data.role,
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
        tags: data.tags || []
      };
    });
    
    // Cache the result with a short TTL (messages change frequently)
    userCache.set(cacheKey, messages, 60000); // 1 minute cache
    
    return messages;
  } catch (error) {
    console.error('Error getting therapy messages:', error);
    throw error;
  }
};

/**
 * Update a Companion Session with new metadata
 */
export const updateTherapySession = async (
  userId: string,
  sessionId: string,
  updates: Partial<TherapySession>
): Promise<void> => {
  try {
    // Don't allow updating the ID
    const { id, ...updateData } = updates;
    
    // Use cache service for update
    await updateUserSubcollectionDoc(userId, 'therapy_sessions', sessionId, {
      ...updateData,
      updatedAt: new Date()
    });
    
    // Clear related caches
    userCache.delete(`user-${userId}-therapy_sessions-${sessionId}`);
    userCache.delete(`user-${userId}-therapy_sessions-list`);
  } catch (error) {
    console.error('Error updating Companion Session:', error);
    throw error;
  }
};

/**
 * Generate session summary based on messages
 */
export const generateSessionSummary = async (
  userId: string,
  sessionId: string
): Promise<{ summary: string; insights: string[]; tags: string[] }> => {
  try {
    // Get all messages from the session
    const messages = await getTherapyMessages(userId, sessionId);
    
    // Process with OpenAI to generate a summary
    const chatHistory = messages.map(msg => ({
      content: msg.content,
      role: msg.role
    }));
    
    // Create a summary using OpenAI
    const result = await processMessageFromOpenAI(
      "Please create a brief summary of our conversation, 2-3 key insights gained, and suggest 3-5 topic tags that represent the main themes discussed.",
      chatHistory,
      null,
      "Professional Therapist",
      "Integrative",
      "Direct & Straightforward"
    );
    
    // Parse the response - this is a simple approach and might need refinement
    const summary = result.response.split("Insights:")[0]?.trim() || result.response;
    
    // Extract insights (could be improved with more structured responses)
    const insightsText = result.response.split("Insights:")[1]?.split("Tags:")[0] || "";
    const insights = insightsText
      .split(/\d+\./)
      .map(insight => insight.trim())
      .filter(insight => insight.length > 0);
    
    // Extract tags (could be improved with more structured responses)
    const tagsText = result.response.split("Tags:")[1] || "";
    const tags = tagsText
      .split(/[,\n]/)
      .map(tag => tag.trim().replace(/^[#-]/, ''))
      .filter(tag => tag.length > 0);
    
    // Update the session with the summary
    await updateTherapySession(userId, sessionId, {
      summary,
      insightsGained: insights,
      topicsTags: tags
    });
    
    return { summary, insights, tags };
  } catch (error) {
    console.error('Error generating session summary:', error);
    throw error;
  }
};
