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
import Slider from '@react-native-community/slider';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { useNavigation } from '@react-navigation/native';
import { chatQuestions, getNextQuestion, isAssessmentComplete } from '../../lib/assessment/questions';
import { generateAssessmentResult } from '../../lib/assessment/analyzer';
import AssessmentSummary from '../../components/assessment/AssessmentSummary';
import { AssessmentResult } from '../../lib/assessment/analyzer';

const MBTI_TYPES = [
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'
];

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  options?: string[];
}

export default function AssessmentScreen() {
  const { user } = useAuth();
  const { saveAssessment, updateUserProfile } = useFirebase();
  const navigation = useNavigation<any>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [questionHistory, setQuestionHistory] = useState<string[]>([]);
  const [mbtiSkip, setMbtiSkip] = useState(false);
  const [awaitingMbtiRetry, setAwaitingMbtiRetry] = useState(false);
  const [mbtiInvalidOptions, setMbtiInvalidOptions] = useState<string[] | null>(null);
  const [mbtiInvalidCount, setMbtiInvalidCount] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Add a message counter for unique keys
  const messageCounterRef = useRef(0);

  const isFirstTextInput =
    currentQuestion === chatQuestions[0]?.id &&
    chatQuestions[0]?.type === 'text';

  useEffect(() => {
    startAssessment();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const startAssessment = () => {
    const firstQuestion = chatQuestions[0];
    if (firstQuestion) {
      setMessages([
        {
          id: Date.now().toString(),
          text: firstQuestion.text,
          isBot: true,
          timestamp: new Date(),
        }
      ]);
      setCurrentQuestion(firstQuestion.id);
      setQuestionHistory([firstQuestion.id]);
    }
  };

  const addBotMessage = (text: string, options?: string[]) => {
    messageCounterRef.current += 1;
    const message: Message = {
      id: `${Date.now()}_${messageCounterRef.current}`,
      text,
      isBot: true,
      timestamp: new Date(),
      options
    };
    setMessages(prev => [...prev, message]);
  };

  const addUserMessage = (text: string) => {
    messageCounterRef.current += 1;
    const message: Message = {
      id: `${Date.now()}_${messageCounterRef.current}`,
      text,
      isBot: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const getCurrentQuestionObj = () =>
    chatQuestions.find(q => q.id === currentQuestion);

  const getNextQuestionSmart = (currentQuestionId: string | null): any => {
    let idx = chatQuestions.findIndex(q => q.id === currentQuestionId);
    let nextIdx = idx + 1;
    while (nextIdx < chatQuestions.length) {
      const q = chatQuestions[nextIdx];
      if (
        mbtiSkip &&
        ['mbti_ei', 'mbti_sn', 'mbti_tf', 'mbti_jp'].includes(q.id)
      ) {
        nextIdx++;
        continue;
      }
      return q;
    }
    return null;
  };

  const handleOptionSelect = (option: string) => {
    if (!currentQuestion) return;
    const currentQuestionData = getCurrentQuestionObj();

    addUserMessage(option);

    const newResponses = { ...responses, [currentQuestion]: option };
    setResponses(newResponses);

    if (currentQuestion === 'mbti_know') {
      if (option === "Yes, I know my MBTI type") {
        setMbtiSkip(true);
        setTimeout(() => {
          addBotMessage(chatQuestions.find(q => q.id === 'mbti_input')?.text || '');
          setCurrentQuestion('mbti_input');
          setQuestionHistory(prev => [...prev, 'mbti_input']);
        }, 500);
        return;
      } else if (option === "No, I'm not sure") {
        setMbtiSkip(false);
        setTimeout(() => {
          addBotMessage(chatQuestions.find(q => q.id === 'mbti_ei')?.text || '');
          setCurrentQuestion('mbti_ei');
          setQuestionHistory(prev => [...prev, 'mbti_ei']);
        }, 500);
        return;
      }
    }

    // Handle MBTI retry options
    if (currentQuestion === 'mbti_input_invalid') {
      setMbtiInvalidOptions(null);
      if (option === 'Retry') {
        // Ask for MBTI input again
        setTimeout(() => {
          addBotMessage(chatQuestions.find(q => q.id === 'mbti_input')?.text || '');
          setCurrentQuestion('mbti_input');
          setQuestionHistory(prev => [...prev, 'mbti_input']);
        }, 300);
        return;
      } else if (option === "I don't know, ask me instead") {
        setMbtiSkip(false);
        // Go to first MBTI question (mbti_ei)
        setTimeout(() => {
          addBotMessage(chatQuestions.find(q => q.id === 'mbti_ei')?.text || '');
          setCurrentQuestion('mbti_ei');
          setQuestionHistory(prev => [...prev, 'mbti_ei']);
        }, 300);
        return;
      }
    }

    setTimeout(() => {
      processNextQuestionSmart(newResponses);
    }, 500);
  };

  const handleSliderSubmit = (value: number) => {
    if (!currentQuestion) return;
    addUserMessage(value.toString());
    const newResponses = { ...responses, [currentQuestion]: value.toString() };
    setResponses(newResponses);
        setTimeout(() => {
      processNextQuestionSmart(newResponses);
    }, 500);
  };

  const handleMultiSubmit = () => {
    if (!currentQuestion) return;
    const selected = responses[currentQuestion];
    if (!selected || !Array.isArray(selected) || selected.length === 0) return;
    addUserMessage((selected as string[]).join(', '));
    const newResponses = { ...responses };
    setResponses(newResponses);
    setTimeout(() => {
      processNextQuestionSmart(newResponses);
    }, 500);
  };

  const handleTextSubmit = () => {
    if (!inputText.trim() || !currentQuestion) return;
    const currentQuestionData = getCurrentQuestionObj();

    if (currentQuestion === 'mbti_input') {
      const mbti = inputText.trim().toUpperCase();
      if (!MBTI_TYPES.includes(mbti)) {
        addUserMessage(inputText);
        setInputText('');
        setMbtiInvalidCount(prev => prev + 1);

        setTimeout(() => {
          addBotMessage(
            "Sorry, that doesn't look like a valid MBTI type. Please check your input."
          );
        }, 300);

        setTimeout(() => {
          if (mbtiInvalidCount < 1) {
            // First invalid: ask again with a helpful hint, no "Great!"
            addBotMessage(
              "Please enter your MBTI type (e.g. INTJ, ENFP). It should be 4 letters, like INFP or ESTJ."
            );
            setCurrentQuestion('mbti_input');
            setQuestionHistory(prev => [...prev, 'mbti_input']);
          } else {
            // After 2 invalid attempts, proceed to MBTI questions
            addBotMessage("Let's figure out your MBTI together!");
            setMbtiSkip(false);
            addBotMessage(chatQuestions.find(q => q.id === 'mbti_ei')?.text || '');
            setCurrentQuestion('mbti_ei');
            setQuestionHistory(prev => [...prev, 'mbti_ei']);
          }
        }, 900);
        return;
      }
      setMbtiSkip(true);
    }

    addUserMessage(inputText);

    const newResponses = { ...responses, [currentQuestion]: inputText };
    setResponses(newResponses);
    setInputText('');

    setTimeout(() => {
      processNextQuestionSmart(newResponses);
    }, 500);
  };

  const processNextQuestionSmart = (currentResponses: Record<string, string | string[]>) => {
    const nextQuestion = getNextQuestionSmart(currentQuestion);
    if (nextQuestion) {
      addBotMessage(nextQuestion.text, nextQuestion.options);
      setCurrentQuestion(nextQuestion.id);
      setQuestionHistory(prev => [...prev, nextQuestion.id]);
    } else {
      completeAssessment(currentResponses);
    }
  };

  const handleBack = () => {
    if (questionHistory.length <= 1) return;
    const prevHistory = [...questionHistory];
    prevHistory.pop();
    const prevQuestionId = prevHistory[prevHistory.length - 1];
    setCurrentQuestion(prevQuestionId);
    setQuestionHistory(prevHistory);
    setMessages(messages.slice(0, -2));
    setResponses(prev => {
      const newResp = { ...prev };
      delete newResp[questionHistory[questionHistory.length - 1]];
      return newResp;
    });
  };

  const completeAssessment = async (finalResponses: Record<string, string | string[]>) => {
    if (!user) return;
    setIsLoading(true);
    addBotMessage("Thank you for completing the assessment! Let me analyze your responses...");
    try {
      const result = generateAssessmentResult(finalResponses);
      setAssessmentResult(result);
      const assessmentData = {
        mbti_type: result.mbtiType,
        perma: result.happinessScores,
        nickname: result.personalInfo.name,
        interests: result.interests,
        primary_goal: result.personalInfo.primaryGoal,
        createdAt: new Date(),
      };
      const saveResult = await saveAssessment(user.id, assessmentData);
      if (saveResult.success) {
        await updateUserProfile(user.id, {
          hasCompletedAssessment: true,
          mbtiType: result.mbtiType,
          name: result.personalInfo.name || user.name,
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
    navigation.goBack();
  };

  const renderCurrentInput = () => {
    const question = getCurrentQuestionObj();
    if (!question) return null;

    let inputComponent = null;

    if (currentQuestion === 'mbti_input_invalid') {
      inputComponent = (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => handleOptionSelect('Retry')}
            disabled={isLoading}
          >
            <Text style={styles.optionText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => handleOptionSelect("I don't know, ask me instead")}
            disabled={isLoading}
          >
            <Text style={styles.optionText}>I don't know, ask me instead</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (question.type === 'slider') {
      // ...existing slider code...
      inputComponent = (
        <View style={styles.sliderContainer}>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>{Number(question.options?.[0] ?? 0)}</Text>
            <Text style={styles.sliderValueMid}>{Number(responses[question.id] ?? question.options?.[0] ?? 0)}</Text>
            <Text style={styles.sliderLabel}>{Number(question.options?.[1] ?? 10)}</Text>
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={Number(question.options?.[0] ?? 0)}
            maximumValue={Number(question.options?.[1] ?? 10)}
            step={1}
            value={Number(responses[question.id] ?? question.options?.[0] ?? 0)}
            minimumTrackTintColor={theme.colors.primary.main}
            maximumTrackTintColor={theme.colors.gray[300]}
            thumbTintColor={theme.colors.primary.main}
            onSlidingComplete={handleSliderSubmit}
            disabled={isLoading}
          />
          <Text style={styles.sliderValueText}>
            Your happiness score: <Text style={styles.sliderValueMid}>{Number(responses[question.id] ?? question.options?.[0] ?? 0)}</Text> / {Number(question.options?.[1] ?? 10)}
          </Text>
        </View>
      );
    } else if (question.type === 'single') {
      inputComponent = (
        <View style={styles.optionsContainer}>
          {question.options?.map((option, index) => (
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
      );
    } else if (question.type === 'multi') {
      inputComponent = (
        <View style={[styles.optionsContainer, { flexWrap: 'wrap', flexDirection: 'row' }]}>
          {question.options?.map((option, idx) => {
            const selected = Array.isArray(responses[question.id]) && (responses[question.id] as string[]).includes(option);
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.optionButton,
                  selected && { backgroundColor: theme.colors.primary.main, borderColor: theme.colors.primary.main }
                ]}
                onPress={() => {
                  const prev = Array.isArray(responses[question.id]) ? responses[question.id] as string[] : [];
                  let newArr: string[];
                  if (prev.includes(option)) {
                    newArr = prev.filter(o => o !== option);
                  } else {
                    newArr = [...prev, option];
                  }
                  setResponses({ ...responses, [question.id]: newArr });
                }}
                disabled={isLoading}
              >
                <Text style={[
                  styles.optionText,
                  selected && { color: theme.colors.white }
                ]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!Array.isArray(responses[question.id]) || (responses[question.id] as string[]).length === 0 || isLoading) && styles.sendButtonDisabled,
              { marginTop: theme.spacing.md }
            ]}
            onPress={handleMultiSubmit}
            disabled={!Array.isArray(responses[question.id]) || (responses[question.id] as string[]).length === 0 || isLoading}
          >
            <Text style={{ color: theme.colors.white, fontWeight: '600' }}>Submit</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (question.type === 'text') {
      inputComponent = (
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
      );
    }

    // Always show Back button below input if not first question
    return (
      <View>
        {inputComponent}
        {questionHistory.length > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={isLoading}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {messages.map((msg, idx) => (
            <View key={msg.id} style={[
              styles.messageContainer,
              msg.isBot ? styles.botMessageContainer : styles.userMessageContainer
            ]}>
              <View style={styles.messageHeader}>
                {msg.isBot ? (
                  <Bot size={20} color={theme.colors.primary.main} />
                ) : (
                  <User size={20} color={theme.colors.gray[600]} />
                )}
                <Text style={styles.messageTime}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={[
                styles.messageBubble,
                msg.isBot ? styles.botBubble : styles.userBubble
              ]}>
                <Text style={[
                  styles.messageText,
                  msg.isBot ? styles.botText : styles.userText
                ]}>
                  {msg.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        {renderCurrentInput()}
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
  currentQuestionContainer: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sliderContainer: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
  },
  sliderLabel: {
    ...theme.typography.body,
    color: theme.colors.primary.main,
    fontWeight: 'bold',
  },
  sliderValueMid: {
    fontSize: 20,
    color: theme.colors.primary.main,
    fontWeight: 'bold',
    marginHorizontal: theme.spacing.sm,
  },
  sliderValueText: {
    ...theme.typography.body,
    color: theme.colors.primary.main,
    marginTop: theme.spacing.sm,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  backButton: {
    marginTop: theme.spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray[200],
  },
  backButtonText: {
    ...theme.typography.button,
    color: theme.colors.textSecondary,
  },
  fixedInputContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'flex-end',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
});