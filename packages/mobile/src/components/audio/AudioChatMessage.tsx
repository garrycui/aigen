import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Play, Pause, Volume2, FileText, Mic } from 'lucide-react-native';
import { AudioPlayer } from '../../lib/audio/AudioPlayer';
import { AudioTranscript } from '../../lib/audio/AudioRecorder';
import { theme } from '../../theme';

interface AudioChatMessageProps {
  text: string;
  language?: string;
  isAI?: boolean;
  audioUri?: string;
  transcript?: AudioTranscript;
  showTranscript?: boolean;
}

export default function AudioChatMessage({ 
  text, 
  language = 'en', 
  isAI = false,
  audioUri,
  transcript,
  showTranscript = false
}: AudioChatMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const handlePlayAudio = async () => {
    if (isPlaying) {
      AudioPlayer.stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    
    if (audioUri && !isAI) {
      // Play recorded audio for user messages
      await AudioPlayer.playAudioResponse(audioUri, () => setIsPlaying(false));
    } else {
      // Use text-to-speech for AI messages or when no audio URI
      await AudioPlayer.speak(text, language, () => setIsPlaying(false));
    }
  };

  const renderTranscriptInfo = () => {
    if (!transcript || !showTranscript) return null;
    
    return (
      <TouchableOpacity 
        style={styles.transcriptToggle}
        onPress={() => setShowFullTranscript(!showFullTranscript)}
      >
        <FileText size={12} color={theme.colors.gray[500]} />
        <Text style={styles.transcriptLabel}>
          {showFullTranscript ? 'Hide' : 'Show'} transcript
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTranscriptDetails = () => {
    if (!transcript || !showFullTranscript) return null;
    
    return (
      <View style={styles.transcriptDetails}>
        <Text style={styles.transcriptTitle}>Transcript Details:</Text>
        <Text style={styles.transcriptText}>"{transcript.text}"</Text>
        {transcript.confidence && (
          <Text style={styles.confidenceText}>
            Confidence: {Math.round(transcript.confidence * 100)}%
          </Text>
        )}
        {transcript.language && (
          <Text style={styles.languageText}>
            Language: {transcript.language.toUpperCase()}
          </Text>
        )}
      </View>
    );
  };

  const containerStyle = isAI ? styles.aiContainer : styles.userContainer;
  const textStyle = isAI ? styles.aiText : styles.userText;
  const messageStyle = isAI ? styles.aiMessage : styles.userMessage;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.messageContent, messageStyle]}>
        {/* Audio indicator icon */}
        <View style={styles.audioIndicator}>
          <Mic size={14} color={isAI ? theme.colors.white : theme.colors.primary.main} />
          <Text style={[styles.audioLabel, isAI ? styles.aiAudioLabel : styles.userAudioLabel]}>
            Audio
          </Text>
        </View>
        
        {/* Message text */}
        <Text style={[styles.text, textStyle]}>{text}</Text>
        
        {/* Transcript info toggle */}
        {renderTranscriptInfo()}
        
        {/* Audio playback button */}
        <TouchableOpacity 
          style={[styles.playButton, isAI ? styles.aiPlayButton : styles.userPlayButton]} 
          onPress={handlePlayAudio}
        >
          {isPlaying ? (
            <Pause size={16} color={isAI ? theme.colors.primary.main : theme.colors.white} />
          ) : (
            <Play size={16} color={isAI ? theme.colors.primary.main : theme.colors.white} />
          )}
          <Text style={[styles.playButtonText, isAI ? styles.aiPlayButtonText : styles.userPlayButtonText]}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Transcript details (collapsible) */}
      {renderTranscriptDetails()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginVertical: theme.spacing[2], 
    paddingHorizontal: theme.spacing[4] 
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  messageContent: {
    maxWidth: '85%',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[3],
    borderWidth: 1,
  },
  userMessage: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  aiMessage: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.gray[200],
  },
  audioIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  audioLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    marginLeft: theme.spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userAudioLabel: {
    color: theme.colors.white,
  },
  aiAudioLabel: {
    color: theme.colors.primary.main,
  },
  text: { 
    fontSize: theme.typography.fontSize.base,
    lineHeight: 20,
    marginBottom: theme.spacing[2],
  },
  userText: {
    color: theme.colors.white,
  },
  aiText: {
    color: theme.colors.gray[900],
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
    opacity: 0.7,
  },
  transcriptLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    marginLeft: theme.spacing[1],
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
    marginTop: theme.spacing[1],
  },
  userPlayButton: {
    backgroundColor: theme.colors.white,
  },
  aiPlayButton: {
    backgroundColor: theme.colors.gray[100],
  },
  playButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    marginLeft: theme.spacing[1],
  },
  userPlayButtonText: {
    color: theme.colors.primary.main,
  },
  aiPlayButtonText: {
    color: theme.colors.primary.main,
  },
  transcriptDetails: {
    marginTop: theme.spacing[2],
    padding: theme.spacing[3],
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.md,
    maxWidth: '85%',
  },
  transcriptTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray[700],
    marginBottom: theme.spacing[2],
  },
  transcriptText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    fontStyle: 'italic',
    marginBottom: theme.spacing[2],
  },
  confidenceText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    marginBottom: theme.spacing[1],
  },
  languageText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
  },
});