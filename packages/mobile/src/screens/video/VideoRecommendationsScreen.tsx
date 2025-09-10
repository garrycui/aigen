import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Modal,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, TrendingUp, Target, Heart, Play, X, ArrowLeft, ExternalLink } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { usePersonalization } from '../../hooks/usePersonalization';
import { useInteractionTracking } from '../../hooks/useInteractionTracking';
import { useVideoBehaviorTracking } from '../../hooks/useVideoBehaviorTracking';
import { useIntelligentVideoRecommendations } from '../../hooks/useIntelligentVideoRecommendations';
import { getIntelligentPersonalizedVideos, YouTubeVideo, UnifiedVideoResponse, getQuotaStatus } from '../../lib/video/videoRecommender';
import { SimpleQuotaManager } from '../../lib/video/simpleQuotaManager';
import FullScreenVideoList from '../../components/video/FullScreenVideoList';
import { theme } from '../../theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function VideoRecommendationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { profile: personalization, loading: personalizationLoading, hasCompletedAssessment } = usePersonalization(user?.id || '');
  const { trackTopicEngagement, trackVideoInteraction } = useInteractionTracking(user?.id || '');
  const { trackBehavior, generateAdaptiveQueries, backgroundLoader } = useVideoBehaviorTracking(user?.id || '');
  const { 
    generateHybridQueries, 
    trackIntelligentInteraction, 
    calculateMixingRatio, 
    getEngagementProfile,
    isReady 
  } = useIntelligentVideoRecommendations(user?.id || '');
  
  // State management - Updated for full-screen experience
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [quotaManager] = useState(() => SimpleQuotaManager.getInstance());
  
  // Background video loading
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastBackgroundLoadRef = useRef<number>(0);

  const fetchVideoSections = useCallback(async (useIntelligentMixing: boolean = false, append: boolean = false) => {
    if (!user) {
      setError('Please log in to see personalized videos');
      setLoading(false);
      return;
    }

    if (personalizationLoading || !isReady) {
      console.log('⏳ [VideoScreen] Waiting for personalization and intelligence to load...');
      return;
    }

    if (!personalization || !hasCompletedAssessment) {
      console.log('⚠️ [VideoScreen] No personalization found or assessment not completed');
      setError('assessment_required');
      setLoading(false);
      return;
    }
    
    if (!append) setLoading(true);
    setError(null);
    
    try {
      // Check YouTube API quota status first
      const quotaStatus = getQuotaStatus();
      if (quotaStatus.isExceeded) {
        console.warn('🚫 [VideoScreen] YouTube API quota exceeded');
        setError(`YouTube API limit reached. Videos will be available again in ${quotaStatus.hoursUntilReset} hours.`);
        setLoading(false);
        return;
      }

      // Initialize quota manager
      await quotaManager.init();
      const quotaInfo = quotaManager.getQuotaInfo();
      
      console.log('🧠 [VideoScreen] Fetching videos with quota-aware mixing:', {
        useIntelligentMixing,
        quotaStatus: quotaInfo.status,
        remaining: quotaInfo.remaining
      });
      
      let response: UnifiedVideoResponse;
      
      if (useIntelligentMixing && quotaManager.canMakeAPICall()) {
        // Use intelligent recommendation system with quota awareness
        const hybridQueries = generateHybridQueries();
        const mixingRatio = calculateMixingRatio();
        
        // Limit queries based on quota status
        const maxQueries = quotaInfo.status === 'critical' ? 1 : quotaInfo.status === 'warning' ? 2 : 3;
        
        // Prioritize queries based on user behavior
        const userInteractions: any[] = []; // Get from engagement profile
        const engagementProfile = getEngagementProfile();
        
        console.log('🎯 [VideoScreen] Using intelligent mixing with quota limits:', {
          queries: {
            profile: Math.min(hybridQueries.profileQueries.length, maxQueries),
            behavior: Math.min(hybridQueries.behaviorQueries.length, maxQueries),
            exploration: Math.min(hybridQueries.explorationQueries.length, 1)
          },
          ratio: mixingRatio,
          quotaLimited: maxQueries < 3,
          engagementStats: {
            totalInteractions: engagementProfile.totalInteractions,
            avgScore: engagementProfile.avgEngagementScore
          }
        });
        
        response = await getIntelligentPersonalizedVideos(
          personalization,
          {
            profileQueries: hybridQueries.profileQueries.slice(0, maxQueries),
            behaviorQueries: hybridQueries.behaviorQueries.slice(0, maxQueries),
            explorationQueries: hybridQueries.explorationQueries.slice(0, 1)
          },
          mixingRatio,
          {
            pageSize: quotaInfo.status === 'critical' ? 20 : 40, // Smaller batch if quota limited
            userLanguage: 'en'
          }
        );
      } else if (quotaManager.canMakeAPICall()) {
        // Fallback to simpler approach with quota awareness
        const adaptiveQueries = generateAdaptiveQueries();
        const quotaAwareQueries = adaptiveQueries.length > 0 ? adaptiveQueries.slice(0, 2) : [
          'motivation tutorial',
          'productivity tips'
        ];
        
        response = await getIntelligentPersonalizedVideos(
          personalization,
          {
            profileQueries: quotaAwareQueries,
            behaviorQueries: [],
            explorationQueries: ['wellness guide', 'personal development']
          },
          { profileWeight: 0.7, behaviorWeight: 0.1, explorationWeight: 0.2 },
          {
            pageSize: 25,
            userLanguage: 'en'
          }
        );
      } else {
        // No quota available - show cached content only
        console.warn('⚠️ [VideoScreen] No API quota available, using cached content only');
        setError('Daily API limit reached. Showing cached content until tomorrow.');
        return;
      }
      
      console.log('✅ [VideoScreen] Received videos:', response.videos.length);
      
      if (append) {
        setVideos(prev => [...prev, ...response.videos]);
      } else {
        setVideos(response.videos);
      }
      
      } catch (error) {
        console.error('❌ [VideoScreen] Error fetching videos:', error);
        
        // Show user-friendly message for quota errors
        if (error instanceof Error && error.message.includes('403')) {
          setError('YouTube API limit reached. Please try again tomorrow.');
        } else {
          setError('Failed to load personalized videos. Please try again.');
        }
        
        if (!append) setVideos([]);
      } finally {
      setLoading(false);
      setBackgroundLoading(false);
    }
  }, [user, personalization, personalizationLoading, hasCompletedAssessment, isReady, generateHybridQueries, calculateMixingRatio, getEngagementProfile, generateAdaptiveQueries, quotaManager]);

  // Background loading triggered by user behavior
  const triggerBackgroundLoad = useCallback(() => {
    const now = Date.now();
    const timeSinceLastLoad = now - lastBackgroundLoadRef.current;
    
    // Avoid too frequent background loads
    if (timeSinceLastLoad < 30000 || backgroundLoading) { // 30 seconds minimum
      return;
    }
    
    lastBackgroundLoadRef.current = now;
    setBackgroundLoading(true);
    
    console.log('🔄 [VideoScreen] Triggering background load with adaptive queries');
    fetchVideoSections(true, true); // Use adaptive queries and append
  }, [fetchVideoSections, backgroundLoading]);

  useEffect(() => {
    fetchVideoSections();
  }, [fetchVideoSections]);

  const handleVideoInteraction = useCallback(async (
    videoId: string, 
    interactionType: 'view' | 'like' | 'dislike' | 'skip' | 'watch' | 'scroll_past'
  ) => {
    const video = videos.find(v => v.videoId === videoId);
    if (!video) return;

    if (interactionType === 'view') {
      setWatchedVideos(prev => new Set([...prev, videoId]));
    }

    // Track with intelligent system for advanced learning
    await trackIntelligentInteraction(
      video,
      interactionType,
      0, // watchDuration - will be updated by view duration callback
      0  // timeOnScreen - will be updated by view duration callback
    );

    // Also track behavior for fallback learning
    trackBehavior({
      videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      topics: video.topicTags,
      duration: 0, // Will be updated by view duration callback
      totalDuration: 30, // Estimated
      interactionType,
      viewOrder: videos.findIndex(v => v.videoId === videoId) + 1,
      timeSpentOnScreen: 0, // Will be updated
      wasPlayed: false // Will be updated
    });

    console.log(`📹 Video ${interactionType}:`, video.title);

    // Trigger background loading based on engagement patterns
    if (interactionType === 'like' || interactionType === 'watch') {
      // User is engaged, prepare more similar content
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(triggerBackgroundLoad, 2000);
    } else if (interactionType === 'scroll_past' || interactionType === 'dislike') {
      // User is not interested, might need different content
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(triggerBackgroundLoad, 5000);
    }
  }, [videos, trackIntelligentInteraction, trackBehavior, triggerBackgroundLoad]);

  const handleVideoViewDuration = useCallback((videoId: string, duration: number, totalDuration: number) => {
    // Update intelligent tracking with actual view duration
    const video = videos.find(v => v.videoId === videoId);
    if (!video) return;

    // Update intelligent system
    trackIntelligentInteraction(
      video,
      duration > totalDuration * 0.7 ? 'watch' : 'view',
      duration,
      duration * 1000 // timeOnScreen in milliseconds
    );

    // Update behavior tracking as well
    trackBehavior({
      videoId,
      title: video.title,
      channelTitle: video.channelTitle,
      topics: video.topicTags,
      duration,
      totalDuration,
      interactionType: duration > totalDuration * 0.7 ? 'watch' : 'view',
      viewOrder: videos.findIndex(v => v.videoId === videoId) + 1,
      timeSpentOnScreen: duration * 1000,
      wasPlayed: true
    });
  }, [videos, trackIntelligentInteraction, trackBehavior]);

  const handleRequestMoreVideos = useCallback(() => {
    console.log('� [VideoScreen] User requested more videos');
    if (!backgroundLoading) {
      triggerBackgroundLoad();
    }
  }, [triggerBackgroundLoad, backgroundLoading]);

  const handleIndexChange = useCallback((index: number) => {
    setCurrentVideoIndex(index);
    
    // Preload more videos when user is getting close to the end
    if (index >= videos.length - 5 && !backgroundLoading) {
      triggerBackgroundLoad();
    }
  }, [videos.length, backgroundLoading, triggerBackgroundLoad]);

  const getSectionIcon = useCallback((permaDimension: string) => {
    const iconMap = {
      positiveEmotion: <Heart color="#f59e0b" size={20} />,
      engagement: <Sparkles color="#8b5cf6" size={20} />,
      relationships: <Heart color="#ec4899" size={20} />,
      meaning: <Target color="#06b6d4" size={20} />,
      accomplishment: <TrendingUp color="#10b981" size={20} />
    };
    return iconMap[permaDimension as keyof typeof iconMap] || <Sparkles color="#6366f1" size={20} />;
  }, []);

  const getSectionGradient = useCallback((permaDimension: string): [string, string] => {
    const gradientMap: Record<string, [string, string]> = {
      positiveEmotion: ['#fef3c7', '#fde68a'],
      engagement: ['#e0e7ff', '#c7d2fe'],
      relationships: ['#fce7f3', '#fbcfe8'],
      meaning: ['#cffafe', '#a7f3d0'],
      accomplishment: ['#d1fae5', '#a7f3d0']
    };
    return gradientMap[permaDimension as keyof typeof gradientMap] || ['#f3f4f6', '#e5e7eb'];
  }, []);

  if (loading || personalizationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text style={styles.loadingText}>
          {personalizationLoading ? 'Loading your profile...' : 'Finding perfect videos for you...'}
        </Text>
      </View>
    );
  }

  if (error === 'assessment_required') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary.main} />
        <View style={styles.errorContainer}>
          <View style={styles.assessmentRequiredContainer}>
            <Sparkles color={theme.colors.primary.main} size={48} />
            <Text style={styles.assessmentRequiredTitle}>Complete Your Assessment</Text>
            <Text style={styles.assessmentRequiredDescription}>
              To get personalized video recommendations, please complete your personality assessment first.
            </Text>
            <TouchableOpacity 
              style={styles.assessmentButton}
              onPress={() => navigation.navigate('Assessment')}
            >
              <Text style={styles.assessmentButtonText}>Start Assessment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary.main} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchVideoSections()}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Background Loading Indicator */}
      {backgroundLoading && (
        <View style={styles.backgroundLoadingIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primary.main} />
          <Text style={styles.backgroundLoadingText}>Loading more videos...</Text>
        </View>
      )}

      {/* Full Screen Video Experience */}
      <FullScreenVideoList
        videos={videos}
        onVideoInteraction={handleVideoInteraction}
        onRequestMoreVideos={handleRequestMoreVideos}
        onVideoViewDuration={handleVideoViewDuration}
        watchedVideos={watchedVideos}
        currentIndex={currentVideoIndex}
        onIndexChange={handleIndexChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  header: {
    paddingTop: 60,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  backButton: {
    padding: theme.spacing.sm,
  },
  headerTitle: {
    ...theme.typography.h2,
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  headerSubtitle: {
    ...theme.typography.body,
    color: theme.colors.white + 'CC',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white + '20',
    borderRadius: theme.borderRadius.lg,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: theme.colors.white,
  },
  toggleText: {
    ...theme.typography.body,
    color: theme.colors.white,
    fontWeight: '500',
  },
  activeToggleText: {
    color: theme.colors.primary.main,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.white,
    marginHorizontal: theme.spacing.lg,
    marginTop: -theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    ...theme.typography.h3,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  errorMessage: {
    ...theme.typography.body,
    color: theme.colors.error,
  },
  assessmentRequiredContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  assessmentRequiredTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  assessmentRequiredDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
  },
  assessmentButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    minWidth: 200,
    alignItems: 'center',
  },
  assessmentButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  videoListContainer: {
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  loadMoreButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  loadMoreButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  loadingMoreText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  videoListHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  motivationContainer: {
    backgroundColor: theme.colors.primary.light + '20',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  motivationText: {
    ...theme.typography.body,
    color: theme.colors.primary.main,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  retryButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  backgroundLoadingIndicator: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
  },
  backgroundLoadingText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  sectionContainer: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  sectionHeader: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitleContainer: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  sectionTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  sectionDescription: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  sectionBadge: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    minWidth: 32,
    alignItems: 'center',
  },
  sectionBadgeText: {
    ...theme.typography.caption,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  allVideosContainer: {
    paddingTop: theme.spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: theme.spacing.xl * 2,
    marginTop: theme.spacing.xl,
  },
  emptyTitle: {
    ...theme.typography.h4,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.lg,
  },
  emptyDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 24,
  },
  // Video Player Modal Styles
  videoPlayerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    paddingTop: 60,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  playerTitle: {
    ...theme.typography.h5,
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: theme.spacing.md,
  },
  videoWrapper: {
    height: 250,
    backgroundColor: theme.colors.black,
  },
  webView: {
    flex: 1,
  },
  externalLinkButton: {
    padding: theme.spacing.sm,
  },
  noWebViewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[100],
    padding: theme.spacing.xl,
  },
  noWebViewTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  noWebViewDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: 22,
  },
  openYouTubeButton: {
    backgroundColor: theme.colors.error, // YouTube red
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    minWidth: 200,
    alignItems: 'center',
  },
  openYouTubeText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  videoLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.black,
  },
  videoLoadingText: {
    ...theme.typography.body,
    color: theme.colors.white,
    marginTop: theme.spacing.md,
  },
  videoInfo: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
  },
  videoTitle: {
    ...theme.typography.h4,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    lineHeight: 28,
  },
  videoChannel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  videoSection: {
    ...theme.typography.caption,
    color: theme.colors.primary.main,
    marginBottom: theme.spacing.lg,
    fontWeight: '600',
  },
  videoDescriptionScroll: {
    flex: 1,
  },
  videoDescription: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
});