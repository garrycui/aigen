import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { FlatList } from 'react-native';
import { MessageCircle, Sparkles } from 'lucide-react-native';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { useInteractionTracking } from '../../hooks/useInteractionTracking';
import { useUnifiedPersonalization } from '../../hooks/useUnifiedPersonalization'; // UPDATED: Replace useDynamicPersonalization

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

  // UPDATED: Use unified personalization instead of dynamic
  const { profile: personalization, loading: personalizationLoading } = useUnifiedPersonalization(user?.id || '');
  const { trackChatInteraction, trackAnalyticsResult, trackTopicEngagement } = useInteractionTracking(user?.id || '');

  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [userInsights, setUserInsights] = useState<any>(null);
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
        const { insights } = await chatService.getUserInsightsAndSuggestions(messages);
        if (!cancelled) {
          setUserInsights(insights);
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

  const initializeChat = async () => {
    try {
      setIsInitializing(true);
      
      // UPDATED: Use unified personalization profile instead of assessment
      if (personalization) {
        const userContext = buildUserContextFromProfile(personalization);
        setUserContext(userContext);
      } else {
        console.log('No personalization profile found, user may need to complete assessment');
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
      content: `👋 **Hi there!** I'm your AI happiness companion. 

I'm here to help you discover what brings you joy and support your wellbeing journey.

**What would you like to explore today?**
- Share what's on your mind
- Ask about building happiness habits  
- Discuss your goals and dreams
- Or just chat about anything! 😊`,
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

    // Show thinking message with better formatting
    const thinkingMsg: ExtendedChatMessage = {
      id: `thinking-${Date.now()}`,
      content: 'AI is thinking...',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isAudioMessage: false
    };
    setMessages(prev => [...prev, thinkingMsg]);

    try {
      const updateSessionWrapper = async (sessionId: string, updates: any): Promise<any> => {
        const result = await updateChatSession(sessionId, updates);
        return result;
      };

      const { response, sentiment, threadId, runId } = await chatService.generateResponse(
        text,
        currentSession,
        userContext || undefined,
        personalization,
        sessionContext || undefined,
        updateSessionWrapper
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
        content: response, // Response is already formatted by chatService.postProcessResponse
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: safeSentiment,
        isAudioMessage: false,
        threadId,
        runId
      };
      
      setMessages(prev => [...prev, aiMsg]);
      await saveChatMessage(currentSession.id, removeUndefinedFields(aiMsg));

      // Enhanced tracking with happiness focus
      trackChatInteraction({
        messageId: aiMsg.id,
        userMessage: text,
        aiResponse: response,
        topics: extractTopicsFromMessage(text, response),
        sentiment: aiMsg.sentiment || 'neutral',
        engagementLevel: calculateEngagementLevel(text, response),
        timestamp: aiMsg.timestamp,
        threadId,
        runId,
        permaSignals: mapResponseToPermaSignals(response)
      });
      
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== thinkingMsg.id));
      
      // Better error message with formatting
      const errorMsg: ExtendedChatMessage = {
        id: `error-${Date.now()}`,
        content: `I apologize, but I'm having some technical difficulties right now. 

**Please try asking your question again** - I'm here to help! 🤖

*If the issue persists, you can try starting a new conversation.*`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: 'neutral',
        isAudioMessage: false
      };
      
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  // Enhanced topic extraction for happiness focus
  const extractTopicsFromMessage = (userMessage: string, aiResponse: string): string[] => {
    const topics: string[] = [];
    const combinedText = `${userMessage} ${aiResponse}`.toLowerCase();
    
    // Check against user's primary interests and happiness sources
    if (personalization?.contentPreferences?.primaryInterests) {
      personalization.contentPreferences.primaryInterests.forEach(interest => {
        if (combinedText.includes(interest.toLowerCase())) {
          topics.push(interest);
          trackTopicEngagement({
            topic: interest,
            engagementScore: 8,
            interactionType: 'mention',
            context: `Interest mentioned: "${userMessage.slice(0, 100)}..."`
          });
        }
      });
    }
    
    // Check against happiness sources
    if (personalization?.wellnessProfile?.happinessSources) {
      personalization.wellnessProfile.happinessSources.forEach(source => {
        const sourceKeywords = source.toLowerCase().split(' ');
        if (sourceKeywords.some(keyword => combinedText.includes(keyword))) {
          topics.push(source);
          trackTopicEngagement({
            topic: source,
            engagementScore: 9,
            interactionType: 'followup',
            context: `Happiness source discussed: "${userMessage.slice(0, 100)}..."`
          });
        }
      });
    }
    
    // Enhanced happiness-focused topic detection
    const happinessTopicKeywords = [
      { keywords: ['happy', 'happiness', 'joy', 'joyful', 'delight'], topic: 'happiness-building' },
      { keywords: ['grateful', 'gratitude', 'thankful', 'appreciate'], topic: 'gratitude-practice' },
      { keywords: ['goal', 'achievement', 'accomplish', 'success'], topic: 'goal-achievement' },
      { keywords: ['relationship', 'friend', 'family', 'love', 'connect'], topic: 'relationships' },
      { keywords: ['mindful', 'meditation', 'peaceful', 'calm'], topic: 'mindfulness' },
      { keywords: ['creative', 'art', 'music', 'write', 'express'], topic: 'creative-expression' },
      { keywords: ['health', 'wellness', 'exercise', 'energy'], topic: 'physical-wellbeing' },
      { keywords: ['learn', 'grow', 'develop', 'improve'], topic: 'personal-growth' },
      { keywords: ['meaning', 'purpose', 'values', 'significant'], topic: 'life-meaning' },
      { keywords: ['flow', 'engaged', 'absorbed', 'passionate'], topic: 'engagement' }
    ];
    
    happinessTopicKeywords.forEach(({ keywords, topic }) => {
      const mentioned = keywords.some(keyword => combinedText.includes(keyword));
      if (mentioned && !topics.includes(topic)) {
        topics.push(topic);
        trackTopicEngagement({
          topic,
          engagementScore: 7,
          interactionType: 'mention',
          context: `Happiness topic discovered: "${userMessage.slice(0, 100)}..."`
        });
      }
    });
    
    return [...new Set(topics)];
  };

  // Enhanced engagement calculation for happiness focus
  const calculateEngagementLevel = (userMessage: string, aiResponse: string): number => {
    let score = 5; // Base score
    
    // Boost for emotional expression and happiness indicators
    const happinessWords = ['happy', 'joy', 'excited', 'grateful', 'love', 'amazing', 'wonderful'];
    const emotionalWords = ['feel', 'emotion', 'heart', 'soul', 'passion', 'dream'];
    const growthWords = ['learn', 'grow', 'improve', 'better', 'progress', 'develop'];
    
    if (happinessWords.some(word => userMessage.toLowerCase().includes(word))) {
      score += 3; // High boost for happiness expressions
    }
    
    if (emotionalWords.some(word => userMessage.toLowerCase().includes(word))) {
      score += 2; // Emotional engagement
    }
    
    if (growthWords.some(word => userMessage.toLowerCase().includes(word))) {
      score += 2; // Growth mindset
    }
    
    // Length and question indicators
    if (userMessage.length > 50) score += 1;
    if (userMessage.includes('?')) score += 1;
    if (aiResponse.length > 100) score += 1;
    
    // Future-focused and action-oriented language
    const actionWords = ['will', 'going to', 'plan', 'want to', 'hope to', 'excited to'];
    if (actionWords.some(word => userMessage.toLowerCase().includes(word))) {
      score += 2;
    }
    
    return Math.min(10, Math.max(1, score));
  };

  // Enhanced PERMA signal mapping with happiness focus
  const mapResponseToPermaSignals = (response: string): Record<string, number> => {
    const signals: Record<string, number> = {};
    const responseLower = response.toLowerCase();
    
    const permaIndicators = {
      positiveEmotion: ['joy', 'happy', 'positive', 'grateful', 'optimistic', 'delight', 'wonderful', 'amazing', 'love', 'excited'],
      engagement: ['engage', 'flow', 'passionate', 'absorbed', 'focus', 'immersed', 'energy', 'enthusiasm'],
      relationships: ['connect', 'relationship', 'friend', 'family', 'social', 'love', 'support', 'together', 'bond'],
      meaning: ['purpose', 'meaning', 'values', 'significant', 'meaningful', 'worthwhile', 'important', 'matter'],
      accomplishment: ['achieve', 'success', 'accomplish', 'goal', 'progress', 'proud', 'victory', 'complete', 'mastery']
    };
    
    Object.entries(permaIndicators).forEach(([dimension, keywords]) => {
      const matches = keywords.filter(keyword => responseLower.includes(keyword)).length;
      if (matches > 0) {
        signals[dimension] = Math.min(3, matches);
      }
    });
    
    return signals;
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
        topics: extractTopicsFromMessage(text, response), // NEW: Extract topics
        sentiment: aiMsg.sentiment || 'neutral',
        engagementLevel: calculateEngagementLevel(text, response), // NEW: Calculate engagement
        timestamp: aiMsg.timestamp,
        threadId,
        runId,
        permaSignals: mapResponseToPermaSignals(response) // NEW: Map to PERMA
      });
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== thinkingMsg.id));
      Alert.alert('Error', 'Failed to get AI response.');
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  // UPDATED: Build UserContext from UnifiedPersonalizationProfile
  const buildUserContextFromProfile = (profile: any) => {
    if (!profile) return null;
    
    return {
      mbtiType: profile.userCore?.mbtiType,
      communicationStyle: profile.userCore?.communicationStyle,
      learningPreference: profile.userCore?.learningStyle,
      emotionalState: profile.computed?.needsAttention?.length > 0 ? 'needs_support' : 'stable',
      supportNeeds: profile.wellnessProfile?.focusAreas?.join(', '),
      perma: profile.wellnessProfile?.currentScores,
      interests: profile.contentPreferences?.primaryInterests,
      name: user?.name || 'User',
      // NEW: Add wellness context
      wellnessFocus: profile.wellnessProfile?.focusAreas,
      happinessSources: profile.wellnessProfile?.happinessSources,
      currentMood: profile.computed?.overallHappiness
    };
  };

  // UI rendering with enhanced messaging
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
        userPersonalization={personalization}
      />
    </KeyboardAvoidingView>
  );
}
