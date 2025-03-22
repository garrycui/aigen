import { doc, getDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../common/firebase';
import { sessionCache } from '../common/cache';

// Constants for session management
export const STALE_CHAT_THRESHOLD = 6 * 60 * 60 * 1000; // 6 hours before a chat is considered "stale"
export const LOCAL_STORAGE_KEY_PREFIX = 'aigen_chat_last_active_';
export const MAX_ACTIVE_SESSIONS = 5;

// Interface definitions
export interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
  sentiment?: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastActiveAt: string;
  messages: ChatMessage[];
}

export interface ChatSessionsDoc {
  userId: string;
  activeSessions: ChatSession[];
  archivedSessions: ChatSession[];
  currentSessionId: string;
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
}

/**
 * Platform-agnostic storage interface for session data
 * This allows us to use different storage mechanisms on web vs mobile
 */
export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Helper function for safe localStorage operations
const safeLSOperation = <T>(operation: () => T, fallback: T): T => {
  try {
    return operation();
  } catch (error) {
    console.error('LocalStorage operation failed:', error);
    return fallback;
  }
};

// Simplified web storage implementation
export const webSessionStorage: SessionStorage = {
  getItem: (key: string) => safeLSOperation(() => localStorage.getItem(key), null),
  setItem: (key: string, value: string) => safeLSOperation(() => localStorage.setItem(key, value), undefined),
  removeItem: (key: string) => safeLSOperation(() => localStorage.removeItem(key), undefined),
};

// Current storage implementation - can be swapped for mobile implementation
let currentStorage: SessionStorage = webSessionStorage;

/**
 * Set the storage implementation to use
 * This allows mobile apps to provide their own AsyncStorage implementation
 */
export const setSessionStorage = (storage: SessionStorage): void => {
  currentStorage = storage;
};

/**
 * Update the last activity time of a session
 */
export const updateLastActiveTime = (sessionId: string): void => {
  try {
    currentStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${sessionId}`, Date.now().toString());
  } catch (error) {
    console.error('Error updating last active time:', error);
  }
};

/**
 * Check if a chat session is stale based on its last activity time
 */
export const checkIfStaleChat = (sessionId: string): boolean => {
  try {
    const lastActiveTime = currentStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${sessionId}`);
    if (!lastActiveTime) return false;
    
    const lastActive = parseInt(lastActiveTime, 10);
    const now = Date.now();
    
    return (now - lastActive) > STALE_CHAT_THRESHOLD;
  } catch (error) {
    console.error('Error checking if chat is stale:', error);
    return false; // If there's any error, don't consider it stale
  }
};

/**
 * Format a session date for display
 */
export const formatSessionDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Today: Show time only
  if (date.toDateString() === now.toDateString()) {
    return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Yesterday: Show "Yesterday"
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // This week: Show day of week
  if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return `${date.toLocaleDateString([], { weekday: 'long' })}`;
  }
  
  // Older: Show date
  return date.toLocaleDateString();
};

/**
 * Get sentiment-based style class for chat bubbles
 */
export const getSentimentClass = (sentiment?: string): string => {
  switch (sentiment) {
    case 'positive': return 'bg-green-50 border-green-200';
    case 'negative': return 'bg-red-50 border-red-200';
    case 'neutral': return 'bg-blue-50 border-blue-200';
    default: return 'bg-white border-gray-200';
  }
};

/**
 * Initialize sessions document for a user
 */
export const initializeSessionsDoc = async (userId: string): Promise<string> => {
  const sessionId = `session_${Date.now()}`;
  const newSession = createEmptySession(sessionId);
  
  const sessionsRef = doc(db, 'chatSessions', userId);
  const data = {
    userId,
    activeSessions: [newSession],
    archivedSessions: [],
    currentSessionId: sessionId,
    updatedAt: serverTimestamp()
  };
  
  const sessionsDoc = await getDoc(sessionsRef);
  if (!sessionsDoc.exists()) {
    await setDoc(sessionsRef, { ...data, createdAt: serverTimestamp() });
  } else {
    await updateDoc(sessionsRef, data);
  }
  
  return sessionId;
};

// Helper to create a session object
const createEmptySession = (id: string): ChatSession => ({
  id,
  title: 'New Conversation',
  createdAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
  messages: []
});

/**
 * Get a session by ID from either active or archived sessions
 */
export const findSessionById = async (
  userId: string, 
  sessionId: string
): Promise<ChatSession | null> => {
  const { activeSessions, archivedSessions } = await getUserSessions(userId);
  
  // Look in active sessions first
  let session = activeSessions.find(s => s.id === sessionId);
  
  if (!session) {
    // Try archived sessions
    session = archivedSessions.find(s => s.id === sessionId);
  }
  
  return session || null;
};

/**
 * Get user's sessions with caching
 */
export const getUserSessions = async (userId: string): Promise<{
  activeSessions: ChatSession[];
  archivedSessions: ChatSession[];
  currentSessionId: string;
}> => {
  if (!userId) throw new Error('User ID is required');
  
  const cacheKey = `user-sessions-${userId}`;
  
  // Try to get from cache first
  return sessionCache.getOrSet(cacheKey, async () => {
    const sessionsRef = doc(db, 'chatSessions', userId);
    const sessionsDoc = await getDoc(sessionsRef);
    
    if (!sessionsDoc.exists()) {
      // Initialize first
      await initializeSessionsDoc(userId);
      const newDoc = await getDoc(sessionsRef);
      const data = newDoc.data() as ChatSessionsDoc;
      return {
        activeSessions: data.activeSessions || [],
        archivedSessions: data.archivedSessions || [],
        currentSessionId: data.currentSessionId
      };
    }
    
    const data = sessionsDoc.data() as ChatSessionsDoc;
    return {
      activeSessions: data.activeSessions || [],
      archivedSessions: data.archivedSessions || [],
      currentSessionId: data.currentSessionId
    };
  }, 60000); // 1-minute cache
};

