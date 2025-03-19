import { useState, useRef, useEffect } from 'react';
import { 
  MeditationVideo, 
  MeditationPreferences, 
  DEFAULT_PREFERENCES,
  generateMeditationContent,
  calculateLineTiming,
  speakMeditationLine, // Make sure to import this
  toggleSpeechSynthesis,
  stopSpeechSynthesis,
  initializeSpeechSynthesis,
  getBestMeditationVoice,
  createEnhancedMeditationUtterance
} from '@shared/lib/mind/meditationspace';
import { Maximize, Minimize, X, Play, Pause, Settings, Menu } from 'lucide-react';

interface MeditationSessionProps {
  mbtiType: string;
  userId?: string;
  isPlayingMusic?: boolean;
  onStartMeditation?: () => void;
  isUiVisible?: boolean;
  showNavToggle?: boolean;
  onNavToggle?: () => void;
  // Props to connect with parent MeditationSpace component
  onThemeChange?: (theme: string) => void;
  backgroundVideos?: MeditationVideo[];
  currentVideo?: MeditationVideo | null;
  isMeditationActive?: boolean; // New prop to track meditation state
  onMeditationStateChange?: (isActive: boolean) => void; // To notify parent of state change
}

const MeditationSession = ({ 
  mbtiType = 'default', 
  userId, 
  isPlayingMusic = false,
  onStartMeditation,
  isUiVisible = true,
  showNavToggle = false,
  onNavToggle,
  onThemeChange,
  currentVideo = null,
  isMeditationActive = false,
  onMeditationStateChange
}: MeditationSessionProps) => {
  // Layout state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Voice selection state
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<MeditationPreferences>({
    duration: 5, // in minutes
    focus: 'mindfulness',
    background: 'nature',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Guided meditation state
  const [guidanceLines, setGuidanceLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [showGuidance, setShowGuidance] = useState(false);
  const [isGuidanceActive, setIsGuidanceActive] = useState(false);
  const [guidanceTimings, setGuidanceTimings] = useState<number[]>([]);
  const [currentGuidanceTimerId, setCurrentGuidanceTimerId] = useState<NodeJS.Timeout | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [premiumVoiceCount, setPremiumVoiceCount] = useState(0);

  // Filter voices specifically for meditation (replacing the previous voice loading logic)
  useEffect(() => {
    const loadMeditationVoices = () => {
      // Force synchronous loading on some browsers
      const synth = window.speechSynthesis;
      synth.getVoices();
      
      setTimeout(() => {
        const allVoices = synth.getVoices();
        if (allVoices.length > 0) {
          // Filter for voices that work well for meditation
          const meditationVoices = allVoices.filter(voice => {
            // Prefer female voices, they tend to be more soothing for meditation
            const isFemale = voice.name.toLowerCase().includes('female') || 
                            voice.name.includes('Samantha') || 
                            voice.name.includes('Moira') || 
                            voice.name.includes('Karen');
            
            // Prefer premium/neural voices
            const isPremium = voice.name.includes('Neural') || 
                             voice.name.includes('Premium') || 
                             voice.name.includes('Wavenet');
            
            // Include voices that are either female or premium, or have calming names
            return isFemale || isPremium || 
                  voice.name.includes('Calm') || 
                  voice.name.includes('soft');
          });
          
          // If we found meditation-suitable voices, use them
          if (meditationVoices.length > 0) {
            setAvailableVoices(meditationVoices);
            
            // Set default to the first female premium voice if available
            const femalePremium = meditationVoices.find(v => 
              (v.name.toLowerCase().includes('female') || 
               v.name.includes('Samantha') || 
               v.name.includes('Moira')) && 
              (v.name.includes('Neural') || 
               v.name.includes('Premium'))
            );
            
            if (femalePremium) {
              setSelectedVoice(femalePremium.name);
            } else {
              // Otherwise use first voice in filtered list
              setSelectedVoice(meditationVoices[0].name);
            }
            
            setPremiumVoiceCount(meditationVoices.filter(v => 
              v.name.includes('Neural') || 
              v.name.includes('Premium') || 
              v.name.includes('Wavenet')
            ).length);
          } else {
            // If no suitable voices, fall back to all voices
            setAvailableVoices(allVoices);
            if (allVoices.length > 0) {
              setSelectedVoice(allVoices[0].name);
            }
          }
        } else {
          // Try again after a longer delay
          setTimeout(loadMeditationVoices, 500);
        }
      }, 100);
    };
    
    loadMeditationVoices();
    
    // Set up event handler for voice loading
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadMeditationVoices;
    }
    
    // Periodic check for browsers that don't fire the event
    const periodicCheck = setTimeout(() => {
      const currentVoices = window.speechSynthesis.getVoices();
      if (currentVoices.length > 0 && availableVoices.length === 0) {
        loadMeditationVoices();
      }
    }, 1000);
    
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
      clearTimeout(periodicCheck);
    };
  }, []);

  // Load default preferences based on MBTI type
  useEffect(() => {
    // Initialize speech synthesis
    const speechSupported = initializeSpeechSynthesis();
    setIsSpeechSupported(speechSupported);
    
    // Set default preferences based on MBTI
    const defaults = DEFAULT_PREFERENCES[mbtiType] || DEFAULT_PREFERENCES.default;
    setPreferences(prev => ({
      ...prev,
      focus: defaults.focus,
      background: defaults.background
    }));
    
    // Clean up speech synthesis when component unmounts
    return () => {
      stopSpeechSynthesis();
    };
  }, [mbtiType]);

  // Handle fullscreen change events from browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      // Update state based on actual fullscreen status
      const isInFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isInFullscreen);
      
      // Adjust container classes based on fullscreen state
      if (isInFullscreen && containerRef.current) {
        containerRef.current.classList.add('fixed', 'inset-0', 'z-50');
        containerRef.current.classList.remove('relative');
      } else if (containerRef.current) {
        containerRef.current.classList.remove('fixed', 'inset-0', 'z-50');
        containerRef.current.classList.add('relative');
      }
    };
    
    // Listen for fullscreen change events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Generate meditation guidance based on preferences - modified to remove any duration limit
  const handleGenerateGuidance = async () => {
    setIsLoading(true);
    try {
      // Get meditation content as an array of lines
      // Note: we still use duration to generate appropriate-length content
      const lines = await generateMeditationContent(
        mbtiType,
        preferences.focus,
        preferences.duration
      );
      
      // Calculate timing for each line
      const timings = calculateLineTiming(lines, preferences.duration);
      
      setGuidanceLines(lines);
      setGuidanceTimings(timings);
      setCurrentLineIndex(-1);
      setShowGuidance(true);
      
      // Start the guided meditation after a short delay
      setTimeout(() => {
        startGuidedMeditation(lines, timings);
      }, 1000);
    } catch (error) {
      console.error('Error generating meditation guidance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start guided meditation with voice
  const startGuidedMeditation = (lines: string[], timings: number[]) => {
    setIsGuidanceActive(true);
    setCurrentLineIndex(0);
    
    // Start the first line
    if (lines.length > 0) {
      // Speak the first line
      if (isSpeechSupported) {
        const utterance = speakLineWithSelectedVoice(lines[0], () => {
          // When line is finished being spoken, schedule the next line
          scheduleNextLine(1, lines, timings);
        });
        setCurrentUtterance(utterance);
      } else {
        // If speech not supported, just use timings
        scheduleNextLine(1, lines, timings);
      }
    }
  };

  // Modified schedule function to continue until all lines are spoken
  const scheduleNextLine = (nextIndex: number, lines: string[], timings: number[]) => {
    // Only end meditation when all lines are completed
    if (nextIndex >= lines.length) {
      // Don't automatically end the meditation experience
      // Just mark guidance as completed but keep the meditation state active
      setIsGuidanceActive(false);
      
      // Show a completion message or display final guidance
      setCurrentLineIndex(lines.length - 1); // Keep showing the last line
      return;
    }
    
    // Clear any existing timer
    if (currentGuidanceTimerId) {
      clearTimeout(currentGuidanceTimerId);
    }
    
    // Continue with next line regardless of elapsed time
    const timerId = setTimeout(() => {
      setCurrentLineIndex(nextIndex);
      
      // Speak the new line
      if (isSpeechSupported) {
        const utterance = speakLineWithSelectedVoice(lines[nextIndex], () => {
          scheduleNextLine(nextIndex + 1, lines, timings);
        });
        setCurrentUtterance(utterance);
      } else {
        scheduleNextLine(nextIndex + 1, lines, timings);
      }
    }, isSpeechSupported ? 500 : timings[nextIndex - 1]);
    
    setCurrentGuidanceTimerId(timerId);
  };

  // Handle pausing/resuming the guided meditation
  const toggleGuidedMeditation = () => {
    if (isGuidanceActive) {
      // Pause
      if (currentGuidanceTimerId) {
        clearTimeout(currentGuidanceTimerId);
      }
      if (isSpeechSupported) {
        toggleSpeechSynthesis(true); // Pause speech
      }
      setIsGuidanceActive(false);
    } else {
      // Resume
      setIsGuidanceActive(true);
      if (isSpeechSupported) {
        toggleSpeechSynthesis(false); // Resume speech
      }
      // Resume with the current line
      if (currentLineIndex < guidanceLines.length - 1) {
        scheduleNextLine(currentLineIndex + 1, guidanceLines, guidanceTimings);
      }
    }
  };

  // Modify stop guided meditation to make it explicit
  const stopGuidedMeditation = () => {
    if (currentGuidanceTimerId) {
      clearTimeout(currentGuidanceTimerId);
      setCurrentGuidanceTimerId(null);
    }
    
    if (isSpeechSupported) {
      stopSpeechSynthesis();
    }
    
    // Reset all meditation state
    setIsGuidanceActive(false);
    setShowGuidance(false);
    setCurrentLineIndex(-1);
    
    // Notify parent that meditation has ended (only when explicitly stopped)
    if (onMeditationStateChange) {
      onMeditationStateChange(false);
    }
  };

  // Start meditation session
  const startMeditation = () => {
    // Notify parent that meditation is starting
    if (onMeditationStateChange) {
      onMeditationStateChange(true);
    }
    
    if (onStartMeditation) {
      // Use setTimeout to ensure any video operations happen after this call completes
      setTimeout(() => {
        onStartMeditation();
      }, 0);
    }
    
    // Use setTimeout to prevent race condition with video playback
    setTimeout(() => {
      handleGenerateGuidance();
    }, 100);
  };

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (currentGuidanceTimerId) {
        clearTimeout(currentGuidanceTimerId);
      }
      stopSpeechSynthesis();
    };
  }, []);

  // Toggle fullscreen mode - target the right parent element
  const toggleFullscreen = () => {
    // Find the closest parent container for fullscreen
    const fullscreenTarget = containerRef.current?.closest('.rounded-lg') || containerRef.current;
    
    if (!document.fullscreenElement) {
      if (fullscreenTarget?.requestFullscreen) {
        fullscreenTarget.requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(err => console.error('Could not enter fullscreen mode:', err));
      }
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error('Could not exit fullscreen mode:', err));
    }
  };

  // Apply settings and update background theme
  const applySettings = () => {
    setIsLoading(true);
    try {
      const newTheme = preferences.background;
      
      // Notify parent to change the background theme
      if (onThemeChange) {
        onThemeChange(newTheme);
      }
    } catch (error) {
      console.error('Error applying settings:', error);
    } finally {
      setIsLoading(false);
      setShowSettings(false);
    }
  };

  // Speak meditation line with the selected voice - fixed to handle pause markers
  const speakLineWithSelectedVoice = (line: string, onComplete?: () => void) => {
    // Check if this is a pause marker (don't speak it)
    if (line === '[pause]') {
      // Create a pause effect, then call the completion callback
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 3000);
      return null;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(line);
    
    // Use selected voice if available
    if (selectedVoice) {
      const voice = availableVoices.find(v => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
    }
    
    // Improve voice quality with better parameters
    utterance.rate = 0.9;  // Slightly slower for meditation
    utterance.pitch = 1.0;  // Natural pitch
    utterance.volume = 0.9;
    
    if (onComplete) {
      utterance.onend = onComplete;
    }
    
    window.speechSynthesis.speak(utterance);
    return utterance;
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      {/* Main content container */}
      <div 
        className={`absolute inset-0 z-25 p-6 transition-opacity duration-500 ${isUiVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Header controls - enable pointer events */}
        <div className="flex justify-between items-center mb-16 pointer-events-auto">
          <h2 className="text-lg font-semibold text-white drop-shadow-lg">Meditation Space</h2>
          <div className="flex items-center space-x-2">
            {showNavToggle && (
              <button
                onClick={onNavToggle}
                className="p-2 text-white hover:text-indigo-200 rounded-full hover:bg-white/10 transition-colors"
                title="Toggle Navigation Bar"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <button 
              onClick={toggleFullscreen} 
              className="p-2 text-white hover:text-indigo-200 rounded-full hover:bg-white/10 transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              className="p-2 text-white hover:text-indigo-200 rounded-full hover:bg-white/10 transition-colors"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Fixed Settings Panel with Voice Selection */}
        {showSettings && !showGuidance && (
          <div 
            className="mb-8 p-6 bg-black/40 backdrop-blur-md rounded-lg max-w-md mx-auto pointer-events-auto"
          >
            <h3 className="font-medium text-white mb-4 flex items-center justify-between">
              <span>Customize Your Experience</span>
              <button onClick={() => setShowSettings(false)}>
                <X className="h-5 w-5 text-white/80 hover:text-white" />
              </button>
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-1">Duration (minutes)</label>
                {/* Fix the select element syntax error */}
                <select 
                  value={preferences.duration}
                  onChange={(e) => setPreferences({...preferences, duration: Number(e.target.value)})}
                  className="w-full bg-white/20 border-0 text-white rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {[5, 10, 15, 20, 30].map((mins) => (
                    <option key={mins} value={mins}>{mins} minutes</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-1">Focus</label>
                <input 
                  type="text"
                  value={preferences.focus}
                  onChange={(e) => setPreferences({...preferences, focus: e.target.value})}
                  className="w-full bg-white/20 border-0 text-white rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., stress relief, sleep, focus..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-1">Background Theme</label>
                <input 
                  type="text"
                  value={preferences.background}
                  onChange={(e) => setPreferences({...preferences, background: e.target.value})}
                  className="w-full bg-white/20 border-0 text-white rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., ocean, forest, space..."
                />
              </div>
              
              {/* Voice selection option */}
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Meditation Voice
                </label>
                <select 
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-white/20 border-0 text-white rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {availableVoices.length === 0 && (
                    <option value="">Loading meditation voices...</option>
                  )}
                  {availableVoices.map((voice, index) => {
                    // Add helpful tags to identify voice characteristics
                    const isPremium = voice.name.includes('Neural') || 
                                     voice.name.includes('Premium') || 
                                     voice.name.includes('Wavenet');
                    const isFemale = voice.name.toLowerCase().includes('female') || 
                                   voice.name.includes('Samantha') || 
                                   voice.name.includes('Moira') || 
                                   voice.name.includes('Karen');
                    const tag = isPremium 
                      ? '⭐ Premium' 
                      : isFemale 
                        ? '♀ Soothing'
                        : '';
                    
                    return (
                      <option key={`${voice.name}-${index}`} value={voice.name}>
                        {voice.name} {tag && `(${tag})`}
                      </option>
                    );
                  })}
                </select>
                <p className="text-white/60 text-xs mt-1">
                  {premiumVoiceCount > 0 
                    ? 'Premium voices (⭐) provide the most calming meditation experience'
                    : 'Select the voice that feels most soothing to you'}
                </p>
              </div>
              
              {/* Voice quality info */}
              <div className="mt-3 text-white/70 text-xs space-y-1">
                {/* ... existing voice quality guidance ... */}
              </div>
              
              {/* Premium voice options */}
              <div className="mt-4 p-3 bg-indigo-900/30 rounded-lg">
                {/* ... existing premium voice options ... */}
              </div>
              
              <button
                onClick={applySettings}
                className="w-full py-2 bg-indigo-600/80 hover:bg-indigo-700/80 text-white font-medium rounded-lg"
              >
                Apply Settings
              </button>
            </div>
          </div>
        )}
          
        {/* Guidance Overlay */}
        {showGuidance && guidanceLines.length > 0 && (
          <div 
            className={`${isFullscreen ? 'fixed inset-0' : 'absolute inset-0'} z-30 flex flex-col items-center justify-center text-center p-6 pointer-events-auto`}
          >
            <button 
              onClick={stopGuidedMeditation} 
              className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 rounded-full p-2"
              aria-label="Stop meditation"
            >
              <X className="h-6 w-6" />
            </button>
            
            <div className="max-w-2xl">
              {/* Display current line with enhanced text shadow for readability */}
              {currentLineIndex > 0 && currentLineIndex < guidanceLines.length - 1 && (
                <p className="text-white/70 text-md md:text-lg leading-relaxed mb-4 shadow-text">
                  {guidanceLines[currentLineIndex - 1]}
                </p>
              )}
              
              {/* Current line or completion message */}
              <p className="text-white text-xl md:text-2xl leading-relaxed min-h-[4rem] transition-opacity duration-1000 shadow-text">
                {currentLineIndex >= 0 ? (
                  // Show current guidance line
                  guidanceLines[currentLineIndex]
                ) : (
                  // Initial state
                  'Preparing your meditation...'
                )}
              </p>
              
              {/* Only show controls when meditation is active or has remaining content */}
              {(isGuidanceActive || currentLineIndex < guidanceLines.length - 1) && (
                <div className="opacity-0 hover:opacity-100 transition-opacity duration-300 mt-8">
                  <button 
                    onClick={toggleGuidedMeditation} 
                    className="px-6 py-3 bg-black/30 hover:bg-black/40 text-white rounded-md flex items-center justify-center mx-auto"
                    aria-label={isGuidanceActive ? "Pause meditation" : "Resume meditation"}
                  >
                    {isGuidanceActive ? (
                      <>
                        <Pause className="h-5 w-5 mr-2" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 mr-2" /> Resume
                      </>
                    )}
                  </button>
                  
                  {/* Progress indicator that shows completion */}
                  <div className="mt-4 w-full max-w-md mx-auto">
                    <div className="h-0.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/60 transition-all duration-150"
                        style={{ 
                          width: `${Math.min(((currentLineIndex + 1) / guidanceLines.length) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Completion message at the end */}
              {!isGuidanceActive && currentLineIndex >= guidanceLines.length - 1 && (
                <div className="mt-8 opacity-100 transition-opacity duration-500">
                  <p className="text-white/80 text-lg mb-4">
                    Your meditation is complete. Feel free to continue in silence or end your session.
                  </p>
                  <button
                    onClick={stopGuidedMeditation}
                    className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-md"
                  >
                    End Session
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meditation controls - hidden during active meditation */}
        {!isMeditationActive && (
          <div 
            className={`${isFullscreen ? 'absolute bottom-6 left-0 right-0' : 'mt-36'} z-25 pointer-events-auto`}
          >
            <div className="max-w-lg mx-auto">
              {/* Start Meditation Button */}
              <div className="mb-8">
                <button
                  onClick={startMeditation}
                  disabled={isLoading || !currentVideo}
                  className={`w-full py-3 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg flex items-center justify-center backdrop-blur-md transition-all ${(!currentVideo || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Preparing your session...' : 'Start Guided Meditation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Fullscreen exit button that's always visible */}
      {isFullscreen && !isUiVisible && (
        <div>
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-50 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white/70 hover:text-white transition-all pointer-events-auto"
            title="Exit Fullscreen"
          >
            <Minimize className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};

// Add style for text shadow to ensure readability on any background
const styles = `
  .shadow-text {
    text-shadow: 0 2px 4px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.7);
    letter-spacing: 0.01em;
  }
`;

// Inject the styles into the document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default MeditationSession;