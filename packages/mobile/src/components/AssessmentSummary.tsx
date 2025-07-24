
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Brain, Heart, Lightbulb, Target, Star, CheckCircle } from 'lucide-react-native';
import { theme } from '../theme';
import { AssessmentResult } from '../lib/assessment/analyzer';

interface AssessmentSummaryProps {
  result: AssessmentResult;
  onContinue: () => void;
}

const mbtiDescriptions: Record<string, { title: string; description: string; color: string }> = {
  'INTJ': { title: 'The Architect', description: 'Strategic and independent thinker', color: '#6366F1' },
  'INTP': { title: 'The Thinker', description: 'Innovative and analytical problem-solver', color: '#8B5CF6' },
  'ENTJ': { title: 'The Commander', description: 'Bold and imaginative leader', color: '#EF4444' },
  'ENTP': { title: 'The Debater', description: 'Quick-witted and clever innovator', color: '#F59E0B' },
  'INFJ': { title: 'The Advocate', description: 'Creative and insightful idealist', color: '#10B981' },
  'INFP': { title: 'The Mediator', description: 'Poetic and kind-hearted helper', color: '#06B6D4' },
  'ENFJ': { title: 'The Protagonist', description: 'Charismatic and inspiring leader', color: '#F97316' },
  'ENFP': { title: 'The Campaigner', description: 'Enthusiastic and creative free spirit', color: '#EC4899' },
  'ISTJ': { title: 'The Logistician', description: 'Practical and fact-minded reliable', color: '#64748B' },
  'ISFJ': { title: 'The Protector', description: 'Warm-hearted and dedicated helper', color: '#84CC16' },
  'ESTJ': { title: 'The Executive', description: 'Efficient and hardworking organizer', color: '#DC2626' },
  'ESFJ': { title: 'The Consul', description: 'Extraordinarily caring and social', color: '#D946EF' },
  'ISTP': { title: 'The Virtuoso', description: 'Bold and practical experimenter', color: '#059669' },
  'ISFP': { title: 'The Adventurer', description: 'Flexible and charming artist', color: '#0EA5E9' },
  'ESTP': { title: 'The Entrepreneur', description: 'Smart and energetic perceptive', color: '#F97316' },
  'ESFP': { title: 'The Entertainer', description: 'Spontaneous and enthusiastic performer', color: '#E11D48' },
};

const aiReadinessColors: Record<string, string> = {
  'beginner': '#10B981',
  'intermediate': '#F59E0B',
  'advanced': '#6366F1',
  'resistant': '#EF4444',
};

const aiReadinessLabels: Record<string, string> = {
  'beginner': 'AI Explorer',
  'intermediate': 'AI Learner',
  'advanced': 'AI Pro',
  'resistant': 'AI Skeptic',
};

