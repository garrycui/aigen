import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { FlatList } from 'react-native';
import { MessageCircle, Sparkles } from 'lucide-react-native';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
// Import chat service and profiler (implement these in lib/chat/)
import { ChatService, ChatMessage, UserContext } from '../../lib/chat/chatService';
import { AudioChatService } from '../../lib/audio/AudioChatService';
import { AudioTranscript } from '../../lib/audio/AudioRecorder';
import { UserProfiler } from '../../lib/chat/userProfiler';
// Import chat components (implement these in components/chat/)
import ChatMessageComponent from '../../components/chat/ChatMessage';
import ChatInput from '../../components/chat/ChatInput';
import ChatHeader from './ChatHeader';
import ChatMessagesList from './ChatMessagesList';

// Enhanced ChatMessage interface to support audio
interface ExtendedChatMessage extends ChatMessage {
  audioUri?: string;
  transcript?: AudioTranscript;
  isAudioMessage?: boolean;
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
    saveUserInsights,
  } = useFirebase();

  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
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
    if (user) {
      initializeChat();
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (messages.length === 0) return;
      const { insights, suggestedQuestions } = await chatService.getUserInsightsAndSuggestions(messages);
      if (!cancelled) {
        setUserInsights(insights);
        setSuggestedQuestions(suggestedQuestions);
        if (messages.length > 0 && messages.length % 10 === 0) {
          if (insights) {
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
    // Inject "Try asking" system message every 5 user/assistant messages if there are suggested questions
    if (
      suggestedQuestions.length > 0 &&
      messages.length > 0 &&
      messages.filter(m => m.role === 'user' || m.role === 'assistant').length % 5 === 0
    ) {
      injectTryAskingMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (assessmentResult.success && assessmentResult.data?.length > 0) {
        const assessment = assessmentResult.data[0];
        setUserContext({
          mbtiType: assessment.mbti_type,
          aiPreference: assessment.ai_preference,
          communicationStyle: assessment.communication_style,
          learningPreference: assessment.learning_preference,
          emotionalState: assessment.emotional_state,
          supportNeeds: assessment.support_needs,
        });
      }
      const sessionsResult = await getChatSessions(user!.id);
      if (sessionsResult.success && sessionsResult.data?.length > 0) {
        const recentSession = sessionsResult.data
          .sort(
            (a: { updatedAt: string }, b: { updatedAt: string }) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
        setCurrentSessionId(recentSession.id);
        await loadChatMessages(recentSession.id);
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
      const sessionData = {
        userId: user!.id,
        title: 'New Chat',
        messages: [],
        userContext,
        summary: ''
      };
      const result = await saveChatSession(user!.id, sessionData);
      if (result.success) {
        setCurrentSessionId(result.data.id);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error creating new session:', error);
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
            isAudioMessage: msg.isAudioMessage || false
          }));
        setMessages(sortedMessages);
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  };

  const sendWelcomeMessage = () => {
    const welcomeMessage: ExtendedChatMessage = {
      id: `welcome-${Date.now()}`,
      content: `Hey there! 👋 I'm your AI companion, here to help you navigate this exciting world of artificial intelligence! 

Whether you're curious about AI, worried about changes, or ready to dive deep into new tech - I've got your back! 

What's on your mind today? 🤔`,
      role: 'assistant',
      timestamp: new Date().toISOString(),
      sentiment: 'positive',
      isAudioMessage: false
    };
    setMessages([welcomeMessage]);
    if (currentSessionId) {
      saveChatMessage(currentSessionId, welcomeMessage);
    }
  };

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!currentSessionId || !user) return;
    const userMessage: ExtendedChatMessage = {
      id: `user-${Date.now()}`,
      content: messageText,
      role: 'user',
      timestamp: new Date().toISOString(),
      isAudioMessage: false
    };

    // Add user message and "AI is thinking..." system message
    const thinkingMessage: ExtendedChatMessage = {
      id: `thinking-${Date.now()}`,
      content: "AI is thinking...",
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isAudioMessage: false
    };

    setMessages(prev => [...prev, userMessage, thinkingMessage]);
    setIsLoading(true);
    setIsTyping(true);

    // Scroll to end after sending
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      await saveChatMessage(currentSessionId, userMessage);

      const updatedHistory = [...messages, userMessage];
      const response = await chatService.generateResponse(
        messageText,
        updatedHistory,
        userContext || undefined
      );
      const allowedSentiments = ['positive', 'negative', 'neutral'] as const;
      const aiMessage: ExtendedChatMessage = {
        id: `ai-${Date.now()}`,
        content: response.response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: allowedSentiments.includes(response.sentiment as any)
          ? (response.sentiment as 'positive' | 'negative' | 'neutral')
          : undefined,
        isAudioMessage: false
      };

      // Replace "AI is thinking..." with actual AI message
      setMessages(prev => {
        const withoutThinking = prev.filter(m => !m.id.startsWith('thinking-'));
        return [...withoutThinking, aiMessage];
      });

      await saveChatMessage(currentSessionId, aiMessage);

      // Scroll to end after AI response
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ExtendedChatMessage = {
        id: `error-${Date.now()}`,
        content: "Oops! I had a little hiccup there. Could you try asking me again? 😅",
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: 'neutral',
        isAudioMessage: false
      };
      setMessages(prev => {
        const withoutThinking = prev.filter(m => !m.id.startsWith('thinking-'));
        return [...withoutThinking, errorMessage];
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [currentSessionId, user, messages, userContext, chatService, saveChatMessage]);

  const handleSendAudioMessage = useCallback(async (
    text: string,
    language?: string,
    audioUri?: string,
    transcript?: AudioTranscript
  ) => {
    if (!currentSessionId || !user) return;
    const userMessage: ExtendedChatMessage = {
      id: `user-audio-${Date.now()}`,
      content: text,
      role: 'user',
      timestamp: new Date().toISOString(),
      audioUri,
      transcript,
      isAudioMessage: true
    };
    const updatedHistory = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setIsTyping(true);
    try {
      await saveChatMessage(currentSessionId, userMessage);

      const audioResponse = await audioChatService.processAudioInput(
        audioUri || text,
        updatedHistory,
        userContext || undefined
      );
      const aiMessage: ExtendedChatMessage = {
        id: `ai-audio-${Date.now()}`,
        content: audioResponse.response.content,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: audioResponse.response.sentiment,
        isAudioMessage: true,
        transcript
      };
      setMessages(prev => [...prev, aiMessage]);
      await saveChatMessage(currentSessionId, aiMessage);
    } catch (error) {
      console.error('Error sending audio message:', error);
      const errorMessage: ExtendedChatMessage = {
        id: `error-audio-${Date.now()}`,
        content: "Oops! I had a little hiccup there. Could you try sending that audio message again? 😅",
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sentiment: 'neutral',
        isAudioMessage: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [currentSessionId, user, messages, userContext, audioChatService, saveChatMessage]);

  // Scroll to end when a new message is added
  useEffect(() => {
    if (!isInitializing && messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length, isInitializing]);

  // Only show the last N messages (e.g., 20)
  const LAST_N = 20;
  const visibleMessages = messages.slice(-LAST_N);

  // FlatList render function for messages
  const renderItem = useCallback(
    ({ item, index }: { item: ExtendedChatMessage; index: number }) => (
      <ChatMessagesList
        messages={[item]}
        suggestedQuestions={suggestedQuestions}
        onAskSuggested={handleSendMessage}
        isLatest={index === visibleMessages.length - 1}
      />
    ),
    [suggestedQuestions, handleSendMessage, visibleMessages.length]
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.gray[50] }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={{ flex: 1 }}>
        <ChatHeader isInitializing={isInitializing} />
        {isInitializing ? (
          <View style={{ alignItems: 'center', marginTop: theme.spacing[8] }}>
            <ActivityIndicator size="large" color={theme.colors.primary.main} />
            <Text style={{ color: theme.colors.gray[600], marginTop: theme.spacing[2] }}>
              Loading your chat...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={scrollViewRef}
            data={visibleMessages}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: theme.spacing[8], paddingVertical: theme.spacing[2] }}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )}
        <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.gray[200], backgroundColor: theme.colors.white }}>
          <ChatInput
            onSendMessage={handleSendMessage}
            onSendAudioMessage={handleSendAudioMessage}
            isLoading={isLoading || isTyping}
            inputValue={inputValue}
            setInputValue={setInputValue}
            placeholder="Type a message or use the mic..."
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
