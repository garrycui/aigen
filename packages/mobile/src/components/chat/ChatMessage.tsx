import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Clipboard, ScrollView } from 'react-native';
import { Bot, User, Copy, ThumbsUp, ThumbsDown } from 'lucide-react-native';
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

interface FormattedSection {
  type: 'heading' | 'subheading' | 'paragraph' | 'list' | 'numberedList' | 'code' | 'quote' | 'divider' | 'sectionBreak';
  content: string;
  level?: number;
  items?: string[];
}

function ChatMessage({ message, isLatest, suggestedQuestions = [], onAskSuggested }: ChatMessageProps) {
  const isBot = message.role === 'assistant';
  const isThinking = message.role === 'assistant' && message.content === 'AI is thinking...';

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
  const shouldAnimate = isBot && isLatest && !isThinking;
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
    if (isBot && !isThinking) {
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

  // Enhanced parsing for better formatting with proper numbering
  const parseMessageContent = (content: string): FormattedSection[] => {
    const lines = content.split('\n');
    const sections: FormattedSection[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines but add section breaks for better spacing
      if (!line) {
        if (sections.length > 0 && sections[sections.length - 1].type !== 'sectionBreak') {
          sections.push({ type: 'sectionBreak', content: '' });
        }
        continue;
      }
      
      // Check for headings with enhanced hierarchy
      if (line.startsWith('# ')) {
        sections.push({ type: 'heading', content: line.slice(2), level: 1 });
      } else if (line.startsWith('## ')) {
        sections.push({ type: 'heading', content: line.slice(3), level: 2 });
      } else if (line.startsWith('### ')) {
        sections.push({ type: 'subheading', content: line.slice(4), level: 3 });
      } else if (line.startsWith('#### ')) {
        sections.push({ type: 'subheading', content: line.slice(5), level: 4 });
      } 
      // Handle numbered lists (1. 2. 3.) - Fixed to preserve actual numbers
      else if (/^\d+\.\s/.test(line)) {
        const items = [line]; // Keep the full line with number
        while (i + 1 < lines.length && /^\d+\.\s/.test(lines[i + 1].trim())) {
          i++;
          items.push(lines[i].trim()); // Keep the full line with number
        }
        sections.push({ type: 'numberedList', content: '', items });
      }
      // Handle bullet lists
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        const items = [line.slice(2)];
        while (i + 1 < lines.length && (lines[i + 1].trim().startsWith('- ') || lines[i + 1].trim().startsWith('* '))) {
          i++;
          items.push(lines[i].trim().slice(2));
        }
        sections.push({ type: 'list', content: '', items });
      } 
      // Handle code blocks
      else if (line.startsWith('```')) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        sections.push({ type: 'code', content: codeLines.join('\n') });
      } 
      // Handle quotes
      else if (line.startsWith('> ')) {
        sections.push({ type: 'quote', content: line.slice(2) });
      } 
      // Handle manual dividers
      else if (line === '---' || line === '***') {
        sections.push({ type: 'divider', content: '' });
      } 
      // Regular paragraphs
      else {
        sections.push({ type: 'paragraph', content: line });
      }
    }
    
    return sections;
  };

  const formattedSections = React.useMemo(() => parseMessageContent(displayedText), [displayedText]);
  
  // For typing animation, show sections progressively
  const displayedSections = React.useMemo(() => {
    if (!shouldAnimate || displayedText === message.content) {
      return formattedSections;
    }
    
    // Calculate how many sections to show based on typed text
    const typedLength = displayedText.length;
    const totalLength = message.content.length;
    const progress = typedLength / totalLength;
    const sectionsToShow = Math.floor(progress * formattedSections.length);
    
    return formattedSections.slice(0, sectionsToShow + 1);
  }, [formattedSections, displayedText, message.content, shouldAnimate]);

  const renderFormattedText = (text: string) => {
    // Enhanced inline formatting
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|__[^_]+__|_[^_]+_)/);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={index} style={styles.boldText}>
            {part.slice(2, -2)}
          </Text>
        );
      } else if (part.startsWith('__') && part.endsWith('__')) {
        return (
          <Text key={index} style={styles.boldText}>
            {part.slice(2, -2)}
          </Text>
        );
      } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return (
          <Text key={index} style={styles.italicText}>
            {part.slice(1, -1)}
          </Text>
        );
      } else if (part.startsWith('_') && part.endsWith('_') && !part.startsWith('__')) {
        return (
          <Text key={index} style={styles.italicText}>
            {part.slice(1, -1)}
          </Text>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Text key={index} style={styles.inlineCode}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      return <Text key={index}>{part}</Text>;
    });
  };

  const renderSection = (section: FormattedSection, index: number) => {
    switch (section.type) {
      case 'heading':
        return (
          <View key={index} style={styles.headingContainer}>
            <Text style={[
              styles.heading,
              section.level === 1 ? styles.heading1 : styles.heading2,
              isBot ? styles.botText : styles.userText
            ]}>
              {renderFormattedText(section.content)}
            </Text>
          </View>
        );
      
      case 'subheading':
        return (
          <View key={index} style={styles.subheadingContainer}>
            <Text style={[
              styles.subheading,
              section.level === 3 ? styles.heading3 : styles.heading4,
              isBot ? styles.botText : styles.userText
            ]}>
              {renderFormattedText(section.content)}
            </Text>
          </View>
        );
      
      case 'paragraph':
        return (
          <View key={index} style={styles.paragraphContainer}>
            <Text style={[styles.messageText, isBot ? styles.botText : styles.userText]}>
              {renderFormattedText(section.content)}
            </Text>
          </View>
        );
      
      case 'numberedList':
        return (
          <View key={index} style={styles.numberedListContainer}>
            {section.items?.map((item, itemIndex) => {
              // Extract number and text from the item
              const match = item.match(/^(\d+)\.\s(.+)$/);
              const number = match ? match[1] : (itemIndex + 1).toString();
              const text = match ? match[2] : item.replace(/^\d+\.\s/, '');
              
              return (
                <View key={itemIndex} style={styles.numberedListItem}>
                  <Text style={[styles.numberedListNumber, isBot ? styles.botNumberText : styles.userNumberText]}>
                    {number}.
                  </Text>
                  <Text style={[styles.numberedListText, isBot ? styles.botText : styles.userText]}>
                    {renderFormattedText(text)}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      
      case 'list':
        return (
          <View key={index} style={styles.listContainer}>
            {section.items?.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.listItem}>
                <Text style={[styles.listBullet, isBot ? styles.botNumberText : styles.userNumberText]}>•</Text>
                <Text style={[styles.listText, isBot ? styles.botText : styles.userText]}>
                  {renderFormattedText(item)}
                </Text>
              </View>
            ))}
          </View>
        );
      
      case 'code':
        return (
          <View key={index} style={styles.codeBlockContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={styles.codeBlock}>{section.content}</Text>
            </ScrollView>
          </View>
        );
      
      case 'quote':
        return (
          <View key={index} style={styles.quoteContainer}>
            <View style={styles.quoteBorder} />
            <Text style={[styles.quoteText, isBot ? styles.botText : styles.userText]}>
              {renderFormattedText(section.content)}
            </Text>
          </View>
        );
      
      case 'divider':
        return (
          <View key={index} style={styles.dividerContainer}>
            <View style={styles.straightDivider} />
          </View>
        );
      
      case 'sectionBreak':
        return (
          <View key={index} style={styles.sectionBreak} />
        );
      
      default:
        return null;
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
        <View style={[styles.messageBubble, styles.botBubbleFullWidth]}>
          <Text style={[styles.messageText, styles.botText]}>
            <Text style={{ fontStyle: 'italic', opacity: 0.7 }}>AI is thinking...</Text>
          </Text>
        </View>
      </View>
    );
  }

  // Enhanced normal user/assistant message with full width for assistant
  return (
    <View style={[
      styles.messageContainer,
      isBot ? styles.botMessage : styles.userMessage
    ]}>
      {/* Simplified message header */}
      <View style={[
        styles.messageHeader,
        isBot ? styles.botHeader : styles.userHeader
      ]}>
        <Text style={[
          styles.senderName,
          isBot ? styles.botSenderName : styles.userSenderName
        ]}>
          {isBot ? 'Assistant' : 'You'}
        </Text>
        <Text style={[
          styles.messageTime,
          isBot ? styles.botTime : styles.userTime
        ]}>
          {!isNaN(Date.parse(message.timestamp))
            ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''
          }
        </Text>
        
        {/* Copy action for bot messages */}
        {isBot && !isThinking && (
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyText}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Copy size={14} color={theme.colors.gray[500]} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Enhanced message content with full width for assistant */}
      <View style={[
        styles.messageBubble,
        isBot ? styles.botBubbleFullWidth : styles.userBubble
      ]}>
        <View style={[
          styles.messageContent,
          isBot ? styles.botMessageContent : styles.userMessageContent
        ]}>
          {displayedSections.map((section, index) => renderSection(section, index))}
          
          {/* Typing indicator for current message */}
          {shouldAnimate && displayedSections.length < formattedSections.length && (
            <View style={styles.typingIndicator}>
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
            </View>
          )}
        </View>
        
        {/* Enhanced message feedback for bot messages */}
        {isBot && !isThinking && (
          <View style={styles.messageFeedback}>
            <TouchableOpacity 
              style={[styles.feedbackButton, reaction === '👍' && styles.feedbackButtonActive]}
              onPress={() => handleReaction('👍')}
            >
              <ThumbsUp size={12} color={reaction === '👍' ? theme.colors.primary.main : theme.colors.gray[400]} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.feedbackButton, reaction === '👎' && styles.feedbackButtonActive]}
              onPress={() => handleReaction('👎')}
            >
              <ThumbsDown size={12} color={reaction === '👎' ? theme.colors.danger : theme.colors.gray[400]} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default React.memo(ChatMessage);

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
  },
  botMessage: {
    alignItems: 'stretch', // Changed to stretch for full width
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
    paddingHorizontal: theme.spacing[1],
  },
  botHeader: {
    justifyContent: 'flex-start',
  },
  userHeader: {
    justifyContent: 'flex-end',
  },
  senderName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    marginRight: theme.spacing[2],
  },
  botSenderName: {
    color: theme.colors.primary.main,
  },
  userSenderName: {
    color: theme.colors.gray[600],
  },
  messageTime: {
    fontSize: theme.typography.fontSize.xs,
  },
  botTime: {
    color: theme.colors.gray[500],
  },
  userTime: {
    color: theme.colors.gray[500],
  },
  copyButton: {
    marginLeft: theme.spacing[2],
    padding: theme.spacing[1],
    borderRadius: theme.borderRadius.sm,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing[2],
  },
  messageBubble: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  // Full width for bot messages, no container restrictions
  botBubbleFullWidth: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    width: '100%', // Full width
    alignSelf: 'stretch',
  },
  userBubble: {
    backgroundColor: theme.colors.primary.main,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  messageContent: {
    padding: theme.spacing[4],
  },
  // Separate content styles for better spacing
  botMessageContent: {
    paddingHorizontal: theme.spacing[6], // More horizontal padding for readability
    paddingVertical: theme.spacing[4],
  },
  userMessageContent: {
    padding: theme.spacing[4],
  },
  
  // Enhanced typography styles with better hierarchy
  headingContainer: {
    marginBottom: theme.spacing[4],
    marginTop: theme.spacing[2],
  },
  subheadingContainer: {
    marginBottom: theme.spacing[3],
    marginTop: theme.spacing[3],
  },
  paragraphContainer: {
    marginBottom: theme.spacing[3],
  },
  heading: {
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: 1.2,
  },
  heading1: {
    fontSize: theme.typography.fontSize['3xl'],
    marginBottom: theme.spacing[2],
  },
  heading2: {
    fontSize: theme.typography.fontSize['2xl'],
    marginBottom: theme.spacing[2],
  },
  subheading: {
    fontWeight: theme.typography.fontWeight.semibold,
    lineHeight: 1.3,
  },
  heading3: {
    fontSize: theme.typography.fontSize.xl,
    marginBottom: theme.spacing[1],
  },
  heading4: {
    fontSize: theme.typography.fontSize.lg,
    marginBottom: theme.spacing[1],
  },
  messageText: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: 24,
  },
  botText: {
    color: theme.colors.gray[800],
  },
  userText: {
    color: theme.colors.white,
  },
  boldText: {
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.base + 1,
  },
  italicText: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: 'monospace',
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  
  // Enhanced numbered list styles with proper numbering
  numberedListContainer: {
    marginBottom: theme.spacing[4],
    paddingLeft: theme.spacing[2],
  },
  numberedListItem: {
    flexDirection: 'row',
    marginBottom: theme.spacing[2],
    alignItems: 'flex-start',
  },
  numberedListNumber: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    minWidth: 32,
    marginRight: theme.spacing[3],
    marginTop: 2,
  },
  // Separate colors for numbers
  botNumberText: {
    color: theme.colors.primary.main,
  },
  userNumberText: {
    color: theme.colors.white,
  },
  numberedListText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    lineHeight: 24,
    fontWeight: theme.typography.fontWeight.medium,
  },
  
  // Enhanced bullet list styles
  listContainer: {
    marginBottom: theme.spacing[4],
    paddingLeft: theme.spacing[2],
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: theme.spacing[2],
    alignItems: 'flex-start',
  },
  listBullet: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginRight: theme.spacing[3],
    marginTop: 2,
    minWidth: 16,
  },
  listText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    lineHeight: 24,
  },
  
  // Enhanced code block styles
  codeBlockContainer: {
    backgroundColor: theme.colors.gray[900],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[4],
    marginVertical: theme.spacing[3],
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.main,
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[100],
    lineHeight: 20,
  },
  
  // Enhanced quote styles
  quoteContainer: {
    flexDirection: 'row',
    marginVertical: theme.spacing[3],
    paddingLeft: theme.spacing[3],
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[3],
  },
  quoteBorder: {
    width: 4,
    backgroundColor: theme.colors.primary.main,
    marginRight: theme.spacing[3],
    borderRadius: 2,
  },
  quoteText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    fontStyle: 'italic',
    lineHeight: 24,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  
  // Straight line divider instead of curved
  dividerContainer: {
    marginVertical: theme.spacing[4],
    alignItems: 'center',
  },
  straightDivider: {
    width: '100%', // Full width straight line
    height: 1,
    backgroundColor: theme.colors.gray[300],
  },
  
  // Section break for better spacing
  sectionBreak: {
    height: theme.spacing[3],
  },
  
  // Enhanced feedback
  messageFeedback: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[6], // Match content padding
    paddingBottom: theme.spacing[3],
    paddingTop: theme.spacing[1],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[100],
  },
  feedbackButton: {
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray[50],
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  feedbackButtonActive: {
    backgroundColor: theme.colors.primary.light,
    borderColor: theme.colors.primary.main,
  },
  
  // Animation styles
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing[2],
    gap: theme.spacing[1],
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.gray[400],
    opacity: 0.6,
  },
});