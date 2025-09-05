import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { FlatList } from 'react-native';
import { MessageCircle, Sparkles } from 'lucide-react-native';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { useInteractionTracking } from '../../hooks/useInteractionTracking';
import { useDynamicPersonalization } from '../../hooks/useDynamicPersonalization';
// Import chat service and profiler (implement these in lib/chat/)
import { ChatService, ChatMessage, UserContext, ChatSession } from '../../lib/chat/chatService';
import { SessionContext } from '../../lib/chat/sessionManager';
import { AudioChatService } from '../../lib/audio/AudioChatService';
import { AudioTranscript } from '../../lib/audio/AudioRecorder';

// Import chat components (implement these in components/chat/)
import ChatInput from '../../components/chat/ChatInput';
import ChatHeader from './ChatHeader';
import ChatMessagesList from './ChatMessagesList';

// Enhanced ChatMessage interface to support audio
interface ExtendedChatMessage extends ChatMessage {
  audioUri?: string;
  transcript?: AudioTranscript;
  isAudioMessage?: boolean;
  threadId?: string;
  runId?: string;
}

// Utility to remove undefined fields (keep in sync with FirebaseContext)
function removeUndefinedFields(obj: any): any {
  if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [k, v]) => {
      if (v !== undefined) acc[k] = removeUndefinedFields(v);
      return acc;
    }, {} as any);
  }
  return obj;
}

