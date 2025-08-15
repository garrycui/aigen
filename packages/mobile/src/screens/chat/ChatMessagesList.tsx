import React, { useEffect } from 'react';
import { FlatList, View } from 'react-native';
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
  useEffect(() => {
    if (scrollViewRef?.current && messages.length > 0) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, scrollViewRef]);

  return (
    <FlatList
      ref={scrollViewRef}
      data={messages}
      keyExtractor={item => item.id}
      renderItem={({ item, index }) => (
        <ChatMessage
          message={item}
          isLatest={index === messages.length - 1}
          suggestedQuestions={
            item.role === 'assistant' && item.id.startsWith('try-asking')
              ? suggestedQuestions
              : []
          }
          onAskSuggested={onAskSuggested}
        />
      )}
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
    />
  );
}