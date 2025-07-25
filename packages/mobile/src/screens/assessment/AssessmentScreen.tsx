import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Bot, User } from 'lucide-react-native';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { chatQuestions, getNextQuestion, isAssessmentComplete } from '../../lib/assessment/questions';
import { generateAssessmentResult } from '../../lib/assessment/analyzer';
import AssessmentSummary from '../../components/assessment/AssessmentSummary';
import { AssessmentResult } from '../../lib/assessment/analyzer';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  options?: string[];
}

interface ChatAssessmentScreenProps {
  onComplete: () => void;
}

export default function ChatAssessmentScreen({ onComplete }: ChatAssessmentScreenProps) {
  const { user } = useAuth();
  const { saveAssessment, updateUserProfile } = useFirebase();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Start the assessment
    startAssessment();
  }, []);

  useEffect(() => {
    // Auto scroll to bottom when new messages are added
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const startAssessment = () => {
    const firstQuestion = getNextQuestion(null);
    if (firstQuestion) {
      addBotMessage(firstQuestion.text, firstQuestion.options);
      setCurrentQuestion(firstQuestion.id);
    }
  };

  const addBotMessage = (text: string, options?: string[]) => {
    const message: Message = {
      id: Date.now().toString(),
      text,
      isBot: true,
      timestamp: new Date(),
      options
    };
    setMessages(prev => [...prev, message]);
  };

  const addUserMessage = (text: string) => {
    const message: Message = {
      id: Date.now().toString(),
      text,
      isBot: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const handleOptionSelect = (option: string) => {
    if (!currentQuestion) return;

    // Add user response
    addUserMessage(option);
    
    // Store response
    const newResponses = { ...responses, [currentQuestion]: option };
    setResponses(newResponses);

    // Process next question
    setTimeout(() => {
      processNextQuestion(newResponses);
    }, 500);
  };

  const handleTextSubmit = () => {
    if (!inputText.trim() || !currentQuestion) return;

    // Add user response
    addUserMessage(inputText);
    
    // Store response
    const newResponses = { ...responses, [currentQuestion]: inputText };
    setResponses(newResponses);
    
    setInputText('');

    // Process next question
    setTimeout(() => {
      processNextQuestion(newResponses);
    }, 500);
  };

  const processNextQuestion = (currentResponses: Record<string, string>) => {
    const nextQuestion = getNextQuestion(currentQuestion);
    
    if (nextQuestion) {
      addBotMessage(nextQuestion.text, nextQuestion.options);
      setCurrentQuestion(nextQuestion.id);
    } else {
      // Assessment complete
      completeAssessment(currentResponses);
    }
  };

  const completeAssessment = async (finalResponses: Record<string, string>) => {
    if (!user) return;

    setIsLoading(true);
    addBotMessage("Thank you for completing the assessment! Let me analyze your responses...");

    try {
      const result = generateAssessmentResult(finalResponses);
      setAssessmentResult(result);
      
      // Save assessment to Firebase
      const assessmentData = {
        mbti_type: result.mbtiType,
        ai_preference: result.aiReadiness,
        responses: finalResponses,
        communication_style: result.communicationStyle,
        learning_preference: result.learningPreference,
        emotional_state: result.emotionalState,
        support_needs: result.supportNeeds,
        personalized_recommendations: result.personalizedRecommendations,
      };

      const saveResult = await saveAssessment(user.id, assessmentData);
      
      if (saveResult.success) {
        // Update user profile
        await updateUserProfile(user.id, {
          hasCompletedAssessment: true,
          mbtiType: result.mbtiType,
          aiPreference: result.aiReadiness,
          communicationStyle: result.communicationStyle,
          learningPreference: result.learningPreference,
          name: result.personalInfo.name || user.name
        });

        addBotMessage(
          `Perfect! I've analyzed your responses and created your personalized AI profile. Let me show you the results!`
        );

        setTimeout(() => {
          setShowSummary(true);
        }, 1500);
      } else {
        throw new Error(saveResult.error);
      }
    } catch (error) {
      console.error('Error completing assessment:', error);
      Alert.alert('Error', 'Failed to save assessment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummaryContinue = () => {
    onComplete();
  };

  const renderMessage = (message: Message) => (
    <View key={message.id} style={[
      styles.messageContainer,
      message.isBot ? styles.botMessageContainer : styles.userMessageContainer
    ]}>
      <View style={styles.messageHeader}>
        {message.isBot ? (
          <Bot size={20} color={theme.colors.primary.main} />
        ) : (
          <User size={20} color={theme.colors.gray[600]} />
        )}
        <Text style={styles.messageTime}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      
      <View style={[
        styles.messageBubble,
        message.isBot ? styles.botBubble : styles.userBubble
      ]}>
        <Text style={[
          styles.messageText,
          message.isBot ? styles.botText : styles.userText
        ]}>
          {message.text}
        </Text>
      </View>

      {message.options && (
        <View style={styles.optionsContainer}>
          {message.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.optionButton}
              onPress={() => handleOptionSelect(option)}
              disabled={isLoading}
            >
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const currentQuestionData = chatQuestions.find(q => q.id === currentQuestion);
  const showTextInput = currentQuestionData && !currentQuestionData.options;

  if (showSummary && assessmentResult) {
    return (
      <SafeAreaView style={styles.container}>
        <AssessmentSummary 
          result={assessmentResult} 
          onContinue={handleSummaryContinue}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Personality Assessment</Text>
        <Text style={styles.headerSubtitle}>Let's discover your AI personality together</Text>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(renderMessage)}
        </ScrollView>

        {showTextInput && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your response..."
              multiline
              maxLength={200}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={handleTextSubmit}
              disabled={!inputText.trim() || isLoading}
            >
              <Send size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  messageContainer: {
    marginBottom: theme.spacing.lg,
  },
  botMessageContainer: {
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  messageTime: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  botBubble: {
    backgroundColor: theme.colors.gray[100],
    borderBottomLeftRadius: theme.borderRadius.sm,
  },
  userBubble: {
    backgroundColor: theme.colors.primary.main,
    borderBottomRightRadius: theme.borderRadius.sm,
  },
  messageText: {
    ...theme.typography.body,
  },
  botText: {
    color: theme.colors.text,
  },
  userText: {
    color: theme.colors.white,
  },
  optionsContainer: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
    width: '100%',
  },
  optionButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  optionText: {
    ...theme.typography.body,
    color: theme.colors.primary.main,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginRight: theme.spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});