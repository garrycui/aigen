import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../../theme';

export default function ChatHeader({ session, isLoading }: { session: any; isLoading: boolean }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>
        {session?.title || 'Chat'}
      </Text>
      {isLoading && (
        <ActivityIndicator size="small" color={theme.colors.primary.main} style={{ marginLeft: 8 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: theme.spacing[5],
    paddingBottom: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary.main,
  },
});