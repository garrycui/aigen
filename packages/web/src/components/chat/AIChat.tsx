import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Send, RefreshCw, Clock, ChevronDown, ChevronRight, Trash2, MessageSquare } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { 
  getUserSessions,
  setCurrentSession,
  createNewSession,
  deleteSession,
  getSessionMessages,
  processChatWithSession,
  clearAllChatHistory,
  runChatMaintenance,
  getPaginatedSessionMessages,
  updateLastActiveTime,
  checkIfStaleChat,
  formatSessionDate,
  getSentimentClass
} from '@shared/lib/chat/chat';
import { ChatSession } from '@shared/lib/chat/sessionManager';
import AIChatCard from './AIChatCard';

// Constants for chat management
// Toggle for auto session creation feature
const AUTO_CREATE_NEW_SESSION = true;

// Define types for the message component
interface ChatMessageType {
  content: string;
  role: 'user' | 'assistant';
  sentiment?: 'positive' | 'negative' | 'neutral';
  timestamp?: string;
  recommendations?: { id: string; title: string; content: string; type?: 'post' | 'tutorial' }[];
}

interface ChatMessageProps {
  message: ChatMessageType;
  isAnimating: boolean;
  animatedText: string;
  index: number;
  animatingMessageIndex: number | null;
  getSentimentColor: (sentiment?: string) => string;
  handleContentClick: (id: string, type: 'post' | 'tutorial') => void;
  showRecommendations?: boolean;
  animationQueue?: number[]; // Add this type
}

