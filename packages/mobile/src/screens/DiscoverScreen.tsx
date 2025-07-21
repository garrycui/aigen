import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { Compass } from 'lucide-react-native';
import { screenStyles, colors, theme } from '../theme';

export default function DiscoverScreen() {
  const [search, setSearch] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.headerGradient}>
        <View style={styles.headerContent}>
          <Compass size={36} color={colors.white} />
          <Text style={styles.headerTitle}>Discover</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.subtitle}>
          Explore trending topics and curated suggestions.
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Search topics..."
            placeholderTextColor={colors.gray[400]}
            value={search}
            onChangeText={setSearch}
            editable
          />
        </View>
        <View style={styles.suggestionList}>
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionText}>What’s new in AI?</Text>
          </View>
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionText}>Best productivity hacks</Text>
          </View>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.gray[900],
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  suggestionList: {
    marginTop: 8,
  },
  suggestionCard: {
    backgroundColor: colors.primary.light,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 16,
    color: colors.primary.main,
    fontWeight: '600',
  },
});