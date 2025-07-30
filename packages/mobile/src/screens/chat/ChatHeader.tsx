import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { theme } from '../../theme';

export default function ChatHeader({ isInitializing }: { isInitializing: boolean }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing[4],
      backgroundColor: theme.colors.primary.main,
    }}>
      <MessageCircle size={24} color={theme.colors.white} />
      <Text style={{
        color: theme.colors.white,
        fontSize: theme.typography.fontSize.lg,
        fontWeight: '700',
        marginLeft: theme.spacing[2]
      }}>
        AI Chat
      </Text>
      {isInitializing && (
        <ActivityIndicator size="small" color={theme.colors.white} style={{ marginLeft: theme.spacing[2] }} />
      )}
    </View>
  );
}