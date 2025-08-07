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
  Target
} from 'lucide-react-native';
import { theme, screenStyles } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getPersonaPrompt } from '../../lib/chat/persona';
import { getPERMAGuidance } from '../../lib/chat/permaGuide';

interface UserProfileData {
  name: string;
  email: string;
  mbtiType?: string;
  hasCompletedAssessment?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface AssessmentData {
  mbti_type?: string;
  perma?: {
    positiveEmotion: number;
    engagement: number;
    relationships: number;
    meaning: number;
    accomplishment: number;
  };
  nickname?: string;
  interests?: string[];
  primary_goal?: string;
  createdAt?: any;
}

export default function ProfileScreen() {
  const { user, signOut: authSignOut } = useAuth();
  const { getUserProfile, getUserAssessment } = useFirebase();
  const navigation = useNavigation<any>();
  
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reload profile and assessment data when screen is focused (e.g. after retake)
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
        // Use basic user data if profile doesn't exist
        setProfileData({
          name: user.name,
          email: user.email,
          hasCompletedAssessment: user.hasCompletedAssessment || false
        });
      }

      // Always fetch the latest assessment (not just if user.hasCompletedAssessment)
      const assessmentResult = await getUserAssessment(user.id);
      if (assessmentResult.success && assessmentResult.data.length > 0) {
        // Sort by createdAt descending, pick the latest
        const sorted = assessmentResult.data
          .slice()
          .sort((a: AssessmentData, b: AssessmentData) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
            return bTime - aTime;
          });
        setAssessmentData(sorted[0]);
        // Update profileData.hasCompletedAssessment if needed
        setProfileData(prev => prev ? { ...prev, hasCompletedAssessment: true } : prev);
      } else {
        setAssessmentData(null);
        setProfileData(prev => prev ? { ...prev, hasCompletedAssessment: false } : prev);
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[screenStyles.screenHeader, { alignItems: 'center' }]}>
          <View style={screenStyles.perplexityAvatar}>
            <User size={48} color={theme.colors.primary.main} />
          </View>
          <Text style={screenStyles.perplexityProfileName}>{profileData?.name || 'User'}</Text>
          <Text style={screenStyles.perplexityProfileEmail}>{profileData?.email || 'user@email.com'}</Text>
        </View>

        {/* Basic Info */}
        <View style={screenStyles.contentWithPadding}>
          <Text style={screenStyles.headerTitle}>Profile Information</Text>
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

        {/* Assessment Results */}
        {profileData?.hasCompletedAssessment && (
          <View style={screenStyles.contentWithPadding}>
            <Text style={screenStyles.headerTitle}>Assessment Results</Text>
            
            {assessmentData?.mbti_type && renderInfoCard(
              <Brain size={20} color="#6366F1" />,
              'Personality Type',
              assessmentData.mbti_type,
              'MBTI assessment result'
            )}

            {/* MBTI Persona */}
            {assessmentData?.mbti_type && (
              <View style={screenStyles.card}>
                <Text style={styles.infoCardTitle}>AI Chat Persona</Text>
                <Text style={styles.infoCardSubtitle}>
                  {getPersonaPrompt(assessmentData.mbti_type, assessmentData.nickname)}
                </Text>
              </View>
            )}

            {assessmentData?.perma && (
              <View style={screenStyles.card}>
                <View style={styles.infoCardHeader}>
                  <Lightbulb size={20} color="#F59E0B" />
                  <Text style={styles.infoCardTitle}>PERMA (Happiness Dimensions)</Text>
                </View>
                <Text style={styles.infoCardValue}>
                  PE: {assessmentData.perma.positiveEmotion} / 10{'\n'}
                  E: {assessmentData.perma.engagement} / 10{'\n'}
                  R: {assessmentData.perma.relationships} / 10{'\n'}
                  M: {assessmentData.perma.meaning} / 10{'\n'}
                  A: {assessmentData.perma.accomplishment} / 10
                </Text>
                {/* PERMA Focus Area */}
                <Text style={styles.infoCardSubtitle}>
                  {getPERMAGuidance(assessmentData.perma)}
                </Text>
              </View>
            )}

            {assessmentData?.interests && assessmentData.interests.length > 0 && renderInfoCard(
              <Lightbulb size={20} color="#F59E0B" />,
              'Interests',
              assessmentData.interests.join(', ')
            )}

            {assessmentData?.primary_goal && renderInfoCard(
              <Target size={20} color="#8B5CF6" />,
              'Fulfillment Driver',
              assessmentData.primary_goal
            )}

            {assessmentData?.createdAt && renderInfoCard(
              <Calendar size={20} color={theme.colors.primary.light} />,
              'Assessment Completed',
              formatDate(assessmentData.createdAt),
              'Last assessment date'
            )}

            {/* Retake Assessment Button */}
            <TouchableOpacity
              style={[screenStyles.card, { 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.colors.primary.main,
                gap: theme.spacing.sm,
                marginTop: theme.spacing.md,
              }]}
              onPress={handleRetakeAssessment}
            >
              <Brain size={20} color={theme.colors.primary.main} />
              <Text style={[theme.typography.button, { color: theme.colors.primary.main, fontWeight: '600' }]}>
                Retake Assessment
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No Assessment Message */}
        {!profileData?.hasCompletedAssessment && (
          <View style={screenStyles.contentWithPadding}>
            <View style={[screenStyles.emptyState, { borderWidth: 2, borderColor: theme.colors.border, borderStyle: 'dashed' }]}>
              <Brain size={32} color={theme.colors.textSecondary} />
              <Text style={screenStyles.emptyStateTitle}>Assessment Not Completed</Text>
              <Text style={screenStyles.emptyStateText}>
                Complete your personality assessment to unlock personalized recommendations.
              </Text>
            </View>
          </View>
        )}

        {/* Sign Out Button */}
        <View style={screenStyles.contentWithPadding}>
          <TouchableOpacity style={[screenStyles.card, { 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#EF4444',
            gap: theme.spacing.sm,
          }]} onPress={handleSignOut}>
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
});