/**
 * Get paginated messages for a session to reduce memory usage
 */
export const getPaginatedSessionMessages = async (
  userId: string, 
  sessionId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{
  messages: ChatMessage[];
  totalMessages: number;
  totalPages: number;
  currentPage: number;
}> => {
  if (!userId || !sessionId) throw new Error('User ID and session ID are required');
  
  const session = await findSessionById(userId, sessionId);
  
  if (!session) {
    return { 
      messages: [], 
      totalMessages: 0, 
      totalPages: 0, 
      currentPage: 1 
    };
  }
  
  const totalMessages = session.messages.length;
  const totalPages = Math.ceil(totalMessages / pageSize);
  
  // Ensure page is within valid range
  const validPage = Math.max(1, Math.min(page, totalPages || 1));
  
  // Calculate start and end indices for the current page
  const startIdx = (validPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalMessages);
  
  // Get messages for the current page
  const messages = session.messages.slice(startIdx, endIdx);
  
  return {
    messages,
    totalMessages,
    totalPages,
    currentPage: validPage
  };
};

/**
 * Get session metadata only (faster initial load)
 */
export const getSessionMetadata = async (userId: string): Promise<{
  activeSessions: Omit<ChatSession, 'messages'>[];
  archivedSessions: Omit<ChatSession, 'messages'>[];
  currentSessionId: string;
}> => {
  if (!userId) throw new Error('User ID is required');
  
  const cacheKey = `user-sessions-metadata-${userId}`;
  
  return sessionCache.getOrSet(cacheKey, async () => {
    // Get full sessions first
    const { activeSessions, archivedSessions, currentSessionId } = await getUserSessions(userId);
    
    // Extract only metadata (omit messages)
    const activeMetadata = activeSessions.map(session => {
      const { messages, ...metadata } = session;
      return { 
        ...metadata, 
        messageCount: messages.length 
      };
    });
    
    const archivedMetadata = archivedSessions.map(session => {
      const { messages, ...metadata } = session;
      return { 
        ...metadata, 
        messageCount: messages.length 
      };
    });
    
    return {
      activeSessions: activeMetadata,
      archivedSessions: archivedMetadata,
      currentSessionId
    };
  }, 30000); // 30 second cache for metadata (refreshes more frequently)
};

/**
 * Compact session data to reduce storage size
 */
export const compactSessionData = async (userId: string): Promise<void> => {
  if (!userId) return;
  
  const { activeSessions, archivedSessions, currentSessionId } = await getUserSessions(userId);
  
  // Create compacted versions of sessions
  const compactActiveSessions = activeSessions.map(session => {
    // Don't compact the current session
    if (session.id === currentSessionId || session.messages.length <= 50) {
      return session;
    }
    
    // Keep first 10 messages and last 40 for non-current active sessions
    const firstMessages = session.messages.slice(0, 10);
    const lastMessages = session.messages.slice(-40);
    
    return {
      ...session,
      messages: [...firstMessages, ...lastMessages]
    };
  });
  
  // More aggressive compacting for archived sessions
  const compactArchivedSessions = archivedSessions.map(session => {
    if (session.messages.length <= 20) {
      return session;
    }
    
    // Keep first 5 messages and last 15 for archived sessions
    const firstMessages = session.messages.slice(0, 5);
    const lastMessages = session.messages.slice(-15);
    
    return {
      ...session,
      messages: [...firstMessages, ...lastMessages]
    };
  });
  
  // Update in Firestore if anything changed
  if (JSON.stringify(activeSessions) !== JSON.stringify(compactActiveSessions) ||
      JSON.stringify(archivedSessions) !== JSON.stringify(compactArchivedSessions)) {
    
    const sessionsRef = doc(db, 'chatSessions', userId);
    await updateDoc(sessionsRef, {
      activeSessions: compactActiveSessions,
      archivedSessions: compactArchivedSessions,
      updatedAt: serverTimestamp()
    });
    
    // Invalidate cache
    sessionCache.delete(`user-sessions-${userId}`);
  }
};

/**
 * Archive old sessions automatically
 */
export const archiveOldSessions = async (userId: string): Promise<void> => {
  if (!userId) return;
  
  // Get all user sessions
  const { activeSessions, archivedSessions, currentSessionId } = await getUserSessions(userId);
  
  // Don't archive if we're under the limit or have only the current session
  if (activeSessions.length <= MAX_ACTIVE_SESSIONS || 
      (activeSessions.length === 1 && activeSessions[0].id === currentSessionId)) {
    return;
  }
  
  const now = Date.now();
  
  // Find sessions to archive (older than 30 days and not the current session)
  const sessionsToArchive = activeSessions.filter(session => {
    if (session.id === currentSessionId) return false;
    
    const lastActiveTimestamp = new Date(session.lastActiveAt).getTime();
    const daysSinceActive = (now - lastActiveTimestamp) / (1000 * 60 * 60 * 24);
    return daysSinceActive > 30;
  });
  
  // If we found sessions to archive
  if (sessionsToArchive.length > 0) {
    const updatedActiveSessions = activeSessions.filter(
      session => !sessionsToArchive.some(s => s.id === session.id)
    );
    
    const updatedArchivedSessions = [...sessionsToArchive, ...archivedSessions];
    
    const sessionsRef = doc(db, 'chatSessions', userId);
    await updateDoc(sessionsRef, {
      activeSessions: updatedActiveSessions,
      archivedSessions: updatedArchivedSessions,
      updatedAt: serverTimestamp()
    });
    
    // Invalidate cache
    sessionCache.delete(`user-sessions-${userId}`);
  }
};