import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Linking, StyleSheet, Dimensions } from 'react-native';
import { ThumbsUp, ThumbsDown, Youtube, Eye, Clock } from 'lucide-react-native';
import type { YouTubeVideo } from '../../lib/video/videoRecommender';

interface YouTubeVideoListProps {
  videos: YouTubeVideo[];
  topicName?: string;
  onVideoInteraction?: (videoId: string, interactionType: 'view' | 'like' | 'dislike') => void;
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
  watchedVideos = new Set(),
  horizontal = false,
  refreshing,
  onRefresh
}: YouTubeVideoListProps) {
  const [feedback, setFeedback] = useState<FeedbackMap>({});

  const handleLike = (id: string) => {
    setFeedback(f => ({ ...f, [id]: 'like' }));
    onVideoInteraction?.(id, 'like');
  };

  const handleDislike = (id: string) => {
    setFeedback(f => ({ ...f, [id]: 'dislike' }));
    onVideoInteraction?.(id, 'dislike');
  };

  const handleVideoPress = (video: YouTubeVideo) => {
    onVideoInteraction?.(video.videoId, 'view');
    Linking.openURL(video.url);
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
        <TouchableOpacity onPress={() => handleVideoPress(item)}>
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
            <View style={styles.playIconContainer}>
              <Youtube color="#fff" size={horizontal ? 28 : 32} />
            </View>
            {item.duration && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
              </View>
            )}
            {isWatched && (
              <View style={styles.watchedBadge}>
                <Eye color="#fff" size={16} />
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <Text style={[styles.title, horizontal && styles.horizontalTitle]} numberOfLines={horizontal ? 3 : 2}>
            {item.title}
          </Text>
          
          {item.channelTitle && (
            <Text style={styles.channelTitle} numberOfLines={1}>
              {item.channelTitle}
            </Text>
          )}

          <View style={styles.metaContainer}>
            {item.viewCount && (
              <View style={styles.metaItem}>
                <Eye color="#6b7280" size={14} />
                <Text style={styles.metaText}>{formatViewCount(item.viewCount)}</Text>
              </View>
            )}
            {item.publishedAt && (
              <View style={styles.metaItem}>
                <Clock color="#6b7280" size={14} />
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

          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              onPress={() => handleLike(item.videoId)} 
              style={[styles.actionButton, feedback[item.videoId] === 'like' && styles.activeButton]}
            >
              <ThumbsUp 
                color={feedback[item.videoId] === 'like' ? '#22c55e' : '#6b7280'} 
                size={20} 
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
                color={feedback[item.videoId] === 'dislike' ? '#ef4444' : '#6b7280'} 
                size={20} 
              />
            </TouchableOpacity>
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

  if (horizontal) {
    return (
      <FlatList
        {...listProps}
        horizontal
        pagingEnabled={false}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
      />
    );
  }

  return (
    <FlatList
      {...listProps}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Youtube color="#9ca3af" size={48} />
          <Text style={styles.emptyText}>No videos found for this topic</Text>
        </View>
      }
    />
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
    backgroundColor: '#f3f4f6',
  },
  playIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 32,
    padding: 8,
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