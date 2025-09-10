import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ThumbsUp, ThumbsDown, Eye, Play } from 'lucide-react-native';
import type { YouTubeVideo } from '../../lib/video/videoRecommender';
import { theme } from '../../theme';

interface FullScreenVideoListProps {
  videos: YouTubeVideo[];
  onVideoInteraction: (videoId: string, interactionType: 'view' | 'like' | 'dislike' | 'skip' | 'watch' | 'scroll_past') => void;
  onRequestMoreVideos: () => void;
  onVideoViewDuration: (videoId: string, duration: number, totalDuration: number) => void;
  watchedVideos: Set<string>;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
}

interface VideoMetrics {
  startTime: number;
  totalViewTime: number;
  isPlaying: boolean;
  wasPlayed: boolean;
  scrolledPast: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function FullScreenVideoList({
  videos,
  onVideoInteraction,
  onRequestMoreVideos,
  onVideoViewDuration,
  watchedVideos,
  currentIndex = 0,
  onIndexChange,
}: FullScreenVideoListProps) {
  const flatListRef = useRef<FlatList>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(currentIndex);
  const [playingVideos, setPlayingVideos] = useState<Set<string>>(new Set());
  const [videoMetrics, setVideoMetrics] = useState<Map<string, VideoMetrics>>(new Map());
  const [feedback, setFeedback] = useState<Record<string, 'like' | 'dislike' | undefined>>({});

  // Initialize metrics for new videos
  useEffect(() => {
    videos.forEach(video => {
      if (!videoMetrics.has(video.videoId)) {
        setVideoMetrics(prev => new Map(prev).set(video.videoId, {
          startTime: Date.now(),
          totalViewTime: 0,
          isPlaying: false,
          wasPlayed: false,
          scrolledPast: false,
        }));
      }
    });
  }, [videos]);

  const updateVideoMetrics = useCallback((videoId: string, updates: Partial<VideoMetrics>) => {
    setVideoMetrics(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(videoId) || {
        startTime: Date.now(),
        totalViewTime: 0,
        isPlaying: false,
        wasPlayed: false,
        scrolledPast: false,
      };
      newMap.set(videoId, { ...current, ...updates });
      return newMap;
    });
  }, []);

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      const previousIndex = currentVideoIndex;
      
