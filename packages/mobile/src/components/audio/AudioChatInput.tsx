import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { AudioRecorder, AudioTranscript } from '../../lib/audio/AudioRecorder';
import { theme } from '../../theme';

interface AudioChatInputProps {
  onSend: (text: string, language?: string, audioUri?: string, transcript?: AudioTranscript) => void;
  isLoading: boolean;
}

export default function AudioChatInput({ onSend, isLoading }: AudioChatInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

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
        onSend(transcript.text, transcript.language, audioUri, transcript);
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
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording: {formatTime(recordingTime)}</Text>
        </View>
      )}
      
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordingButton,
          isDisabled && styles.disabledButton
        ]}
        onPress={isRecording ? handleStopRecording : handleStartRecording}
        disabled={isDisabled}
      >
        {isTranscribing ? (
          <Text style={styles.processingText}>Processing...</Text>
        ) : isRecording ? (
          <>
            <MicOff size={24} color={theme.colors.white} />
            <Text style={styles.buttonText}>Stop</Text>
          </>
        ) : (
          <>
            <Mic size={24} color={theme.colors.white} />
            <Text style={styles.buttonText}>Hold to Record</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16, // theme.spacing[4] equivalent
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
    backgroundColor: theme.colors.white,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8, // theme.spacing[2] equivalent
    padding: 8,
    backgroundColor: '#fef2f2', // red-50 equivalent
    borderRadius: 8, // theme.borderRadius.lg equivalent
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444', // red-500 equivalent
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14, // theme.typography.fontSize.sm equivalent
    color: '#b91c1c', // red-700 equivalent
    fontWeight: '500',
  },
  recordButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 9999, // theme.borderRadius.full equivalent
    paddingVertical: 12, // theme.spacing[3] equivalent
    paddingHorizontal: 24, // theme.spacing[6] equivalent
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: theme.colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  recordingButton: {
    backgroundColor: '#ef4444', // red-500 equivalent
  },
  disabledButton: {
    backgroundColor: theme.colors.gray[400],
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16, // theme.typography.fontSize.base equivalent
    fontWeight: '600',
    marginLeft: 8,
  },
  processingText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});