// Memoized message component for performance optimization
const ChatMessage = memo(({
  message,
  isAnimating,
  animatedText,
  index,
  animatingMessageIndex,
  getSentimentColor,
  handleContentClick,
  showRecommendations = true,
  animationQueue = [] // Add this new prop
}: ChatMessageProps & { showRecommendations?: boolean }) => {
  const shouldShowRecommendations = showRecommendations && 
    message.recommendations && 
    message.recommendations.length > 0;
  
  // Check if this message is waiting in the animation queue
  const isQueued = animationQueue.includes(index);
  
  // For assistant messages that are queued for animation but not currently animating,
  // we should show an empty bubble with a pulsing indicator
  const isQueuedForAnimation = message.role === 'assistant' && isQueued;
  
  return (
    <div 
      className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
    >
      <div
        className={`max-w-[80%] p-4 rounded-lg border shadow-sm ${getSentimentColor(message.sentiment)}`}
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {message.role === 'assistant' && index === animatingMessageIndex ? (
          // Currently animating message
          <>
            <span dangerouslySetInnerHTML={{ __html: animatedText.replace(/\n/g, '<br/>') }} />
            <span className="typing-cursor">|</span>
          </>
        ) : isQueuedForAnimation ? (
          // Message is queued for animation - show waiting indicator
          <span className="inline-flex"><span className="dot-typing"></span></span>
        ) : (
          // Regular message display (or completed animation)
          <span dangerouslySetInnerHTML={{ __html: message.content }} />
        )}
      </div>
      <span className="text-xs text-gray-500 mt-1">
        {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
      </span>
      
      {shouldShowRecommendations && !isQueuedForAnimation && message.recommendations && (
        <div className="mt-4 space-y-4 w-full max-w-[95%] animate-fade-in">
          {message.recommendations.map(rec => (
            <AIChatCard
              key={rec.id}
              item={{
                id: rec.id,
                title: rec.title,
                content: rec.content,
                type: rec.type || 'tutorial'
              }}
              onClick={handleContentClick}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Add the missing message formatting functions at the top of the file
const formatMessage = (content: string): string => content.replace(/\n/g, '<br/>');
const unformatMessage = (content: string): string => content.replace(/<br\/>/g, '\n');

const AIChat = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{
    content: string;
    role: 'user' | 'assistant';
    sentiment?: 'positive' | 'negative' | 'neutral';
    timestamp?: string;
    recommendations?: { id: string; title: string; content: string; type?: 'post' | 'tutorial' }[];
  }>>([]);
  // Add new state for typing animation
  const [animatingMessageIndex, setAnimatingMessageIndex] = useState<number | null>(null);
  const [animatedText, setAnimatedText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(15); // ms per character
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState('min-h-[60px]');
  const [isThinking, setIsThinking] = useState(false);
  const [showNewChatPrompt, setShowNewChatPrompt] = useState(false);
  const [isStaleChat, setIsStaleChat] = useState(false);
  
  // New session management state
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);

  // Add state for pagination support
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetchingMoreMessages, setIsFetchingMoreMessages] = useState(false);

  // Add state for tracking animation completion
  const [animationComplete, setAnimationComplete] = useState(true); 
  const [recommendationsReady, setRecommendationsReady] = useState(false);
  const [hasLearningIntent, setHasLearningIntent] = useState(false);
  const [animationQueue, setAnimationQueue] = useState<number[]>([]);

  // Use memoized callbacks for better performance
  const getSentimentColor = useCallback((sentiment?: string) => {
    return getSentimentClass(sentiment);
  }, []);

  const handleContentClick = useCallback((id: string, type: 'post' | 'tutorial') => {
    const path = type === 'post' ? `/forum/${id}` : `/tutorials/${id}`;
    window.location.href = path;
  }, []);

  // Create a new chat session with optimized handling
  const handleNewChat = useCallback(async () => {
    if (!user || isLoading) return;
    
    setIsLoading(true);
    try {
      const newSessionId = await createNewSession(user.id);
      setCurrentSessionId(newSessionId);
      setMessages([]);
      setCurrentPage(1);
      setTotalPages(1);
      
      // Update session lists
      const { activeSessions, archivedSessions } = await getUserSessions(user.id);
      setActiveSessions(activeSessions);
      setArchivedSessions(archivedSessions);
      
      // Hide prompts and close drawer on mobile
      setShowNewChatPrompt(false);
      if (window.innerWidth < 768) {
        setShowSessionDrawer(false);
      }
      
      // Update last active time
      updateLastActiveTime(newSessionId);
      
      // Run maintenance tasks in the background
      setTimeout(() => {
        if (user?.id) {
          runChatMaintenance(user.id).catch(console.error);
        }
      }, 2000);
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading]);

  // Switch to a different session
  const handleSwitchSession = async (sessionId: string) => {
    if (!user || isLoading || sessionId === currentSessionId) return;
    
    setIsLoading(true);
    try {
      await setCurrentSession(user.id, sessionId);
      setCurrentSessionId(sessionId);
      
      // Get messages for this session
      const messages = await getSessionMessages(user.id, sessionId);
      
      if (messages.length > 0) {
        const formattedMessages = messages.map(msg => ({
          content: formatMessage(msg.content),
          role: msg.role,
          sentiment: msg.sentiment,
          timestamp: msg.timestamp
        }));
        setMessages(formattedMessages);
        setContainerHeight('h-[400px]');
      } else {
        setMessages([]);
      }
      
      // Update session lists to get latest order
      const { activeSessions, archivedSessions } = await getUserSessions(user.id);
      setActiveSessions(activeSessions);
      setArchivedSessions(archivedSessions);
      
      // Hide stale banner
      setShowNewChatPrompt(false);
      
      // Close drawer on mobile
      if (window.innerWidth < 768) {
        setShowSessionDrawer(false);
      }
      
      // Update last active time
      updateLastActiveTime(sessionId);
    } catch (error) {
      console.error('Error switching sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a session
  const handleDeleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!user || isLoading) return;
    
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await deleteSession(user.id, sessionId);
      
      // Update session lists
      const { activeSessions, archivedSessions, currentSessionId: newCurrentId } = await getUserSessions(user.id);
      setActiveSessions(activeSessions);
      setArchivedSessions(archivedSessions);
      
      // If we deleted the current session, update the view
      if (sessionId === currentSessionId) {
        setCurrentSessionId(newCurrentId);
        
        if (newCurrentId) {
          // Load messages for the new current session
          const messages = await getSessionMessages(user.id, newCurrentId);
          const formattedMessages = messages.map(msg => ({
            content: formatMessage(msg.content),
            role: msg.role,
            sentiment: msg.sentiment,
            timestamp: msg.timestamp
          }));
          setMessages(formattedMessages);
          
          // Update last active time
          updateLastActiveTime(newCurrentId);
        } else {
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all chat history
  const handleClearHistory = async () => {
    if (!user || isLoading) return;
    
    if (!window.confirm('Are you sure you want to clear all conversation history? This cannot be undone.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await clearAllChatHistory(user.id);
      
      // Reset the UI state
      setActiveSessions([]);
      setArchivedSessions([]);
      setMessages([]);
      setCurrentSessionId('');
      setContainerHeight('min-h-[60px]');
      
      // Get the new (empty) session created by clearAllChatHistory
      const { activeSessions, currentSessionId } = await getUserSessions(user.id);
      setActiveSessions(activeSessions);
      setCurrentSessionId(currentSessionId);
      
    } catch (error) {
      console.error('Error clearing history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load more messages (pagination support)
  const handleLoadMoreMessages = useCallback(async () => {
    if (!user || !currentSessionId || isLoading || isFetchingMoreMessages || currentPage <= 1) return;
    
    setIsFetchingMoreMessages(true);
    try {
      // Get the previous page of messages
      const prevPage = currentPage - 1;
      const { messages: olderMessages } = await getPaginatedSessionMessages(
        user.id, currentSessionId, prevPage, 20
      );
      
      if (olderMessages?.length) {
        const formattedOlderMessages = olderMessages.map(msg => ({
          content: formatMessage(msg.content),
          role: msg.role,
          sentiment: msg.sentiment,
          timestamp: msg.timestamp
        }));
        
        // Prepend older messages
        setMessages(prev => [...formattedOlderMessages, ...prev]);
        setCurrentPage(prevPage);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsFetchingMoreMessages(false);
    }
  }, [user, currentSessionId, isLoading, isFetchingMoreMessages, currentPage]);

  // Load sessions and messages when component mounts
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      
      const loadSessionsAndMessages = async () => {
        try {
          // Get sessions data
          const { activeSessions, archivedSessions, currentSessionId } = await getUserSessions(user.id);
          
          setActiveSessions(activeSessions);
          setArchivedSessions(archivedSessions);
          
          if (currentSessionId) {
            setCurrentSessionId(currentSessionId);
            
            // Check if session is stale
            const isStale = checkIfStaleChat(currentSessionId);
            setShowNewChatPrompt(isStale);
            
            // Get paginated messages for current session (just the most recent page)
            const { 
              messages, 
              totalPages,
              currentPage 
            } = await getPaginatedSessionMessages(
              user.id, 
              currentSessionId,
              1, // Start with the most recent page
              20 // Page size
            );
            
            setCurrentPage(currentPage);
            setTotalPages(totalPages);
            
            if (messages.length > 0) {
              setContainerHeight('h-[400px]');
              const formattedMessages = messages.map(msg => ({
                content: formatMessage(msg.content),
                role: msg.role,
                sentiment: msg.sentiment,
                timestamp: msg.timestamp
              }));
              setMessages(formattedMessages);
            }
            
            // Update last active time
            updateLastActiveTime(currentSessionId);
          }
        } catch (error) {
          console.error('Error loading sessions and messages:', error);
        } finally {
          setIsLoading(false);
        }
        
        // Run maintenance tasks in the background after a delay
        setTimeout(() => {
          if (user?.id) {
            runChatMaintenance(user.id).catch(console.error);
          }
        }, 5000);
      };
      
      loadSessionsAndMessages();
    }
  }, [user]);

  // Check for stale sessions and auto-create new ones if needed
  useEffect(() => {
    if (!user || !currentSessionId || !AUTO_CREATE_NEW_SESSION) return;
    
    const isStale = checkIfStaleChat(currentSessionId);
    
    if (isStale && messages.length > 0) {
      setIsStaleChat(true);
      setShowNewChatPrompt(true);
      
      // Auto-create new session if enabled and session is stale
      if (AUTO_CREATE_NEW_SESSION && !isLoading) {
        // We don't create automatically on page load, just mark as stale
        // The next user interaction will create a new session
        console.log("Session is stale. A new session will be created on next interaction.");
      }
    }
  }, [user, currentSessionId, messages.length]);

  // Container height adjustment based on messages
  useEffect(() => {
    if (messages.length > 0) {
      setContainerHeight('h-[400px]');
    }
  }, [messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-scroll during animation
  useEffect(() => {
    if (chatContainerRef.current && isAnimating) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [animatedText, isAnimating]);

  // Animation effect for gradually revealing AI response
  useEffect(() => {
    if (!isAnimating || animatingMessageIndex === null || !messages[animatingMessageIndex]) return;

    const fullText = unformatMessage(messages[animatingMessageIndex].content);
    
    if (animatedText.length < fullText.length) {
      // Still animating - show more text
      const timeout = setTimeout(() => {
        const nextChunkSize = Math.floor(Math.random() * 3) + 1;
        setAnimatedText(fullText.slice(0, animatedText.length + nextChunkSize));
      }, animationSpeed);
      
      return () => clearTimeout(timeout);
    }
    
    // Animation complete - check queue
    finishCurrentAnimation();
  }, [isAnimating, animatingMessageIndex, animatedText, messages, animationSpeed]);

  // Extract animation completion function to reuse
  const finishCurrentAnimation = useCallback(() => {
    setIsAnimating(false);
    setAnimatingMessageIndex(null);
    setAnimatedText('');
    
    if (animationQueue.length > 0) {
      // Start next animation after delay
      setTimeout(() => {
        const nextIndex = animationQueue[0];
        const remainingQueue = animationQueue.slice(1);
        setAnimationQueue(remainingQueue);
        setAnimatingMessageIndex(nextIndex);
        setAnimatedText('');
        setIsAnimating(true);
      }, 300);
    } else {
      // All done - show recommendations if needed
      setAnimationComplete(true);
      if (hasLearningIntent) setRecommendationsReady(true);
    }
  }, [animationQueue, hasLearningIntent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;
    
    // Handle stale chat
    if (checkIfStaleChatActive()) {
      await handleStaleChat();
      return;
    }

    const timestamp = new Date().toISOString();
    const userMessage = input;
    prepareForSubmission(timestamp, userMessage);

    try {
      const result = await processChatWithSession(user!.id, currentSessionId, userMessage);
      handleSuccessResponse(result, timestamp, userMessage);
    } catch (error) {
      handleErrorResponse(error);
    } finally {
      completeSubmission();
    }
  };

  // Fix the validateInputs function
  const validateInputs = (): boolean => {
    if (!input.trim() || !user || !currentSessionId || isLoading) return false;
    return true;
  };

  // Fix the isStaleChat function to return a boolean
  const checkIfStaleChatActive = (): boolean => {
    return !!(showNewChatPrompt || isStaleChat) && AUTO_CREATE_NEW_SESSION;
  };

  // Fix the handleStaleChat function
  const handleStaleChat = async (): Promise<void> => {
    if (!user) return;
    await handleNewChat();
    const pendingMessage = input;
    setInput('');
    setTimeout(async () => {
      setInput(pendingMessage);
      const newForm = document.querySelector('form');
      if (newForm) newForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }, 300);
  };

  // Fix the prepareForSubmission function
  const prepareForSubmission = (timestamp: string, userMessage: string): void => {
    setInput('');
    setIsLoading(true);
    updateLastActiveTime(currentSessionId);
    
    // Hide new chat prompt if it's showing
    if (showNewChatPrompt) {
      setShowNewChatPrompt(false);
    }
    setIsStaleChat(false);
    
    setMessages(prev => [...prev, { content: formatMessage(userMessage), role: 'user', timestamp }]);
    setTimeout(() => setIsThinking(true), 500);
    
    setRecommendationsReady(false);
    setHasLearningIntent(false);
    setAnimationComplete(false);
  };

  const handleSuccessResponse = async (result: any, timestamp: string, userMessage: string) => {
    const responses = Array.isArray(result) ? result : [result];
    const newMessages = responses.map((res) => ({
      content: formatMessage(res.response),
      role: 'assistant' as 'assistant',
      sentiment: res.sentiment,
      timestamp: new Date().toISOString(),
      recommendations: res.recommendations || []
    }));

    const isLearningIntent = responses.length > 1 && responses[1].recommendations?.length > 0;
    setHasLearningIntent(isLearningIntent);

    setMessages(prev => {
      const updatedMessages = [...prev];
      if (updatedMessages.length > 0) {
        updatedMessages[updatedMessages.length - 1] = { content: userMessage, role: 'user', timestamp };
      } else {
        updatedMessages.push({ content: userMessage, role: 'user', timestamp });
      }
      const finalMessages = [...updatedMessages, ...newMessages];
      setTimeout(() => {
        if (isLearningIntent) {
          const firstResponseIndex = finalMessages.length - newMessages.length;
          const recommendationsMessageIndex = firstResponseIndex + 1;
          setAnimatingMessageIndex(firstResponseIndex);
          setAnimatedText('');
          setIsAnimating(true);
          setAnimationQueue([recommendationsMessageIndex]);
        } else {
          const lastAIMessageIndex = finalMessages.length - 1;
          setAnimatingMessageIndex(lastAIMessageIndex);
          setAnimatedText('');
          setIsAnimating(true);
          setAnimationQueue([]);
        }
      }, 50);
      return finalMessages;
    });

    const { activeSessions, archivedSessions } = await getUserSessions(user!.id);
    setActiveSessions(activeSessions);
    setArchivedSessions(archivedSessions);
  };

  const handleErrorResponse = (error: any) => {
    console.error('Error in chat:', error);
    setMessages(prev => [
      ...prev,
      { content: 'I apologize, but I encountered an error. Please try again.', role: 'assistant', timestamp: new Date().toISOString() }
    ]);
    setAnimationComplete(true);
  };

  const completeSubmission = () => {
    setIsLoading(false);
    setIsThinking(false);
    setTimeout(() => {
      if (user?.id && currentSessionId) {
        getPaginatedSessionMessages(user.id, currentSessionId, 1, 20)
          .then(({ totalPages }) => {
            setTotalPages(totalPages);
          })
          .catch(console.error);
      }
    }, 2000);
  };

  return (
    <div className={`flex flex-col bg-gray-50 rounded-lg transition-all duration-300 ${containerHeight}`}>
      {/* Chat header with session controls */}
      <div className="flex justify-between items-center bg-gray-100 p-2 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center">
          <button
            onClick={() => setShowSessionDrawer(!showSessionDrawer)}
            className="p-1 mr-2 text-gray-600 hover:bg-gray-200 rounded-md"
            title="Show conversation history"
          >
            <Clock className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 truncate max-w-[180px]">
            {activeSessions.find(s => s.id === currentSessionId)?.title || 'New Conversation'}
          </span>
        </div>
        <div>
          <button
            onClick={handleNewChat}
            className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200"
            title="Start a new conversation"
          >
            New Chat
          </button>
        </div>
      </div>

      {/* Main content area with session drawer and chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* Session drawer sidebar */}
        {showSessionDrawer && (
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
            <div className="p-3 border-b border-gray-200">
              <button
                onClick={handleNewChat}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm flex items-center justify-center"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                <span>New Conversation</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {/* Active conversations */}
              {activeSessions.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2 px-1">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Recent Conversations
                    </h3>
                    {activeSessions.length > 0 && (
                      <button
                        onClick={handleClearHistory}
                        className="text-xs text-red-500 hover:text-red-700"
                        title="Clear all conversations"
                      >
                        Clear History
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {activeSessions.map(session => (
                      <div
                        key={session.id}
                        className={`flex items-center group justify-between p-2 rounded-md text-sm cursor-pointer ${
                          currentSessionId === session.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => handleSwitchSession(session.id)}
                      >
                        <div className="flex-1 truncate pr-2">
                          <div className="font-medium truncate">{session.title}</div>
                          <div className="text-xs text-gray-500">{formatSessionDate(session.lastActiveAt)}</div>
                        </div>
                        {currentSessionId !== session.id && (
                          <button
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Archived conversations */}
              {archivedSessions.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowArchivedSessions(!showArchivedSessions)}
                    className="flex items-center justify-between w-full px-1 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    <span>Archived ({archivedSessions.length})</span>
                    {showArchivedSessions ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  
                  {showArchivedSessions && (
                    <div className="space-y-1 mt-1">
                      {archivedSessions.map(session => (
                        <div
                          key={session.id}
                          className="flex items-center group justify-between p-2 rounded-md text-sm cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSwitchSession(session.id)}
                        >
                          <div className="flex-1 truncate pr-2">
                            <div className="font-medium truncate">{session.title}</div>
                            <div className="text-xs text-gray-500">{formatSessionDate(session.lastActiveAt)}</div>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {activeSessions.length === 0 && archivedSessions.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No conversations yet. Start a new chat!
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Stale Chat Banner */}
          {showNewChatPrompt && (
            <div className="bg-blue-50 border-b border-blue-200 p-3 flex items-center justify-between">
              <div className="text-sm text-blue-700">
                This is a previous conversation. Would you like to start a new one?
              </div>
              <button 
                onClick={handleNewChat}
                className="ml-4 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-sm flex items-center"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                New Chat
              </button>
            </div>
          )}

          {/* Chat messages display */}
          <div 
            ref={chatContainerRef}
            className="flex-1 p-4 overflow-y-auto space-y-4"
          >
            {/* Add "Load Previous Messages" button when there are more pages */}
            {currentPage < totalPages && (
              <div className="flex justify-center py-2">
                <button
                  onClick={handleLoadMoreMessages}
                  className="px-4 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  disabled={isFetchingMoreMessages}
                >
                  {isFetchingMoreMessages ? 'Loading...' : 'Load previous messages'}
                </button>
              </div>
            )}

            {/* Welcome message when no messages */}
            {messages.length === 0 && !isLoading && (
              <div className="flex justify-center items-center h-full">
                <div className="text-center p-6 rounded-lg bg-white shadow-sm border border-gray-200">
                  <h3 className="font-medium text-gray-800 mb-2">Welcome! I'm here to help you.</h3>
                  <p className="text-gray-600 text-sm mb-4">How are you feeling about AI technology today?</p>
                  <div className="flex justify-center space-x-2">
                    <button 
                      onClick={() => setInput("I'm excited about AI possibilities!")}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                    >
                      Excited
                    </button>
                    <button 
                      onClick={() => setInput("I'm a bit uncertain about AI changes.")}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
                    >
                      Uncertain
                    </button>
                    <button 
                      onClick={() => setInput("I want to learn more about AI.")}
                      className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200"
                    >
                      Curious
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Message display - now using memoized component */}
            {messages.map((message, index) => (
              <ChatMessage
                key={`${message.role}-${index}`}
                message={message}
                isAnimating={isAnimating}
                animatedText={animatedText}
                index={index}
                animatingMessageIndex={animatingMessageIndex}
                getSentimentColor={getSentimentColor}
                handleContentClick={handleContentClick}
                showRecommendations={animationComplete && recommendationsReady}
                animationQueue={animationQueue}
              />
            ))}

            {/* Enhanced thinking indicator with animated gradient */}
            {(isLoading || isThinking) && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 shadow-sm">
                  <div className="flex flex-col space-y-1">
                    <div className="flex space-x-2 items-center">
                      <div className="thinking-dot bg-indigo-400 rounded-full animate-thinking-1"></div>
                      <div className="thinking-dot bg-indigo-500 rounded-full animate-thinking-2"></div>
                      <div className="thinking-dot bg-indigo-600 rounded-full animate-thinking-3"></div>
                    </div>
                    <span className="text-xs text-gray-500 pt-1">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input form */}
          <div className="bg-white border-t p-4">
            {messages.length > 0 && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleNewChat}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Start New Chat
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${
                  isLoading || !input.trim()
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Add custom CSS for thinking animation */}
      <style>{`
        .thinking-dot {
          width: 8px;
          height: 8px;
          opacity: 0.7;
        }

        @keyframes thinking {
          0% { transform: translateY(0px); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
          100% { transform: translateY(0px); opacity: 0.4; }
        }

        .animate-thinking-1 {
          animation: thinking 1.2s infinite;
        }
        
        .animate-thinking-2 {
          animation: thinking 1.2s infinite 0.2s;
        }
        
        .animate-thinking-3 {
          animation: thinking 1.2s infinite 0.4s;
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .typing-cursor {
          display: inline-block;
          opacity: 1;
          animation: blink 1s infinite;
          margin-left: 2px;
          font-weight: normal;
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        
        .dot-typing {
          position: relative;
          left: -9999px;
          width: 6px;
          height: 6px;
          border-radius: 5px;
          background-color: #6B7280;
          color: #6B7280;
          box-shadow: 9984px 0 0 0 #6B7280, 9999px 0 0 0 #6B7280, 10014px 0 0 0 #6B7280;
          animation: dotTyping 1.5s infinite linear;
        }

        @keyframes dotTyping {
          0% {
            box-shadow: 9984px 0 0 0 #6B7280, 9999px 0 0 0 #6B7280, 10014px 0 0 0 #6B7280;
          }
          16.667% {
            box-shadow: 9984px -10px 0 0 #6B7280, 9999px 0 0 0 #6B7280, 10014px 0 0 0 #6B7280;
          }
          33.333% {
            box-shadow: 9984px 0 0 0 #6B7280, 9999px 0 0 0 #6B7280, 10014px 0 0 0 #6B7280;
          }
          50% {
            box-shadow: 9984px 0 0 0 #6B7280, 9999px -10px 0 0 #6B7280, 10014px 0 0 0 #6B7280;
          }
          66.667% {
            box-shadow: 9984px 0 0 0 #6B7280, 9999px 0 0 0 #6B7280, 10014px 0 0 0 #6B7280;
          }
          83.333% {
            box-shadow: 9984px 0 0 0 #6B7280, 9999px 0 0 0 #6B7280, 10014px -10px 0 0 #6B7280;
          }
          100% {
            box-shadow: 9984px 0 0 0 #6B7280, 9999px 0 0 0 #6B7280, 10014px 0 0 0 #6B7280;
          }
        }
      `}</style>
    </div>
  );
};

export default AIChat;
