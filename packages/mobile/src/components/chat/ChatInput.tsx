import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Alert } from 'react-native';
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
  // Add missing state for audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Use controlled input if provided
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
      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording: {formatTime(recordingTime)}</Text>
        </View>
      )}

      {/* Input container with text input and buttons */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.gray[400]}
          multiline
          maxLength={500}
          editable={!isLoading && !isRecording && !isTranscribing}
        />
        
        {/* Audio button beside input */}
        <TouchableOpacity
          style={[
            styles.audioButton,
            isRecording && styles.recordingAudioButton,
            isDisabled && styles.disabledButton
          ]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isDisabled}
        >
          {isTranscribing ? (
            <Loader2 size={20} color={theme.colors.white} />
          ) : isRecording ? (
            <MicOff size={20} color={theme.colors.white} />
          ) : (
            <Mic size={20} color={theme.colors.white} />
          )}
        </TouchableOpacity>

        {/* Send button beside audio button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!input.trim() || isLoading || isRecording || isTranscribing) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading || isRecording || isTranscribing}
        >
          <Send size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </View>
      
      {/* Character count */}
      {input.length > 0 && (
        <Text style={styles.characterCount}>
          {input.length}/500
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing[2],
    padding: theme.spacing[2],
    backgroundColor: '#fef2f2',
    borderRadius: theme.borderRadius.lg,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: theme.spacing[2],
  },
  recordingText: {
    fontSize: theme.typography.fontSize.sm,
    color: '#b91c1c',
    fontWeight: theme.typography.fontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.gray[100],
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
  },
  textInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[900],
    maxHeight: 100,
    paddingVertical: theme.spacing[1],
  },
  audioButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing[2],
    marginLeft: theme.spacing[2],
  },
  recordingAudioButton: {
    backgroundColor: '#ef4444',
  },
  sendButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing[2],
    marginLeft: theme.spacing[2],
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.gray[300],
  },
  disabledButton: {
    backgroundColor: theme.colors.gray[300],
  },
  characterCount: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[400],
    textAlign: 'right',
    marginTop: theme.spacing[1],
  },
});