export default function ChatScreen({ route, navigation }: { route?: any; navigation?: any }) {
  const { user } = useAuth();
  const {
    getUserAssessment,
    saveChatSession,
    getChatSessions,
    updateChatSession,
    saveChatMessage,
    getChatMessages,
  } = useFirebase();

  const { personalization } = useDynamicPersonalization(user?.id || '');
  const { trackChatInteraction, trackAnalyticsResult } = useInteractionTracking(user?.id || '');

  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [userInsights, setUserInsights] = useState<any>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sessionTitle, setSessionTitle] = useState<string>('New Chat');
  const [shouldCreateNewSession, setShouldCreateNewSession] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);

  const scrollViewRef = useRef<FlatList>(null);
  const chatService = ChatService.getInstance();
  const audioChatService = AudioChatService.getInstance();

  useEffect(() => {
    if (user) {
      // Handle navigation params for session management
      const sessionId = route?.params?.sessionId;
      const newSession = route?.params?.newSession;
      
      if (newSession) {
        initializeNewChat();
      } else if (sessionId) {
        loadSpecificSession(sessionId);
      } else {
        initializeChat();
      }
    }
  }, [user, route?.params]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (messages.length === 0) return;
      // Run analytics after every 10 messages or as needed
      if (messages.length % 10 === 0) {
        setIsLoading(true);
        const analytics = await chatService.analyzeConversation(currentSession!, personalization);
        if (!cancelled) {
          setUserInsights(analytics.personalizationUpdates);
          setSuggestedQuestions(analytics.suggestedQuestions);
          // Track analytics result to update personalization
          trackAnalyticsResult({
            sessionId: currentSession!.id,
            summary: analytics.summary,
            permaInsights: analytics.permaInsights,
            personalizationUpdates: analytics.personalizationUpdates,
            messageCount: messages.length,
            timestamp: new Date().toISOString()
          });
        }
        setIsLoading(false);
      } else {
        const { insights, suggestedQuestions } = await chatService.getUserInsightsAndSuggestions(messages);
        if (!cancelled) {
          setUserInsights(insights);
          setSuggestedQuestions(suggestedQuestions);
          if (messages.length > 0 && messages.length % 10 === 0 && insights) {
            const summary = chatService.generateSummaryMessage
              ? chatService.generateSummaryMessage(insights)
              : `Summary: ${JSON.stringify(insights)}`;
            if (summary) {
              const summaryMsg: ExtendedChatMessage = {
                id: `summary-${Date.now()}`,
                content: summary,
                role: 'assistant',
                timestamp: new Date().toISOString(),
                sentiment: 'neutral',
                isAudioMessage: false
              };
              setMessages(prev => [...prev, summaryMsg]);
            }
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [messages]);

  useEffect(() => {
    if (
      suggestedQuestions.length > 0 &&
      messages.length > 0 &&
      messages.filter(m => m.role === 'user' || m.role === 'assistant').length % 5 === 0
    ) {
      injectTryAskingMessage();
    }
  }, [messages, suggestedQuestions]);

  // Monitor message count and auto-create new sessions
  useEffect(() => {
    if (currentSession && messages.length > 50) { // Limit sessions to 50 messages
      setShouldCreateNewSession(true);
    }
  }, [messages.length, currentSession]);

  // Auto-generate session title after 6 messages (3 exchanges)
  useEffect(() => {
    if (currentSession && messages.length === 6 && sessionTitle === 'New Chat') {
      generateSessionTitle();
    }
  }, [messages.length, currentSession, sessionTitle]);

  const injectTryAskingMessage = () => {
    if (messages.some(m => m.role === 'assistant' && m.id.startsWith('try-asking'))) return;
    const tryMsg: ExtendedChatMessage = {
      id: `try-asking-${Date.now()}`,
      content: '',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isAudioMessage: false,
      transcript: undefined,
      audioUri: undefined,
      sentiment: undefined
    };
    setMessages(prev => [...prev, tryMsg]);
  };

  const initializeChat = async () => {
    try {
      setIsInitializing(true);
      const assessmentResult = await getUserAssessment(user!.id);
      let assessment = null;
      if (assessmentResult.success && assessmentResult.data?.length > 0) {
        assessment = assessmentResult.data[0];
        setUserContext({
          mbtiType: assessment.mbti_type,
          aiPreference: assessment.ai_preference,
          communicationStyle: assessment.communication_style,
          learningPreference: assessment.learning_preference,
          emotionalState: assessment.emotional_state,
          supportNeeds: assessment.support_needs,
          perma: assessment.perma,
          interests: assessment.interests,
          name: assessment.nickname,
        });
      }

      const sessionsResult = await getChatSessions(user!.id);
      if (sessionsResult.success && sessionsResult.data?.length > 0) {
        const recent = sessionsResult.data
          .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        setCurrentSession(recent);
        setSessionTitle(recent.title || 'New Chat');
        await loadChatMessages(recent.id);
      } else {
        await createNewSession();
      }

      if (!sessionsResult.success || sessionsResult.data?.length === 0) {
        setTimeout(() => sendWelcomeMessage(), 1000);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to initialize chat. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  const loadSpecificSession = async (sessionId: string) => {
    try {
      setIsInitializing(true);
      const assessmentResult = await getUserAssessment(user!.id);
      let assessment = null;
      if (assessmentResult.success && assessmentResult.data?.length > 0) {
        assessment = assessmentResult.data[0];
        setUserContext({
          mbtiType: assessment.mbti_type,
          aiPreference: assessment.ai_preference,
          communicationStyle: assessment.communication_style,
          learningPreference: assessment.learning_preference,
          emotionalState: assessment.emotional_state,
          supportNeeds: assessment.support_needs,
          perma: assessment.perma,
          interests: assessment.interests,
          name: assessment.nickname,
        });
      }

      const sessionResult = await getChatSessions(user!.id);
      if (sessionResult.success) {
        const session = sessionResult.data.find((s: any) => s.id === sessionId);
        if (session) {
          setCurrentSession(session);
          setSessionTitle(session.title || 'New Chat');
          
          // Load chat messages for this specific session
          await loadChatMessages(session.id);
          
          // Build session context for continuation
          const getRecentSessionsWrapper = async (userId: string, limit: number): Promise<any[]> => {
            const result = await getChatSessions(userId);
            if (result.success && result.data) {
              return result.data.slice(0, limit);
            }
            return [];
          };
          
          try {
            const { sessionContext: ctx } = await chatService.createChatSession(
              user!.id, 
              userContext || undefined,
              getRecentSessionsWrapper,
              personalization
            );
            setSessionContext(ctx || null);
          } catch (error) {
            console.warn('Failed to build session context:', error);
            setSessionContext(null);
          }
        } else {
          Alert.alert('Error', 'Chat session not found');
          navigation?.goBack();
        }
      }
    } catch (error) {
      console.error('Error loading specific session:', error);
      Alert.alert('Error', 'Failed to load chat session');
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeNewChat = async () => {
    try {
      setIsInitializing(true);
      const assessmentResult = await getUserAssessment(user!.id);
      let assessment = null;
      if (assessmentResult.success && assessmentResult.data?.length > 0) {
        assessment = assessmentResult.data[0];
        setUserContext({
          mbtiType: assessment.mbti_type,
          aiPreference: assessment.ai_preference,
          communicationStyle: assessment.communication_style,
          learningPreference: assessment.learning_preference,
          emotionalState: assessment.emotional_state,
          supportNeeds: assessment.support_needs,
          perma: assessment.perma,
          interests: assessment.interests,
          name: assessment.nickname,
        });
      }
      await createNewSession();
      setSessionTitle('New Chat');
      setMessages([]);
      setTimeout(() => sendWelcomeMessage(), 1000);
    } catch (error) {
      console.error('Error initializing new chat:', error);
      Alert.alert('Error', 'Failed to initialize new chat');
    } finally {
      setIsInitializing(false);
    }
  };

  const createNewSession = async () => {
    try {
      // Create wrapper function that extracts data from FirebaseResponse
      const getRecentSessionsWrapper = async (userId: string, limit: number): Promise<any[]> => {
        const result = await getChatSessions(userId);
        if (result.success && result.data) {
          return result.data.slice(0, limit); // Return only the data array, limited to requested count
        }
        return [];
      };

      const { session, sessionContext: ctx } = await chatService.createChatSession(
        user!.id, 
        userContext || undefined,
        getRecentSessionsWrapper, // Pass wrapper function
        personalization
      );
      
      // Don't include the empty id in the session data sent to Firebase
      const sessionData = { 
        userId: user!.id,
        threadId: session.threadId,
        title: 'New Chat', 
        userContext, 
        summary: '',
        theme: 'General',
        messageCount: 0,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        archived: false
      };
      
      console.log('Creating new session with data:', sessionData);
      const result = await saveChatSession(user!.id, sessionData);
      
      if (result.success && result.data?.id) {
        // Now set the Firebase-generated ID on the session
        const fullSession = { 
          ...session, 
          id: result.data.id,
          ...sessionData // Include all the session data
        };
        
        console.log('Session created successfully with ID:', result.data.id);
        setCurrentSession(fullSession);
        setSessionContext(ctx || null);
        setMessages([]);
        setSessionTitle('New Chat');
      } else {
        console.error('Failed to create session:', result.error);
        throw new Error(result.error || 'Failed to create session');
      }
    } catch (e) {
      console.error('Error creating new session:', e);
      Alert.alert('Error', 'Failed to create new chat session');
    }
  };

  const generateSessionTitle = async () => {
    if (!currentSession || messages.length < 3) return;

    try {
      const recentMessages = messages.slice(0, 6).map(m => m.content).join(' ');
      const title = await chatService.generateSessionTitle(recentMessages);
      
      if (title && title !== sessionTitle) {
        setSessionTitle(title);
        await updateChatSession(currentSession.id, { title });
        setCurrentSession(prev => prev ? { ...prev, title } : prev);
      }
    } catch (error) {
      console.error('Error generating session title:', error);
    }
  };

  const handleSessionLimitReached = () => {
    Alert.alert(
      'Session Limit Reached',
      'This conversation is getting long. Would you like to start a new chat session?',
      [
        { text: 'Continue', style: 'cancel' },
        { 
          text: 'New Session', 
          onPress: () => {
            setShouldCreateNewSession(false);
            initializeNewChat();
          }
        }
      ]
    );
  };

  // Show session limit alert
  useEffect(() => {
    if (shouldCreateNewSession) {
      handleSessionLimitReached();
    }
  }, [shouldCreateNewSession]);

  const handleViewSessions = () => {
    navigation?.navigate('ChatSessions');
  };

  const loadChatMessages = async (sessionId: string) => {
    try {
      const result = await getChatMessages(sessionId);
      if (result.success && result.data) {
        const sortedMessages = result.data
          // Sort by createdAt timestamp to maintain chronological order
          .sort((a: any, b: any) => {
            const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
            return timeA - timeB; // Ascending order (oldest first)
          })
          .map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            timestamp: msg.createdAt || msg.timestamp,
            sentiment: msg.sentiment,
            audioUri: msg.audioUri,
            transcript: msg.transcript,
            isAudioMessage: msg.isAudioMessage || false,
            threadId: msg.threadId,
            runId: msg.runId,
          }));
        
        setMessages(sortedMessages);
        console.log(`Loaded ${sortedMessages.length} messages for session ${sessionId} in chronological order`);
        
        // Auto-scroll to bottom after loading messages
        setTimeout(() => {
          scrollViewRef?.current?.scrollToEnd({ animated: false });
        }, 100);
      } else {
        console.log('No messages found for session:', sessionId);
        setMessages([]);
      }
    } catch (e) {
      console.error('Error loading chat messages:', e);
      setMessages([]);
    }
  };

  const sendWelcomeMessage = () => {
    const welcomeMsg: ExtendedChatMessage = {
      id: `welcome-${Date.now()}`,
      content: "👋 Hi! I'm your AI companion. How can I help you today?",
      role: 'assistant',
      timestamp: new Date().toISOString(),
      sentiment: 'positive',
      isAudioMessage: false
    };
    setMessages([welcomeMsg]);
  };

  const handleSendMessage = async (text: string) => {
    if (!currentSession || !user) return;
    
    // Check if session should be closed before processing
    if (chatService.shouldCloseSession(currentSession)) {
      Alert.alert(
        'Session Complete',
        'This conversation has reached its natural end. Starting a new session with your conversation history as context.',
        [
          {
            text: 'Continue',
            onPress: async () => {
              await handleSessionTransition(text);
            }
          }
        ]
      );
      return;
    }

    setIsTyping(true);
    setIsLoading(true);

    const userMsg: ExtendedChatMessage = {
      id: `user-${Date.now()}`,
      content: text,
      role: 'user',
      timestamp: new Date().toISOString(),
      sentiment: ChatService.analyzeSentiment(text),
      isAudioMessage: false
    };
    
    setMessages(prev => [...prev, userMsg]);
    await saveChatMessage(currentSession.id, removeUndefinedFields(userMsg));

    // Update session message count
    const newMessageCount = (currentSession.messageCount || 0) + 2;
    await updateChatSession(currentSession.id, { 
      messageCount: newMessageCount,
      updatedAt: new Date().toISOString()
    });
    setCurrentSession(prev => prev ? { ...prev, messageCount: newMessageCount } : prev);

    // Track interaction
    trackChatInteraction({
      messageId: userMsg.id,
      userMessage: text,
      aiResponse: '',
      topics: [],
      sentiment: userMsg.sentiment || 'neutral',
      engagementLevel: 5,
      timestamp: userMsg.timestamp,
      threadId: currentSession.threadId,
    });

    // Show thinking message
    const thinkingMsg: ExtendedChatMessage = {
      id: `thinking-${Date.now()}`,
      content: 'AI is thinking...',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isAudioMessage: false
    };
    setMessages(prev => [...prev, thinkingMsg]);

    try {
      // Create wrapper function for updateChatSession
      const updateSessionWrapper = async (sessionId: string, updates: any): Promise<any> => {
        const result = await updateChatSession(sessionId, updates);
        return result; // Return the full result, but the sessionManager will handle it
      };

      const { response, sentiment, threadId, runId } = await chatService.generateResponse(
        text,
        currentSession,
        userContext || undefined,
        personalization,
        sessionContext || undefined, // Pass session context
        updateSessionWrapper // Pass wrapper function
      );
      
      // Handle threadId changes
      if (threadId && threadId !== currentSession.threadId) {
        await updateChatSession(currentSession.id, { threadId });
        setCurrentSession(prev => prev ? { ...prev, threadId } : prev);
      }
      
      // Remove thinking message and add AI response
      setMessages(prev => prev.filter(m => m.id !== thinkingMsg.id));
      
      const allowedSentiments = ['positive', 'negative', 'neutral'] as const;
      const safeSentiment = allowedSentiments.includes(sentiment as any) ? sentiment as 'positive' | 'negative' | 'neutral' : 'neutral';
      
      const aiMsg: ExtendedChatMessage = {
        id: `assistant-${Date.now()}`,
        content: response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: safeSentiment,
        isAudioMessage: false,
        threadId,
        runId
      };
      
      setMessages(prev => [...prev, aiMsg]);
      await saveChatMessage(currentSession.id, removeUndefinedFields(aiMsg));

      // Track AI response
      trackChatInteraction({
        messageId: aiMsg.id,
        userMessage: text,
        aiResponse: response,
        topics: [],
        sentiment: aiMsg.sentiment || 'neutral',
        engagementLevel: 5,
        timestamp: aiMsg.timestamp,
        threadId,
        runId
      });
      
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== thinkingMsg.id));
      Alert.alert('Error', 'Failed to get AI response.');
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  const handleSessionTransition = async (pendingMessage: string) => {
    try {
      // Close current session and create summary
      if (currentSession) {
        // Create wrapper function for updateChatSession for session closing
        const updateSessionWrapper = async (sessionId: string, updates: any): Promise<any> => {
          const result = await updateChatSession(sessionId, updates);
          return result;
        };

        await chatService.closeSession(currentSession, updateSessionWrapper);
      }
      
      // Create new session with context
      await createNewSession();
      
      // Send the pending message to new session
      setTimeout(() => {
        if (pendingMessage) {
          handleSendMessage(pendingMessage);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error during session transition:', error);
      Alert.alert('Error', 'Failed to transition to new session');
    }
  };

  const handleSendAudioMessage = async (
    text: string,
    language?: string,
    audioUri?: string,
    transcript?: AudioTranscript
  ) => {
    if (!currentSession || !user) return;
    setIsTyping(true);
    setIsLoading(true);

    const userMsg: ExtendedChatMessage = {
      id: `user-audio-${Date.now()}`,
      content: text,
      role: 'user',
      timestamp: new Date().toISOString(),
      sentiment: ChatService.analyzeSentiment(text),
      isAudioMessage: true,
      audioUri,
      transcript
    };
    setMessages(prev => [...prev, userMsg]);
    await saveChatMessage(currentSession.id, removeUndefinedFields(userMsg));

    // Update session message count
    const newMessageCount = (currentSession.messageCount || 0) + 2; // User + AI message
    await updateChatSession(currentSession.id, { 
      messageCount: newMessageCount,
      updatedAt: new Date().toISOString()
    });
    setCurrentSession(prev => prev ? { ...prev, messageCount: newMessageCount } : prev);

    // Track chat interaction
    trackChatInteraction({
      messageId: userMsg.id,
      userMessage: text,
      aiResponse: '',
      topics: [],
      sentiment: userMsg.sentiment || 'neutral',
      engagementLevel: 5,
      timestamp: userMsg.timestamp,
      threadId: currentSession.threadId,
    });

    // Show "AI is thinking..." message
    const thinkingMsg: ExtendedChatMessage = {
      id: `thinking-${Date.now()}`,
      content: 'AI is thinking...',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isAudioMessage: false
    };
    setMessages(prev => [...prev, thinkingMsg]);

    try {
      // Create wrapper function for updateChatSession
      const updateSessionWrapper = async (sessionId: string, updates: any): Promise<any> => {
        const result = await updateChatSession(sessionId, updates);
        return result;
      };

      const { response, sentiment, threadId, runId } = await chatService.generateResponse(
        text,
        currentSession,
        userContext || undefined,
        personalization,
        sessionContext || undefined, // Pass session context
        updateSessionWrapper // Pass wrapper function
      );
      
      // If threadId changed, update session in Firebase and local state
      if (threadId && threadId !== currentSession.threadId) {
        await updateChatSession(currentSession.id, { threadId });
        setCurrentSession(prev => prev ? { ...prev, threadId } : prev);
      }
      setMessages(prev => prev.filter(m => m.id !== thinkingMsg.id));
      // Ensure sentiment is one of the allowed values
      const allowedSentiments = ['positive', 'negative', 'neutral'] as const;
      const safeSentiment = allowedSentiments.includes(sentiment as any) ? sentiment as 'positive' | 'negative' | 'neutral' : 'neutral';
      const aiMsg: ExtendedChatMessage = {
        id: `assistant-${Date.now()}`,
        content: response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: safeSentiment,
        isAudioMessage: false,
        threadId,
        runId
      };
      setMessages(prev => [...prev, aiMsg]);
      await saveChatMessage(currentSession.id, removeUndefinedFields(aiMsg));

      // Track chat interaction with AI response
      trackChatInteraction({
        messageId: aiMsg.id,
        userMessage: text,
        aiResponse: response,
        topics: [],
        sentiment: aiMsg.sentiment || 'neutral',
        engagementLevel: 5,
        timestamp: aiMsg.timestamp,
        threadId,
        runId
      });
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== thinkingMsg.id));
      Alert.alert('Error', 'Failed to get AI response.');
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  const handleAskSuggested = (q: string) => {
    setInputValue(q);
  };

  // UI rendering
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.gray[50] }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ChatHeader 
        session={currentSession} 
        sessionTitle={sessionTitle}
        isLoading={isLoading || isInitializing}
        onViewSessions={handleViewSessions}
        onNewSession={initializeNewChat}
      />
      <View style={{ flex: 1 }}>
        <ChatMessagesList
          messages={messages}
          suggestedQuestions={suggestedQuestions}
          onAskSuggested={handleAskSuggested}
          scrollViewRef={scrollViewRef}
        />
        {(isLoading || isInitializing) && (
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <ActivityIndicator size="small" color={theme.colors.primary.main} />
          </View>
        )}
      </View>
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendAudioMessage={handleSendAudioMessage}
        isLoading={isLoading || isTyping}
        inputValue={inputValue}
        setInputValue={setInputValue}
      />
    </KeyboardAvoidingView>
  );
}
