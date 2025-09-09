import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  User, 
  Mail, 
  Brain, 
  Lightbulb, 
  LogOut, 
  RefreshCw,
  Calendar,
  Target,
  Heart,
  MessageCircle,
  TrendingUp,
  Star,
  Activity,
  Zap,
  Settings,
  Award,
  BarChart3
} from 'lucide-react-native';
import { theme, screenStyles } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { usePersonalization } from '../../hooks/usePersonalization';

const { width } = Dimensions.get('window');
const cardWidth = (width - theme.spacing.lg * 3) / 2;

interface UserProfileData {
  name: string;
  email: string;
  mbtiType?: string;
  hasCompletedAssessment?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export default function ProfileScreen() {
  const { user, signOut: authSignOut } = useAuth();
  const { getUserProfile } = useFirebase();
  const navigation = useNavigation<any>();
  
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const {
    profile: personalizationProfile,
    loading: personalizationLoading,
    loadProfile,
    generateTopicQueries
  } = usePersonalization(user?.id || '');

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadUserData();
        loadProfile();
      }
    }, [user, loadProfile])
  );

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const profileResult = await getUserProfile(user.id);
      if (profileResult.success) {
        setProfileData({
          name: user.name,
          email: user.email,
          ...profileResult.data
        });
      } else {
        setProfileData({
          name: user.name,
          email: user.email,
          hasCompletedAssessment: user.hasCompletedAssessment || false
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    await loadProfile();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            if (authSignOut) {
              const result = await authSignOut();
              if (result.error) {
                Alert.alert('Error', result.error);
              }
            }
          }
        }
      ]
    );
  };

  const handleRetakeAssessment = () => {
    navigation.navigate('AssessmentIntro');
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const renderStatCard = (icon: React.ReactNode, title: string, value: string, color: string = theme.colors.primary.main) => (
    <View style={[styles.statCard, { width: cardWidth }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const renderPermaChart = () => {
    if (!personalizationProfile?.wellnessProfile?.currentScores) return null;

    const { currentScores } = personalizationProfile.wellnessProfile;
    const maxScore = Math.max(...Object.values(currentScores));
    
    return (
      <View style={styles.permaChart}>
        <Text style={styles.sectionTitle}>PERMA Happiness Profile</Text>
        <View style={styles.permaContainer}>
          {Object.entries(currentScores).map(([key, value]) => {
            const height = (value / 10) * 100;
            const getDimensionName = (dim: string) => {
              const names: Record<string, string> = {
                positiveEmotion: 'Positive',
                engagement: 'Engage',
                relationships: 'Relations',
                meaning: 'Meaning',
                accomplishment: 'Achieve'
              };
              return names[dim] || dim;
            };
            
            const getColor = (score: number) => {
              if (score >= 8) return '#10B981';
              if (score >= 6) return '#F59E0B';
              return '#EF4444';
            };
            
            return (
              <View key={key} style={styles.permaItem}>
                <View style={styles.permaBarContainer}>
                  <View style={[styles.permaBar, { height: `${height}%`, backgroundColor: getColor(value) }]} />
                </View>
                <Text style={styles.permaScore}>{value}</Text>
                <Text style={styles.permaLabel}>{getDimensionName(key)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderInterestsPreview = () => {
    if (!personalizationProfile?.contentPreferences?.primaryInterests?.length) return null;

    const interests = personalizationProfile.contentPreferences.primaryInterests.slice(0, 4);
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Heart size={20} color={theme.colors.primary.main} />
          <Text style={styles.sectionTitle}>Top Interests</Text>
        </View>
        <View style={styles.interestsPreview}>
          {interests.map((interest, index) => (
            <View key={index} style={styles.interestTag}>
              <Text style={styles.interestTagText}>{interest}</Text>
            </View>
          ))}
          {personalizationProfile.contentPreferences.primaryInterests.length > 4 && (
            <View style={[styles.interestTag, styles.moreTag]}>
              <Text style={styles.moreTagText}>+{personalizationProfile.contentPreferences.primaryInterests.length - 4}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading && !profileData) {
    return (
      <SafeAreaView style={screenStyles.container}>
        <View style={screenStyles.loadingContainer}>
          <RefreshCw size={32} color={theme.colors.primary.main} />
          <Text style={screenStyles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasPersonalization = !!personalizationProfile;
  const userName = profileData?.name || 'User';
  const mbtiType = personalizationProfile?.userCore?.mbtiType;
  const overallHappiness = personalizationProfile?.computed?.overallHappiness;
  const totalMessages = personalizationProfile?.activityTracking?.chatMetrics?.totalMessages || 0;
  const engagementLevel = personalizationProfile?.computed?.engagementLevel || 'Low';

  return (
    <SafeAreaView style={screenStyles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing || personalizationLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <User size={40} color={theme.colors.white} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{profileData?.email}</Text>
            {mbtiType && (
              <View style={styles.mbtiTag}>
                <Brain size={14} color={theme.colors.primary.main} />
                <Text style={styles.mbtiText}>{mbtiType}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={() => {}}>
            <Settings size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {hasPersonalization ? (
          <>
            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              {renderStatCard(
                <Heart size={20} color="#EC4899" />,
                'Happiness',
                overallHappiness ? `${overallHappiness.toFixed(1)}/10` : 'N/A',
                '#EC4899'
              )}
              {renderStatCard(
                <MessageCircle size={20} color="#06B6D4" />,
                'Messages',
                totalMessages.toString(),
                '#06B6D4'
              )}
            </View>

            <View style={styles.statsContainer}>
              {renderStatCard(
                <Activity size={20} color="#8B5CF6" />,
                'Engagement',
                engagementLevel,
                '#8B5CF6'
              )}
              {renderStatCard(
                <Calendar size={20} color="#10B981" />,
                'Member Since',
                formatDate(profileData?.createdAt),
                '#10B981'
              )}
            </View>

            {/* PERMA Chart */}
            {renderPermaChart()}

            {/* Interests */}
            {renderInterestsPreview()}

            {/* Communication Style */}
            {personalizationProfile?.userCore?.communicationStyle && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MessageCircle size={20} color={theme.colors.primary.main} />
                  <Text style={styles.sectionTitle}>AI Chat Style</Text>
                </View>
                <View style={styles.communicationCard}>
                  <Text style={styles.communicationStyle}>
                    {personalizationProfile.userCore.communicationStyle} • {personalizationProfile.userCore.emotionalSupport}
                  </Text>
                </View>
              </View>
            )}

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionCard} onPress={handleRetakeAssessment}>
                  <Brain size={24} color={theme.colors.primary.main} />
                  <Text style={styles.actionText}>Update Assessment</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionCard} onPress={() => {}}>
                  <BarChart3 size={24} color="#10B981" />
                  <Text style={styles.actionText}>View Analytics</Text>
                </TouchableOpacity>
              </View>
            </View>

          </>
        ) : (
          /* No Personalization State */
          <View style={styles.emptyState}>
            <Brain size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyStateTitle}>Complete Your Profile</Text>
            <Text style={styles.emptyStateText}>
              Take our personality assessment to unlock personalized AI conversations and insights.
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={handleRetakeAssessment}>
              <Text style={styles.startButtonText}>Start Assessment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.md,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  userName: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  userEmail: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  mbtiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary.light + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  mbtiText: {
    ...theme.typography.caption,
    color: theme.colors.primary.main,
    fontWeight: '600',
  },
  settingsButton: {
    padding: theme.spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statValue: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  statTitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    fontWeight: '600',
  },
  permaChart: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  permaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  permaItem: {
    alignItems: 'center',
    flex: 1,
  },
  permaBarContainer: {
    height: 80,
    width: 24,
    backgroundColor: theme.colors.gray[100],
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  permaBar: {
    width: '100%',
    borderRadius: 12,
    minHeight: 8,
  },
  permaScore: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: 'bold',
    marginTop: theme.spacing.xs,
  },
  permaLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  interestsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  interestTag: {
    backgroundColor: theme.colors.primary.light + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
  },
  interestTagText: {
    ...theme.typography.caption,
    color: theme.colors.primary.main,
    fontWeight: '500',
  },
  moreTag: {
    backgroundColor: theme.colors.gray[100],
  },
  moreTagText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  communicationCard: {
    backgroundColor: theme.colors.gray[50],
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  communicationStyle: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionText: {
    ...theme.typography.caption,
    color: theme.colors.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyStateTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: 'bold',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyStateText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.lg,
  },
  startButton: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  startButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  signOutText: {
    ...theme.typography.button,
    color: '#EF4444',
    fontWeight: '600',
  },
});
