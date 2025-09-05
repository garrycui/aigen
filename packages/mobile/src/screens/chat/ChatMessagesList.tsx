import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { ChevronDown, ArrowUp } from 'lucide-react-native';
import { theme } from '../../theme';
import ChatMessage from '../../components/chat/ChatMessage';

export default function ChatMessagesList({
  messages,
  suggestedQuestions,
  onAskSuggested,
  scrollViewRef,
}: {
  messages: any[];
  suggestedQuestions: string[];
  onAskSuggested: (q: string) => void;
  scrollViewRef: any;
}) {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (scrollViewRef?.current && messages.length > 0) {
      // For newly loaded sessions, scroll to bottom immediately
      if (isNearBottom || messages.length === 1) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: messages.length > 1 });
        }, 100);
      }
    }
  }, [messages, scrollViewRef, isNearBottom]);

  // Animate scroll buttons
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showScrollToBottom || showScrollToTop ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showScrollToBottom, showScrollToTop, fadeAnim]);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const distanceFromTop = contentOffset.y;
    
    // Show/hide scroll to bottom button
    setShowScrollToBottom(distanceFromBottom > 100);
    setIsNearBottom(distanceFromBottom < 100);
    
    // Show/hide scroll to top button
    setShowScrollToTop(distanceFromTop > 200);
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollViewRef?.current?.scrollToEnd({ animated: true });
  }, [scrollViewRef]);

  const scrollToTop = useCallback(() => {
    scrollViewRef?.current?.scrollToOffset({ offset: 0, animated: true });
  }, [scrollViewRef]);

  const renderMessage = useCallback(({ item, index }: { item: any; index: number }) => {
    // Determine if this is the latest message for animations
    const isLatest = index === messages.length - 1;
    
    return (
      <ChatMessage
        message={item}
        isLatest={isLatest}
        suggestedQuestions={
          item.role === 'assistant' && item.id.startsWith('try-asking')
            ? suggestedQuestions
            : []
        }
        onAskSuggested={onAskSuggested}
      />
    );
  }, [suggestedQuestions, onAskSuggested, messages.length]);

  // Enhanced key extractor to ensure unique keys
  const keyExtractor = useCallback((item: any, index: number) => {
    return item.id || `message-${index}-${item.timestamp || Date.now()}`;
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        ref={scrollViewRef}
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 100,
        }}
        // Ensure messages are displayed in correct order
        inverted={false}
      />
      
      {/* Scroll buttons */}
      {(showScrollToBottom || showScrollToTop) && (
        <Animated.View style={[styles.scrollButtons, { opacity: fadeAnim }]}>
          {showScrollToTop && (
            <TouchableOpacity style={styles.scrollButton} onPress={scrollToTop}>
              <ArrowUp size={20} color={theme.colors.white} />
            </TouchableOpacity>
          )}
          
          {showScrollToBottom && (
            <TouchableOpacity 
              style={[styles.scrollButton, styles.scrollToBottomButton]} 
              onPress={scrollToBottom}
            >
              <ChevronDown size={20} color={theme.colors.white} />
              {messages.length > 0 && !isNearBottom && (
                <View style={styles.newMessageIndicator}>
                  <Text style={styles.newMessageText}>New</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  messagesList: {
    paddingBottom: 16,
    paddingTop: 8,
  },
  scrollButtons: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  scrollButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollToBottomButton: {
    position: 'relative',
  },
  newMessageIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.colors.danger,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  newMessageText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
});