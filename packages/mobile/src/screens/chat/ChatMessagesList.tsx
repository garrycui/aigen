import React from 'react';
import ChatMessageComponent from '../../components/chat/ChatMessage';

type ChatMessagesListProps = {
  messages: Array<any>;
  suggestedQuestions?: string[];
  onAskSuggested?: (question: string) => void;
  isLatest?: boolean;
};

const ChatMessagesList = React.memo(function ChatMessagesList({
  messages,
  suggestedQuestions,
  onAskSuggested,
  isLatest,
}: ChatMessagesListProps) {
  return (
    <>
      {messages.map((msg, idx) => (
        <ChatMessageComponent
          key={msg.id}
          message={msg}
          isLatest={isLatest}
          suggestedQuestions={suggestedQuestions}
          onAskSuggested={onAskSuggested}
        />
      ))}
    </>
  );
});

export default ChatMessagesList;