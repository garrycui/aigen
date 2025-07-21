import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { Brain } from 'lucide-react-native';
import { screenStyles, colors, theme } from '../theme';
import Video from 'react-native-video';

export default function HomeScreen({ onFinishSplash }: { onFinishSplash?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFinishSplash) onFinishSplash();
    }, 4000); // 2 seconds splash
    return () => clearTimeout(timer);
  }, [onFinishSplash]);

  return (
    <View style={styles.container}>
      <Video
        source={require('../../assets/videos/background.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        repeat
        muted
        // Optionally, you can add a poster or fallback image
      />
      <View style={styles.overlay}>
        <View style={styles.heroContent}>
          <Brain size={64} color={colors.white} />
          <Text style={styles.heroTitle}>AigenThrive</Text>
          <Text style={styles.heroSubtitle}>Empower Your Mind, Lead in the AI Era</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)', // Optional: darken video
  },
  heroContent: {
    alignItems: 'center',
    gap: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: 12,
  },
  heroSubtitle: {
    fontSize: 18,
    color: colors.white,
    opacity: 0.85,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 320,
  },
});