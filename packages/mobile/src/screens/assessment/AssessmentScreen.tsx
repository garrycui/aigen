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
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Bot, User } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { useNavigation } from '@react-navigation/native';
import { chatQuestions, getNextQuestion, isAssessmentComplete } from '../../lib/assessment/questions';
import { generateAssessmentResult, analyzeAndSaveAssessment } from '../../lib/assessment/analyzer';
import AssessmentSummary from '../../components/assessment/AssessmentSummary';
import { AssessmentResult } from '../../lib/assessment/analyzer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAssessmentCache } from '../../hooks/useLatestAssessment';
import { useDynamicPersonalization } from '../../hooks/useDynamicPersonalization';

const MBTI_TYPES = [
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'
];

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ASSESSMENT_PROGRESS_KEY = 'assessment_progress';

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

  // Add the dynamic personalization hook
  const { initializeFromAssessment } = useDynamicPersonalization(user?.id || '');

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

  // Accordion state for content_preferences categories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Add progress tracking
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Add typing animation for bot messages
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(ASSESSMENT_PROGRESS_KEY);
      if (saved) {
        try {
          const { responses, currentQuestion, questionHistory } = JSON.parse(saved);
          setResponses(responses || {});
          setCurrentQuestion(currentQuestion || chatQuestions[0]?.id);
          setQuestionHistory(questionHistory || [chatQuestions[0]?.id]);
          
          // Show the current question in chat when restoring progress
          const currentQuestionObj = chatQuestions.find(q => q.id === (currentQuestion || chatQuestions[0]?.id));
          if (currentQuestionObj) {
            setMessages([
              {
                id: Date.now().toString(),
                text: currentQuestionObj.text,
                isBot: true,
                timestamp: new Date(),
              }
            ]);
          }
        } catch {
          // If parsing fails, start fresh
          startAssessment();
        }
      } else {
        startAssessment();
      }
    })();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  useEffect(() => {
    if (currentQuestion) {
      AsyncStorage.setItem(
        ASSESSMENT_PROGRESS_KEY,
        JSON.stringify({
          responses,
          currentQuestion,
          questionHistory,
        })
      );
    }
  }, [responses, currentQuestion, questionHistory]);

  // Calculate progress
  useEffect(() => {
    const totalQuestions = chatQuestions.length;
    const currentIndex = chatQuestions.findIndex(q => q.id === currentQuestion);
    const newProgress = currentIndex >= 0 ? (currentIndex / totalQuestions) * 100 : 0;
    setProgress(newProgress);
    
    Animated.timing(progressAnim, {
      toValue: newProgress,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [currentQuestion]);

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

  // Enhanced bot message with typing effect
  const addBotMessage = (text: string, options?: string[]) => {
    setIsTyping(true);
    setTimeout(() => {
      messageCounterRef.current += 1;
      const message: Message = {
        id: `${Date.now()}_${messageCounterRef.current}`,
        text,
        isBot: true,
        timestamp: new Date(),
        options
      };
      setMessages(prev => [...prev, message]);
      setIsTyping(false);
    }, 800); // Simulate typing delay
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
    prevHistory.pop(); // Remove current question
    const prevQuestionId = prevHistory[prevHistory.length - 1];
    
    // Update state
    setCurrentQuestion(prevQuestionId);
    setQuestionHistory(prevHistory);
    
    // Remove the last two messages (bot question + user response)
    setMessages(prev => prev.slice(0, -2));
    
    // Remove the response for the question we're backing out of
    setResponses(prev => {
      const newResp = { ...prev };
      const questionToRemove = questionHistory[questionHistory.length - 1];
      delete newResp[questionToRemove];
      // Also remove category selections if backing out of content_preferences
      if (questionToRemove === 'content_preferences') {
        delete newResp['content_preferences_categories'];
      }
      return newResp;
    });
    
    // Add the previous question back to messages if it's not already there
    const prevQuestionObj = chatQuestions.find(q => q.id === prevQuestionId);
    if (prevQuestionObj) {
      setTimeout(() => {
        addBotMessage(prevQuestionObj.text, prevQuestionObj.options);
      }, 100);
    }
  };

  const completeAssessment = async (finalResponses: Record<string, string | string[]>) => {
    if (!user) return;
    setIsLoading(true);
    addBotMessage("Thank you for completing the assessment! Let me analyze your responses...");
    
    try {
      await AsyncStorage.removeItem(ASSESSMENT_PROGRESS_KEY);
      
      // 1. Generate and save static baseline assessment
      const result = await analyzeAndSaveAssessment(user.id, finalResponses, {
        saveAssessment,
        updateUserProfile,
      });
      
      // 2. Initialize dynamic personalization from assessment result (NEW!)
      addBotMessage("Creating your personalized AI profile...");
      
      const initResult = await initializeFromAssessment(result, result.assessmentDate);
      if (!initResult?.success) {
        console.warn('Failed to initialize dynamic personalization, but assessment was saved');
      }
      
      // 3. Clear the assessment cache so ProfileScreen will fetch fresh data
      clearAssessmentCache(user.id);
      
      setAssessmentResult(result);
      addBotMessage(
        `Perfect! I've analyzed your responses and created your personalized AI profile. Your AI companion will now adapt and learn from your interactions!`
      );
      
      setTimeout(() => {
        setShowSummary(true);
      }, 1500);
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
            style={[styles.optionButton, styles.enhancedOptionButton]}
            onPress={() => handleOptionSelect('Retry')}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionText}>Retry</Text>
              <View style={styles.optionArrow}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, styles.enhancedOptionButton]}
            onPress={() => handleOptionSelect("I don't know, ask me instead")}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionText}>I don't know, ask me instead</Text>
              <View style={styles.optionArrow}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      );
    }
    // Enhanced slider with better UX
    else if (question.type === 'slider') {
      const currentValue = Number(responses[question.id] ?? question.options?.[0] ?? 0);
      const maxValue = Number(question.options?.[1] ?? 10);
      const isFirstInteraction = currentValue === Number(question.options?.[0] ?? 0);
      
      inputComponent = (
        <View style={styles.sliderContainer}>
          {/* Progress indicator for slider questions */}
          <View style={styles.sliderProgress}>
            <Text style={styles.progressText}>Question {chatQuestions.findIndex(q => q.id === currentQuestion) + 1} of {chatQuestions.length}</Text>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  })}
                ]} 
              />
            </View>
          </View>

          {/* Enhanced question display */}
          <View style={styles.sliderQuestionContainer}>
            <Text style={styles.sliderQuestionLarge}>{question.text}</Text>
          </View>

          <View style={styles.sliderHeader}>
            <View style={styles.sliderValueDisplay}>
              <Text style={styles.sliderValueNumber}>{currentValue}</Text>
              <Text style={styles.sliderValueMax}>/ {maxValue}</Text>
            </View>
            
            {/* Emoji feedback based on value */}
            <Text style={styles.emojiFeeback}>
              {currentValue <= 2 ? '😢' : 
               currentValue <= 4 ? '😐' :
               currentValue <= 6 ? '🙂' :
               currentValue <= 8 ? '😊' : '🤩'}
            </Text>
          </View>
          
          {/* Enhanced instructions */}
          {isFirstInteraction && (
            <View style={styles.sliderInstructions}>
              <Text style={styles.instructionText}>👆 Drag the slider to rate your happiness</Text>
              <Text style={styles.instructionSubtext}>Take your time - there's no wrong answer</Text>
            </View>
          )}
          
          <View style={styles.sliderTrackContainer}>
            <View style={styles.sliderLabelsContainer}>
              <View style={styles.labelWithIcon}>
                <Text style={styles.sliderEndLabel}>😔 Very Low</Text>
              </View>
              <View style={styles.labelWithIcon}>
                <Text style={styles.sliderEndLabel}>Very High 😄</Text>
              </View>
            </View>
            
            <View style={styles.sliderWrapper}>
              <Slider
                style={styles.slider}
                minimumValue={Number(question.options?.[0] ?? 0)}
                maximumValue={maxValue}
                step={1}
                value={currentValue}
                minimumTrackTintColor={theme.colors.primary.main}
                maximumTrackTintColor={theme.colors.gray[200]}
                thumbTintColor={theme.colors.primary.main}
                onValueChange={(value) => {
                  setResponses(prev => ({ ...prev, [question.id]: value.toString() }));
                }}
                onSlidingComplete={handleSliderSubmit}
                disabled={isLoading}
              />
            </View>
            
            <View style={styles.sliderTicksContainer}>
              {Array.from({ length: maxValue + 1 }, (_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.sliderTick,
                    i <= currentValue && styles.sliderTickActive
                  ]} 
                />
              ))}
            </View>
          </View>
        </View>
      );
    }
    // Enhanced single choice options
    else if (question.type === 'single') {
      inputComponent = (
        <View style={styles.optionsContainer}>
          <View style={styles.questionProgress}>
            <Text style={styles.progressText}>Question {chatQuestions.findIndex(q => q.id === currentQuestion) + 1} of {chatQuestions.length}</Text>
          </View>
          {question.options?.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.optionButton, styles.enhancedOptionButton]}
              onPress={() => handleOptionSelect(option)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionText}>{option}</Text>
                <View style={styles.optionArrow}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    // Enhanced multi-choice with full screen experience for content preferences
    else if (
      question.type === 'multi' &&
      question.id === 'content_preferences' &&
      (question as any).categories
    ) {
      const categories = (question as any).categories as { label: string; options: string[] }[];
      const selectedOptions = Array.isArray(responses[question.id]) ? (responses[question.id] as string[]) : [];
      const selectedCategories = Array.isArray(responses['content_preferences_categories']) ? (responses['content_preferences_categories'] as string[]) : [];

      // Helper functions
      const toggleCategory = (label: string) => {
        setExpandedCategories(prev => ({
          ...prev,
          [label]: !prev[label]
        }));
      };

      const handleCategorySelect = (label: string, options: string[]) => {
        const isSelected = selectedCategories.includes(label);
        let newSelectedCategories: string[];
        let newSelectedOptions: string[];
        if (isSelected) {
          newSelectedCategories = selectedCategories.filter(cat => cat !== label);
          newSelectedOptions = selectedOptions.filter(opt => !options.includes(opt));
        } else {
          newSelectedCategories = [...selectedCategories, label];
          newSelectedOptions = Array.from(new Set([...selectedOptions, ...options]));
        }
        setResponses({
          ...responses,
          [question.id]: newSelectedOptions,
          content_preferences_categories: newSelectedCategories
        });
      };

      const handleOptionSelect = (option: string, categoryLabel: string, categoryOptions: string[]) => {
        let newSelectedOptions: string[];
        let newSelectedCategories = [...selectedCategories];
        if (selectedOptions.includes(option)) {
          newSelectedOptions = selectedOptions.filter(o => o !== option);
          if (categoryOptions.every(opt => !newSelectedOptions.includes(opt))) {
            newSelectedCategories = newSelectedCategories.filter(cat => cat !== categoryLabel);
          }
        } else {
          newSelectedOptions = [...selectedOptions, option];
          if (categoryOptions.every(opt => newSelectedOptions.includes(opt))) {
            if (!newSelectedCategories.includes(categoryLabel)) {
              newSelectedCategories.push(categoryLabel);
            }
          }
        }
        setResponses({
          ...responses,
          [question.id]: newSelectedOptions,
          content_preferences_categories: newSelectedCategories
        });
      };

      // Return full screen modal-style component
      return (
        <View style={styles.fullScreenModal}>
          {/* Header with question and progress */}
          <View style={styles.modalHeader}>
            <View style={styles.modalProgress}>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarTrack}>
                  <Animated.View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%']
                        })
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.modalProgressText}>
                  Question {chatQuestions.findIndex(q => q.id === currentQuestion) + 1} of {chatQuestions.length}
                </Text>
              </View>
            </View>
            
            <Text style={styles.modalQuestionTitle}>{question.text}</Text>
            <Text style={styles.modalQuestionSubtitle}>
              Tap categories to explore • Long-press to select all in a category
            </Text>
            
            <View style={styles.modalSelectedCounter}>
              <Text style={styles.modalCounterText}>
                {selectedOptions.length} item{selectedOptions.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          </View>

          {/* Scrollable categories section */}
          <ScrollView 
            style={styles.modalCategoriesScroll}
            contentContainerStyle={styles.modalCategoriesContent}
            showsVerticalScrollIndicator={false}
          >
            {categories.map((cat, catIdx) => {
              const allSelected = cat.options.every(opt => selectedOptions.includes(opt));
              const someSelected = cat.options.some(opt => selectedOptions.includes(opt));
              const expanded = expandedCategories[cat.label] || false;
              
              return (
                <View key={cat.label} style={styles.modalCategoryCard}>
                  <TouchableOpacity
                    style={[
                      styles.modalCategoryHeader,
                      {
                        backgroundColor: allSelected
                          ? theme.colors.primary.main
                          : someSelected
                            ? theme.colors.primary.light
                            : theme.colors.white,
                      }
                    ]}
                    onPress={() => toggleCategory(cat.label)}
                    onLongPress={() => handleCategorySelect(cat.label, cat.options)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.categoryInfo}>
                      <Text style={[
                        styles.modalCategoryTitle,
                        { color: allSelected ? theme.colors.white : theme.colors.primary.main }
                      ]}>
                        {cat.label}
                      </Text>
                      <Text style={[
                        styles.modalCategorySubtitle,
                        { color: allSelected ? theme.colors.white + '80' : theme.colors.textSecondary }
                      ]}>
                        {cat.options.filter(opt => selectedOptions.includes(opt)).length} of {cat.options.length} selected
                      </Text>
                    </View>
                    <Text style={[
                      styles.modalExpandIcon,
                      { color: allSelected ? theme.colors.white : theme.colors.primary.main }
                    ]}>
                      {expanded ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  
                  {expanded && (
                    <View style={styles.modalCategoryOptions}>
                      {cat.options.map((option, idx) => {
                        const selected = selectedOptions.includes(option);
                        return (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.modalSubOptionButton,
                              selected && styles.modalSubOptionSelected
                            ]}
                            onPress={() => handleOptionSelect(option, cat.label, cat.options)}
                            disabled={isLoading}
                            activeOpacity={0.7}
                          >
                            <View style={styles.modalSubOptionContent}>
                              <Text style={[
                                styles.modalSubOptionText,
                                selected && styles.modalSubOptionTextSelected
                              ]}>{option}</Text>
                              {selected && <Text style={styles.modalCheckmark}>✓</Text>}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Fixed bottom buttons */}
          <View style={styles.modalBottomActions}>
            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                selectedOptions.length === 0 && styles.modalSubmitButtonDisabled
              ]}
              onPress={handleMultiSubmit}
              disabled={selectedOptions.length === 0 || isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSubmitButtonText}>
                Continue with {selectedOptions.length} selection{selectedOptions.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
            
            {questionHistory.length > 1 && (
              <TouchableOpacity
                style={styles.modalBackButton}
                onPress={handleBack}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBackButtonText}>← Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }
    // Enhanced regular multi-choice
    else if (question.type === 'multi') {
      inputComponent = (
        <View style={styles.optionsContainer}>
          <View style={styles.questionProgress}>
            <Text style={styles.progressText}>Question {chatQuestions.findIndex(q => q.id === currentQuestion) + 1} of {chatQuestions.length}</Text>
          </View>
          
          <Text style={styles.multiQuestionTitle}>{question.text}</Text>
          
          <View style={styles.multiOptionsGrid}>
            {question.options?.map((option, idx) => {
              const selected = Array.isArray(responses[question.id]) && (responses[question.id] as string[]).includes(option);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.multiOptionCard,
                    selected && styles.multiOptionSelected
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
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.multiOptionText,
                    selected && styles.multiOptionTextSelected
                  ]}>{option}</Text>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!Array.isArray(responses[question.id]) || (responses[question.id] as string[]).length === 0) && styles.submitButtonDisabled
            ]}
            onPress={handleMultiSubmit}
            disabled={!Array.isArray(responses[question.id]) || (responses[question.id] as string[]).length === 0 || isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // Enhanced text input
    else if (question.type === 'text') {
      inputComponent = (
        <View style={styles.textInputContainer}>
          <View style={styles.questionProgress}>
            <Text style={styles.progressText}>Question {chatQuestions.findIndex(q => q.id === currentQuestion) + 1} of {chatQuestions.length}</Text>
          </View>
          
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.enhancedTextInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Share your thoughts..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              maxLength={200}
              editable={!isLoading}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{inputText.length}/200</Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              !inputText.trim() && styles.submitButtonDisabled
            ]}
            onPress={handleTextSubmit}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // For content preferences, don't wrap in inputWrapper since it has its own layout
    if (
      question.type === 'multi' &&
      question.id === 'content_preferences' &&
      (question as any).categories
    ) {
      return inputComponent;
    }

    // Enhanced back button for other question types
    return (
      <View style={styles.inputWrapper}>
        {inputComponent}
        {questionHistory.length > 1 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Check if we should show the full screen modal for content preferences
  const isContentPreferencesQuestion = getCurrentQuestionObj()?.type === 'multi' && 
    getCurrentQuestionObj()?.id === 'content_preferences' && 
    (getCurrentQuestionObj() as any)?.categories;

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
      {/* Enhanced header with gradient - only show if not content preferences */}
      {!isContentPreferencesQuestion && (
        <LinearGradient
          colors={[theme.colors.primary.main, theme.colors.primary.light]}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>AI Personality Assessment</Text>
          <Text style={styles.headerSubtitle}>Discover your unique happiness profile</Text>
          
          {/* Overall progress bar */}
          <View style={styles.headerProgress}>
            <Animated.View 
              style={[
                styles.headerProgressFill, 
                { width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%']
                })}
              ]} 
            />
          </View>
        </LinearGradient>
      )}

      {/* Show full screen modal for content preferences, otherwise show chat */}
      {isContentPreferencesQuestion ? (
        renderCurrentInput()
      ) : (
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {messages.map((msg, idx) => (
              <View key={msg.id} style={[
                styles.messageContainer,
                msg.isBot ? styles.botMessageContainer : styles.userMessageContainer
              ]}>
                <View style={styles.messageHeader}>
                  {msg.isBot ? (
                    <View style={styles.botIcon}>
                      <Bot size={16} color={theme.colors.white} />
                    </View>
                  ) : (
                    <View style={styles.userIcon}>
                      <User size={16} color={theme.colors.primary.main} />
                    </View>
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
            
            {/* Typing indicator */}
            {isTyping && (
              <View style={[styles.messageContainer, styles.botMessageContainer]}>
                <View style={styles.messageHeader}>
                  <View style={styles.botIcon}>
                    <Bot size={16} color={theme.colors.white} />
                  </View>
                  <Text style={styles.messageTime}>typing...</Text>
                </View>
                <View style={[styles.messageBubble, styles.botBubble]}>
                  <Text style={styles.typingText}>●●●</Text>
                </View>
              </View>
            )}
          </ScrollView>
          
          {!isTyping && renderCurrentInput()}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// Enhanced styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  sliderContainer: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  sliderQuestion: {
    ...theme.typography.h4,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  sliderValueDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    shadowColor: theme.colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sliderValueNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  sliderValueMax: {
    fontSize: 16,
    color: theme.colors.white,
    opacity: 0.8,
    marginLeft: 2,
  },
  sliderTrackContainer: {
    width: '100%',
  },
  sliderLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sliderEndLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  slider: {
    width: '100%',
    height: 50,
  },
  sliderTicksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingHorizontal: 12,
  },
  sliderTick: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.gray[300],
  },
  sliderTickActive: {
    backgroundColor: theme.colors.primary.main,
    transform: [{ scale: 1.2 }],
  },
  sliderInstructions: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.primary.light + '20',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary.light,
  },
  instructionText: {
    ...theme.typography.caption,
    color: theme.colors.primary.main,
    fontWeight: '600',
    textAlign: 'center',
  },
  sliderWrapper: {
    position: 'relative',
    width: '100%',
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  headerTitle: {
    ...theme.typography.h2,
    color: theme.colors.white,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.white + 'CC',
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  headerProgress: {
    height: 4,
    backgroundColor: theme.colors.white + '30',
    borderRadius: 2,
    marginTop: theme.spacing.md,
    overflow: 'hidden',
  },
  headerProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.white,
    borderRadius: 2,
  },
  botIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  sliderProgress: {
    marginBottom: theme.spacing.lg,
  },
  progressText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary.main,
    borderRadius: 2,
  },
  emojiFeeback: {
    fontSize: 32,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  instructionSubtext: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  labelWithIcon: {
    alignItems: 'center',
  },
  questionProgress: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  enhancedOptionButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.primary.light,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionArrow: {
    opacity: 0.5,
  },
  arrowText: {
    fontSize: 18,
    color: theme.colors.primary.main,
    fontWeight: 'bold',
  },
  multiQuestionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  multiQuestionSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  selectedCounter: {
    backgroundColor: theme.colors.primary.light + '20',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  counterText: {
    ...theme.typography.caption,
    color: theme.colors.primary.main,
    textAlign: 'center',
    fontWeight: '600',
  },
  categoryCard: {
    marginBottom: theme.spacing.sm, // Reduced margin
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, // Reduced shadow
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md, // Reduced padding
    borderWidth: 1,
    borderColor: theme.colors.primary.light,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    ...theme.typography.h5,
    fontWeight: '600',
  },
  categorySubtitle: {
    ...theme.typography.caption,
    marginTop: theme.spacing.xs,
  },
  expandIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  categoryOptions: {
    backgroundColor: theme.colors.gray[50],
    padding: theme.spacing.sm, // Reduced padding
  },
  subOptionButton: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.sm, // Reduced padding
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs, // Reduced margin
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  subOptionSelected: {
    backgroundColor: theme.colors.primary.light + '20',
    borderColor: theme.colors.primary.main,
  },
  subOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subOptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  },
  subOptionTextSelected: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  checkmark: {
    color: theme.colors.primary.main,
    fontWeight: 'bold',
    fontSize: 16,
  },
  multiOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  multiOptionCard: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    minWidth: '45%',
    alignItems: 'center',
  },
  multiOptionSelected: {
    backgroundColor: theme.colors.primary.light + '20',
    borderColor: theme.colors.primary.main,
  },
  multiOptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
  },
  multiOptionTextSelected: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  textInputContainer: {
    padding: theme.spacing.lg,
  },
  textInputWrapper: {
    marginBottom: theme.spacing.lg,
  },
  enhancedTextInput: {
    ...theme.typography.body,
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  characterCount: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  submitButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: theme.colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.gray[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  inputWrapper: {
    padding: theme.spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray[100],
    marginTop: theme.spacing.lg,
  },
  backButtonText: {
    ...theme.typography.button,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  // Enhanced slider question display
  sliderQuestionContainer: {
    backgroundColor: theme.colors.primary.light + '15',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.main,
  },
  sliderQuestionLarge: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 32,
  },
  
  // Fixed container styles
  fullScreenScrollContainer: {
    flex: 1,
  },
  fullScreenScrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  contentPreferencesContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  compactCategoriesContainer: {
    flex: 1,
    marginBottom: theme.spacing.lg,
  },
  fixedButtonsContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  
  // Remove old container styles that were causing issues
  fullWidthContainer: {
    width: '100%',
    paddingHorizontal: theme.spacing.md,
  },
  categoriesScrollContainer: {
    maxHeight: SCREEN_HEIGHT * 0.3, // Reduced height
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  categoriesScrollView: {
    width: '100%',
  },
  categoriesContent: {
    paddingBottom: theme.spacing.sm,
  },
  submitButtonContainer: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    width: '100%',
  },
  
  // Full screen modal styles for content preferences
  fullScreenModal: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    backgroundColor: theme.colors.white,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  modalProgress: {
    marginBottom: theme.spacing.lg,
  },
  progressBarContainer: {
    alignItems: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary.main,
    borderRadius: 3,
  },
  modalProgressText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  modalQuestionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  modalQuestionSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalSelectedCounter: {
    backgroundColor: theme.colors.primary.light + '20',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  modalCounterText: {
    ...theme.typography.h5,
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  modalCategoriesScroll: {
    flex: 1,
  },
  modalCategoriesContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  modalCategoryCard: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modalCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.primary.light,
  },
  modalCategoryTitle: {
    ...theme.typography.h4,
    fontWeight: '600',
  },
  modalCategorySubtitle: {
    ...theme.typography.body,
    marginTop: theme.spacing.xs,
  },
  modalExpandIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalCategoryOptions: {
    backgroundColor: theme.colors.gray[50],
    padding: theme.spacing.lg,
  },
  modalSubOptionButton: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modalSubOptionSelected: {
    backgroundColor: theme.colors.primary.light + '20',
    borderColor: theme.colors.primary.main,
    borderWidth: 2,
  },
  modalSubOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSubOptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    fontWeight: '500',
  },
  modalSubOptionTextSelected: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  modalCheckmark: {
    color: theme.colors.primary.main,
    fontWeight: 'bold',
    fontSize: 18,
  },
  modalBottomActions: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
    gap: theme.spacing.md,
  },
  modalSubmitButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: theme.colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitButtonDisabled: {
    backgroundColor: theme.colors.gray[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  modalSubmitButtonText: {
    ...theme.typography.h5,
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  modalBackButton: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray[100],
  },
  modalBackButtonText: {
    ...theme.typography.button,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});