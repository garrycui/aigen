import React, { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, Clock, ChevronDown, ChevronRight, Trash2, MessageSquare } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { 
  getUserSessions,
  setCurrentSession,
  createNewSession,
  deleteSession,
  getSessionMessages,
  processChatWithSession,
  clearAllChatHistory 
} from '@shared/lib/chat/chat';
import AIChatCard from './AIChatCard';

// Constants for chat management
const STALE_CHAT_THRESHOLD = 6 * 60 * 60 * 1000; // 6 hours before a chat is considered "stale"
const LOCAL_STORAGE_KEY_PREFIX = 'aigen_chat_last_active_';
// Add constant for auto-creation of new sessions
const AUTO_CREATE_NEW_SESSION = true; // Toggle for auto session creation feature

// Interface for chat sessions
interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastActiveAt: string;
}

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

  // Update the last activity time
  const updateLastActiveTime = (sessionId: string) => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${sessionId}`, Date.now().toString());
    } catch (error) {
      console.error('Error updating last active time:', error);
    }
  };

  // Check if the chat is stale based on last activity time
  const checkIfStaleChat = (sessionId: string) => {
    try {
      const lastActiveTime = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${sessionId}`);
      if (!lastActiveTime) return false;
      
      const lastActive = parseInt(lastActiveTime, 10);
      const now = Date.now();
      
      return (now - lastActive) > STALE_CHAT_THRESHOLD;
    } catch (error) {
      return false; // If there's any error, don't consider it stale
    }
  };

  // Create a new chat session
  const handleNewChat = async () => {
    if (!user || isLoading) return;
    
    setIsLoading(true);
    try {
      const newSessionId = await createNewSession(user.id);
      setCurrentSessionId(newSessionId);
      setMessages([]);
      
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
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
          content: msg.content.replace(/\n/g, '<br/>'),
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
            content: msg.content.replace(/\n/g, '<br/>'),
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
            
            // Get messages for current session
            const messages = await getSessionMessages(user.id, currentSessionId);
            
            if (messages.length > 0) {
              setContainerHeight('h-[400px]');
              const formattedMessages = messages.map(msg => ({
                content: msg.content.replace(/\n/g, '<br/>'),
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
    if (isAnimating && animatingMessageIndex !== null && messages[animatingMessageIndex]) {
      const fullText = messages[animatingMessageIndex].content.replace(/<br\/>/g, '\n');
      
      if (animatedText.length < fullText.length) {
        const timeout = setTimeout(() => {
          // Add a few characters at a time for smoother animation
          const nextChunkSize = Math.floor(Math.random() * 3) + 1; // 1-3 characters
          const nextText = fullText.slice(0, animatedText.length + nextChunkSize);
          setAnimatedText(nextText);
        }, animationSpeed);
        
        return () => clearTimeout(timeout);
      } else {
        // Animation complete
        setIsAnimating(false);
        setAnimatingMessageIndex(null);
        setAnimatedText('');
      }
    }
  }, [isAnimating, animatingMessageIndex, animatedText, messages, animationSpeed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !currentSessionId || isLoading) return;

    // Create new session if current one is stale
    if ((showNewChatPrompt || isStaleChat) && AUTO_CREATE_NEW_SESSION) {
      await handleNewChat();
      // Store the message to use after new session is created
      const pendingMessage = input;
      setInput('');
      
      // Wait a bit for the new session creation to complete
      setTimeout(async () => {
        setInput(pendingMessage);
        // Submit after new session is ready
        const newForm = document.querySelector('form');
        if (newForm) newForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }, 300);
      
      return;
    }

    // Hide new chat prompt if it's showing
    if (showNewChatPrompt) {
      setShowNewChatPrompt(false);
    }
    if (isStaleChat) {
      setIsStaleChat(false);
    }
    
    // Update last active time
    updateLastActiveTime(currentSessionId);

    const timestamp = new Date().toISOString();
    const message = input;
    setInput('');
    setIsLoading(true);

    // Show user message immediately
    setMessages(prev => [...prev, { content: message, role: 'user', timestamp }]);
    
    // Add a small delay and show thinking indicator to make it feel more human
    setTimeout(() => setIsThinking(true), 500);

    try {
      // Use session-based processing
      const result = await processChatWithSession(user.id, currentSessionId, message);
      const responses = Array.isArray(result) ? result : [result];
      
      const newMessages = responses.map((res) => ({
        content: res.response.replace(/\n/g, '<br/>'),
        role: 'assistant' as 'assistant',
        sentiment: res.sentiment,
        timestamp: new Date().toISOString(),
        recommendations: res.recommendations || []
      }));

      // We need to update messages first, then start animation
      setMessages(prev => {
        const updatedMessages = [...prev];
        if (updatedMessages.length > 0) {
          updatedMessages[updatedMessages.length - 1] = { content: message, role: 'user', timestamp };
        } else {
          updatedMessages.push({ content: message, role: 'user', timestamp });
        }
        
        // Add the new AI messages
        const finalMessages = [...updatedMessages, ...newMessages];
        
        // Start animation in the next render cycle to ensure we have the updated messages state
        setTimeout(() => {
          // Get index of the last AI message we want to animate
          const lastAIMessageIndex = finalMessages.length - 1;
          setAnimatingMessageIndex(lastAIMessageIndex);
          setAnimatedText('');
          setIsAnimating(true);
        }, 50);
        
        return finalMessages;
      });
      
      // Refresh session data to get updated titles
      const { activeSessions, archivedSessions } = await getUserSessions(user.id);
      setActiveSessions(activeSessions);
      setArchivedSessions(archivedSessions);
      
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [
        ...prev,
        { content: 'I apologize, but I encountered an error. Please try again.', role: 'assistant', timestamp: new Date().toISOString() }
      ]);
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  // Format date for display
  const formatSessionDate = (dateString: string) => {
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

  // Get sentiment-based background color
  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-50 border-green-200';
      case 'negative': return 'bg-red-50 border-red-200';
      case 'neutral': return 'bg-blue-50 border-blue-200';
      default: return 'bg-white border-gray-200';
    }
  };

  // Handler for content card clicks
  const handleContentClick = (id: string, type: 'post' | 'tutorial') => {
    const path = type === 'post' ? `/forum/${id}` : `/tutorials/${id}`;
    window.location.href = path;
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

            {/* Message display */}
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-lg border shadow-sm ${getSentimentColor(message.sentiment)}`}
                  style={{ whiteSpace: 'pre-wrap' }} // Preserve whitespace
                >
                  {message.role === 'assistant' && index === animatingMessageIndex ? (
                    <>
                      {/* Display animated text for the message being animated */}
                      <span dangerouslySetInnerHTML={{ __html: animatedText.replace(/\n/g, '<br/>') }} />
                      <span className="typing-cursor">|</span>
                    </>
                  ) : (
                    // Display full content for other messages
                    <span dangerouslySetInnerHTML={{ __html: message.content }} />
                  )}
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
                </span>
                {message.recommendations && message.recommendations.length > 0 && (
                  <div className="mt-4 space-y-4 w-full max-w-[95%]">
                    {message.recommendations.map(rec => (
                      <AIChatCard
                        key={rec.id}
                        item={{
                          id: rec.id,
                          title: rec.title,
                          content: rec.content,
                          type: rec.type || 'tutorial' // Default to tutorial if type not specified
                        }}
                        onClick={handleContentClick}
                      />
                    ))}
                  </div>
                )}
              </div>
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
      `}</style>
    </div>
  );
};

export default AIChat;
