import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Clipboard } from 'react-native';
import { Bot, User } from 'lucide-react-native';
import { theme } from '../../theme';

// Fix the interface - use a local interface instead of importing
interface ChatMessageType {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  threadId?: string;
  runId?: string;
  isAudioMessage?: boolean;
  audioUri?: string;
  transcript?: any;
}

interface ChatMessageProps {
  message: ChatMessageType;
  isLatest?: boolean;
  suggestedQuestions?: string[];
  onAskSuggested?: (q: string) => void;
}

function ChatMessage({ message, isLatest, suggestedQuestions = [], onAskSuggested }: ChatMessageProps) {
  const isBot = message.role === 'assistant';
  const isThinking = message.role === 'assistant' && message.content === 'AI is thinking...';
  const isTryAsking = message.role === 'assistant' && message.id.startsWith('try-asking');

  // Animation for "AI is thinking..."
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (isThinking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { 
            toValue: 1.3, 
            duration: 500, 
            useNativeDriver: true, 
            easing: Easing.inOut(Easing.ease) 
          }),
          Animated.timing(pulseAnim, { 
            toValue: 1, 
            duration: 500, 
            useNativeDriver: true, 
            easing: Easing.inOut(Easing.ease) 
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isThinking, pulseAnim]);

  // Typing animation for assistant messages
  const shouldAnimate = isBot && isLatest && !isTryAsking && !isThinking;
  const [displayedText, setDisplayedText] = useState(shouldAnimate ? '' : message.content);

  useEffect(() => {
    if (shouldAnimate && message.content) {
      setDisplayedText('');
      let i = 0;
      let interval: NodeJS.Timeout;
      const total = message.content.length;
      const startCount = Math.min(20, total);
      const endCount = Math.min(20, total);

      const animate = () => {
        if (i < startCount) {
          setDisplayedText(message.content.slice(0, i + 1));
          i++;
          interval = setTimeout(animate, 60);
        } else if (i < total - endCount) {
          i = total - endCount;
          setDisplayedText(message.content.slice(0, i));
          interval = setTimeout(animate, 25);
        } else if (i < total) {
          setDisplayedText(message.content.slice(0, i + 1));
          i++;
          interval = setTimeout(animate, 40);
        }
      };
      animate();
      return () => clearTimeout(interval);
    } else {
      setDisplayedText(message.content);
    }
  }, [message.content, shouldAnimate]);

  const getSentimentColor = () => {
    switch (message.sentiment) {
      case 'positive': return theme.colors.success;
      case 'negative': return theme.colors.danger;
      default: return theme.colors.gray[100];
    }
  };

  // Message reactions and feedback
  const [reaction, setReaction] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Animate actions appearance
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showActions ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showActions, fadeAnim]);

  const handleReaction = (emoji: string) => {
    setReaction(reaction === emoji ? null : emoji);
    setShowActions(false);
    // TODO: Save reaction to Firebase for learning
  };

  const handleLongPress = () => {
    if (isBot && !isThinking && !isTryAsking) {
      setShowActions(!showActions);
    }
  };

  const handleCopyText = async () => {
    try {
      await Clipboard.setString(message.content);
      setShowActions(false);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  // Render "AI is thinking..." message
  if (isThinking) {
    return (
      <View style={[styles.messageContainer, styles.botMessage]}>
        <View style={styles.messageHeader}>
          <Animated.View style={[
            styles.avatarContainer,
            { backgroundColor: theme.colors.primary.main, transform: [{ scale: pulseAnim }] }
          ]}>
            <Bot size={16} color={theme.colors.white} />
          </Animated.View>
          <Text style={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[styles.messageBubble, styles.botBubble]}>
          <Text style={[styles.messageText, styles.botText]}>
            <Text style={{ fontStyle: 'italic', opacity: 0.7 }}>AI is thinking...</Text>
          </Text>
        </View>
      </View>
    );
  }

  // Render "Try asking" suggestions as assistant message
  if (isTryAsking && suggestedQuestions.length > 0) {
    return (
      <View style={[styles.messageContainer, styles.botMessage]}>
        <View style={styles.messageHeader}>
          <View style={[
            styles.avatarContainer,
            { backgroundColor: theme.colors.primary.main }
          ]}>
            <Bot size={16} color={theme.colors.white} />
          </View>
          <Text style={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[styles.messageBubble, styles.botBubble]}>
          <Text style={[styles.messageText, styles.botText, { fontWeight: '600', marginBottom: 8 }]}>
            Try asking:
          </Text>
          {suggestedQuestions.map((q, index) => (
            <TouchableOpacity
              key={`${q}-${index}`}
              style={styles.suggestionButton}
              onPress={() => onAskSuggested && onAskSuggested(q)}
            >
              <Text style={styles.suggestionButtonText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Enhanced normal user/assistant message
  return (
    <View style={[
      styles.messageContainer,
      isBot ? styles.botMessage : styles.userMessage
    ]}>
      {/* Enhanced message header with sentiment indicator */}
      <View style={styles.messageHeader}>
        <View style={[
          styles.avatarContainer,
          { backgroundColor: isBot ? theme.colors.primary.main : theme.colors.gray[400] },
          message.sentiment && !isBot && { borderWidth: 2, borderColor: getSentimentColor() }
        ]}>
          {isBot ? (
            <Bot size={16} color={theme.colors.white} />
          ) : (
            <User size={16} color={theme.colors.white} />
          )}
        </View>
        
        <View style={styles.messageInfo}>
          <Text style={styles.messageTime}>
            {!isNaN(Date.parse(message.timestamp))
              ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''
            }
          </Text>
          {/* Sentiment indicator */}
          {message.sentiment && (
            <View style={[styles.sentimentBadge, { backgroundColor: getSentimentColor() }]}>
              <Text style={styles.sentimentText}>
                {message.sentiment === 'positive' ? '😊' : message.sentiment === 'negative' ? '😔' : '😐'}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Enhanced message bubble with interactions */}
      <TouchableOpacity
        style={[
          styles.messageBubble,
          isBot ? styles.botBubble : styles.userBubble,
          !isBot && message.sentiment ? { backgroundColor: getSentimentColor() } : null,
          showActions && styles.activeBubble
        ]}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={0.8}
        disabled={isThinking || isTryAsking}
      >
        {/* Message content */}
        <Text style={[
          styles.messageText,
          isBot ? styles.botText : styles.userText
        ]}>
          {displayedText}
        </Text>
        
        {/* Message reactions */}
        {reaction && (
          <View style={styles.reactionContainer}>
            <Text style={styles.reaction}>{reaction}</Text>
          </View>
        )}
        
        {/* Typing indicator for current message */}
        {shouldAnimate && displayedText.length < message.content.length && (
          <View style={styles.typingIndicator}>
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
          </View>
        )}
      </TouchableOpacity>

      {/* Quick actions for bot messages */}
      {showActions && isBot && (
        <Animated.View style={[styles.messageActions, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleReaction('👍')}
          >
            <Text style={styles.actionEmoji}>👍</Text>
            <Text style={styles.actionLabel}>Helpful</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleReaction('❤️')}
          >
            <Text style={styles.actionEmoji}>❤️</Text>
            <Text style={styles.actionLabel}>Love it</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleReaction('🤔')}
          >
            <Text style={styles.actionEmoji}>🤔</Text>
            <Text style={styles.actionLabel}>Confusing</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleCopyText}
          >
            <Text style={styles.actionEmoji}>📋</Text>
            <Text style={styles.actionLabel}>Copy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowActions(false)}
          >
            <Text style={styles.actionEmoji}>✖️</Text>
            <Text style={styles.actionLabel}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

export default React.memo(ChatMessage);

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
  },
  botMessage: {
    alignItems: 'flex-start',
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[1],
  },
  avatarContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing[2],
  },
  messageTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  botBubble: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  userBubble: {
    backgroundColor: theme.colors.primary.main,
  },
  messageText: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: 20,
  },
  botText: {
    color: theme.colors.gray[800],
  },
  userText: {
    color: theme.colors.white,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  sentimentBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentimentText: {
    fontSize: 10,
  },
  activeBubble: {
    shadowColor: theme.colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 1.02 }],
  },
  reactionContainer: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing[1],
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reaction: {
    fontSize: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing[1],
    gap: theme.spacing[1],
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.gray[400],
    opacity: 0.6,
  },
  suggestionButton: {
    backgroundColor: theme.colors.gray[100],
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[2],
    marginBottom: theme.spacing[1],
    minWidth: 180,
    alignItems: 'center',
  },
  suggestionButtonText: {
    color: theme.colors.primary.main,
    fontWeight: '500',
    fontSize: theme.typography.fontSize.sm,
  },
  messageActions: {
    flexDirection: 'row',
    marginTop: theme.spacing[2],
    gap: theme.spacing[2],
    flexWrap: 'wrap',
    paddingLeft: 32, // Align with message bubble
  },
  actionButton: {
    alignItems: 'center',
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    minWidth: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  actionEmoji: {
    fontSize: 18,
    marginBottom: theme.spacing[1],
  },
  actionLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
});