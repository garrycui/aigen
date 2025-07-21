import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { screenStyles, colors, theme } from '../theme';

export default function ChatScreen() {
  const [input, setInput] = useState('');
  return (
    <View style={styles.container}>
      <View style={styles.headerGradient}>
        <View style={styles.headerContent}>
          <MessageCircle size={36} color={colors.white} />
          <Text style={styles.headerTitle}>Ask Anything</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.subtitle}>
          Start a conversation and get instant answers powered by AI.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask anything..."
            placeholderTextColor={colors.gray[400]}
            value={input}
            onChangeText={setInput}
            editable
          />
          <TouchableOpacity style={[styles.sendButton, input.length === 0 && styles.sendButtonDisabled]} disabled={input.length === 0}>
            <MessageCircle size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 12,
    backgroundColor: colors.primary.main,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginLeft: 12,
  },
  card: {
    backgroundColor: colors.white,
    margin: 16,
    borderRadius: 24,
    padding: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray[600],
    marginBottom: 24,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.gray[900],
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sendButton: {
    backgroundColor: colors.primary.main,
    borderRadius: 16,
    padding: 10,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
});