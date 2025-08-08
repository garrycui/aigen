import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, TrendingUp, Target, Heart } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useDynamicPersonalization } from '../../hooks/useDynamicPersonalization';
import { useInteractionTracking } from '../../hooks/useInteractionTracking';
import { getPersonalizedVideoSections, VideoSection, searchYouTubeVideos, generateSectionDescription } from '../../lib/video/videoRecommender';
import YouTubeVideoList from '../../components/video/YouTubeVideoList';

export default function VideoRecommendationsScreen() {
  const { user } = useAuth();
  const { personalization, loading: personalizationLoading } = useDynamicPersonalization(user?.id || '');
  const { trackTopicEngagement } = useInteractionTracking(user?.id || '');
  
  const [videoSections, setVideoSections] = useState<VideoSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [watchedVideos, setWatchedVideos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchVideoSections = useCallback(async () => {
    if (!user) {
      setError('Please log in to see personalized videos');
      setLoading(false);
      return;
    }

    console.log('Debug - User:', user.id);
    console.log('Debug - Personalization loading:', personalizationLoading);
    console.log('Debug - Personalization data:', personalization);

    // If personalization is still loading, wait
    if (personalizationLoading) {
      console.log('Debug - Waiting for personalization to load...');
      return;
    }

    // If no personalization data, try to create a basic fallback
    if (!personalization) {
      console.log('Debug - No personalization found, creating fallback...');
      try {
        const fallbackSections = await createFallbackVideoSections(user);
        setVideoSections(fallbackSections);
        setError('Using basic recommendations. Complete your assessment for personalized content.');
      } catch (error) {
        console.error('Error creating fallback sections:', error);
        setError('Unable to load video recommendations. Please try again.');
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      console.log('Debug - Fetching personalized sections...');
      const sections = await getPersonalizedVideoSections(personalization);
      console.log('Debug - Received sections:', sections.length);
      setVideoSections(sections);
    } catch (error) {
      console.error('Error fetching video sections:', error);
      setError('Failed to load personalized videos. Please try again.');
      setVideoSections([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, personalization, personalizationLoading]);

  useEffect(() => {
    fetchVideoSections();
  }, [fetchVideoSections]);

  // Create fallback video sections when no personalization is available
  const createFallbackVideoSections = useCallback(async (user: any): Promise<VideoSection[]> => {
    const fallbackTopics = [
      {
        topicName: 'Mood Boosters',
        searchTerms: ['happiness', 'motivation', 'positive thinking'],
        permaDimension: 'positiveEmotion',
        priority: 10
      },
      {
        topicName: 'Learning & Growth',
        searchTerms: ['learning', 'self improvement', 'personal development'],
        permaDimension: 'engagement',
        priority: 8
      },
      {
        topicName: 'Relaxation',
        searchTerms: ['relaxation', 'meditation', 'stress relief'],
        permaDimension: 'positiveEmotion',
        priority: 6
      }
    ];

    const sections: VideoSection[] = [];
    
    for (const topic of fallbackTopics) {
      try {
        const videos = await searchYouTubeVideos(topic.searchTerms, 6);
        if (videos.length > 0) {
          sections.push({
            topicName: topic.topicName,
            description: generateSectionDescription(topic.topicName, topic.permaDimension),
            videos,
            permaDimension: topic.permaDimension,
            priority: topic.priority
          });
        }
      } catch (error) {
        console.error(`Error fetching fallback videos for ${topic.topicName}:`, error);
      }
    }

    return sections;
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVideoSections();
  };

  const handleVideoInteraction = async (
    videoId: string, 
    topicName: string, 
    interactionType: 'view' | 'like' | 'dislike'
  ) => {
    if (interactionType === 'view') {
      setWatchedVideos(prev => new Set([...prev, videoId]));
    }

    await trackTopicEngagement({
      topic: topicName,
      engagementScore: interactionType === 'like' ? 9 : interactionType === 'view' ? 7 : 2,
      interactionType: interactionType === 'view' ? 'mention' : 
                      interactionType === 'like' ? 'followup' : 'dismissal',
      context: `video_recommendation_${topicName}`
    });
  };

  const getSectionIcon = (permaDimension: string) => {
    const iconMap = {
      positiveEmotion: <Heart color="#f59e0b" size={20} />,
      engagement: <Sparkles color="#8b5cf6" size={20} />,
      relationships: <Heart color="#ec4899" size={20} />,
      meaning: <Target color="#06b6d4" size={20} />,
      accomplishment: <TrendingUp color="#10b981" size={20} />
    };
    return iconMap[permaDimension as keyof typeof iconMap] || <Sparkles color="#6366f1" size={20} />;
  };

  const getSectionGradient = (permaDimension: string): [string, string] => {
    const gradientMap: Record<string, [string, string]> = {
      positiveEmotion: ['#fef3c7', '#fde68a'],
      engagement: ['#e0e7ff', '#c7d2fe'],
      relationships: ['#fce7f3', '#fbcfe8'],
      meaning: ['#cffafe', '#a7f3d0'],
      accomplishment: ['#d1fae5', '#a7f3d0']
    };
    return gradientMap[permaDimension as keyof typeof gradientMap] || ['#f3f4f6', '#e5e7eb'];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>
          {personalizationLoading ? 'Loading your profile...' : 'Curating videos just for you...'}
        </Text>
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Your Video Journey</Text>
        <Text style={styles.headerSubtitle}>
          {videoSections.length} personalized sections • {watchedVideos.size} videos watched
        </Text>
      </LinearGradient>

      {/* Error message if any */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      )}

      {/* Progress Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{videoSections.length}</Text>
          <Text style={styles.statLabel}>Topics</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{videoSections.reduce((sum, section) => sum + section.videos.length, 0)}</Text>
          <Text style={styles.statLabel}>Videos</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{watchedVideos.size}</Text>
          <Text style={styles.statLabel}>Watched</Text>
        </View>
      </View>

      {/* Video Sections */}
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
          />
        </View>
      ))}

      {videoSections.length === 0 && !loading && (
        <View style={styles.emptyContainer}>
          <Sparkles color="#9ca3af" size={48} />
          <Text style={styles.emptyTitle}>No recommendations yet</Text>
          <Text style={styles.emptyDescription}>
            Complete your assessment to get personalized video recommendations
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    borderRadius: 12,
    padding: 16,
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
    marginLeft: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textTransform: 'capitalize',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 2,
  },
  sectionBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  sectionBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4b5563',
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#dc2626',
  },
});