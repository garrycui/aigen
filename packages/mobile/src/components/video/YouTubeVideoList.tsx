import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { ThumbsUp, ThumbsDown, Youtube, Eye, Clock, Play } from 'lucide-react-native';
import type { YouTubeVideo } from '../../lib/video/videoRecommender';
import { theme } from '../../theme';

interface YouTubeVideoListProps {
  videos: YouTubeVideo[];
  topicName?: string;
  onVideoInteraction?: (videoId: string, interactionType: 'view' | 'like' | 'dislike') => void;
  onVideoPress?: (video: YouTubeVideo) => void; // NEW: Direct video press handler
  watchedVideos?: Set<string>;
  horizontal?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

type FeedbackMap = { [videoId: string]: 'like' | 'dislike' | undefined };

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = screenWidth * 0.75;

export default function YouTubeVideoList({ 
  videos, 
  topicName,
  onVideoInteraction,
  onVideoPress, // NEW: Video press handler
  watchedVideos = new Set(),
  horizontal = false,
  refreshing,
  onRefresh
}: YouTubeVideoListProps) {
  const [feedback, setFeedback] = useState<Record<string, 'like' | 'dislike' | undefined>>({});

  const handleLike = (id: string) => {
    setFeedback(f => ({ ...f, [id]: 'like' }));
    onVideoInteraction?.(id, 'like');
  };

  const handleDislike = (id: string) => {
    setFeedback(f => ({ ...f, [id]: 'dislike' }));
    onVideoInteraction?.(id, 'dislike');
  };

  const handleVideoPress = (video: YouTubeVideo) => {
    // Use the new onVideoPress if provided, otherwise fallback to opening URL
    if (onVideoPress) {
      onVideoPress(video);
    } else {
      onVideoInteraction?.(video.videoId, 'view');
      // Fallback: could open in browser, but we prefer in-app now
    }
  };

  const formatViewCount = (viewCount?: string) => {
    if (!viewCount) return '';
    const count = parseInt(viewCount);
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
    return `${count} views`;
  };

  const formatDuration = (duration?: string) => {
    if (!duration) return '';
    // Parse ISO 8601 duration (PT4M13S -> 4:13)
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

  const renderItem = ({ item }: { item: YouTubeVideo }) => {
    const isWatched = watchedVideos.has(item.videoId);
    const cardStyle = horizontal ? [styles.card, styles.horizontalCard, { width: cardWidth }] : styles.card;

    return (
      <View style={cardStyle}>
        {/* Enhanced Thumbnail with Play Button Overlay */}
        <TouchableOpacity onPress={() => handleVideoPress(item)} activeOpacity={0.8}>
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
            
            {/* Play Button Overlay */}
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Play color="#fff" size={horizontal ? 24 : 28} fill="#fff" />
              </View>
            </View>
            
            {/* Duration Badge */}
            {item.duration && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
              </View>
            )}
            
            {/* Watched Indicator */}
            {isWatched && (
              <View style={styles.watchedBadge}>
                <Eye color="#fff" size={16} />
              </View>
            )}
            
            {/* Embeddable Indicator */}
            {item.isEmbeddable && (
              <View style={styles.embeddableBadge}>
                <Youtube color="#fff" size={12} />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Content Container */}
        <View style={styles.contentContainer}>
          <TouchableOpacity onPress={() => handleVideoPress(item)} activeOpacity={0.8}>
            <Text style={[styles.title, horizontal && styles.horizontalTitle]} numberOfLines={horizontal ? 2 : 3}>
              {item.title}
            </Text>
          </TouchableOpacity>
          
          {item.channelTitle && (
            <Text style={styles.channelTitle} numberOfLines={1}>
              {item.channelTitle}
            </Text>
          )}

          <View style={styles.metaContainer}>
            {item.viewCount && (
              <View style={styles.metaItem}>
                <Eye color={theme.colors.gray[500]} size={14} />
                <Text style={styles.metaText}>{formatViewCount(item.viewCount)}</Text>
              </View>
            )}
            {item.publishedAt && (
              <View style={styles.metaItem}>
                <Clock color={theme.colors.gray[500]} size={14} />
                <Text style={styles.metaText}>
                  {new Date(item.publishedAt).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>

          {!horizontal && (
            <Text style={styles.description} numberOfLines={2}>
              {item.snippet}
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              onPress={() => handleLike(item.videoId)} 
              style={[styles.actionButton, feedback[item.videoId] === 'like' && styles.activeButton]}
            >
              <ThumbsUp 
                color={feedback[item.videoId] === 'like' ? theme.colors.success : theme.colors.gray[500]} 
                size={18} 
              />
              {item.likeCount && (
                <Text style={styles.actionText}>
                  {parseInt(item.likeCount) > 1000 ? 
                    `${(parseInt(item.likeCount) / 1000).toFixed(1)}K` : 
                    item.likeCount
                  }
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => handleDislike(item.videoId)}
              style={[styles.actionButton, feedback[item.videoId] === 'dislike' && styles.activeButton]}
            >
              <ThumbsDown 
                color={feedback[item.videoId] === 'dislike' ? theme.colors.error : theme.colors.gray[500]} 
                size={18} 
              />
            </TouchableOpacity>
            
            {/* Play Button for Non-horizontal Layout */}
            {!horizontal && (
              <TouchableOpacity 
                onPress={() => handleVideoPress(item)}
                style={[styles.actionButton, styles.playActionButton]}
              >
                <Play color={theme.colors.primary.main} size={18} />
                <Text style={[styles.actionText, { color: theme.colors.primary.main }]}>Play</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const listProps = {
    data: videos,
    keyExtractor: (item: YouTubeVideo) => item.videoId,
    renderItem,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    contentContainerStyle: horizontal ? styles.horizontalContainer : styles.verticalContainer,
  };

  return (
    <>
      {horizontal ? (
        <FlatList
          {...listProps}
          horizontal
          pagingEnabled={false}
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        />
      ) : (
        <FlatList
          {...listProps}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Youtube color={theme.colors.gray[400]} size={48} />
              <Text style={styles.emptyText}>No videos found for this topic</Text>
            </View>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  horizontalCard: {
    marginBottom: 0,
    marginRight: 0,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.gray[100],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  playButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 32,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  watchedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  embeddableBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 8,
    padding: 4,
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    lineHeight: 22,
    marginBottom: 8,
  },
  horizontalTitle: {
    fontSize: 15,
  },
  channelTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  playActionButton: {
    backgroundColor: '#f0f9ff',
  },
  activeButton: {
    backgroundColor: '#f3f4f6',
  },
  actionText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '600',
  },
  horizontalContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  verticalContainer: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
  },
});