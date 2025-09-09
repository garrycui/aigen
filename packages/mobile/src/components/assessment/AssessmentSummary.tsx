import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Brain, Star } from 'lucide-react-native';
import { theme } from '../../theme';
import { UnifiedPersonalizationProfile } from '../../lib/personalization/types';

interface AssessmentSummaryProps {
  profile: UnifiedPersonalizationProfile;
  userName: string;
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

export default function AssessmentSummary({ profile, userName, onContinue }: AssessmentSummaryProps) {
  const mbtiInfo = mbtiDescriptions[profile.userCore.mbtiType] || {
    title: 'Unique Personality',
    description: 'Special combination of traits',
    color: '#6366F1'
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.celebration}>
          <Star size={32} color="#F59E0B" />
          <Text style={styles.congratsText}>Congratulations, {userName || 'Friend'}!</Text>
          <Text style={styles.subText}>Your happiness profile is ready</Text>
        </View>
      </View>

      {/* MBTI Type Card */}
      <View style={[styles.card, styles.mbtiCard]}>
        <View style={styles.cardHeader}>
          <Brain size={24} color={mbtiInfo.color} />
          <Text style={styles.cardTitle}>Your MBTI Type</Text>
        </View>
        <View style={[styles.mbtiTypeContainer, { backgroundColor: mbtiInfo.color + '15' }]}>
          <Text style={[styles.mbtiType, { color: mbtiInfo.color }]}>{profile.userCore.mbtiType}</Text>
          <Text style={[styles.mbtiTitle, { color: mbtiInfo.color }]}>{mbtiInfo.title}</Text>
          <Text style={styles.mbtiDescription}>{mbtiInfo.description}</Text>
        </View>
      </View>

      {/* PERMA Scores with Focus Areas */}
      <View style={[styles.card, styles.goalCard]}>
        <Text style={styles.goalTitle}>Your Happiness Dimensions (PERMA)</Text>
        <View style={styles.permaScoresContainer}>
          <View style={styles.permaScore}>
            <Text style={styles.permaLabel}>Positive Emotion</Text>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${profile.wellnessProfile.currentScores.positiveEmotion * 10}%` }]} />
            </View>
            <Text style={styles.scoreNumber}>{profile.wellnessProfile.currentScores.positiveEmotion}/10</Text>
          </View>
          
          <View style={styles.permaScore}>
            <Text style={styles.permaLabel}>Engagement</Text>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${profile.wellnessProfile.currentScores.engagement * 10}%` }]} />
            </View>
            <Text style={styles.scoreNumber}>{profile.wellnessProfile.currentScores.engagement}/10</Text>
          </View>
          
          <View style={styles.permaScore}>
            <Text style={styles.permaLabel}>Relationships</Text>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${profile.wellnessProfile.currentScores.relationships * 10}%` }]} />
            </View>
            <Text style={styles.scoreNumber}>{profile.wellnessProfile.currentScores.relationships}/10</Text>
          </View>
          
          <View style={styles.permaScore}>
            <Text style={styles.permaLabel}>Meaning</Text>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${profile.wellnessProfile.currentScores.meaning * 10}%` }]} />
            </View>
            <Text style={styles.scoreNumber}>{profile.wellnessProfile.currentScores.meaning}/10</Text>
          </View>
          
          <View style={styles.permaScore}>
            <Text style={styles.permaLabel}>Accomplishment</Text>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${profile.wellnessProfile.currentScores.accomplishment * 10}%` }]} />
            </View>
            <Text style={styles.scoreNumber}>{profile.wellnessProfile.currentScores.accomplishment}/10</Text>
          </View>
        </View>
        
        {/* Show focus areas */}
        {profile.wellnessProfile.focusAreas.length > 0 && (
          <View style={styles.focusAreasContainer}>
            <Text style={styles.focusAreasTitle}>Areas to Focus On:</Text>
            <Text style={styles.focusAreasText}>
              {profile.wellnessProfile.focusAreas
                .map(area => area.charAt(0).toUpperCase() + area.slice(1))
                .join(', ')
              }
            </Text>
          </View>
        )}
      </View>

      {/* Enhanced Interests Display */}
      <View style={[styles.card, styles.goalCard]}>
        <Text style={styles.goalTitle}>Your Top Interests</Text>
        {profile.contentPreferences.primaryInterests.length > 0 && (
          <View style={styles.interestsGrid}>
            {profile.contentPreferences.primaryInterests.slice(0, 6).map((interest, index) => (
              <View key={index} style={styles.interestBadge}>
                <Text style={styles.interestBadgeText}>{interest}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Communication Style */}
      <View style={[styles.card, styles.goalCard]}>
        <Text style={styles.goalTitle}>Your AI Chat Style</Text>
        <Text style={styles.goalText}>
          Communication: {profile.userCore.communicationStyle}
        </Text>
        <Text style={styles.goalText}>
          Support Level: {profile.userCore.emotionalSupport}
        </Text>
      </View>

      {/* Happiness Sources */}
      {profile.wellnessProfile.happinessSources.length > 0 && (
        <View style={[styles.card, styles.goalCard]}>
          <Text style={styles.goalTitle}>What Makes You Happy</Text>
          <View style={styles.happinessSourcesContainer}>
            {profile.wellnessProfile.happinessSources.map((source, index) => (
              <Text key={index} style={styles.happinessSource}>• {source}</Text>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
        <Text style={styles.continueButtonText}>View Your Profile</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your profile helps us personalize your experience and boost your happiness.
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
  focusAreasContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: theme.borderRadius.md,
  },
  focusAreasTitle: {
    ...theme.typography.caption,
    color: '#92400E',
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  focusAreasText: {
    ...theme.typography.caption,
    color: '#92400E',
    textTransform: 'capitalize',
  },
  permaScoresContainer: {
    gap: theme.spacing.md,
  },
  permaScore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permaLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
    fontWeight: '500',
  },
  scoreBar: {
    flex: 2,
    height: 8,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 4,
    marginHorizontal: theme.spacing.md,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    backgroundColor: theme.colors.primary.main,
    borderRadius: 4,
  },
  scoreNumber: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'right',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  interestBadge: {
    backgroundColor: theme.colors.primary.light + '20',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  interestBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  happinessSourcesContainer: {
    marginTop: theme.spacing.sm,
  },
  happinessSource: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    lineHeight: 20,
  },
});