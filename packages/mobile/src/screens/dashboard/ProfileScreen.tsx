import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
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
  Star
} from 'lucide-react-native';
import { theme, screenStyles } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getPersonaPrompt } from '../../lib/chat/persona';
import { getPERMAGuidance } from '../../lib/chat/permaGuide';
import { useLatestAssessment, clearAssessmentCache } from '../../hooks/useLatestAssessment';

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

  // Use the enhanced hook with all its capabilities
  const { 
    assessment: assessmentResult, 
    loading: assessmentLoading, 
    hasAssessment,
    refresh: refreshAssessment,
    // Use composite helpers for easy data access
    getProfileData,
    getChatConfig,
    getContentConfig,
    getWellnessConfig,
    // Specific helpers for display
    getMBTIType,
    getHappinessScores,
    getFocusAreas,
    getStrengths,
    getPrimaryInterests,
    getRecommendedServices,
    getWellnessGoals,
    getUserName,
    getLowestPERMAScore,
    getHighestPERMAScore,
    needsUpdate
  } = useLatestAssessment(user?.id || '');

  // Only reload profile data when screen is focused - don't refresh assessment automatically
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadUserData();
      }
    }, [user])
  );

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Load user profile
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
    // Only refresh assessment if user explicitly pulls to refresh
    refreshAssessment();
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
    // Clear the assessment cache before navigating to assessment
    if (user) {
      clearAssessmentCache(user.id);
    }
    navigation.navigate('AssessmentIntro');
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return 'N/A';
    }
  };

  const renderInfoCard = (icon: React.ReactNode, title: string, value: string, subtitle?: string) => (
    <View style={screenStyles.card}>
      <View style={styles.infoCardHeader}>
        {icon}
        <Text style={styles.infoCardTitle}>{title}</Text>
      </View>
      <Text style={styles.infoCardValue}>{value}</Text>
      {subtitle && <Text style={styles.infoCardSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderPersonalityInsights = () => {
    if (!hasAssessment) return null;

    const mbtiType = getMBTIType();
    const chatConfig = getChatConfig();
    const userName = getUserName();

    return (
      <View style={screenStyles.contentWithPadding}>
        <Text style={screenStyles.headerTitle}>Personality Profile</Text>
        
        {/* User Name */}
        {userName && renderInfoCard(
          <User size={20} color="#8B5CF6" />,
          'Your Name',
          userName,
          'From your assessment'
        )}

        {/* MBTI Type with description */}
        {mbtiType && renderInfoCard(
          <Brain size={20} color="#6366F1" />,
          'Personality Type',
          mbtiType,
          'Your MBTI personality type'
        )}

        {/* AI Communication Style */}
        {chatConfig.communicationStyle && renderInfoCard(
          <MessageCircle size={20} color="#06B6D4" />,
          'AI Communication',
          `${chatConfig.communicationStyle} style`,
          `${chatConfig.emotionalSupport} emotional support level`
        )}
      </View>
    );
  };

  const renderHappinessProfile = () => {
    if (!hasAssessment) return null;

    const happinessScores = getHappinessScores();
    const focusAreas = getFocusAreas();
    const strengths = getStrengths();
    const lowestScore = getLowestPERMAScore();
    const highestScore = getHighestPERMAScore();

    if (!happinessScores) return null;

    return (
      <View style={screenStyles.contentWithPadding}>
        <Text style={screenStyles.headerTitle}>Happiness Profile</Text>
        
        {/* PERMA Scores with enhanced visualization */}
        <View style={screenStyles.card}>
          <View style={styles.infoCardHeader}>
            <Lightbulb size={20} color="#F59E0B" />
            <Text style={styles.infoCardTitle}>PERMA Happiness Dimensions</Text>
          </View>
          
          <View style={styles.permaScoresContainer}>
            {Object.entries(happinessScores).map(([key, value]) => {
              const isStrength = strengths.includes(key);
              const isFocusArea = focusAreas.includes(key);
              const isLowest = lowestScore?.dimension === key;
              const isHighest = highestScore?.dimension === key;
              
              const getDimensionName = (dim: string) => {
                const names: Record<string, string> = {
                  positiveEmotion: 'Positive Emotion',
                  engagement: 'Engagement',
                  relationships: 'Relationships',
                  meaning: 'Meaning',
                  accomplishment: 'Accomplishment'
                };
                return names[dim] || dim;
              };
              
              const getScoreColor = (score: number) => {
                if (score >= 8) return '#10B981'; // Green
                if (score >= 6) return '#F59E0B'; // Orange
                return '#EF4444'; // Red
              };
              
              return (
                <View key={key} style={styles.permaScoreRow}>
                  <View style={styles.permaScoreInfo}>
                    <Text style={[
                      styles.permaScoreLabel,
                      { color: getScoreColor(value) }
                    ]}>
                      {getDimensionName(key)}
                    </Text>
                    <View style={styles.badgeContainer}>
                      {isHighest && <Text style={styles.highestBadge}>Highest</Text>}
                      {isLowest && <Text style={styles.lowestBadge}>Needs Focus</Text>}
                      {isStrength && !isHighest && <Text style={styles.strengthBadge}>Strength</Text>}
                    </View>
                  </View>
                  <View style={styles.scoreContainer}>
                    <Text style={[
                      styles.permaScoreValue,
                      { color: getScoreColor(value) }
                    ]}>
                      {value}
                    </Text>
                    <Text style={styles.scoreOutOf}>/10</Text>
                  </View>
                </View>
              );
            })}
          </View>
          
          {/* Quick insights */}
          <View style={styles.insightsContainer}>
            {lowestScore && (
              <Text style={styles.insightText}>
                💡 Focus on improving your {lowestScore.dimension.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </Text>
            )}
            {highestScore && (
              <Text style={styles.insightText}>
                ⭐ Your {highestScore.dimension.replace(/([A-Z])/g, ' $1').toLowerCase()} is your strongest area
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderPersonalizationInsights = () => {
    if (!hasAssessment) return null;

    const contentConfig = getContentConfig();
    const wellnessConfig = getWellnessConfig();
    const primaryInterests = getPrimaryInterests();
    const recommendedServices = getRecommendedServices();
    const wellnessGoals = getWellnessGoals();

    return (
      <View style={screenStyles.contentWithPadding}>
        <Text style={screenStyles.headerTitle}>Your Personalization</Text>
        
        {/* Primary Interests */}
        {primaryInterests.length > 0 && renderInfoCard(
          <Heart size={20} color="#EC4899" />,
          'Top Interests',
          primaryInterests.slice(0, 5).join(', '),
          `Content preferences for personalized recommendations`
        )}

        {/* Focus Areas for Growth */}
        {wellnessConfig.focusAreas.length > 0 && renderInfoCard(
          <TrendingUp size={20} color="#EF4444" />,
          'Growth Opportunities',
          wellnessConfig.focusAreas.map(area => 
            area.replace(/([A-Z])/g, ' $1').toLowerCase()
          ).join(' & '),
          'Areas where targeted interventions can help most'
        )}

        {/* Wellness Goals */}
        {wellnessGoals.length > 0 && renderInfoCard(
          <Target size={20} color="#8B5CF6" />,
          'Wellness Goals',
          wellnessGoals.slice(0, 3).join(', '),
          'Personalized outcomes based on your assessment'
        )}

        {/* Recommended Service Types */}
        {recommendedServices.length > 0 && renderInfoCard(
          <Star size={20} color="#10B981" />,
          'Recommended Services',
          recommendedServices.slice(0, 4).join(', '),
          'Service types that match your personality and needs'
        )}

        {/* Content Focus Areas */}
        {contentConfig.focusAreaContent && contentConfig.focusAreaContent.length > 0 && renderInfoCard(
          <Lightbulb size={20} color="#F59E0B" />,
          'Suggested Content',
          contentConfig.focusAreaContent.slice(0, 4).join(', '),
          'Content types to boost your focus areas'
        )}
      </View>
    );
  };

  const renderAssessmentActions = () => {
    if (!hasAssessment) return null;

    const updateNeeded = needsUpdate();

    return (
      <View style={screenStyles.contentWithPadding}>
        <Text style={screenStyles.headerTitle}>Assessment Actions</Text>
        
        {/* Update notification if needed */}
        {updateNeeded && (
          <View style={[screenStyles.card, styles.updateCard]}>
            <View style={styles.infoCardHeader}>
              <RefreshCw size={20} color="#F59E0B" />
              <Text style={styles.updateTitle}>Assessment Update Available</Text>
            </View>
            <Text style={styles.updateText}>
              Your assessment was taken with an older version. Retake it to unlock new features and better personalization.
            </Text>
          </View>
        )}

        {/* Retake Assessment Button */}
        <TouchableOpacity
          style={[
            screenStyles.card, 
            styles.actionButton,
            updateNeeded && styles.actionButtonHighlight
          ]}
          onPress={handleRetakeAssessment}
        >
          <Brain size={20} color={updateNeeded ? '#F59E0B' : theme.colors.primary.main} />
          <Text style={[
            theme.typography.button, 
            { 
              color: updateNeeded ? '#F59E0B' : theme.colors.primary.main, 
              fontWeight: '600' 
            }
          ]}>
            {updateNeeded ? 'Update Assessment' : 'Retake Assessment'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Update the condition to also check for assessmentLoading
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

  return (
    <SafeAreaView style={screenStyles.container}>
      <ScrollView 
        style={screenStyles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing || assessmentLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[screenStyles.screenHeader, { alignItems: 'center' }]}>
          <View style={screenStyles.perplexityAvatar}>
            <User size={48} color={theme.colors.primary.main} />
          </View>
          <Text style={screenStyles.perplexityProfileName}>
            {getUserName() || profileData?.name || 'User'}
          </Text>
          <Text style={screenStyles.perplexityProfileEmail}>
            {profileData?.email || 'user@email.com'}
          </Text>
          {hasAssessment && (
            <View style={styles.assessmentBadge}>
              <Text style={styles.assessmentBadgeText}>✓ Assessment Complete</Text>
            </View>
          )}
        </View>

        {/* Basic Info */}
        <View style={screenStyles.contentWithPadding}>
          <Text style={screenStyles.headerTitle}>Account Information</Text>
          {renderInfoCard(
            <Mail size={20} color={theme.colors.primary.main} />,
            'Email Address',
            profileData?.email || 'Not available'
          )}
          {renderInfoCard(
            <Calendar size={20} color={theme.colors.primary.light} />,
            'Member Since',
            formatDate(profileData?.createdAt),
            'Join date'
          )}
        </View>

        {/* Assessment-based sections - only show if assessment exists */}
        {hasAssessment ? (
          <>
            {renderPersonalityInsights()}
            {renderHappinessProfile()}
            {renderPersonalizationInsights()}
            {renderAssessmentActions()}
          </>
        ) : (
          /* No Assessment Message */
          <View style={screenStyles.contentWithPadding}>
            <View style={[screenStyles.emptyState, { borderWidth: 2, borderColor: theme.colors.border, borderStyle: 'dashed' }]}>
              <Brain size={32} color={theme.colors.textSecondary} />
              <Text style={screenStyles.emptyStateTitle}>Assessment Not Completed</Text>
              <Text style={screenStyles.emptyStateText}>
                Complete your personality assessment to unlock personalized AI conversations, content recommendations, and wellness insights.
              </Text>
              <TouchableOpacity
                style={[screenStyles.card, styles.actionButton, { marginTop: theme.spacing.lg }]}
                onPress={() => navigation.navigate('AssessmentIntro')}
              >
                <Brain size={20} color={theme.colors.primary.main} />
                <Text style={[theme.typography.button, { color: theme.colors.primary.main, fontWeight: '600' }]}>
                  Start Assessment
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Sign Out Button */}
        <View style={screenStyles.contentWithPadding}>
          <TouchableOpacity style={[screenStyles.card, styles.signOutButton]} onPress={handleSignOut}>
            <LogOut size={20} color="#EF4444" />
            <Text style={[theme.typography.button, { color: '#EF4444', fontWeight: '600' }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={screenStyles.contentWithPadding}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
            Last updated: {formatDate(profileData?.updatedAt || profileData?.createdAt)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  infoCardTitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    fontWeight: '500',
  },
  infoCardValue: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textTransform: 'capitalize',
  },
  infoCardSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  permaScoresContainer: {
    gap: theme.spacing.sm,
  },
  permaScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  permaScoreInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
  },
  permaScoreLabel: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  strengthLabel: {
    color: '#10B981',
  },
  focusLabel: {
    color: '#EF4444',
  },
  permaScoreValue: {
    ...theme.typography.h5,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  strengthValue: {
    color: '#10B981',
  },
  focusValue: {
    color: '#EF4444',
  },
  strengthBadge: {
    ...theme.typography.caption,
    color: '#10B981',
    backgroundColor: '#10B981' + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    fontSize: 10,
    fontWeight: '600',
  },
  focusBadge: {
    ...theme.typography.caption,
    color: '#EF4444',
    backgroundColor: '#EF4444' + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    fontSize: 10,
    fontWeight: '600',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreOutOf: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginLeft: 2,
  },
  highestBadge: {
    ...theme.typography.caption,
    color: '#10B981',
    backgroundColor: '#10B981' + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    fontSize: 10,
    fontWeight: '600',
  },
  lowestBadge: {
    ...theme.typography.caption,
    color: '#EF4444',
    backgroundColor: '#EF4444' + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    fontSize: 10,
    fontWeight: '600',
  },
  insightsContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  insightText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  assessmentBadge: {
    backgroundColor: '#10B981' + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
    marginTop: theme.spacing.sm,
  },
  assessmentBadgeText: {
    ...theme.typography.caption,
    color: '#10B981',
    fontWeight: '600',
  },
  updateCard: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B' + '10',
  },
  updateTitle: {
    ...theme.typography.body,
    color: '#F59E0B',
    marginLeft: theme.spacing.sm,
    fontWeight: '600',
  },
  updateText: {
    ...theme.typography.body,
    color: '#F59E0B',
    marginTop: theme.spacing.xs,
  },
  actionButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary.main,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  actionButtonHighlight: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B' + '10',
  },
  signOutButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: theme.spacing.sm,
  },
});
