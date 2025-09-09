import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  ActivityIndicator, 
  StyleSheet, 
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
  Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, TrendingUp, Target, Heart, Play, X, ArrowLeft, ExternalLink } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useUnifiedPersonalization } from '../../hooks/useUnifiedPersonalization';
import { useInteractionTracking } from '../../hooks/useInteractionTracking';
import { getPersonalizedVideoSections, VideoSection, YouTubeVideo } from '../../lib/video/videoRecommender';
import YouTubeVideoList from '../../components/video/YouTubeVideoList';
import { theme } from '../../theme';

// Conditional WebView import with fallback
let WebView: any = null;
try {
  const { WebView: RNWebView } = require('react-native-webview');
  WebView = RNWebView;
} catch (error) {
  console.warn('react-native-webview not available, videos will open in browser');
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function VideoRecommendationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { profile: personalization, loading: personalizationLoading } = useUnifiedPersonalization(user?.id || '');
  const { trackTopicEngagement } = useInteractionTracking(user?.id || '');
  
  // State management
  const [videoSections, setVideoSections] = useState<VideoSection[]>([]);
  const [allVideos, setAllVideos] = useState<(YouTubeVideo & { sectionName: string; permaDimension: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'sections' | 'all'>('sections');
  
  // Video player state
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentVideoSection, setCurrentVideoSection] = useState<string>('');

  const fetchVideoSections = useCallback(async () => {
    if (!user) {
      setError('Please log in to see personalized videos');
      setLoading(false);
      return;
    }

    if (personalizationLoading) {
      console.log('⏳ [VideoScreen] Waiting for personalization to load...');
      return;
    }

    if (!personalization) {
      console.log('⚠️ [VideoScreen] No personalization found');
      setError('Complete your assessment to get personalized video recommendations');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      console.log('🎬 [VideoScreen] Fetching personalized sections...');
      const sections = await getPersonalizedVideoSections(personalization, {});
      console.log('✅ [VideoScreen] Received sections:', sections.length);
      
      setVideoSections(sections);
      
      // Flatten all videos for the "All Videos" view
      const flattenedVideos = sections.flatMap(section => 
        section.videos.map(video => ({
          ...video,
          sectionName: section.topicName,
          permaDimension: section.permaDimension
        }))
      );
      setAllVideos(flattenedVideos);
      
    } catch (error) {
      console.error('❌ [VideoScreen] Error fetching video sections:', error);
      setError('Failed to load personalized videos. Please try again.');
      setVideoSections([]);
      setAllVideos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, personalization, personalizationLoading]);

  useEffect(() => {
    fetchVideoSections();
  }, [fetchVideoSections]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVideoSections();
  }, [fetchVideoSections]);

  const handleVideoPress = useCallback(async (video: YouTubeVideo, sectionName?: string) => {
    console.log('🎯 [VideoScreen] Playing video:', video.title);
    
    // Track video interaction
    handleVideoInteraction(video.videoId, sectionName || '', 'view');
    
    if (WebView) {
      // Use in-app WebView if available
      setSelectedVideo(video);
      setCurrentVideoSection(sectionName || '');
      setShowVideoPlayer(true);
    } else {
      // Fallback to opening in browser
      try {
        const supported = await Linking.canOpenURL(video.url);
        if (supported) {
          await Linking.openURL(video.url);
        } else {
          Alert.alert('Error', 'Cannot open video. Please install YouTube app or check your internet connection.');
        }
      } catch (error) {
        console.error('Error opening video URL:', error);
        Alert.alert('Error', 'Failed to open video.');
      }
    }
  }, []);

  const handleVideoInteraction = useCallback(async (
    videoId: string, 
    sectionName: string, 
    interactionType: 'view' | 'like' | 'dislike'
  ) => {
    if (interactionType === 'view') {
      setWatchedVideos(prev => new Set([...prev, videoId]));
    }

    try {
      await trackTopicEngagement({
        topic: sectionName,
        engagementScore: interactionType === 'like' ? 9 : interactionType === 'view' ? 7 : 2,
        interactionType: interactionType === 'view' ? 'mention' : 
                        interactionType === 'like' ? 'followup' : 'dismissal',
        context: `video_recommendation_${sectionName}`
      });
    } catch (error) {
      console.error('Error tracking video interaction:', error);
    }
  }, [trackTopicEngagement]);

  const closeVideoPlayer = useCallback(() => {
    setShowVideoPlayer(false);
    setSelectedVideo(null);
    setCurrentVideoSection('');
  }, []);

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

  // Enhanced video player modal with fallback
  const renderVideoPlayer = () => {
    if (!showVideoPlayer || !selectedVideo) return null;

    return (
      <Modal
        visible={showVideoPlayer}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeVideoPlayer}
      >
        <View style={styles.videoPlayerContainer}>
          {/* Player Header */}
          <View style={styles.playerHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={closeVideoPlayer}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.playerTitle} numberOfLines={1}>
              {selectedVideo.title}
            </Text>
            <TouchableOpacity 
              style={styles.externalLinkButton}
              onPress={() => Linking.openURL(selectedVideo.url)}
            >
              <ExternalLink size={20} color={theme.colors.primary.main} />
            </TouchableOpacity>
          </View>

          {/* Video Player */}
          <View style={styles.videoWrapper}>
            {WebView ? (
              <WebView
                source={{ uri: selectedVideo.embedUrl }}
                style={styles.webView}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.videoLoading}>
                    <ActivityIndicator size="large" color={theme.colors.primary.main} />
                    <Text style={styles.videoLoadingText}>Loading video...</Text>
                  </View>
                )}
                onError={(syntheticEvent: any) => {
                  const { nativeEvent } = syntheticEvent;
                  console.error('WebView error: ', nativeEvent);
                  Alert.alert(
                    'Video Error', 
                    'Failed to load video. Would you like to open it in YouTube?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Open YouTube', onPress: () => Linking.openURL(selectedVideo.url) }
                    ]
                  );
                }}
              />
            ) : (
              // Fallback when WebView is not available
              <View style={styles.noWebViewContainer}>
                <Play size={64} color={theme.colors.primary.main} />
                <Text style={styles.noWebViewTitle}>Video Player Not Available</Text>
                <Text style={styles.noWebViewDescription}>
                  WebView is not available. Tap below to open in YouTube.
                </Text>
                <TouchableOpacity 
                  style={styles.openYouTubeButton}
                  onPress={() => Linking.openURL(selectedVideo.url)}
                >
                  <Text style={styles.openYouTubeText}>Open in YouTube</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Video Info */}
          <View style={styles.videoInfo}>
            <Text style={styles.videoTitle}>{selectedVideo.title}</Text>
            <Text style={styles.videoChannel}>{selectedVideo.channelTitle}</Text>
            <Text style={styles.videoSection}>From: {currentVideoSection}</Text>
            
            {selectedVideo.snippet && (
              <ScrollView style={styles.videoDescriptionScroll}>
                <Text style={styles.videoDescription}>{selectedVideo.snippet}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text style={styles.loadingText}>
          {personalizationLoading ? 'Loading your profile...' : 'Finding perfect videos for you...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <LinearGradient
        colors={[theme.colors.primary.main, theme.colors.primary.light]}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Videos</Text>
          <View style={styles.placeholder} />
        </View>
        
        <Text style={styles.headerSubtitle}>
          {allVideos.length} videos • {watchedVideos.size} watched
        </Text>
        
        {/* View Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'sections' && styles.activeToggle]}
            onPress={() => setViewMode('sections')}
          >
            <Text style={[styles.toggleText, viewMode === 'sections' && styles.activeToggleText]}>
              By Topic
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'all' && styles.activeToggle]}
            onPress={() => setViewMode('all')}
          >
            <Text style={[styles.toggleText, viewMode === 'all' && styles.activeToggleText]}>
              All Videos
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      )}

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{videoSections.length}</Text>
            <Text style={styles.statLabel}>Topics</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{allVideos.length}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{watchedVideos.size}</Text>
            <Text style={styles.statLabel}>Watched</Text>
          </View>
        </View>

        {/* Content based on view mode */}
        {viewMode === 'sections' ? (
          // Sections View
          <>
            {videoSections.map((section, index) => (
              <View key={`${section.topicName}-${index}`} style={styles.sectionContainer}>
                <LinearGradient
                  colors={getSectionGradient(section.permaDimension)}
                  style={styles.sectionHeader}
                >
                  <View style={styles.sectionTitleRow}>
                    {getSectionIcon(section.permaDimension)}
                    <View style={styles.sectionTitleContainer}>
                      <Text style={styles.sectionTitle}>{section.topicName}</Text>
                      <Text style={styles.sectionDescription}>{section.description}</Text>
                    </View>
                  </View>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{section.videos.length}</Text>
                  </View>
                </LinearGradient>

                <YouTubeVideoList
                  videos={section.videos}
                  topicName={section.topicName}
                  onVideoInteraction={(videoId, interactionType) => 
                    handleVideoInteraction(videoId, section.topicName, interactionType)
                  }
                  watchedVideos={watchedVideos}
                  horizontal={true}
                  onVideoPress={(video) => handleVideoPress(video, section.topicName)}
                />
              </View>
            ))}
          </>
        ) : (
          // All Videos View
          <View style={styles.allVideosContainer}>
            <YouTubeVideoList
              videos={allVideos}
              onVideoInteraction={(videoId, interactionType) => {
                const video = allVideos.find(v => v.videoId === videoId);
                handleVideoInteraction(videoId, video?.sectionName || '', interactionType);
              }}
              watchedVideos={watchedVideos}
              horizontal={false}
              onVideoPress={(video) => {
                const videoWithSection = allVideos.find(v => v.videoId === video.videoId);
                handleVideoPress(video, videoWithSection?.sectionName);
              }}
            />
          </View>
        )}

        {/* Empty State */}
        {allVideos.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Sparkles color={theme.colors.gray[400]} size={48} />
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptyDescription}>
              Complete your assessment to get personalized video recommendations
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Video Player Modal with improved fallback */}
      {renderVideoPlayer()}
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