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

export default function ChatScreen() {
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

  const scrollViewRef = useRef<FlatList>(null);
  const chatService = ChatService.getInstance();
  const audioChatService = AudioChatService.getInstance();

  useEffect(() => {
    if (user) initializeChat();
  }, [user]);

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

  const createNewSession = async () => {
    try {
      const session = await chatService.createChatSession(user!.id, userContext || undefined);
      const sessionData = { ...session, userId: user!.id, title: 'New Chat', userContext, summary: '' };
      const result = await saveChatSession(user!.id, sessionData);
      if (result.success) {
        const full = { ...session, id: result.data.id };
        setCurrentSession(full);
        setMessages([]);
      }
    } catch (e) {
      console.error('Error creating new session:', e);
    }
  };

  const loadChatMessages = async (sessionId: string) => {
    try {
      const result = await getChatMessages(sessionId);
      if (result.success) {
        const sortedMessages = result.data
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            timestamp: msg.createdAt,
            sentiment: msg.sentiment,
            audioUri: msg.audioUri,
            transcript: msg.transcript,
            isAudioMessage: msg.isAudioMessage,
          }));
        setMessages(sortedMessages);
      }
    } catch (e) {
      console.error('Error loading chat messages:', e);
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
      const { response, sentiment, threadId, runId } = await chatService.generateResponse(
        text,
        currentSession,
        userContext || undefined,
        personalization // <-- already passing full personalization
      );
      // If threadId changed, update session in Firebase and local state
      if (threadId && threadId !== currentSession.threadId) {
        await updateChatSession(currentSession.id, { threadId });
        setCurrentSession(prev => prev ? { ...prev, threadId } : prev);
      }
      // Remove "AI is thinking..." message
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
      const { response, sentiment, threadId, runId } = await chatService.generateResponse(
        text,
        currentSession,
        userContext || undefined,
        personalization // <-- already passing full personalization
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
      <ChatHeader session={currentSession} isLoading={isLoading || isInitializing} />
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
