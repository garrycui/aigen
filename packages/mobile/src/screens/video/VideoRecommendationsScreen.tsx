import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useFirebase } from '../../context/FirebaseContext';
import { getPersonalizedYouTubeVideos, YouTubeVideo } from '../../lib/video/videoRecommender';
import YouTubeVideoList from '../../components/video/YouTubeVideoList';

export default function VideoRecommendationsScreen() {
  const { user } = useAuth();
  const { getUserAssessment } = useFirebase();
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVideos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const assessmentResult = await getUserAssessment(user.id);
      let assessment = null;
      if (assessmentResult.success && assessmentResult.data?.length > 0) {
        assessment = assessmentResult.data[0];
      }
      const mbti = assessment?.mbti_type || 'INFJ';
      const perma = assessment?.permaAnswers || {};
      const interests = assessment?.interests || [];
      const videos = await getPersonalizedYouTubeVideos({ mbti, perma, interests });
      setVideos(videos);
    } catch (e) {
      setVideos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, getUserAssessment]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVideos();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Videos to Boost Your Mood 🎬</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <YouTubeVideoList videos={videos} refreshing={refreshing} onRefresh={onRefresh} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 16 },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, color: '#222' },
});