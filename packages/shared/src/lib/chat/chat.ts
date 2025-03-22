import vader from 'vader-sentiment';
import Fuse from 'fuse.js';
import { 
  collection, doc, getDoc, setDoc, updateDoc, arrayUnion, 
  getDocs, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../common/firebase';
import { getLatestAssessment } from '../assessment/assessment';
import { generateChatResponse, extractKeyword} from '../common/openai';
import { 
  tutorialCache, 
  postCache, 
  sessionCache,
  responseCache
} from '../common/cache';
import {
  ChatMessage,
  ChatSession,
  ChatSessionsDoc,
  MAX_ACTIVE_SESSIONS,
  updateLastActiveTime,
  getUserSessions,
  initializeSessionsDoc,
  checkIfStaleChat,
  formatSessionDate,
  getSentimentClass,
  getPaginatedSessionMessages,
  compactSessionData,
  archiveOldSessions,
  getSessionMetadata
} from './sessionManager';

// Re-export session manager functions for backward compatibility
export {
  getUserSessions,
  getPaginatedSessionMessages,
  checkIfStaleChat,
  formatSessionDate,
  getSentimentClass,
  updateLastActiveTime,
  compactSessionData,
  archiveOldSessions,
  getSessionMetadata
};

/**
 * Initialize chat history for a user in Firestore.
 */
const initializeChatDoc = async (userId: string) => {
  const chatRef = doc(db, 'chatHistory', userId);
  const chatDoc = await getDoc(chatRef);

  if (!chatDoc.exists()) {
    await setDoc(chatRef, {
      userId,
      messages: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  return chatRef;
};

/**
 * Analyze sentiment of a message using vader-sentiment.
 */
const analyzeSentiment = (message: string): 'positive' | 'negative' | 'neutral' => {
  if (!message) return 'neutral';
  
  const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(message);
  if (!intensity) return 'neutral';
  
  if (intensity.compound >= 0.05) return 'positive';
  if (intensity.compound <= -0.05) return 'negative';
  return 'neutral';
};

/**
 * Save chat messages to Firestore.
 */
export const saveChatMessage = async (userId: string, message: string, role: 'user' | 'assistant') => {
  if (!userId || !message || !role) throw new Error('Missing required fields for chat message');
  const chatRef = await initializeChatDoc(userId);

  const messageData: ChatMessage = {
    content: message,
    role,
    timestamp: new Date().toISOString()
  };

  if (role === 'user') {
    messageData.sentiment = analyzeSentiment(message);
  }

  await updateDoc(chatRef, {
    messages: arrayUnion(messageData),
    updatedAt: serverTimestamp()
  });

  return { sentiment: messageData.sentiment };
};

/**
 * Retrieve paginated chat history from Firestore.
 */
export const getChatHistory = async (
  userId: string, 
): Promise<ChatMessage[]> => {
  // Ensure user has session structure
  await migrateToSessions(userId);
  
  // Get the current session
  const { currentSessionId } = await getUserSessions(userId);
  
  if (!currentSessionId) {
    return [];
  }
  
  // Get the messages for the current session
  return getSessionMessages(userId, currentSessionId);
};

/**
 * Fetch cached tutorials and posts from Firestore with Fuse.js search.
 */
// Fix the function to properly use cache and handle errors
async function fetchCombinedContent(searchPhrase: string): Promise<Array<{ 
  id: string; 
  title: string; 
  content: string;
  type: 'post' | 'tutorial';
}>> {
  // Create unique cache keys for posts and tutorials collection
  const postsCacheKey = 'combined-content-posts';
  const tutorialsCacheKey = 'combined-content-tutorials';
  
  try {
    // Get posts from cache or fetch them
    const cachedPosts = await postCache.getOrSet(postsCacheKey, async () => {
      try {
        const postsRef = collection(db, 'posts');
        const postsSnap = await getDocs(postsRef);
        return postsSnap.docs.map(doc => ({
          id: doc.id,
          title: (doc.data().title || '').toString(),
          content: (doc.data().content || '').toString(),
          type: 'post' as const
        }));
      } catch (error) {
        console.error('Error fetching posts for search:', error);
        return [];
      }
    }, 24 * 60 * 60 * 1000); // 24 hour TTL for this specific cache
    
    // Get tutorials from cache or fetch them
    const cachedTutorials = await tutorialCache.getOrSet(tutorialsCacheKey, async () => {
      try {
        const tutorialsRef = collection(db, 'tutorials');
        const tutorialsSnap = await getDocs(tutorialsRef);
        return tutorialsSnap.docs.map(doc => ({
          id: doc.id,
          title: (doc.data().title || '').toString(),
          content: (doc.data().content || '').toString(),
          type: 'tutorial' as const
        }));
      } catch (error) {
        console.error('Error fetching tutorials for search:', error);
        return [];
      }
    }, 24 * 60 * 60 * 1000); // 24 hour TTL for this specific cache
    
    // Only create Fuse instance if we have data
    if (searchPhrase && (cachedPosts.length > 0 || cachedTutorials.length > 0)) {
      const fuse = new Fuse(
        [...cachedPosts, ...cachedTutorials], 
        {
          keys: ['title', 'content'],
          threshold: 0.5,
          ignoreLocation: true
        }
      );
      
      return fuse.search(searchPhrase).map(result => result.item);
    }
    
    return [...cachedPosts, ...cachedTutorials];
  } catch (error) {
    console.error('Error in fetchCombinedContent:', error);
    return [];
  }
}

/**
 * Determine if a message has a learning intent or could benefit from resources.
 */
const determineLearningIntent = async (message: string): Promise<"learning" | "other"> => {
  const lower = message.toLowerCase();
  
  // Use a Set for faster lookups
  const learningKeywords = new Set([
    'tutorial', 'guide', 'learn', 'explain', 'how to', 'show me',
    'understand', 'resource', 'teach', 'help me with', 'example',
    'struggle with', 'difficulty', 'confused about', 'more information',
    'guidance', 'advice', 'best practice', 'recommend', 'suggestion'
  ]);
  
  // Check for keywords more efficiently
  const messageHasIntent = [...learningKeywords].some(keyword => lower.includes(keyword));
  
  // Only check context if needed
  if (messageHasIntent) return "learning";
  
  // Check context clues
  const contextClues = ['improve', 'better', 'want to', 'help me', 'not sure how'];
  const contextHasLearningClues = contextClues.some(clue => lower.includes(clue));
  
  return contextHasLearningClues ? "learning" : "other";
};

/**
 * Process a chat message.
 */
export const processChatMessage = async (userId: string, message: string) => {
  // Just call processChatWithSession directly with auto-resolved sessionId
  await migrateToSessions(userId);
  const sessionId = await getOrCreateSession(userId);
  return processChatWithSession(userId, sessionId, message);
};

// New interfaces for session management

// Constants for session management

/**
 * Get or create a session
 */
export const getOrCreateSession = async (userId: string): Promise<string> => {
  if (!userId) throw new Error('User ID is required');
  
  // First, check if sessions doc exists
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) {
    // Initialize and return a new session ID
    return initializeSessionsDoc(userId);
  }
  
  // Get the data
  const data = sessionsDoc.data() as ChatSessionsDoc;
  
  // Check if there's an active current session
  if (data.currentSessionId) {
    const currentSession = data.activeSessions.find(s => s.id === data.currentSessionId);
    if (currentSession) {
      return data.currentSessionId;
    }
  }
  
  // If we don't have a valid current session, create a new one
  const sessionId = `session_${Date.now()}`;
  const newSession: ChatSession = {
    id: sessionId,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    messages: []
  };
  
  const activeSessions = [newSession, ...(data.activeSessions || [])];
  
  await updateDoc(sessionsRef, {
    activeSessions,
    currentSessionId: sessionId,
    updatedAt: serverTimestamp()
  });
  
  return sessionId;
};

/**
 * Set the current active session
 */
export const setCurrentSession = async (userId: string, sessionId: string): Promise<void> => {
  if (!userId || !sessionId) throw new Error('User ID and session ID are required');
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  await updateDoc(sessionsRef, {
    currentSessionId: sessionId,
    updatedAt: serverTimestamp()
  });
  
  // Update last active time
  updateLastActiveTime(sessionId);
  
  // Invalidate cache
  sessionCache.delete(`user-sessions-${userId}`);
};

/**
 * Create a new session and set it as current
 */
export const createNewSession = async (userId: string): Promise<string> => {
  if (!userId) throw new Error('User ID is required');
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) {
    return initializeSessionsDoc(userId);
  }
  
  const data = sessionsDoc.data() as ChatSessionsDoc;
  const sessionId = `session_${Date.now()}`;
  const newSession: ChatSession = {
    id: sessionId,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    messages: []
  };
  
  // Add new session to beginning of active sessions
  let activeSessions = [newSession, ...(data.activeSessions || [])];
  
  // Manage active session limit
  if (activeSessions.length > MAX_ACTIVE_SESSIONS) {
    // Move oldest sessions to archived
    const sessionsToArchive = activeSessions.splice(MAX_ACTIVE_SESSIONS);
    const updatedArchived = [...sessionsToArchive, ...(data.archivedSessions || [])];
    
    await updateDoc(sessionsRef, {
      activeSessions,
      archivedSessions: updatedArchived,
      currentSessionId: sessionId,
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(sessionsRef, {
      activeSessions,
      currentSessionId: sessionId,
      updatedAt: serverTimestamp()
    });
  }
  
  // Invalidate the session cache
  sessionCache.delete(`user-sessions-${userId}`);
  
  return sessionId;
};

/**
 * Add message to a specific session with batch operations
 */
export const addMessageToSession = async (
  userId: string,
  sessionId: string,
  message: string,
  role: 'user' | 'assistant'
): Promise<{ sentiment?: 'positive' | 'negative' | 'neutral' }> => {
  // Validation
  if (!userId || !sessionId || !message || !role) {
    throw new Error('Missing required fields for adding message');
  }
  
  // Use single transaction for better performance
  const messageData: ChatMessage = {
    content: message,
    role,
    timestamp: new Date().toISOString()
  };
  
  if (role === 'user') {
    messageData.sentiment = analyzeSentiment(message);
  }
  
  // Call optimized function
  await updateSessionWithMessage(userId, sessionId, messageData);
  
  return { sentiment: role === 'user' ? messageData.sentiment : undefined };
};

/**
 * Delete a session with batch operations
 */
export const deleteSession = async (userId: string, sessionId: string): Promise<void> => {
  if (!userId || !sessionId) throw new Error('User ID and session ID are required');
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) return;
  
  const data = sessionsDoc.data() as ChatSessionsDoc;
  
  // Filter out the session to delete
  const activeSessions = data.activeSessions.filter(s => s.id !== sessionId);
  const archivedSessions = data.archivedSessions.filter(s => s.id !== sessionId);
  
  // If deleting the current session, set a new current session
  let currentSessionId = data.currentSessionId;
  if (currentSessionId === sessionId) {
    currentSessionId = activeSessions.length > 0 ? activeSessions[0].id : '';
  }
  
  // Use batch operations for better performance and consistency
  const batch = writeBatch(db);
  batch.update(sessionsRef, {
    activeSessions,
    archivedSessions,
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  
  // Invalidate cache
  sessionCache.delete(`user-sessions-${userId}`);
}

/**
 * Get messages for a specific session
 */
export const getSessionMessages = async (userId: string, sessionId: string): Promise<ChatMessage[]> => {
  if (!userId || !sessionId) throw new Error('User ID and session ID are required');
  
  const { activeSessions, archivedSessions } = await getUserSessions(userId);
  
  // Look for session in active sessions first
  let session = activeSessions.find(s => s.id === sessionId);
  
  if (!session) {
    // Try archived sessions
    session = archivedSessions.find(s => s.id === sessionId);
  }
  
  return session?.messages || [];
};

/**
 * Cache common AI responses with MBTI-specific variations
 */
const getCachedOrGenerateResponse = async <T extends {response: string}>(
  message: string,
  chatHistory: any[], 
  generateFn: (message: string, chatHistory: any[], type?: string, preference?: string) => Promise<T>,
  mbtiType?: string,
  aiPreference?: string
): Promise<T> => {
  // Create a cache key based on the message and contextual factors
  // We simplify the message by trimming and lowercasing to catch similar questions
  const simplifiedMessage = message.trim().toLowerCase();
  
  // If the message is simple/common, we can use exact key
  if (simplifiedMessage.length < 50) {
    const cacheKey = `${simplifiedMessage}|${mbtiType || 'unknown'}|${aiPreference || 'default'}`;
    
    // Check cache
    const cached = responseCache.get(cacheKey);
    if (cached) {
      console.log('Using cached response for:', simplifiedMessage);
      return { response: cached.response } as T;
    }
    
    // Generate new response
    const response = await generateFn(message, chatHistory, mbtiType, aiPreference);
    
    // Cache the response if it's successful
    if (response && response.response) {
      responseCache.set(cacheKey, {
        response: response.response,
        timestamp: Date.now()
      });
      
      // Cleanup old entries if cache grows too large
      if (responseCache.size > 500) {
        const oldestKeys = responseCache.keys()
          .filter(key => responseCache.get(key))
          .sort((a, b) => {
            const itemA = responseCache.get(a)!;
            const itemB = responseCache.get(b)!;
            return itemA.timestamp - itemB.timestamp;
          })
          .slice(0, 100);
        
        oldestKeys.forEach(key => responseCache.delete(key));
      }
    }
    
    return response;
  }
  
  // For complex messages, just generate without caching
  return generateFn(message, chatHistory, mbtiType, aiPreference);
};

/**
 * Process chat message with sessions - optimized with caching and batch operations
 */
export const processChatWithSession = async (userId: string, sessionId: string, message: string) => {
  try {
    if (!userId || !sessionId || !message || typeof message !== 'string') {
      throw new Error('Invalid input for processing chat message');
    }

    // Fetch user assessment data and messages concurrently for efficiency
    const [assessmentResult, chatHistory] = await Promise.all([
      getLatestAssessment(userId),
      getSessionMessages(userId, sessionId)
    ]);
    
    const mbtiType = assessmentResult.data?.mbti_type;
    const aiPreference = assessmentResult.data?.ai_preference;
    
    // Save user message to session
    const { sentiment } = await addMessageToSession(userId, sessionId, message, 'user');

    // Generate AI response with caching for common questions
    const aiResponse = await getCachedOrGenerateResponse(
      message, 
      chatHistory, 
      generateChatResponse,
      mbtiType, 
      aiPreference
    );
    
    if (!aiResponse || !aiResponse.response) throw new Error('Failed to generate chat response');

    // Save AI response to session
    await addMessageToSession(userId, sessionId, aiResponse.response, 'assistant');
    
    // Update last active time for the session
    updateLastActiveTime(sessionId);

    const firstResponse = {
      response: aiResponse.response,
      sentiment,
      userContext: { mbtiType, aiPreference },
      recommendations: []
    };

    // Check if the user has a learning intent
    const intent = await determineLearningIntent(message);

    if (intent === "learning") {
      // Add recommendations for learning-focused messages
      try {
        const searchPhrase = await extractKeyword(message);
        const contentItems = await fetchCombinedContent(searchPhrase);

        if (contentItems.length) {
          // Limit to 3 recommendations
          const limitedItems = contentItems.slice(0, 3);
          
          const recommendationsText = `Here are some helpful resources:\n` +
            limitedItems.map(item => `• ${item.title}`).join('\n');

          // Save recommendations as a separate assistant message
          await addMessageToSession(userId, sessionId, recommendationsText, 'assistant');

          return [firstResponse, {
            response: recommendationsText,
            sentiment,
            userContext: { mbtiType, aiPreference },
            recommendations: limitedItems
          }];
        }
      } catch (recError) {
        console.error('Error getting recommendations:', recError);
        // Continue without recommendations if there's an error
      }
    }

    return firstResponse;
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
};

/**
 * Migrate user from old chat history to session-based system
 */
export const migrateToSessions = async (userId: string): Promise<void> => {
  if (!userId) return;
  
  try {
    // Check if user already has sessions
    const sessionsRef = doc(db, 'chatSessions', userId);
    const sessionsDoc = await getDoc(sessionsRef);
    
    if (sessionsDoc.exists()) {
      // Already migrated
      return;
    }
    
    // Get old chat history
    const chatRef = doc(db, 'chatHistory', userId);
    const chatDoc = await getDoc(chatRef);
    
    if (!chatDoc.exists() || !chatDoc.data().messages || chatDoc.data().messages.length === 0) {
      // No history to migrate, just initialize session doc
      await initializeSessionsDoc(userId);
      return;
    }
    
    // Create a new session with the old messages
    const sessionId = `session_${Date.now()}`;
    const oldMessages = chatDoc.data().messages || [];
    
    // Create title from first user message
    let title = 'Imported Conversation';
    const firstUserMsg = oldMessages.find((m: ChatMessage) => m.role === 'user');
    if (firstUserMsg) {
      const words = firstUserMsg.content.split(' ');
      title = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
    }
    
    const newSession: ChatSession = {
      id: sessionId,
      title,
      createdAt: new Date(oldMessages[0]?.timestamp || Date.now()).toISOString(),
      lastActiveAt: new Date(oldMessages[oldMessages.length - 1]?.timestamp || Date.now()).toISOString(),
      messages: oldMessages
    };
    
    // Create sessions document with migrated data
    await setDoc(sessionsRef, {
      userId,
      activeSessions: [newSession],
      archivedSessions: [],
      currentSessionId: sessionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error migrating to sessions:', error);
  }
};

/**
 * More efficient clear all chat history with batch operations
 */
export const clearAllChatHistory = async (userId: string): Promise<void> => {
  if (!userId) return;
  
  try {
    const batch = writeBatch(db);
    
    // Delete old chat history
    const chatRef = doc(db, 'chatHistory', userId);
    batch.delete(chatRef);
    
    // Delete sessions
    const sessionsRef = doc(db, 'chatSessions', userId);
    batch.delete(sessionsRef);
    
    // Execute all deletes in one batch
    await batch.commit();
    
    // Clear session cache
    sessionCache.delete(`user-sessions-${userId}`);
    
    // Initialize a fresh sessions document
    await initializeSessionsDoc(userId);
  } catch (error) {
    console.error('Error clearing chat history:', error);
    // Try to initialize a fresh sessions document even after error
    try {
      await initializeSessionsDoc(userId);
    } catch (initError) {
      console.error('Failed to initialize fresh sessions document:', initError);
      throw error;
    }
  }
};

/**
 * Batch process multiple messages at once to reduce Firestore operations
 */
export const addMultipleMessagesToSession = async (
  userId: string,
  sessionId: string,
  messages: Array<{ content: string, role: 'user' | 'assistant' }>
): Promise<void> => {
  if (!userId || !sessionId || !messages.length) return;
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  
  // Get current session first
  const { activeSessions, archivedSessions } = await getUserSessions(userId);
  
  let isActive = false;
  let sessionIndex = activeSessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    // Check archived sessions
    sessionIndex = archivedSessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
      throw new Error('Session not found');
    }
  } else {
    isActive = true;
  }
  
  // Get the session to update
  const session = isActive 
    ? { ...activeSessions[sessionIndex] } 
    : { ...archivedSessions[sessionIndex] };
  
  // Process all messages at once
  const now = new Date().toISOString();
  const messageData = messages.map(msg => ({
    content: msg.content,
    role: msg.role,
    timestamp: now,
    sentiment: msg.role === 'user' ? analyzeSentiment(msg.content) : undefined
  }));
  
  // Update session
  session.messages = [...session.messages, ...messageData];
  session.lastActiveAt = now;
  
  // Update title if needed
  if (session.title === 'New Conversation') {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      const words = firstUserMsg.content.split(' ');
      session.title = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
    }
  }
  
  // Update in Firestore with a single write
  const batch = writeBatch(db);
  
  if (isActive) {
    const updatedSessions = [...activeSessions];
    updatedSessions[sessionIndex] = session;
    
    batch.update(sessionsRef, {
      activeSessions: updatedSessions,
      updatedAt: serverTimestamp()
    });
  } else {
    const updatedSessions = [...archivedSessions];
    updatedSessions[sessionIndex] = session;
    
    batch.update(sessionsRef, {
      archivedSessions: updatedSessions,
      updatedAt: serverTimestamp()
    });
  }
  
  await batch.commit();
  sessionCache.delete(`user-sessions-${userId}`);
};

/**
 * Optimized version of processChatWithSession that reduces Firestore operations
 */
export const processOptimizedChat = async (userId: string, sessionId: string, message: string) => {
  try {
    if (!userId || !sessionId || !message || typeof message !== 'string') {
      throw new Error('Invalid input for processing chat message');
    }

    // Fetch user assessment data and messages concurrently
    const [assessmentResult, chatHistory] = await Promise.all([
      getLatestAssessment(userId),
      getSessionMessages(userId, sessionId)
    ]);
    
    const mbtiType = assessmentResult.data?.mbti_type;
    const aiPreference = assessmentResult.data?.ai_preference;
    
    // Analyze sentiment of user message
    const sentiment = analyzeSentiment(message);
    
    // Save user message to session and wait for AI response
    const userMessage = {
      content: message,
      role: 'user' as const,
      sentiment,
      timestamp: new Date().toISOString()
    };
    
    // Generate AI response with caching
    const aiResponse = await getCachedOrGenerateResponse(
      message,
      [...chatHistory, userMessage], // Include the new message in context
      generateChatResponse,
      mbtiType,
      aiPreference
    );
    
    if (!aiResponse || !aiResponse.response) {
      throw new Error('Failed to generate chat response');
    }
    
    // Create AI response message
    const aiMessage = {
      content: aiResponse.response,
      role: 'assistant' as const,
      timestamp: new Date().toISOString()
    };
    
    // Check for learning intent to see if we need recommendations
    const intent = await determineLearningIntent(message);
    
    let recommendationsMessage = null;
    let recommendationsItems: Array<{
      id: string;
      title: string;
      content: string;
      type: 'post' | 'tutorial';
    }> = [];
    
    if (intent === "learning") {
      try {
        const searchPhrase = await extractKeyword(message);
        const contentItems = await fetchCombinedContent(searchPhrase);
        
        if (contentItems.length) {
          // Limit to 3 recommendations
          recommendationsItems = contentItems.slice(0, 3);
          
          const recommendationsText = `Here are some helpful resources:\n` +
            recommendationsItems.map(item => `• ${item.title}`).join('\n');
            
          recommendationsMessage = {
            content: recommendationsText,
            role: 'assistant' as const,
            timestamp: new Date().toISOString()
          };
        }
      } catch (error) {
        console.error('Error getting recommendations:', error);
      }
    }
    
    // Batch save messages to reduce Firestore operations
    const messagesToAdd = recommendationsMessage 
      ? [userMessage, aiMessage, recommendationsMessage] 
      : [userMessage, aiMessage];
    
    // Use batch processing for saving messages
    await addMultipleMessagesToSession(userId, sessionId, messagesToAdd);
    
    // Update last active time
    updateLastActiveTime(sessionId);
    
    // Run maintenance tasks in the background
    setTimeout(() => {
      compactSessionData(userId).catch(err => 
        console.error('Error compacting session data:', err)
      );
      archiveOldSessions(userId).catch(err => 
        console.error('Error archiving old sessions:', err)
      );
    }, 5000);
    
    const firstResponse = {
      response: aiResponse.response,
      sentiment,
      userContext: { mbtiType, aiPreference },
      recommendations: []
    };
    
    // If we have recommendations, return them as a second response
    if (recommendationsMessage) {
      return [firstResponse, {
        response: recommendationsMessage.content,
        sentiment,
        userContext: { mbtiType, aiPreference },
        recommendations: recommendationsItems
      }];
    }
    
    return firstResponse;
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
};

// Export the optimized function while keeping the original for compatibility
export { processOptimizedChat as optimizedProcessChat };

/**
 * Run maintenance tasks in the background for a user
 */
export const runChatMaintenance = async (userId: string): Promise<void> => {
  if (!userId) return;
  
  try {
    // Run tasks sequentially to avoid conflicts
    await compactSessionData(userId);
    await archiveOldSessions(userId);
    console.log('Chat maintenance completed for user:', userId);
  } catch (error) {
    console.error('Error running chat maintenance:', error);
  }
};

// Fix the missing updateSessionWithMessage function
/**
 * Update a session with a new message
 */
const updateSessionWithMessage = async (userId: string, sessionId: string, messageData: ChatMessage): Promise<void> => {
  const sessionsRef = doc(db, 'chatSessions', userId);
  const sessionsDoc = await getDoc(sessionsRef);
  
  if (!sessionsDoc.exists()) {
    throw new Error('Chat sessions not found');
  }
  
  const data = sessionsDoc.data() as ChatSessionsDoc;
  const now = new Date().toISOString();
  
  // Find the session to update
  let sessionFound = false;
  const activeSessions = [...data.activeSessions];
  
  // First check active sessions
  for (let i = 0; i < activeSessions.length; i++) {
    if (activeSessions[i].id === sessionId) {
      // Update the session
      activeSessions[i].messages.push(messageData);
      activeSessions[i].lastActiveAt = now;
      
      // Update session title based on first user message if needed
      if (activeSessions[i].title === 'New Conversation' && messageData.role === 'user') {
        // Use first few words of message as title
        const words = messageData.content.split(' ');
        const title = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
        activeSessions[i].title = title;
      }
      
      await updateDoc(sessionsRef, {
        activeSessions,
        updatedAt: serverTimestamp()
      });
      
      sessionFound = true;
      break;
    }
  }
  
  if (!sessionFound) {
    // Check archived sessions
    const archivedSessions = [...data.archivedSessions];
    
    for (let i = 0; i < archivedSessions.length; i++) {
      if (archivedSessions[i].id === sessionId) {
        // Update the session
        archivedSessions[i].messages.push(messageData);
        archivedSessions[i].lastActiveAt = now;
        
        // Similar title update logic for archived sessions
        if (archivedSessions[i].title === 'New Conversation' && messageData.role === 'user') {
          const words = messageData.content.split(' ');
          const title = words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
          archivedSessions[i].title = title;
        }
        
        // Move from archived to active sessions
        const sessionToActivate = archivedSessions.splice(i, 1)[0];
        activeSessions.unshift(sessionToActivate);
        
        // Update in Firestore
        await updateDoc(sessionsRef, {
          activeSessions,
          archivedSessions,
          currentSessionId: sessionId,
          updatedAt: serverTimestamp()
        });
        
        sessionFound = true;
        break;
      }
    }
  }
  
  if (!sessionFound) {
    throw new Error('Session not found');
  }
  
  // Invalidate cache
  sessionCache.delete(`user-sessions-${userId}`);
};