      if (newIndex !== previousIndex) {
        // Handle previous video metrics
        if (previousIndex >= 0 && previousIndex < videos.length) {
          const previousVideo = videos[previousIndex];
          const metrics = videoMetrics.get(previousVideo.videoId);
          
          if (metrics && !metrics.scrolledPast) {
            const viewDuration = Date.now() - metrics.startTime;
            updateVideoMetrics(previousVideo.videoId, {
              totalViewTime: metrics.totalViewTime + viewDuration,
              scrolledPast: true,
            });

            // Track behavior based on engagement
            if (viewDuration < 2000 && !metrics.wasPlayed) {
              // Scrolled past quickly without playing - not interested
              onVideoInteraction(previousVideo.videoId, 'scroll_past');
            } else if (metrics.wasPlayed && viewDuration > 5000) {
              // Played and watched for a while - interested
              onVideoInteraction(previousVideo.videoId, 'watch');
            }

            // Report view duration for personalization
            onVideoViewDuration(previousVideo.videoId, viewDuration / 1000, 30); // Assume 30s average
          }
        }

        // Initialize new video metrics
        if (newIndex >= 0 && newIndex < videos.length) {
          const currentVideo = videos[newIndex];
          updateVideoMetrics(currentVideo.videoId, {
            startTime: Date.now(),
            scrolledPast: false,
          });

          // Track view
          onVideoInteraction(currentVideo.videoId, 'view');
        }

        setCurrentVideoIndex(newIndex);
        onIndexChange?.(newIndex);

        // Request more videos when near the end
        if (newIndex >= videos.length - 3) {
          onRequestMoreVideos();
        }
      }
    }
  }, [currentVideoIndex, videos, videoMetrics, onVideoInteraction, onVideoViewDuration, onRequestMoreVideos, onIndexChange, updateVideoMetrics]);

  const handleVideoPress = useCallback((video: YouTubeVideo) => {
    const isCurrentlyPlaying = playingVideos.has(video.videoId);
    
    if (isCurrentlyPlaying) {
      setPlayingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(video.videoId);
        return newSet;
      });
    } else {
      setPlayingVideos(prev => new Set(prev).add(video.videoId));
      updateVideoMetrics(video.videoId, { 
        wasPlayed: true,
        isPlaying: true 
      });
    }
  }, [playingVideos, updateVideoMetrics]);

  const handleLike = useCallback((videoId: string) => {
    setFeedback(prev => ({ ...prev, [videoId]: 'like' }));
    onVideoInteraction(videoId, 'like');
  }, [onVideoInteraction]);

  const handleDislike = useCallback((videoId: string) => {
    setFeedback(prev => ({ ...prev, [videoId]: 'dislike' }));
    onVideoInteraction(videoId, 'dislike');
  }, [onVideoInteraction]);

  const formatViewCount = (viewCount?: string) => {
    if (!viewCount) return '';
    const count = parseInt(viewCount);
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatDuration = (duration?: string) => {
    if (!duration) return '';
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderVideoItem = ({ item, index }: { item: YouTubeVideo; index: number }) => {
    const isPlaying = playingVideos.has(item.videoId);
    const isWatched = watchedVideos.has(item.videoId);
    const userFeedback = feedback[item.videoId];

    return (
      <View style={styles.videoContainer}>
        {/* Video Player */}
        <TouchableOpacity 
          style={styles.videoPlayer}
          onPress={() => handleVideoPress(item)}
          activeOpacity={0.9}
        >
          {isPlaying ? (
            <WebView
              source={{ 
                uri: `${item.embedUrl}&autoplay=1&mute=0`,
                headers: {
                  'Referer': 'https://www.youtube.com/',
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
                }
              }}
              style={styles.webView}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scrollEnabled={false}
              allowsFullscreenVideo={true}
              startInLoadingState={true}
              originWhitelist={['*']}
              mixedContentMode="compatibility"
              onError={(syntheticEvent) => {
                console.error('WebView error:', syntheticEvent.nativeEvent);
                // Fallback to thumbnail if embedding fails
                setPlayingVideos(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(item.videoId);
                  return newSet;
                });
              }}
              onLoadStart={() => console.log('🎬 Loading video:', item.title)}
              onLoadEnd={() => console.log('✅ Video loaded:', item.title)}
            />
          ) : (
            <>
              <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <Play color="#fff" size={60} fill="#fff" />
                </View>
              </View>
            </>
          )}
          
          {/* Duration Badge */}
          {item.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
            </View>
          )}

          {/* Watched Indicator */}
          {isWatched && (
            <View style={styles.watchedIndicator}>
              <Eye color="#fff" size={20} />
            </View>
          )}
        </TouchableOpacity>

        {/* Video Info Overlay */}
        <View style={styles.videoInfo}>
          <View style={styles.videoDetails}>
            <Text style={styles.videoTitle} numberOfLines={2}>
              {item.title}
            </Text>
            
            <View style={styles.channelInfo}>
              <View style={styles.channelAvatar}>
                <Text style={styles.channelInitial}>
                  {item.channelTitle?.charAt(0).toUpperCase() || 'Y'}
                </Text>
              </View>
              <Text style={styles.channelName} numberOfLines={1}>
                {item.channelTitle || 'YouTube'}
              </Text>
              <View style={styles.metaInfo}>
                <Text style={styles.metaText}>{formatViewCount(item.viewCount)} views</Text>
              </View>
            </View>

            {item.recommendationReason && (
              <Text style={styles.recommendationReason} numberOfLines={1}>
                💡 {item.recommendationReason}
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, userFeedback === 'like' && styles.activeButton]}
              onPress={() => handleLike(item.videoId)}
            >
              <ThumbsUp
                color={userFeedback === 'like' ? "#22c55e" : "#fff"}
                size={28}
                fill={userFeedback === 'like' ? "#22c55e" : "none"}
              />
              {item.likeCount && (
                <Text style={styles.actionText}>
                  {formatViewCount(item.likeCount)}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, userFeedback === 'dislike' && styles.activeButton]}
              onPress={() => handleDislike(item.videoId)}
            >
              <ThumbsDown
                color={userFeedback === 'dislike' ? "#ef4444" : "#fff"}
                size={28}
                fill={userFeedback === 'dislike' ? "#ef4444" : "none"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.videoId}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
        }}
        initialScrollIndex={currentIndex}
        getItemLayout={(data, index) => ({
          length: screenHeight,
          offset: screenHeight * index,
          index,
        })}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight,
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  webView: {
    flex: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 50,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  durationBadge: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  watchedIndicator: {
    position: 'absolute',
    top: 60,
    left: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    borderRadius: 20,
    padding: 8,
  },
  videoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 40,
    backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
  },
  videoDetails: {
    flex: 1,
    marginRight: 16,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  channelInitial: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  channelName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaInfo: {
    marginLeft: 8,
  },
  metaText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recommendationReason: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionButtons: {
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
  },
  activeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});