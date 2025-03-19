import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Brain, Target, Trophy, TrendingUp, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getLatestAssessment } from '@shared/assessment/assessment';
import { getUserBadges, checkAndAwardBadges } from '@shared/dashboard/badges';
import { getTutorials } from '@shared/tutorial/tutorials';
import { getUser, getLearningGoals, getUserMoodEntries } from '@shared/common/cache';

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState({
    assessment: false,
    goals: { total: 3, completed: 0, set: 0 },
    tutorials: { total: 10, completed: 0 },
    posts: { total: 5, published: 0 }
  });
  const [badges, setBadges] = useState([]);
  const [recommendedTutorials, setRecommendedTutorials] = useState([]);
  const [completedTutorialIds, setCompletedTutorialIds] = useState([]);
  const [psychRecords, setPsychRecords] = useState([]);
  const [latestRating, setLatestRating] = useState(0);
  const [psychTrend, setPsychTrend] = useState(0);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Get user data
      const userData = await getUser(user.id);
      if (!userData) return;
      
      setCompletedTutorialIds(userData.completedTutorials || []);

      // Get learning goals
      const goals = await getLearningGoals(user.id);
      const completedGoals = goals.filter(g => g.status === 'completed').length;
      const totalGoalsSet = goals.length;

      const completedTutorials = userData.completedTutorials?.length || 0;
      const publishedPosts = userData.publishedPosts?.length || 0;

      const assessmentResult = await getLatestAssessment(user.id);

      setProgress({
        assessment: !!assessmentResult.data,
        goals: {
          total: 3,
          completed: completedGoals,
          set: totalGoalsSet
        },
        tutorials: {
          total: 10,
          completed: completedTutorials
        },
        posts: {
          total: 5,
          published: publishedPosts
        }
      });

      // Get badges
      await checkAndAwardBadges(user.id);
      const userBadges = await getUserBadges(user.id);
      setBadges(userBadges);

      // Get recommended tutorials
      const recTutorials = await getTutorials(1, 3);
      setRecommendedTutorials(recTutorials);

      // Get psychological data
      const records = await getUserMoodEntries(user.id);
      setPsychRecords(records);
      
      if (records.length) {
        setLatestRating(records[0].rating);
      }
      if (records.length > 1) {
        const oldest = records[records.length - 1].rating;
        const newest = records[0].rating;
        setPsychTrend(newest - oldest);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your AI Adaptation Journey</Text>
          <Text style={styles.subtitle}>Track your progress and access personalized resources</Text>
        </View>
      </View>

      {/* Progress Cards */}
      <View style={styles.progressGrid}>
        <TouchableOpacity 
          style={styles.progressCard}
          onPress={() => navigation.navigate('Progress')}
        >
          <View style={styles.cardIcon}>
            <Target size={24} color="#4f46e5" />
          </View>
          <Text style={styles.cardTitle}>Progress</Text>
          <Text style={styles.cardValue}>{Math.round(
            ((progress.assessment ? 1 : 0) +
              (progress.goals.completed / Math.max(progress.goals.total, 1)) +
              (progress.tutorials.completed / Math.max(progress.tutorials.total, 1)) +
              (progress.posts.published / Math.max(progress.posts.total, 1))) /
              4 *
              100
          )}%</Text>
          <Text style={styles.cardLabel}>Completion rate</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.progressCard}
          onPress={() => navigation.navigate('Badges')}
        >
          <View style={styles.cardIcon}>
            <Trophy size={24} color="#22c55e" />
          </View>
          <Text style={styles.cardTitle}>Achievements</Text>
          <Text style={styles.cardValue}>{badges.length}</Text>
          <Text style={styles.cardLabel}>Badges earned</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.progressCard}
          onPress={() => navigation.navigate('Mind')}
        >
          <View style={styles.cardIcon}>
            <TrendingUp size={24} color="#8b5cf6" />
          </View>
          <Text style={styles.cardTitle}>Mind Tracker</Text>
          <Text style={styles.cardValue}>
            {latestRating ? `Rating: ${latestRating}` : 'No Data'}
          </Text>
          {psychRecords.length > 1 && (
            <Text style={styles.cardLabel}>
              Trend: {psychTrend > 0 ? `+${psychTrend}` : psychTrend}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Recommended Tutorials */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended Tutorials</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Tutorials')}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {recommendedTutorials.map((tutorial) => (
          <TouchableOpacity
            key={tutorial.id}
            style={styles.tutorialCard}
            onPress={() => navigation.navigate('TutorialDetail', { id: tutorial.id })}
          >
            <Text style={styles.tutorialTitle}>{tutorial.title}</Text>
            <Text style={styles.tutorialDescription} numberOfLines={2}>
              {tutorial.content}
            </Text>
            <View style={styles.tutorialFooter}>
              <Text style={styles.tutorialDifficulty}>{tutorial.difficulty}</Text>
              <Text style={styles.tutorialDuration}>{tutorial.estimatedMinutes} min</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Learning Path */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Learning Path</Text>
        <View style={styles.learningPath}>
          <View style={styles.pathItem}>
            <View style={[styles.pathDot, progress.assessment && styles.pathDotCompleted]} />
            <View style={styles.pathContent}>
              <Text style={styles.pathTitle}>Complete Assessment</Text>
              <Text style={styles.pathStatus}>
                {progress.assessment ? 'Completed' : 'Pending'}
              </Text>
            </View>
          </View>

          <View style={styles.pathItem}>
            <View style={[styles.pathDot, progress.goals.set >= progress.goals.total && styles.pathDotCompleted]} />
            <View style={styles.pathContent}>
              <Text style={styles.pathTitle}>Set Learning Goals</Text>
              <Text style={styles.pathStatus}>
                {progress.goals.set === 0
                  ? 'Not Started'
                  : progress.goals.set >= progress.goals.total
                  ? 'Completed'
                  : `${progress.goals.set} of ${progress.goals.total} goals set`}
              </Text>
            </View>
          </View>

          <View style={styles.pathItem}>
            <View style={[styles.pathDot, progress.tutorials.completed > 0 && styles.pathDotCompleted]} />
            <View style={styles.pathContent}>
              <Text style={styles.pathTitle}>Complete Tutorials</Text>
              <Text style={styles.pathStatus}>
                {progress.tutorials.completed === 0
                  ? 'Not Started'
                  : `${progress.tutorials.completed} completed`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  progressGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  progressCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  cardLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  sectionLink: {
    fontSize: 14,
    color: '#4f46e5',
  },
  tutorialCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tutorialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  tutorialDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  tutorialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tutorialDifficulty: {
    fontSize: 12,
    color: '#4f46e5',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tutorialDuration: {
    fontSize: 12,
    color: '#6b7280',
  },
  learningPath: {
    marginTop: 12,
  },
  pathItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pathDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  pathDotCompleted: {
    backgroundColor: '#4f46e5',
  },
  pathContent: {
    flex: 1,
  },
  pathTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  pathStatus: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
});

export default DashboardScreen;