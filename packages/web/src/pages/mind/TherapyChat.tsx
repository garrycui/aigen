import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Settings, X, Info, Clock, Archive, PlusCircle } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { getLatestAssessment } from '@shared/lib/assessment/assessment';
import { 
  Message,
  TherapySession,
  THERAPY_STYLES, 
  THERAPY_MODALITIES, 
  COMMUNICATION_TONES,
  TYPING_SPEED_MS,
  TYPING_DELAY_MS,
  getDefaultPreferencesForMBTI,
  getPersonalizedWelcome,
  processTherapyMessage,
  getOrCreateActiveSession,
  getTherapyMessages,
  addTherapyMessage,
  updateTherapySession,
  getTherapySessions,
  createTherapySession,
  generateSessionSummary
} from '@shared/lib/mind/therapychat';

const TherapyChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mbtiType, setMbtiType] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Session management state
  const [currentSession, setCurrentSession] = useState<TherapySession | null>(null);
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  
  // Typing animation state
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);

  // Therapy preferences state
  const [showPreferences, setShowPreferences] = useState(false);
  const [therapyStyle, setTherapyStyle] = useState<string | null>(null);
  const [therapyModality, setTherapyModality] = useState<string | null>(null);
  const [communicationTone, setCommunicationTone] = useState<string | null>(null);
  
  // Session stage tracking
  const [sessionStage, setSessionStage] = useState<string | null>(null);
  
  // About/Info panel state
  const [showAboutInfo, setShowAboutInfo] = useState(false);

  // Load user profile and sessions
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // Load assessment for MBTI
        const { data: assessment } = await getLatestAssessment(user.id);
        if (assessment) {
          setMbtiType(assessment.mbti_type);
          
          // Set default preferences based on MBTI
          const defaults = getDefaultPreferencesForMBTI(assessment.mbti_type);
          setTherapyStyle(defaults.therapyStyle);
          setTherapyModality(defaults.therapyModality);
          setCommunicationTone(defaults.communicationTone);
        }
        
        // Load Companion Sessions
        const userSessions = await getTherapySessions(user.id);
        setSessions(userSessions);
        
        // Get or create active session
        const activeSession = await getOrCreateActiveSession(user.id, assessment?.mbti_type);
        setCurrentSession(activeSession);
        setSessionStage(activeSession.sessionStage || 'initial');
        
        // Load messages for the active session
        const sessionMessages = await getTherapyMessages(user.id, activeSession.id);
        
        if (sessionMessages.length === 0) {
          // If this is a new session, add a welcome message
          const welcomeMessage = getPersonalizedWelcome(assessment?.mbti_type || "");
          
          const welcomeMsg: Message = {
            id: 'welcome',
            content: welcomeMessage,
            role: 'assistant',
            timestamp: new Date(),
            tags: ['greeting'],
            isTyping: true,
            displayedContent: ''
          };
          
          setMessages([welcomeMsg]);
          
          // Save welcome message to Firestore
          await addTherapyMessage(user.id, activeSession.id, welcomeMsg);
          
          // Start welcome message typing animation after a short delay
          setTimeout(() => {
            setTypingMessageId('welcome');
          }, TYPING_DELAY_MS);
        } else {
          // We have existing messages, load them
          setMessages(sessionMessages);
        }
      } catch (error) {
        console.error('Error loading user data and sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Animation effect for typing out assistant messages
  useEffect(() => {
    if (!typingMessageId) return;
    
    // Find the message that's currently being typed
    const messageIndex = messages.findIndex(msg => msg.id === typingMessageId);
    if (messageIndex === -1) return;
    
    const message = messages[messageIndex];
    if (!message.isTyping) return;
    
    const fullContent = message.content;
    const currentDisplay = message.displayedContent || '';
    
    // If we've already displayed the full content, stop typing
    if (currentDisplay === fullContent) {
      // Mark message as finished typing
      setMessages(prev => {
        const updated = [...prev];
        updated[messageIndex] = {
          ...updated[messageIndex],
          isTyping: false
        };
        return updated;
      });
      setTypingMessageId(null);
      return;
    }
    
    // Calculate next character to display
    const nextCharIndex = currentDisplay.length;
    const nextChar = fullContent.charAt(nextCharIndex);
    const updatedContent = currentDisplay + nextChar;
    
    // Update the displayed content with a timeout for typing effect
    const timeout = setTimeout(() => {
      setMessages(prev => {
        const updated = [...prev];
        updated[messageIndex] = {
          ...updated[messageIndex],
          displayedContent: updatedContent
        };
        return updated;
      });
    }, TYPING_SPEED_MS);
    
    return () => clearTimeout(timeout);
  }, [messages, typingMessageId]);

  // Handle changes to therapy preferences
  const handlePreferenceChange = async () => {
    if (!user || !currentSession) return;
    
    // Add a system message explaining the change
    const changeMessage: Message = {
      id: `system-${Date.now()}`,
      content: `I'll adjust my approach to be more ${communicationTone?.toLowerCase()} using a ${therapyStyle?.toLowerCase()} style with ${therapyModality} techniques. How does that sound?`,
      role: 'assistant',
      timestamp: new Date(),
      tags: ['preference-change'],
      isTyping: true,
      displayedContent: ''
    };
    
    // Add to UI
    setMessages(prev => [...prev, changeMessage]);
    
    // Save to Firestore
    await addTherapyMessage(user.id, currentSession.id, changeMessage);
    
    // Start typing animation for the change message
    setTimeout(() => {
      setTypingMessageId(changeMessage.id);
    }, TYPING_DELAY_MS);
    
    // Close the preferences panel
    setShowPreferences(false);
  };

  // Create a new Companion Session
  const handleNewSession = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Create new session
      const newSession = await createTherapySession(user.id, mbtiType);
      
      // Update sessions list
      setSessions(prev => [newSession, ...prev]);
      
      // Set as current session
      setCurrentSession(newSession);
      setSessionStage('initial');
      
      // Clear messages
      setMessages([]);
      
      // Add welcome message
      const welcomeMessage = getPersonalizedWelcome(mbtiType || "");
      
      const welcomeMsg: Message = {
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date(),
        tags: ['greeting'],
        isTyping: true,
        displayedContent: ''
      };
      
      setMessages([welcomeMsg]);
      
      // Save welcome message
      await addTherapyMessage(user.id, newSession.id, welcomeMsg);
      
      // Start typing animation
      setTimeout(() => {
        setTypingMessageId('welcome');
      }, TYPING_DELAY_MS);
      
      // Close session list if open
      setShowSessionList(false);
    } catch (error) {
      console.error('Error creating new session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load an existing session
  const handleLoadSession = async (sessionId: string) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Find session in our list
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;
      
      // Set as current session
      setCurrentSession(session);
      setSessionStage(session.sessionStage || 'initial');
      
      // Load messages
      const sessionMessages = await getTherapyMessages(user.id, sessionId);
      setMessages(sessionMessages);
      
      // Close session list
      setShowSessionList(false);
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // End the current session
  const handleEndSession = async () => {
    if (!user || !currentSession) return;
    
    try {
      setIsLoading(true);
      
      // Generate summary
      const summary = await generateSessionSummary(user.id, currentSession.id);
      
      // Update session status
      await updateTherapySession(user.id, currentSession.id, {
        status: 'completed',
        summary: summary.summary,
        insightsGained: summary.insights,
        topicsTags: summary.tags
      });
      
      // Add completion message
      const completionMessage: Message = {
        id: `completion-${Date.now()}`,
        content: `Thank you for our conversation today. I've summarized our key points:\n\n${summary.summary}\n\nInsights:\n${summary.insights.map(insight => `- ${insight}`).join('\n')}\n\nWe can continue in a new session whenever you're ready.`,
        role: 'assistant',
        timestamp: new Date(),
        tags: ['session-complete'],
        isTyping: true,
        displayedContent: ''
      };
      
      // Add to UI
      setMessages(prev => [...prev, completionMessage]);
      
      // Save to Firestore
      await addTherapyMessage(user.id, currentSession.id, completionMessage);
      
      // Start typing animation
      setTimeout(() => {
        setTypingMessageId(completionMessage.id);
      }, TYPING_DELAY_MS);
      
      // Refresh sessions list
      const userSessions = await getTherapySessions(user.id);
      setSessions(userSessions);
      
      // Create a new session after completion
      const newSession = await createTherapySession(user.id, mbtiType);
      setCurrentSession(newSession);
      setSessionStage('initial');
      setMessages([]);
      
      // Add welcome message for new session
      const welcomeMessage = getPersonalizedWelcome(mbtiType || "");
      
      const welcomeMsg: Message = {
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        timestamp: new Date(),
        tags: ['greeting'],
        isTyping: true,
        displayedContent: ''
      };
      
      setMessages([welcomeMsg]);
      
      // Save welcome message
      await addTherapyMessage(user.id, newSession.id, welcomeMsg);
      
      // Start typing animation
      setTimeout(() => {
        setTypingMessageId('welcome');
      }, TYPING_DELAY_MS);
    } catch (error) {
      console.error('Error ending session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit handler with typing animation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || typingMessageId !== null) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!user || !currentSession) {
        throw new Error("Missing user or session data");
      }

      // Save user message to Firestore first
      await addTherapyMessage(user.id, currentSession.id, userMessage);
      
      // Get chat history for context
      const chatHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.role
      }));
      
      // Process the message using therapy functions with current preferences and session stage
      const result = await processTherapyMessage(
        input,
        chatHistory,
        mbtiType,
        therapyStyle,
        therapyModality,
        communicationTone,
        sessionStage
      );
      
      // Update the session stage if provided in the result
      if (result.sessionStage) {
        const validStage = result.sessionStage as "initial" | "information_gathering" | "insight_providing" | "action_planning";
        setSessionStage(validStage);
        
        // Also update the session in Firestore
        if (currentSession) {
          await updateTherapySession(user.id, currentSession.id, {
            sessionStage: validStage
          });
        }
      }
      
      // Create assistant message with typing animation
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        content: result.response,
        role: 'assistant',
        timestamp: new Date(),
        tags: result.tags,
        isTyping: true,
        displayedContent: '' // Start with empty displayedContent for typing animation
      };
      
      // Add message to state
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save message to Firestore
      await addTherapyMessage(user.id, currentSession.id, assistantMessage);
      
      // Start typing animation after a short delay
      setTimeout(() => {
        setTypingMessageId(assistantMessageId);
      }, TYPING_DELAY_MS);
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: "I'm having trouble processing your request right now. Could you try again?",
        role: 'assistant',
        timestamp: new Date(),
        tags: ['error']
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md overflow-hidden relative font-sans">
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-full">
              <Bot className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Reflective AI Companion</h2>
              <p className="text-sm font-normal text-gray-500">Your safe space to reflect and grow</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAboutInfo(!showAboutInfo)}
              className="text-xs text-gray-500 hover:text-indigo-600 flex items-center bg-white rounded-md px-2 py-1 shadow-sm font-medium"
              title="About this space"
            >
              <Info className="h-3.5 w-3.5 mr-1" />
              <span>About</span>
            </button>
            <button 
              onClick={() => setShowPreferences(!showPreferences)}
              className="text-gray-500 hover:text-indigo-600 transition-colors bg-white p-2 rounded-full shadow-sm"
              title="Adjust therapy approach"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setShowSessionList(!showSessionList)}
              className="text-gray-500 hover:text-indigo-600 transition-colors bg-white p-2 rounded-full shadow-sm"
              title="Manage sessions"
            >
              <Clock className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* About/Information Panel */}
        {showAboutInfo && (
          <div className="mb-6 p-5 bg-white rounded-lg border border-indigo-100 shadow-sm relative">
            <button 
              onClick={() => setShowAboutInfo(false)}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-semibold text-indigo-800 mb-3 tracking-tight">About This AI Companion</h3>
            
            <div className="text-xs leading-relaxed space-y-3 text-gray-600">
              <p><strong>What this is:</strong> An AI-powered tool designed to help you reflect on thoughts and feelings in a supportive environment. The conversation adapts to your communication preferences and personality type.</p>
              
              <p><strong>What this is NOT:</strong> A replacement for professional therapy, medical advice, or crisis intervention. This AI companion cannot diagnose conditions or provide treatment.</p>
              
              <p><strong>Privacy:</strong> Your conversations are stored securely to provide continuity between sessions. You can start new sessions at any time.</p>
              
              <p><strong>When to seek professional help:</strong> If you're experiencing severe distress, thoughts of harming yourself or others, or ongoing symptoms affecting daily functioning, please contact a licensed mental health professional or crisis service.</p>
              
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-indigo-600 font-medium">Crisis Resources:</p>
                <p>National Suicide Prevention Lifeline: 1-800-273-8255</p>
                <p>Crisis Text Line: Text HOME to 741741</p>
                <p>International Association for Suicide Prevention: <a href="https://www.iasp.info/resources/Crisis_Centres/" className="text-indigo-600 underline">Crisis Centers</a></p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3 text-xs leading-relaxed text-gray-500 bg-white bg-opacity-60 rounded-md p-3">
          <p>Remember: This is a confidential space for reflection. I'm here to listen and support you.</p>
        </div>

        {/* Preferences Panel */}
        {showPreferences && (
          <div className="mb-6 p-5 bg-white rounded-lg border border-indigo-100 shadow-sm relative">
            <button 
              onClick={() => setShowPreferences(false)}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-semibold text-indigo-800 mb-4 tracking-tight">Personalize Your Therapy Experience</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Therapy Style Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Companion Style</label>
                <select
                  value={therapyStyle || ''}
                  onChange={(e) => setTherapyStyle(e.target.value)}
                  className="w-full text-sm p-2.5 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                >
                  {THERAPY_STYLES.map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>
              
              {/* Therapy Modality Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Therapeutic Approach</label>
                <select
                  value={therapyModality || ''}
                  onChange={(e) => setTherapyModality(e.target.value)}
                  className="w-full text-sm p-2.5 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                >
                  {THERAPY_MODALITIES.map(modality => (
                    <option key={modality} value={modality}>{modality}</option>
                  ))}
                </select>
              </div>
              
              {/* Communication Tone Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Communication Style</label>
                <select
                  value={communicationTone || ''}
                  onChange={(e) => setCommunicationTone(e.target.value)}
                  className="w-full text-sm p-2.5 border border-gray-200 rounded focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                >
                  {COMMUNICATION_TONES.map(tone => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-5 flex justify-end">
              <button
                onClick={handlePreferenceChange}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Apply Changes
              </button>
            </div>
            
            <div className="mt-3 text-xs leading-relaxed text-gray-500">
              <p>Personalize how the AI therapist communicates with you. These changes will apply to the next response.</p>
            </div>
          </div>
        )}

        {/* Session List Panel */}
        {showSessionList && (
          <div className="mb-6 p-5 bg-white rounded-lg border border-indigo-100 shadow-sm relative">
            <button 
              onClick={() => setShowSessionList(false)}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-semibold text-indigo-800 mb-4 tracking-tight">Manage Your Companion Sessions</h3>
            
            <div className="space-y-3">
              {sessions.map(session => (
                <div 
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-200"
                >
                  <div>
                    <h4 className="text-sm font-medium text-gray-800">{session.title || 'Untitled Session'}</h4>
                    <p className="text-xs text-gray-500">{new Date(session.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => handleLoadSession(session.id)}
                      className="text-indigo-600 hover:text-indigo-800 transition-colors"
                      title="Load session"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-5 flex justify-end">
              <button
                onClick={handleNewSession}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 transition-colors shadow-sm flex items-center space-x-2"
              >
                <PlusCircle className="h-4 w-4" />
                <span>New Session</span>
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="h-[500px] overflow-y-auto mb-6 space-y-5 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent rounded-lg bg-white bg-opacity-70 p-5 shadow-inner"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`p-1 rounded-full ${message.role === 'user' ? 'bg-indigo-500' : 'bg-indigo-100'}`}>
                    {message.role === 'user' ? (
                      <User className={`h-3 w-3 ${message.role === 'user' ? 'text-white' : 'text-indigo-600'}`} />
                    ) : (
                      <Bot className="h-3 w-3 text-indigo-600" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${message.role === 'user' ? 'text-indigo-100' : 'text-indigo-600'}`}>
                    {message.role === 'user' ? 'You' : 'Companion'}
                  </span>
                </div>
                <p className={`text-sm font-normal leading-relaxed tracking-normal ${message.role === 'user' ? 'text-white' : 'text-gray-700'}`}>
                  {message.isTyping ? message.displayedContent : message.content}
                  {message.isTyping && (
                    <span className="typing-cursor">|</span>
                  )}
                </p>
                {message.tags && message.tags.length > 0 && !message.isTyping && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          message.role === 'user'
                            ? 'bg-indigo-500 text-white'
                            : 'bg-indigo-50 text-indigo-600'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && !typingMessageId && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Empty state with suggestions */}
          {messages.length === 0 && !isLoading && (
            <div className="flex justify-center items-center h-full">
              <div className="text-center p-8 rounded-lg bg-white shadow-sm border border-indigo-100 max-w-md">
                <div className="bg-indigo-100 p-3 rounded-full inline-flex mb-4">
                  <Bot className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2 text-lg tracking-tight">Welcome to Your Safe Space</h3>
                <p className="text-gray-600 text-sm mb-6 leading-relaxed">This is a confidential environment where you can express your thoughts and feelings. How are you feeling today?</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button 
                    onClick={() => setInput("I've been feeling anxious lately and I'm not sure how to manage it")}
                    className="px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors border border-blue-100 font-medium"
                  >
                    Anxious
                  </button>
                  <button 
                    onClick={() => setInput("I'm struggling with stress and feeling overwhelmed by everything")}
                    className="px-4 py-2.5 bg-purple-50 text-purple-700 rounded-lg text-sm hover:bg-purple-100 transition-colors border border-purple-100 font-medium"
                  >
                    Stressed
                  </button>
                  <button 
                    onClick={() => setInput("I want to understand myself better and improve my emotional well-being")}
                    className="px-4 py-2.5 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100 transition-colors border border-green-100 font-medium"
                  >
                    Self-Discovery
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Express your thoughts here..."
              className="w-full pl-4 pr-12 py-3.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base font-normal"
              disabled={isLoading || typingMessageId !== null}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || typingMessageId !== null}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors ${
                isLoading || !input.trim() || typingMessageId !== null
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Send className="h-5 w-5" />
            </button>
          </form>

          {/* Current preferences indicator */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 justify-center">
            <span className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600 font-medium">{therapyStyle}</span>
            <span className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600 font-medium">{therapyModality}</span>
            <span className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600 font-medium">{communicationTone}</span>
            
            {/* Display current session info */}
            {currentSession && (
              <span className="px-2 py-1 bg-indigo-100 rounded-full text-xs text-indigo-600 font-medium">
                {sessionStage === 'initial' ? 'Beginning' : 
                 sessionStage === 'information_gathering' ? 'Exploring' :
                 sessionStage === 'insight_providing' ? 'Insights' : 'Action Steps'}
              </span>
            )}
          </div>
        </div>
        
        {/* Session controls */}
        {currentSession && (
          <div className="mt-4 flex justify-between text-xs">
            <div>
              <span className="text-gray-500">Session: </span>
              <span className="font-medium">{currentSession.title}</span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowSessionList(true)}
                className="text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Change Session
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={handleEndSession}
                className="text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                End Session
              </button>
            </div>
          </div>
        )}
        
        <div className="mt-4 text-xs leading-relaxed text-center text-gray-500 font-normal">
          <p>Remember, I'm an AI assistant, not a replacement for professional mental health support.</p>
        </div>
      </div>

      {/* Typography optimization styles */}
      <style>{`
        .font-sans {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          letter-spacing: -0.011em;
        }
        
        /* Optimize font rendering */
        p, input, button, select, option {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* Improved line height for therapy text */
        .leading-relaxed {
          line-height: 1.6;
        }
        
        /* Improved text display for therapeutic content */
        p {
          margin-bottom: 0.75rem;
        }
        
        p:last-child {
          margin-bottom: 0;
        }
        
        /* Styling for the typing cursor */
        .typing-cursor {
          display: inline-block;
          width: 0.5em;
          animation: blink 1s step-start infinite;
        }
        
        @keyframes blink {
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default TherapyChat;