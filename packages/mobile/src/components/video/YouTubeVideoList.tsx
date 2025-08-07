import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Linking, RefreshControl, StyleSheet } from 'react-native';
import { ThumbsUp, ThumbsDown, Youtube } from 'lucide-react-native';
import type { YouTubeVideo } from '../../lib/video/videoRecommender';

interface YouTubeVideoListProps {
  videos: YouTubeVideo[];
  refreshing: boolean;
  onRefresh: () => void;
}

type FeedbackMap = { [videoId: string]: 'like' | 'dislike' | undefined };

export default function YouTubeVideoList({ videos, refreshing, onRefresh }: YouTubeVideoListProps) {
  const [feedback, setFeedback] = useState<FeedbackMap>({});

  const handleLike = (id: string) => setFeedback(f => ({ ...f, [id]: 'like' }));
  const handleDislike = (id: string) => setFeedback(f => ({ ...f, [id]: 'dislike' }));

  const renderItem = ({ item }: { item: YouTubeVideo }) => (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => Linking.openURL(item.url)}>
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
        <View style={styles.playIcon}>
          <Youtube color="#fff" size={32} />
        </View>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.desc} numberOfLines={2}>{item.snippet}</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => handleLike(item.videoId)}>
          <ThumbsUp color={feedback[item.videoId] === 'like' ? '#22c55e' : '#888'} size={22} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDislike(item.videoId)} style={{ marginLeft: 16 }}>
          <ThumbsDown color={feedback[item.videoId] === 'dislike' ? '#ef4444' : '#888'} size={22} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <FlatList
      data={videos}
      keyExtractor={(item: YouTubeVideo) => item.videoId}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 12 }}
      ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>No videos found.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 18, padding: 12, elevation: 2 },
  thumbnail: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#eee' },
  playIcon: { position: 'absolute', top: 70, left: '45%', backgroundColor: '#ef4444', borderRadius: 24, padding: 6 },
  title: { fontWeight: 'bold', fontSize: 16, marginTop: 8, color: '#222' },
  desc: { color: '#666', marginTop: 4, fontSize: 13 },
  actions: { flexDirection: 'row', marginTop: 10, alignItems: 'center' },
});