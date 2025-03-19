import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Dimensions,
  Platform
} from 'react-native';
import { Play, Pause, Music, Settings, Volume2, VolumeX } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { getLatestAssessment } from '@shared/lib/assessment/assessment';
import { 
  getDefaultPreferences,
  MeditationPreferences,
  DEFAULT_PREFERENCES,
  generateMeditationContent,
  calculateLineTiming
} from '@shared/lib/mind/meditationspace';

const { width } = Dimensions.get('window');

const MeditationSpace = () => {
  const { user } = useAuth();
  const [mbtiType, setMbtiType] = useState<string>('default');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentLine, setCurrentLine] = useState('');
  const [preferences, setPreferences] = useState<MeditationPreferences>({
    duration: 5,
    focus: 'mindfulness',
    background: 'nature'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [guidanceLines, setGuidanceLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [lineTiming, setLineTiming] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user) return;

      try {
        const { data: assessment } = await getLatestAssessment(user.id);
        if (assessment?.mbti_type) {
          setMbtiType(assessment.mbti_type);
          const defaultPrefs = getDefaultPreferences(assessment.mbti_type);
          setPreferences(defaultPrefs);
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    };

    loadUserPreferences();
  }, [user]);

  const startMeditation = async () => {
    if (isPlaying) return;
    
    try {
      setIsLoading(true);
      
      // Generate meditation content
      const lines = await generateMeditationContent(
        mbtiType,
        preferences.focus,
        preferences.duration
      );
      
      // Calculate timing for each line
      const timings = calculateLineTiming(lines, preferences.duration);
      
      setGuidanceLines(lines);
      setLineTiming(timings);
      setCurrentLineIndex(0);
      setCurrentLine(lines[0]);
      setIsPlaying(true);
      
      // Start the meditation sequence
      playMeditationSequence(lines, timings);
    } catch (error) {
      console.error('Error starting meditation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playMeditationSequence = (lines: string[], timings: number[]) => {
    let currentIndex = 0;
    
    const playNextLine = () => {
      if (currentIndex >= lines.length) {
        // Meditation complete
        setIsPlaying(false);
        setCurrentLineIndex(-1);
        return;
      }
      
      setCurrentLine(lines[currentIndex]);
      setCurrentLineIndex(currentIndex);
      
      setTimeout(() => {
        currentIndex++;
        playNextLine();
      }, timings[currentIndex]);
    };
    
    playNextLine();
  };

  const pauseMeditation = () => {
    setIsPlaying(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <View style={styles.background} />

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Meditation Space</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettings(!showSettings)}
          >
            <Settings size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Settings Panel */}
        {showSettings && (
          <View style={styles.settingsPanel}>
            <Text style={styles.settingsTitle}>Customize Your Session</Text>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Duration (minutes)</Text>
              <View style={styles.durationButtons}>
                {[5, 10, 15, 20].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.durationButton,
                      preferences.duration === mins && styles.durationButtonActive
                    ]}
                    onPress={() => setPreferences(prev => ({ ...prev, duration: mins }))}
                  >
                    <Text style={[
                      styles.durationButtonText,
                      preferences.duration === mins && styles.durationButtonTextActive
                    ]}>
                      {mins}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingGroup}>
              <Text style={styles.settingLabel}>Focus</Text>
              <TouchableOpacity 
                style={styles.focusInput}
                onPress={() => {/* Open focus selection modal */}}
              >
                <Text style={styles.focusText}>{preferences.focus}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Meditation Display */}
        <View style={styles.meditationDisplay}>
          {isLoading ? (
            <Text style={styles.loadingText}>Preparing your meditation...</Text>
          ) : currentLine ? (
            <Text style={styles.meditationText}>{currentLine}</Text>
          ) : (
            <Text style={styles.placeholderText}>
              Ready to begin your meditation journey?
            </Text>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.muteButton}
            onPress={toggleMute}
          >
            {isMuted ? (
              <VolumeX size={24} color="#ffffff" />
            ) : (
              <Volume2 size={24} color="#ffffff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={isPlaying ? pauseMeditation : startMeditation}
            disabled={isLoading}
          >
            {isPlaying ? (
              <Pause size={32} color="#ffffff" />
            ) : (
              <Play size={32} color="#ffffff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.musicButton}>
            <Music size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Progress Indicators */}
        {guidanceLines.length > 0 && (
          <View style={styles.progressIndicators}>
            {guidanceLines.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  currentLineIndex === index && styles.progressDotActive
                ]}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2d1b69',
    opacity: 0.8,
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  settingsButton: {
    padding: 8,
  },
  settingsPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  settingGroup: {
    marginBottom: 16,
  },
  settingLabel: {
    color: '#ffffff',
    marginBottom: 8,
  },
  durationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  durationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  durationButtonActive: {
    backgroundColor: '#4f46e5',
  },
  durationButtonText: {
    color: '#ffffff',
  },
  durationButtonTextActive: {
    fontWeight: '600',
  },
  focusInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  focusText: {
    color: '#ffffff',
  },
  meditationDisplay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#ffffff',
    opacity: 0.8,
  },
  meditationText: {
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 36,
  },
  placeholderText: {
    color: '#ffffff',
    opacity: 0.6,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 24,
  },
  muteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  musicButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressDotActive: {
    backgroundColor: '#4f46e5',
  },
});

export default MeditationSpace;