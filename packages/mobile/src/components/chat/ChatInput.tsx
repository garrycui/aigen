import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Alert, Animated } from 'react-native';
import { Send, Loader2, Mic, MicOff } from 'lucide-react-native';
import { AudioRecorder, AudioTranscript } from '../../lib/audio/AudioRecorder';
import { theme } from '../../theme';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onSendAudioMessage: (text: string, language?: string, audioUri?: string, transcript?: AudioTranscript) => void;
  isLoading: boolean;
  placeholder?: string;
  inputValue?: string;
  setInputValue?: (val: string) => void;
}

export default function ChatInput({ 
  onSendMessage, 
  onSendAudioMessage,
  isLoading, 
  placeholder = "Ask me anything...",
  inputValue,
  setInputValue,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [quickActions] = useState([
    { emoji: '🌱', text: 'How can I improve my wellbeing?', category: 'wellness' },
    { emoji: '🎯', text: 'Help me set a goal', category: 'goals' },
    { emoji: '💭', text: 'I need someone to talk to', category: 'support' },
    { emoji: '📚', text: 'I want to learn something new', category: 'learning' },
  ]);

  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (typeof inputValue === 'string' && inputValue !== input) {
      setInput(inputValue);
    }
  }, [inputValue]);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (setInputValue) setInputValue(val);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      fadeAnim.setValue(1);
    }
  }, [isRecording, fadeAnim]);

  useEffect(() => {
    if (input.length > 2) {
      const smartSuggestions = getSmartSuggestions(input);
      setSuggestions(smartSuggestions);
      setShowSuggestions(smartSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [input]);

  const getSmartSuggestions = (text: string): string[] => {
    const allSuggestions = [
      "How can I improve my mood?",
      "What are some stress management techniques?",
      "Can you help me set goals?",
      "I need relationship advice",
      "How do I stay motivated?",
      "What should I do when I feel anxious?",
      "Can you help me build better habits?",
      "How do I deal with difficult emotions?",
      "What are some self-care ideas?",
      "How can I be more productive?",
    ];
    
    return allSuggestions.filter(s => 
      s.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 3);
  };

  const handleSuggestionPress = (suggestion: string) => {
    setInput(suggestion);
    if (setInputValue) setInputValue(suggestion);
    setShowSuggestions(false);
  };

  const handleQuickAction = (action: { text: string }) => {
    handleSuggestionPress(action.text);
  };

  const handleSend = () => {
    if (input.trim() && !isLoading && !isRecording && !isTranscribing) {
      onSendMessage(input.trim());
      setInput('');
      if (setInputValue) setInputValue('');
    }
  };

  const handleStartRecording = async () => {
    try {
      await AudioRecorder.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please check your microphone permissions.');
    }
  };

  const handleStopRecording = async () => {
    try {
      setIsRecording(false);
      setIsTranscribing(true);
      
      const audioUri = await AudioRecorder.stopRecording();
      if (audioUri) {
        const transcript = await AudioRecorder.transcribeAudio(audioUri);
        onSendAudioMessage(transcript.text, transcript.language, audioUri, transcript);
      } else {
        Alert.alert('Error', 'Failed to save recording.');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to process recording.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isDisabled = isLoading || isTranscribing;

  return (
    <View style={styles.container}>
      {/* Quick Actions - Show when input is empty */}
      {input.length === 0 && !isRecording && (
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>Quick start:</Text>
          <View style={styles.quickActions}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionButton}
                onPress={() => handleQuickAction(action)}
              >
                <Text style={styles.quickActionEmoji}>{action.emoji}</Text>
                <Text style={styles.quickActionText} numberOfLines={1}>
                  {action.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Smart suggestions */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions:</Text>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleSuggestionPress(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Enhanced recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingAnimation}>
            <Animated.View style={[
              styles.recordingDot,
              { 
                opacity: fadeAnim,
                transform: [{ scale: fadeAnim }]
              }
            ]} />
          </View>
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingText}>Recording: {formatTime(recordingTime)}</Text>
            <Text style={styles.recordingHint}>Tap stop when finished</Text>
          </View>
          <TouchableOpacity
            style={styles.cancelRecording}
            onPress={() => {
              setIsRecording(false);
              AudioRecorder.stopRecording();
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Enhanced input container */}
      <View style={[
        styles.inputContainer,
        input.length > 0 && styles.inputContainerActive,
        isRecording && styles.inputContainerRecording
      ]}>
        <TextInput
          style={[
            styles.textInput,
            input.length > 100 && styles.longInput
          ]}
          value={input}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.gray[400]}
          multiline
          maxLength={500}
          editable={!isLoading && !isRecording && !isTranscribing}
          onFocus={() => setShowSuggestions(false)}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          accessibilityLabel="Type your message"
          accessibilityHint="Enter your message and tap send, or use voice input"
          accessibilityRole="none"
        />
        
        {/* Input actions */}
        <View style={styles.inputActions}>
          {/* Audio button with enhanced states */}
          <TouchableOpacity
            style={[
              styles.audioButton,
              isRecording && styles.recordingAudioButton,
              isTranscribing && styles.transcribingAudioButton,
              isDisabled && styles.disabledButton
            ]}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isDisabled}
            activeOpacity={0.7}
            accessibilityLabel={isRecording ? "Stop recording" : "Start voice recording"}
            accessibilityHint={isRecording ? "Tap to stop recording your voice message" : "Tap to start recording a voice message"}
            accessibilityRole="button"
          >
            {isTranscribing ? (
              <Animated.View style={{ transform: [{ rotate: '360deg' }] }}>
                <Loader2 size={20} color={theme.colors.white} />
              </Animated.View>
            ) : isRecording ? (
              <MicOff size={20} color={theme.colors.white} />
            ) : (
              <Mic size={20} color={theme.colors.white} />
            )}
          </TouchableOpacity>

          {/* Enhanced send button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() || isLoading || isRecording || isTranscribing) && styles.sendButtonDisabled,
              input.trim() && !isLoading && !isRecording && !isTranscribing && styles.sendButtonActive
            ]}
            onPress={handleSend}
            disabled={!input.trim() || isLoading || isRecording || isTranscribing}
            activeOpacity={0.8}
            accessibilityLabel="Send message"
            accessibilityHint="Send your typed message"
            accessibilityRole="button"
            accessibilityState={{ disabled: !input.trim() || isLoading || isRecording || isTranscribing }}
          >
            <Send size={20} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Enhanced footer with tips and character count */}
      <View style={styles.inputFooter}>
        <View style={styles.footerLeft}>
          {input.length === 0 && !isRecording && (
            <Text style={styles.tipText}>
              💡 Try voice input or ask about wellness, goals, or relationships
            </Text>
          )}
          {isRecording && (
            <Text style={styles.recordingTip}>
              🎤 Speak naturally, I'll transcribe your message
            </Text>
          )}
        </View>
        
        {input.length > 0 && (
          <Text style={[
            styles.characterCount,
            input.length > 450 && styles.characterCountWarning,
            input.length > 480 && styles.characterCountDanger
          ]}>
            {input.length}/500
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  quickActionsContainer: {
    marginBottom: theme.spacing[3],
  },
  quickActionsTitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing[2],
    fontWeight: theme.typography.fontWeight.medium,
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing[2],
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: theme.colors.gray[100],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[3],
    alignItems: 'center',
    minHeight: 60,
  },
  quickActionEmoji: {
    fontSize: 20,
    marginBottom: theme.spacing[1],
  },
  quickActionText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[700],
    textAlign: 'center',
    fontWeight: theme.typography.fontWeight.medium,
  },
  suggestionsContainer: {
    marginBottom: theme.spacing[3],
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[3],
  },
  suggestionsTitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing[2],
    fontWeight: theme.typography.fontWeight.medium,
  },
  suggestionItem: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[2],
    marginBottom: theme.spacing[1],
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  suggestionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[700],
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.danger,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  recordingAnimation: {
    marginRight: theme.spacing[3],
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.white,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  recordingHint: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    opacity: 0.8,
  },
  cancelRecording: {
    padding: theme.spacing[2],
  },
  cancelText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.gray[100],
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    minHeight: 48,
  },
  inputContainerActive: {
    borderWidth: 2,
    borderColor: theme.colors.primary.main,
    backgroundColor: theme.colors.white,
  },
  inputContainerRecording: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.danger + '10',
  },
  textInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[900],
    maxHeight: 100,
    paddingVertical: theme.spacing[1],
  },
  longInput: {
    maxHeight: 120,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing[2],
    marginLeft: theme.spacing[2],
  },
  audioButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.full,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingAudioButton: {
    backgroundColor: theme.colors.danger,
  },
  transcribingAudioButton: {
    backgroundColor: theme.colors.warning,
  },
  disabledButton: {
    opacity: 0.5,
  },
  sendButton: {
    backgroundColor: theme.colors.gray[400],
    borderRadius: theme.borderRadius.full,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: theme.colors.primary.main,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.gray[300],
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing[2],
  },
  footerLeft: {
    flex: 1,
  },
  tipText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    lineHeight: 16,
  },
  recordingTip: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.danger,
    fontWeight: theme.typography.fontWeight.medium,
  },
  characterCount: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
  },
  characterCountWarning: {
    color: theme.colors.warning,
  },
  characterCountDanger: {
    color: theme.colors.danger,
  },
});