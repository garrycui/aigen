import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brain, Smile } from 'lucide-react-native';
import { theme } from '../../theme';
import { useNavigation } from '@react-navigation/native';

export default function AssessmentIntro() {
  const navigation = useNavigation<any>();

  const handleStart = () => {
    navigation.replace('Assessment');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Brain size={48} color={theme.colors.primary.main} />
        <Text style={styles.title}>AI Personality Assessment</Text>
        <Text style={styles.subtitle}>
          Discover your unique happiness profile and unlock personalized recommendations!
        </Text>
      </View>
      <View style={styles.body}>
        <Smile size={32} color={theme.colors.primary.light} />
        <Text style={styles.bodyText}>
          This quick assessment helps us understand your personality, interests, and what makes you happy.
        </Text>
        <Text style={styles.bodyText}>
          Your answers are private and help us personalize your experience.
        </Text>
      </View>
      <TouchableOpacity style={styles.startButton} onPress={handleStart}>
        <Text style={styles.startButtonText}>Start Assessment</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  body: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  bodyText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
    maxWidth: 320,
  },
  startButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    width: '100%',
  },
  startButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 18,
  },
});