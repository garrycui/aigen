import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, Animated } from 'react-native';
import { Brain } from 'lucide-react-native';
import { screenStyles, colors, theme } from '../theme';

export default function HomeScreen({ onFinishSplash }: { onFinishSplash?: () => void }) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.5);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();

    const timer = setTimeout(() => {
      if (onFinishSplash) onFinishSplash();
    }, 4000);
    
    return () => clearTimeout(timer);
  }, [onFinishSplash]);

  return (
    <View style={styles.container}>
      <View style={styles.gradientOverlay}>
        <Animated.View 
          style={[
            styles.heroContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Brain size={64} color={colors.white} />
          <Text style={styles.heroTitle}>AigenThrive</Text>
          <Text style={styles.heroSubtitle}>Empower Your Mind, Lead in the AI Era</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4f46e5',
  },
  gradientOverlay: {
    flex: 1,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
  heroSubtitle: {
    fontSize: 18,
    color: colors.white,
    marginTop: theme.spacing.md,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
});