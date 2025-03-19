import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Brain } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa' }}
      style={styles.container}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Brain size={48} color="#fff" />
            <Text style={styles.title}>Empower Your Mind</Text>
            <Text style={styles.subtitle}>Lead in the AI Era</Text>
          </View>

          <Text style={styles.description}>
            Discover your unique AI adaptation style and get personalized guidance to thrive in the age of artificial intelligence.
          </Text>

          {user ? (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('Questionnaire')}
              >
                <Text style={styles.buttonText}>Start Your Journey</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('Forum')}
              >
                <Text style={styles.secondaryButtonText}>Join Community</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.textButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.textButtonText}>
                  Already have an account? Sign in
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 24,
    color: '#818cf8',
    textAlign: 'center',
    marginTop: 8,
  },
  description: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  textButtonText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
});

export default HomeScreen;