export default function AssessmentSummary({ result, onContinue }: AssessmentSummaryProps) {
  const mbtiInfo = mbtiDescriptions[result.mbtiType] || {
    title: 'Unique Personality',
    description: 'Special combination of traits',
    color: '#6366F1'
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.celebration}>
          <Star size={32} color="#F59E0B" />
          <Text style={styles.congratsText}>Congratulations!</Text>
          <Text style={styles.subText}>Your AI personality profile is ready</Text>
        </View>
      </View>

      {/* MBTI Type Card */}
      <View style={[styles.card, styles.mbtiCard]}>
        <View style={styles.cardHeader}>
          <Brain size={24} color={mbtiInfo.color} />
          <Text style={styles.cardTitle}>Your Personality Type</Text>
        </View>
        <View style={[styles.mbtiTypeContainer, { backgroundColor: mbtiInfo.color + '15' }]}>
          <Text style={[styles.mbtiType, { color: mbtiInfo.color }]}>{result.mbtiType}</Text>
          <Text style={[styles.mbtiTitle, { color: mbtiInfo.color }]}>{mbtiInfo.title}</Text>
          <Text style={styles.mbtiDescription}>{mbtiInfo.description}</Text>
        </View>
      </View>

      {/* AI Readiness Card */}
      <View style={[styles.card, styles.aiCard]}>
        <View style={styles.cardHeader}>
          <Lightbulb size={24} color={aiReadinessColors[result.aiReadiness]} />
          <Text style={styles.cardTitle}>AI Readiness Level</Text>
        </View>
        <View style={[styles.aiReadinessContainer, { backgroundColor: aiReadinessColors[result.aiReadiness] + '15' }]}>
          <Text style={[styles.aiReadinessLabel, { color: aiReadinessColors[result.aiReadiness] }]}>
            {aiReadinessLabels[result.aiReadiness]}
          </Text>
          <Text style={styles.aiReadinessDescription}>
            {result.aiReadiness === 'beginner' && "Perfect! You're ready to start your AI journey with confidence."}
            {result.aiReadiness === 'intermediate' && "Great! You have some experience and are ready to level up."}
            {result.aiReadiness === 'advanced' && "Excellent! You're well-equipped to explore advanced AI features."}
            {result.aiReadiness === 'resistant' && "That's okay! We'll help you find your comfort zone with AI."}
          </Text>
        </View>
      </View>

      {/* Communication Style */}
      <View style={[styles.card, styles.communicationCard]}>
        <View style={styles.cardHeader}>
          <Heart size={24} color="#EC4899" />
          <Text style={styles.cardTitle}>Your Learning Style</Text>
        </View>
        <View style={styles.styleGrid}>
          <View style={[styles.styleItem, { backgroundColor: '#EC489915' }]}>
            <Text style={[styles.styleLabel, { color: '#EC4899' }]}>Communication</Text>
            <Text style={styles.styleValue}>
              {result.communicationStyle.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </View>
          <View style={[styles.styleItem, { backgroundColor: '#06B6D415' }]}>
            <Text style={[styles.styleLabel, { color: '#06B6D4' }]}>Learning</Text>
            <Text style={styles.styleValue}>
              {result.learningPreference.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </View>
        </View>
      </View>

      {/* Personalized Recommendations */}
      <View style={[styles.card, styles.recommendationsCard]}>
        <View style={styles.cardHeader}>
          <Target size={24} color="#10B981" />
          <Text style={styles.cardTitle}>Your Personalized Plan</Text>
        </View>
        <View style={styles.recommendationsList}>
          <View style={styles.recommendationItem}>
            <CheckCircle size={16} color="#10B981" />
            <Text style={styles.recommendationText}>
              Content tone: {result.personalizedRecommendations.contentTone}
            </Text>
          </View>
          <View style={styles.recommendationItem}>
            <CheckCircle size={16} color="#10B981" />
            <Text style={styles.recommendationText}>
              Interaction style: {result.personalizedRecommendations.interactionStyle.replace(/_/g, ' ')}
            </Text>
          </View>
          <View style={styles.recommendationItem}>
            <CheckCircle size={16} color="#10B981" />
            <Text style={styles.recommendationText}>
              Learning path: {result.personalizedRecommendations.learningPath.replace(/_/g, ' ')}
            </Text>
          </View>
          <View style={styles.recommendationItem}>
            <CheckCircle size={16} color="#10B981" />
            <Text style={styles.recommendationText}>
              Motivation: {result.personalizedRecommendations.motivationStrategy.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
      </View>

      {/* Primary Goal */}
      {result.personalInfo.primaryGoal && (
        <View style={[styles.card, styles.goalCard]}>
          <Text style={styles.goalTitle}>Your Goal</Text>
          <Text style={styles.goalText}>"{result.personalInfo.primaryGoal}"</Text>
        </View>
      )}

      <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
        <Text style={styles.continueButtonText}>Explore Your Personalized Dashboard</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your profile will help us provide personalized AI recommendations and learning experiences.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  celebration: {
    alignItems: 'center',
  },
  congratsText: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  subText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  mbtiCard: {
    borderTopWidth: 4,
    borderTopColor: '#6366F1',
  },
  mbtiTypeContainer: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  mbtiType: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  mbtiTitle: {
    ...theme.typography.h4,
    marginTop: theme.spacing.xs,
    fontWeight: '600',
  },
  mbtiDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  aiCard: {
    borderTopWidth: 4,
    borderTopColor: '#10B981',
  },
  aiReadinessContainer: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  aiReadinessLabel: {
    ...theme.typography.h3,
    fontWeight: 'bold',
  },
  aiReadinessDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  communicationCard: {
    borderTopWidth: 4,
    borderTopColor: '#EC4899',
  },
  styleGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  styleItem: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  styleLabel: {
    ...theme.typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  styleValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
    fontWeight: '500',
  },
  recommendationsCard: {
    borderTopWidth: 4,
    borderTopColor: '#10B981',
  },
  recommendationsList: {
    gap: theme.spacing.md,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
    flex: 1,
    textTransform: 'capitalize',
  },
  goalCard: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 4,
    borderTopColor: '#F59E0B',
  },
  goalTitle: {
    ...theme.typography.h4,
    color: '#F59E0B',
    marginBottom: theme.spacing.sm,
  },
  goalText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: theme.colors.primary.main,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  continueButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '600',
  },
  footer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});