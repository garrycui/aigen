import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';

export default function SuggestedQuestions({ questions, onAsk }: { questions: string[], onAsk: (q: string) => void }) {
  if (!questions.length) return null;
  return (
    <View style={{ alignItems: 'center', marginVertical: theme.spacing[2] }}>
      <Text style={{ color: theme.colors.gray[600], fontWeight: '600', marginBottom: theme.spacing[1] }}>
        Try asking:
      </Text>
      {questions.map(q => (
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
          onPress={() => onAsk(q)}
        >
          <Text style={{ color: theme.colors.primary.main, fontWeight: '500' }}>{q}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}