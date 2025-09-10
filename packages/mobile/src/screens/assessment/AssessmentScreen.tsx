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
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bot, User } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { useNavigation } from '@react-navigation/native';
import { streamlinedQuestions } from '../../lib/assessment/streamlinedQuestions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUnifiedPersonalization } from '../../lib/personalization/analyzer';
import { useUnifiedPersonalization } from '../../hooks/useUnifiedPersonalization';
import AssessmentSummary from '../../components/assessment/AssessmentSummary';
import { UnifiedPersonalizationProfile } from '../../lib/personalization/types';

const ASSESSMENT_PROGRESS_KEY = 'assessment_progress';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  options?: string[];
}

interface AssessmentResult {
  mbtiType: string;
  personalInfo: {
    name: string;
  };
  happinessScores: any;
  personalization: UnifiedPersonalizationProfile;
  emotionBaseline: number;
  assessmentDate: string;
  version: string;
}

export default function AssessmentScreen() {
  const { user } = useAuth();
  const { saveAssessment, updateUserProfile } = useFirebase();
  const { initializeFromAssessment } = useUnifiedPersonalization(user?.id || '');
  const navigation = useNavigation<any>();

  // Core state
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(streamlinedQuestions[0]?.id || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [questionHistory, setQuestionHistory] = useState<string[]>([]);
  
  // UI state
  const [progress, setProgress] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const messageCounterRef = useRef(0);

  // Initialize assessment
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(ASSESSMENT_PROGRESS_KEY);
      if (saved) {
        try {
          const { responses, currentQuestion, questionHistory } = JSON.parse(saved);
          setResponses(responses || {});
          setCurrentQuestion(currentQuestion || streamlinedQuestions[0]?.id);
          setQuestionHistory(questionHistory || [streamlinedQuestions[0]?.id]);
          
          const currentQuestionObj = streamlinedQuestions.find(q => q.id === (currentQuestion || streamlinedQuestions[0]?.id));
          if (currentQuestionObj) {
            setMessages([{
              id: Date.now().toString(),
              text: currentQuestionObj.text,
              isBot: true,
              timestamp: new Date(),
            }]);
          }
        } catch {
          startAssessment();
        }
      } else {
        startAssessment();
      }
    })();
  }, []);

  // Auto-scroll and save progress
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  useEffect(() => {
    if (currentQuestion) {
      AsyncStorage.setItem(ASSESSMENT_PROGRESS_KEY, JSON.stringify({
        responses,
        currentQuestion,
        questionHistory,
      }));
    }
  }, [responses, currentQuestion, questionHistory]);

  // Progress tracking
  useEffect(() => {
    const totalQuestions = streamlinedQuestions.length;
    const currentIndex = streamlinedQuestions.findIndex(q => q.id === currentQuestion);
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
    const firstQuestion = streamlinedQuestions[0];
    if (firstQuestion) {
      setMessages([{
        id: Date.now().toString(),
        text: firstQuestion.text,
        isBot: true,
        timestamp: new Date(),
      }]);
      setCurrentQuestion(firstQuestion.id);
      setQuestionHistory([firstQuestion.id]);
    }
  };

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
    }, 800);
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

  const getCurrentQuestionObj = () => streamlinedQuestions.find(q => q.id === currentQuestion);

  const getNextQuestionSmart = (currentQuestionId: string | null): any => {
    let idx = streamlinedQuestions.findIndex(q => q.id === currentQuestionId);
    let nextIdx = idx + 1;
    if (nextIdx < streamlinedQuestions.length) {
      return streamlinedQuestions[nextIdx];
    }
    return null;
  };

  const handleOptionSelect = (option: string) => {
    if (!currentQuestion) return;
    
    addUserMessage(option);
    const newResponses = { ...responses, [currentQuestion]: option };
    setResponses(newResponses);

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
    setTimeout(() => {
      processNextQuestionSmart(responses);
    }, 500);
  };

  const handleTextSubmit = () => {
    if (!inputText.trim() || !currentQuestion) return;

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
    setMessages(prev => prev.slice(0, -2));
    
    setResponses(prev => {
      const newResp = { ...prev };
      const questionToRemove = questionHistory[questionHistory.length - 1];
      delete newResp[questionToRemove];
      return newResp;
    });
    
    const prevQuestionObj = streamlinedQuestions.find(q => q.id === prevQuestionId);
    if (prevQuestionObj) {
      setTimeout(() => {
        addBotMessage(prevQuestionObj.text, prevQuestionObj.options);
      }, 100);
    }
  };

  const completeAssessment = async (finalResponses: Record<string, string | string[]>) => {
    if (!user) return;
    setIsLoading(true);
    addBotMessage("Thank you! Creating your personalized profile...");
    
    try {
      await AsyncStorage.removeItem(ASSESSMENT_PROGRESS_KEY);
      
      // Step 1: Save raw assessment data only
      const rawAssessmentData = {
        userId: user.id,
        responses: finalResponses,
        questionnaireVersion: '3.0',
        completedAt: new Date(),
        questionCount: streamlinedQuestions.length,
      };
      
      const saveResult = await saveAssessment(user.id, rawAssessmentData);
      
      if (!saveResult.success) {
        throw new Error(`Failed to save assessment: ${saveResult.error}`);
      }

      addBotMessage("Processing your responses and generating personalized content...");
      
      // Step 2: Generate unified personalization profile
      console.log('🎯 Generating unified personalization profile...');
      const unifiedProfile = generateUnifiedPersonalization(finalResponses, user.id);
      console.log('📊 Generated profile overview:', {
        userId: unifiedProfile.userId,
        mbtiType: unifiedProfile.userCore.mbtiType,
        primaryInterestsCount: unifiedProfile.contentPreferences.primaryInterests.length,
        focusAreasCount: unifiedProfile.wellnessProfile.focusAreas.length
      });
      
      const profileWithId = {
        ...unifiedProfile,
        baseAssessmentId: saveResult.data?.id || unifiedProfile.userId,
        lastUpdated: new Date().toISOString()
      };
      
      // Step 3: Save to userPersonalization collection and generate topic queries
      console.log('🎯 Initializing personalization profile with topic generation...');
      const initResult = await initializeFromAssessment(profileWithId);
      
      if (!initResult.success) {
        console.error('❌ Failed to initialize personalization:', initResult.error);
        throw new Error(`Failed to initialize personalization: ${initResult.error}`);
      }
      
      console.log('✅ Personalization profile initialized, topic generation started in background');
      
      // Step 4: Update user profile
      await updateUserProfile(user.id, {
        hasCompletedAssessment: true,
        mbtiType: unifiedProfile.userCore.mbtiType,
        name: finalResponses.name,
        lastAssessmentDate: new Date().toISOString(),
        assessmentVersion: '3.0'
      });
      
      setAssessmentResult({
        mbtiType: unifiedProfile.userCore.mbtiType,
        personalInfo: {
          name: finalResponses.name as string || user.email || 'User',
        },
        happinessScores: unifiedProfile.wellnessProfile.currentScores,
        personalization: unifiedProfile,
        emotionBaseline: unifiedProfile.wellnessProfile.currentScores.positiveEmotion,
        assessmentDate: new Date().toISOString(),
        version: '3.0'
      });
      
      addBotMessage("Perfect! Your AI companion is now personalized just for you!");
      
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
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'Profile' } }],
    });
  };

  const renderCurrentInput = () => {
    const question = getCurrentQuestionObj();
    if (!question) return null;

    // Interests question (full screen)
    if (question.type === 'multi' && question.id === 'primary_interests') {
      const selectedOptions = Array.isArray(responses[question.id]) ? (responses[question.id] as string[]) : [];
      
      // Use categorizedOptions from the question data instead of hardcoded categories
      const interestCategories = question.categorizedOptions || [];

      return (
        <View style={styles.interestsContainer}>
          <View style={styles.questionProgress}>
            <Text style={styles.progressText}>Question {streamlinedQuestions.findIndex(q => q.id === currentQuestion) + 1} of {streamlinedQuestions.length}</Text>
          </View>
          
          <Text style={styles.interestsTitle}>What sparks your curiosity? ✨</Text>
          <Text style={styles.interestsSubtitle}>Choose everything that interests you - this helps us personalize your experience!</Text>
          
          <View style={styles.selectedCounter}>
            <Text style={styles.counterText}>
              {selectedOptions.length} interest{selectedOptions.length !== 1 ? 's' : ''} selected
            </Text>
          </View>

          <ScrollView style={styles.categoriesScroll} showsVerticalScrollIndicator={false}>
            {interestCategories.map((category) => (
              <View key={category.title} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                </View>
                
                <View style={styles.interestsGrid}>
                  {category.interests.map((interest) => {
                    const selected = selectedOptions.includes(interest);
                    return (
                      <TouchableOpacity
                        key={interest}
                        style={[styles.interestCard, selected && styles.interestCardSelected]}
                        onPress={() => {
                          const prev = selectedOptions;
                          let newArr: string[];
                          if (prev.includes(interest)) {
                            newArr = prev.filter(o => o !== interest);
                          } else {
                            newArr = [...prev, interest];
                          }
                          setResponses({ ...responses, [question.id]: newArr });
                        }}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.interestText, selected && styles.interestTextSelected]}>
                          {interest}
                        </Text>
                        {selected && (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.checkmark}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          
          {/* Fixed button container for interests */}
          <View style={styles.interestsButtonContainer}>
            <TouchableOpacity
              style={[styles.submitButton, selectedOptions.length === 0 && styles.submitButtonDisabled]}
              onPress={handleMultiSubmit}
              disabled={selectedOptions.length === 0 || isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>
                Continue with {selectedOptions.length} interest{selectedOptions.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
            
            {questionHistory.length > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isLoading}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    // Single choice questions (MBTI) - now follow PERMA design pattern
    if (question.type === 'single') {
      return (
        <ScrollView 
          style={styles.singleChoiceScrollWrapper}
          contentContainerStyle={styles.singleChoiceScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputWrapper}>
            <View style={styles.singleChoiceContainer}>
              <View style={styles.questionProgress}>
                <Text style={styles.progressText}>Question {streamlinedQuestions.findIndex(q => q.id === currentQuestion) + 1} of {streamlinedQuestions.length}</Text>
                <View style={styles.progressBar}>
                  <Animated.View style={[styles.progressFill, { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    })
                  }]} />
                </View>
              </View>

              <View style={styles.singleQuestionContainer}>
                <Text style={styles.singleQuestionTitle}>{question.text}</Text>
              </View>
              
              <View style={styles.singleOptionsContainer}>
                {question.options?.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.enhancedOptionButton}
                    onPress={() => handleOptionSelect(option)}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionText}>{option}</Text>
                      <Text style={styles.arrowText}>→</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Back button inside container for single choice questions */}
              {questionHistory.length > 1 && (
                <View style={styles.singleChoiceBackSection}>
                  <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isLoading}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      );
    }

    // Slider questions
    if (question.type === 'slider') {
      const currentValue = Number(responses[question.id] ?? question.options?.[0] ?? 0);
      const maxValue = Number(question.options?.[1] ?? 10);
      
      return (
        <View style={styles.inputWrapper}>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderProgress}>
              <Text style={styles.progressText}>Question {streamlinedQuestions.findIndex(q => q.id === currentQuestion) + 1} of {streamlinedQuestions.length}</Text>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, { 
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  })
                }]} />
              </View>
            </View>

            <View style={styles.sliderQuestionContainer}>
              <Text style={styles.sliderQuestionLarge}>{question.text}</Text>
            </View>

            <View style={styles.sliderHeader}>
              <View style={styles.sliderValueDisplay}>
                <Text style={styles.sliderValueNumber}>{currentValue}</Text>
                <Text style={styles.sliderValueMax}>/ {maxValue}</Text>
              </View>
              
              <Text style={styles.emojiFeeback}>
                {currentValue <= 2 ? '😢' : 
                 currentValue <= 4 ? '😐' :
                 currentValue <= 6 ? '🙂' :
                 currentValue <= 8 ? '😊' : '🤩'}
              </Text>
            </View>
            
            <View style={styles.sliderTrackContainer}>
              <View style={styles.sliderLabelsContainer}>
                <Text style={styles.sliderEndLabel}>😔 Very Low</Text>
                <Text style={styles.sliderEndLabel}>Very High 😄</Text>
              </View>
              
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
              
              <View style={styles.sliderTicksContainer}>
                {Array.from({ length: maxValue + 1 }, (_, i) => (
                  <View key={i} style={[styles.sliderTick, i <= currentValue && styles.sliderTickActive]} />
                ))}
              </View>
            </View>
          </View>
          {questionHistory.length > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isLoading}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Multi-choice questions (not interests)
    if (question.type === 'multi') {
      const selectedOptions = Array.isArray(responses[question.id]) ? responses[question.id] as string[] : [];
      const maxSelections = question.id === 'happiness_sources' ? 3 : (question.id === 'main_goals' ? 3 : undefined);
      
      return (
        <ScrollView 
          style={styles.multiChoiceScrollWrapper}
          contentContainerStyle={styles.multiChoiceScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputWrapper}>
            <View style={styles.multiChoiceContainer}>
              <View style={styles.questionProgress}>
                <Text style={styles.progressText}>Question {streamlinedQuestions.findIndex(q => q.id === currentQuestion) + 1} of {streamlinedQuestions.length}</Text>
                <View style={styles.progressBar}>
                  <Animated.View style={[styles.progressFill, { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    })
                  }]} />
                </View>
              </View>
              
              <View style={styles.multiQuestionContainer}>
                <Text style={styles.multiQuestionTitle}>{question.text}</Text>
              </View>
              
              {maxSelections && (
                <View style={styles.selectionCounterContainer}>
                  <Text style={styles.selectionCounter}>
                    {selectedOptions.length} of {maxSelections} selected
                  </Text>
                </View>
              )}
              
              <View style={styles.multiOptionsColumn}>
                {question.options?.map((option, idx) => {
                  const selected = selectedOptions.includes(option);
                  const canSelect = !maxSelections || selectedOptions.length < maxSelections || selected;
                  
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.multiOptionRow, 
                        selected && styles.multiOptionSelected,
                        !canSelect && styles.multiOptionDisabled
                      ]}
                      onPress={() => {
                        if (!canSelect && !selected) return;
                        
                        const prev = selectedOptions;
                        let newArr: string[];
                        if (prev.includes(option)) {
                          newArr = prev.filter(o => o !== option);
                        } else {
                          newArr = [...prev, option];
                        }
                        setResponses({ ...responses, [question.id]: newArr });
                      }}
                      disabled={isLoading || (!canSelect && !selected)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.multiOptionText, 
                        selected && styles.multiOptionTextSelected,
                        !canSelect && !selected && styles.multiOptionTextDisabled
                      ]}>
                        {option}
                      </Text>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {/* Submit section inside the container */}
              <View style={styles.multiSubmitSection}>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    selectedOptions.length === 0 && styles.submitButtonDisabled
                  ]}
                  onPress={handleMultiSubmit}
                  disabled={selectedOptions.length === 0 || isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitButtonText}>
                    Continue{selectedOptions.length > 0 ? ` with ${selectedOptions.length} selection${selectedOptions.length !== 1 ? 's' : ''}` : ''}
                  </Text>
                </TouchableOpacity>
                
                {questionHistory.length > 1 && (
                  <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isLoading}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }

    // Text input questions
    if (question.type === 'text') {
      return (
        <View style={styles.inputWrapper}>
          <View style={styles.textInputContainer}>
            <View style={styles.questionProgress}>
              <Text style={styles.progressText}>Question {streamlinedQuestions.findIndex(q => q.id === currentQuestion) + 1} of {streamlinedQuestions.length}</Text>
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, { 
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  })
                }]} />
              </View>
            </View>

            <View style={styles.textQuestionContainer}>
              <Text style={styles.textQuestionTitle}>{question.text}</Text>
            </View>
            
            <View style={styles.textInputWrapper}>
              <TextInput
                style={styles.enhancedTextInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={question.id === 'name' ? "Enter your name..." : "Share your thoughts..."}
                placeholderTextColor={theme.colors.textSecondary}
                multiline={question.id !== 'name'}
                maxLength={question.id === 'name' ? 50 : 200}
                editable={!isLoading}
                textAlignVertical={question.id === 'name' ? 'center' : 'top'}
                autoFocus={true}
                returnKeyType={question.id === 'name' ? 'done' : 'default'}
                onSubmitEditing={question.id === 'name' ? handleTextSubmit : undefined}
              />
              <Text style={styles.characterCount}>
                {inputText.length}/{question.id === 'name' ? 50 : 200}
              </Text>
            </View>
          </View>
          
          {/* Fixed submit button container for text input */}
          <View style={styles.fixedSubmitContainer}>
            <TouchableOpacity
              style={[styles.submitButton, !inputText.trim() && styles.submitButtonDisabled]}
              onPress={handleTextSubmit}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Continue</Text>
            </TouchableOpacity>
            
            {questionHistory.length > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isLoading}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return null;
  };

  const isInterestsQuestion = getCurrentQuestionObj()?.type === 'multi' && 
    getCurrentQuestionObj()?.id === 'primary_interests';
  
  const isMultiChoiceQuestion = getCurrentQuestionObj()?.type === 'multi' && 
    getCurrentQuestionObj()?.id !== 'primary_interests';

  const isSingleChoiceQuestion = getCurrentQuestionObj()?.type === 'single';

  if (showSummary && assessmentResult) {
    return (
      <SafeAreaView style={styles.container}>
        <AssessmentSummary 
          profile={assessmentResult.personalization}
          userName={assessmentResult.personalInfo.name}
          onContinue={handleSummaryContinue}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - only show if not full-screen interests */}
      {!isInterestsQuestion && (
        <LinearGradient
          colors={[theme.colors.primary.main, theme.colors.primary.light]}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>AI Personality Assessment</Text>
          <Text style={styles.headerSubtitle}>Discover your unique happiness profile</Text>
          
          <View style={styles.headerProgress}>
            <Animated.View style={[styles.headerProgressFill, { 
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%']
              })
            }]} />
          </View>
        </LinearGradient>
      )}

      {/* Main content */}
      {isInterestsQuestion ? (
        renderCurrentInput()
      ) : isMultiChoiceQuestion ? (
        // Multi-choice questions get full screen with minimal chat
        <View style={styles.chatContainer}>
          {/* Minimized chat area for multi-choice */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.minimalMessagesContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            {/* Show only the last bot message */}
            {messages.length > 0 && (
              <View style={[styles.messageContainer, styles.botMessageContainer]}>
                <View style={styles.messageHeader}>
                  <View style={styles.botIcon}>
                    <Bot size={16} color={theme.colors.white} />
                  </View>
                  <Text style={styles.messageTime}>
                    {messages[messages.length - 1].timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[styles.messageBubble, styles.botBubble]}>
                  <Text style={[styles.messageText, styles.botText]}>
                    {messages[messages.length - 1].text}
                  </Text>
                </View>
              </View>
            )}
            
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
          
          {/* Expanded question area */}
          <View style={styles.expandedQuestionArea}>
            {!isTyping && renderCurrentInput()}
          </View>
        </View>
      ) : isSingleChoiceQuestion ? (
        // Single choice questions get full screen treatment like multi-choice
        <View style={styles.chatContainer}>
          {/* Minimized chat area for single choice */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.minimalMessagesContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            {/* Show only the last bot message */}
            {messages.length > 0 && (
              <View style={[styles.messageContainer, styles.botMessageContainer]}>
                <View style={styles.messageHeader}>
                  <View style={styles.botIcon}>
                    <Bot size={16} color={theme.colors.white} />
                  </View>
                  <Text style={styles.messageTime}>
                    {messages[messages.length - 1].timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={[styles.messageBubble, styles.botBubble]}>
                  <Text style={[styles.messageText, styles.botText]}>
                    {messages[messages.length - 1].text}
                  </Text>
                </View>
              </View>
            )}
            
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
          
          {/* Expanded question area */}
          <View style={styles.expandedQuestionArea}>
            {!isTyping && renderCurrentInput()}
          </View>
        </View>
      ) : (
        // Regular chat interface for text and slider questions
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {messages.map((msg) => (
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
  // Input components
  inputWrapper: {
    padding: theme.spacing.lg,
  },
  optionsContainer: {
    gap: theme.spacing.sm,
  },
  questionProgress: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
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
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary.main,
    borderRadius: 2,
  },
  // Single choice styles - updated to match PERMA design
  singleChoiceContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  singleQuestionContainer: {
    backgroundColor: theme.colors.primary.light + '15',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.main,
  },
  singleQuestionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 32,
  },
  singleOptionsContainer: {
    gap: theme.spacing.md,
  },
  enhancedOptionButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.primary.light,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
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
  optionText: {
    ...theme.typography.body,
    color: theme.colors.primary.main,
    fontWeight: '500',
    flex: 1,
    fontSize: 16,
  },
  arrowText: {
    fontSize: 18,
    color: theme.colors.primary.main,
    fontWeight: 'bold',
  },
  // Slider styles
  sliderContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderProgress: {
    marginBottom: theme.spacing.lg,
  },
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
  sliderHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
  emojiFeeback: {
    fontSize: 32,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
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
  // Multi-choice styles
  multiChoiceContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  multiQuestionContainer: {
    backgroundColor: theme.colors.primary.light + '15',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.main,
  },
  multiQuestionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 32,
  },
  selectionCounterContainer: {
    backgroundColor: theme.colors.primary.light + '10',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  selectionCounter: {
    ...theme.typography.caption,
    color: theme.colors.primary.main,
    textAlign: 'center',
    fontWeight: '600',
  },
  multiOptionsScrollContainer: {
    maxHeight: 320, // Increased from 200 to 320 for more space
  },
  multiOptionsScrollContent: {
    paddingBottom: theme.spacing.xs,
  },
  multiOptionsColumn: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  multiOptionRow: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  multiOptionSelected: {
    backgroundColor: theme.colors.primary.light + '20',
    borderColor: theme.colors.primary.main,
  },
  multiOptionDisabled: {
    backgroundColor: theme.colors.gray[100],
    borderColor: theme.colors.gray[200],
    opacity: 0.6,
  },
  multiOptionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 22,
    fontSize: 16,
  },
  multiOptionTextSelected: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  multiOptionTextDisabled: {
    color: theme.colors.textSecondary,
  },
  checkmark: {
    color: theme.colors.primary.main,
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: theme.spacing.sm,
  },
  multiSubmitSection: {
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  // Text input styles
  textInputContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textQuestionContainer: {
    backgroundColor: theme.colors.primary.light + '15',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.main,
  },
  textQuestionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 32,
  },
  textInputWrapper: {
    marginBottom: theme.spacing.md,
  },
  enhancedTextInput: {
    ...theme.typography.body,
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    minHeight: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    fontSize: 16,
  },
  characterCount: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
  },
  // Interests full-screen styles
  interestsContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.xl,
  },
  interestsTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  interestsSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    lineHeight: 24,
  },
  selectedCounter: {
    backgroundColor: theme.colors.primary.light + '20',
    marginHorizontal: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  counterText: {
    ...theme.typography.h5,
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  categoriesScroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  categorySection: {
    marginBottom: theme.spacing.xl,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
  },
  categoryTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    fontWeight: '600',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  interestCard: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    minWidth: '45%',
    maxWidth: '48%',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  interestCardSelected: {
    backgroundColor: theme.colors.primary.light + '20',
    borderColor: theme.colors.primary.main,
    borderWidth: 2,
  },
  interestText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
  },
  interestTextSelected: {
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  selectedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.colors.primary.main,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Common styles
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
  // Fixed submit button container
  fixedSubmitContainer: {
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  // Fixed back button container
  fixedBackContainer: {
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  // Interests button container
  interestsButtonContainer: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    paddingBottom: theme.spacing.xl, // Extra bottom padding for safe area
  },
  // Multi-choice wrapper styles
  multiChoiceScrollWrapper: {
    flex: 1,
  },
  multiChoiceScrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  // Minimal messages container for multi-choice questions
  minimalMessagesContainer: {
    maxHeight: 120, // Greatly reduced from full flex
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  expandedQuestionArea: {
    flex: 1, // Takes up most of the remaining space
  },
  // Single choice back section
  singleChoiceBackSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  // Single choice wrapper styles
  singleChoiceScrollWrapper: {
    flex: 1,
  },
  singleChoiceScrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
});