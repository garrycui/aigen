import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Bot, User } from 'lucide-react-native';
import { theme } from '../../theme';
import { ChatMessage as ChatMessageType } from '../../lib/chat/chatService';

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
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
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
    if (shouldAnimate) {
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
          {suggestedQuestions.map(q => (
            <TouchableOpacity
              key={q}
              style={{
                backgroundColor: theme.colors.gray[100],
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing[2],
                marginBottom: theme.spacing[1],
                minWidth: 180,
                alignItems: 'center'
              }}
              onPress={() => onAskSuggested && onAskSuggested(q)}
            >
              <Text style={{ color: theme.colors.primary.main, fontWeight: '500' }}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Normal user/assistant message
  return (
    <View style={[
      styles.messageContainer,
      isBot ? styles.botMessage : styles.userMessage
    ]}>
      <View style={styles.messageHeader}>
        <View style={[
          styles.avatarContainer,
          { backgroundColor: isBot ? theme.colors.primary.main : theme.colors.gray[400] }
        ]}>
          {isBot ? (
            <Bot size={16} color={theme.colors.white} />
          ) : (
            <User size={16} color={theme.colors.white} />
          )}
        </View>
        <Text style={styles.messageTime}>
          {
            !isNaN(Date.parse(message.timestamp))
              ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''
          }
        </Text>
      </View>
      <View style={[
        styles.messageBubble,
        isBot ? styles.botBubble : styles.userBubble,
        !isBot && message.sentiment ? { backgroundColor: getSentimentColor() } : null
      ]}>
        <Text style={[
          styles.messageText,
          isBot ? styles.botText : styles.userText
        ]}>
          {displayedText}
        </Text>
      </View>
    </View>
  );
}

export default React.memo(ChatMessage);

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: theme.spacing?.[2] ?? 8,
    paddingHorizontal: theme.spacing?.[4] ?? 16,
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
    marginBottom: theme.spacing?.[1] ?? 4,
  },
  avatarContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing?.[2] ?? 8,
  },
  messageTime: {
    fontSize: theme.typography?.fontSize?.xs ?? 12,
    color: theme.colors.gray[500],
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: theme.spacing?.[3] ?? 12,
    paddingVertical: theme.spacing?.[2] ?? 8,
    borderRadius: theme.borderRadius?.lg ?? 16,
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
    fontSize: theme.typography?.fontSize?.base ?? 16,
    lineHeight: 20,
  },
  botText: {
    color: theme.colors.gray[800],
  },
  userText: {
    color: theme.colors.white,
  },
});