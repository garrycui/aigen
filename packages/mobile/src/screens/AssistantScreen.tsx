import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Send, Bot } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { processChatMessage } from '@shared/lib/chat/chat';

const AssistantScreen = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim() || !user || isLoading) return;

    const userMessage = {
      content: input,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await processChatMessage(user.id, input);
      
      const assistantMessage = {
        content: response.response,
        role: 'assistant',
        timestamp: new Date(),
        recommendations: response.recommendations || []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage = {
        content: "I'm having trouble processing your request right now. Could you try again?",
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Bot size={24} color="#4f46e5" />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSubtitle}>How can I help you today?</Text>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message, index) => (
          <View 
            key={index}
            style={[
              styles.messageWrapper,
              message.role === 'user' ? styles.userMessageWrapper : styles.assistantMessageWrapper
            ]}
          >
            <View 
              style={[
                styles.message,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage
              ]}
            >
              <Text style={message.role === 'user' ? styles.userMessageText : styles.assistantMessageText}>
                {message.content}
              </Text>
            </View>
            
            {message.recommendations?.length > 0 && (
              <View style={styles.recommendations}>
                {message.recommendations.map((rec, recIndex) => (
                  <TouchableOpacity 
                    key={recIndex}
                    style={styles.recommendationCard}
                    onPress={() => {
                      // Handle recommendation click
                    }}
                  >
                    <Text style={styles.recommendationTitle}>{rec.title}</Text>
                    <Text style={styles.recommendationType}>
                      {rec.type === 'tutorial' ? 'Tutorial' : 'Forum Post'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
        
        {isLoading && (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDot} />
            <View style={[styles.loadingDot, styles.loadingDotMiddle]} />
            <View style={styles.loadingDot} />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity 
          style={[
            styles.sendButton,
            (!input.trim() || isLoading) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Send size={20} color={!input.trim() || isLoading ? '#9ca3af' : '#ffffff'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end',
  },
  assistantMessageWrapper: {
    alignSelf: 'flex-start',
  },
  message: {
    borderRadius: 16,
    padding: 12,
  },
  userMessage: {
    backgroundColor: '#4f46e5',
  },
  assistantMessage: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userMessageText: {
    color: '#ffffff',
  },
  assistantMessageText: {
    color: '#111827',
  },
  recommendations: {
    marginTop: 8,
  },
  recommendationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  recommendationType: {
    fontSize: 12,
    color: '#6b7280',
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
    marginHorizontal: 2,
    opacity: 0.6,
  },
  loadingDotMiddle: {
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#4f46e5',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
});

export default Ass