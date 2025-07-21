import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { screenStyles, colors, theme } from '../theme';

export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.headerGradient}>
        <View style={styles.headerContent}>
          <BookOpen size={36} color={colors.white} />
          <Text style={styles.headerTitle}>Library</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.subtitle}>
          Your saved answers and history will appear here.
        </Text>
        <View style={styles.emptyState}>
          <BookOpen size={64} color={colors.primary.light} />
          <Text style={styles.emptyText}>No saved items yet</Text>
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
    backgroundColor: colors.primary.main, // Use a solid color
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
  emptyState: {
    alignItems: 'center',
    marginTop: 24,
  },
  emptyText: {
    color: colors.gray[400],
    fontSize: 16,
    marginTop: 12,
  },
});
