import { getPexelsVideo } from '../common/pexels';
import { generateMeditationGuidance } from '../common/openai';

// Types
export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  image: string;
  category: string;
}

export interface MeditationVideo {
  id: string;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  video_files: {
    id: string;
    quality: string;
    file_type: string;
    link: string;
    width: number;
    height: number;
  }[];
}

export interface MeditationPreferences {
  duration: number;
  focus: string;
  background: string;
}

export interface MeditationState {
  currentVideoIndex: number;
  isGuidanceActive: boolean;
  guidanceLines: string[];
  currentLineIndex: number;
  isAudioPlaying: boolean;
  audioProgress: number;
}

// Default preferences by MBTI type
export const DEFAULT_PREFERENCES: { [key: string]: { focus: string, background: string } } = {
  'INTJ': { focus: 'analytical meditation', background: 'minimal spaces' },
  'INTP': { focus: 'thought exploration', background: 'starry skies' },
  'ENTJ': { focus: 'goal visualization', background: 'mountain peaks' },
  'ENTP': { focus: 'creative meditation', background: 'abstract patterns' },
  'INFJ': { focus: 'spiritual connection', background: 'gentle waves' },
  'INFP': { focus: 'emotional reflection', background: 'forests' },
  'ENFJ': { focus: 'empathetic meditation', background: 'community scenes' },
  'ENFP': { focus: 'joyful awareness', background: 'colorful landscapes' },
  'ISTJ': { focus: 'structured meditation', background: 'geometric patterns' },
  'ISFJ': { focus: 'nurturing meditation', background: 'home settings' },
  'ESTJ': { focus: 'decisive meditation', background: 'city skylines' },
  'ESFJ': { focus: 'harmonious meditation', background: 'gardens' },
  'ISTP': { focus: 'present moment awareness', background: 'workshops' },
  'ISFP': { focus: 'sensory meditation', background: 'artistic scenes' },
  'ESTP': { focus: 'energetic meditation', background: 'action scenes' },
  'ESFP': { focus: 'playful meditation', background: 'celebrations' },
  'default': { focus: 'mindful meditation', background: 'nature' }
};

// Constants for video and meditation timing
export const VIDEO_DURATION_MS = 2 * 60 * 1000; // 2 minutes in milliseconds
export const SPEECH_PAUSE_DURATION = 1500; // Pause between lines in ms

/**
 * Fetch background videos based on search term
 */
export const fetchBackgroundVideos = async (searchTerm: string, count = 5): Promise<MeditationVideo[]> => {
  try {
    const videos = await getPexelsVideo(searchTerm, count);
    return videos;
  } catch (error) {
    console.error('Error fetching background videos:', error);
    return [];
  }
};

/**
 * Format time in minutes:seconds
 */
export const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Get meditation guidance based on MBTI type and preferences
 */
export const getMeditationGuidance = async (
  mbtiType: string,
  focus: string,
  durationMinutes: number
): Promise<string> => {
  try {
    return await generateMeditationGuidance(mbtiType, focus, durationMinutes);
  } catch (error) {
    console.error('Error generating meditation guidance:', error);
    return 'Take a deep breath. Feel yourself becoming more relaxed with each breath. Allow your mind to be present in this moment.';
  }
};

/**
 * Split guidance text into lines suitable for line-by-line display
 */
export const splitGuidanceIntoLines = (guidance: string): string[] => {
  // First split by paragraphs
  const paragraphs = guidance.split('\n').filter(p => p.trim().length > 0);
  
  // Then split long paragraphs into sentences
  const lines: string[] = [];
  
  paragraphs.forEach(paragraph => {
    // Split by sentence endings (., !, ?) followed by a space or end of string
    const sentences = paragraph.split(/(?<=[.!?])\s+|(?<=[.!?])$/);
    
    sentences.forEach(sentence => {
      if (sentence.trim().length > 0) {
        // If sentence is very long, split it further at commas or natural pauses
        if (sentence.length > 100) {
          const subParts = sentence.split(/(?<=,)\s+|(?<=;)\s+/);
          lines.push(...subParts.filter(p => p.trim().length > 0));
        } else {
          lines.push(sentence.trim());
        }
      }
    });
  });
  
  return lines;
};

/**
 * Gets the default meditation preferences based on MBTI type
 */
export const getDefaultPreferences = (mbtiType: string): MeditationPreferences => {
  const defaults = DEFAULT_PREFERENCES[mbtiType] || DEFAULT_PREFERENCES.default;
  return {
    duration: 5, // Default to 5 minutes
    focus: defaults.focus,
    background: defaults.background
  };
};

/**
 * Get the next video index in rotation
 */
export const getNextVideoIndex = (currentIndex: number, totalVideos: number): number => {
  return (currentIndex + 1) % totalVideos;
};

/**
 * Improved line breaking for meditation content with better pause handling
 */
export const breakTextIntoLines = (text: string): string[] => {
  // First check if the text already has [pause] markers
  const hasPauseMarkers = text.includes('[pause]');
  
  // Split text by both sentences and explicit pause markers
  const lines: string[] = [];
  
  // If we have pause markers, handle them specially
  if (hasPauseMarkers) {
    // Split by [pause] first to preserve it as a separate element
    const segmentsWithPauses = text.split(/\[pause\]/g);
    
    segmentsWithPauses.forEach((segment, index) => {
      // Process each regular text segment
      if (segment.trim().length > 0) {
        // Process each segment into sentences
        const sentencesInSegment = segment
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        // Add all sentences from this segment
        lines.push(...sentencesInSegment);
      }
      
      // Add a pause marker after each segment (except the last one)
      if (index < segmentsWithPauses.length - 1) {
        lines.push('[pause]');
      }
    });
  } else {
    // Process regular text without explicit pause markers
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.length > 0) {
        if (trimmed.length > 80) {
          // Split long sentences at logical break points
          const parts = trimmed.split(/(?:,|;)\s+/);
          let currentLine = '';
          
          parts.forEach(part => {
            if ((currentLine + part).length <= 80) {
              currentLine += (currentLine ? ', ' : '') + part;
            } else {
              if (currentLine) {
                lines.push(currentLine.trim());
              }
              currentLine = part;
            }
          });
          
          if (currentLine) {
            lines.push(currentLine.trim());
          }
        } else {
          lines.push(trimmed);
        }
      }
    });
    
    // Add implicit pauses after certain keywords
    const enhancedLines = [];
    for (let i = 0; i < lines.length; i++) {
      enhancedLines.push(lines[i]);
      
      // Add pauses after guiding instructions or breathing cues
      if (
        lines[i].toLowerCase().includes('notice') || 
        lines[i].toLowerCase().includes('feel') || 
        lines[i].toLowerCase().includes('aware') ||
        lines[i].toLowerCase().includes('breathe') ||
        lines[i].toLowerCase().includes('inhale') ||
        lines[i].toLowerCase().includes('exhale')
      ) {
        enhancedLines.push('[pause]');
      }
    }
    
    return enhancedLines;
  }
  
  return lines;
};

/**
 * Generate meditation guidance and break it into lines with proper pause handling
 */
export const generateMeditationContent = async (
  mbtiType: string,
  focus: string,
  duration: number
): Promise<string[]> => {
  try {
    const guidanceText = await generateMeditationGuidance(mbtiType, focus, duration);
    
    // Process the text into lines with proper pause handling
    const baseLines = breakTextIntoLines(guidanceText);
    
    // Add breathing cues if they aren't already present
    const hasBreathingCues = baseLines.some(line => 
      line.toLowerCase().includes('breath') || 
      line.toLowerCase().includes('inhale') || 
      line.toLowerCase().includes('exhale')
    );
    
    if (!hasBreathingCues) {
      return addBreathingCues(baseLines);
    }
    
    return baseLines;
  } catch (error) {
    console.error('Error generating meditation content:', error);
    return [
      'Take a deep breath in.',
      '[pause]',
      'Hold for a moment.',
      '[pause]',
      'And release.',
      '[pause]',
      'Continue breathing at your own pace.',
      '[pause]',
      'Allow yourself to be present in this moment.',
      '[pause]'
    ];
  }
};

/**
 * Add breathing cues to meditation lines for a more guided experience
 */
export const addBreathingCues = (lines: string[]): string[] => {
  const enhancedLines: string[] = [];
  let breathingCueAdded = false;
  
  // Process each line, adding breathing cues at natural points
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    enhancedLines.push(line);
    
    // Add breathing cues every few instructions if not already present
    if (i > 0 && i % 3 === 0 && !breathingCueAdded &&
        !line.toLowerCase().includes('breath') && 
        !lines[i-1].toLowerCase().includes('breath')) {
      
      // Alternate between different breathing instructions
      if (i % 6 === 0) {
        enhancedLines.push("Take a deep breath in... [pause]");
        enhancedLines.push("And slowly exhale... [pause]");
      } else {
        enhancedLines.push("Breathe in deeply through your nose... [pause]");
        enhancedLines.push("And breathe out through your mouth, releasing any tension... [pause]");
      }
      
      breathingCueAdded = true;
    } else {
      breathingCueAdded = false;
    }
    
    // Add pauses after significant instructions
    if (line.includes('relax') || line.includes('feel') || 
        line.includes('notice') || line.includes('aware')) {
      enhancedLines.push("[pause]");
    }
  }
  
  return enhancedLines;
};

/**
 * Calculate line display timing with enhanced pause handling
 */
export const calculateLineTiming = (
  lines: string[], 
  totalDurationMinutes: number
): number[] => {
  // Count how many significant lines we have (excluding pauses)
  const regularLines = lines.filter(line => line !== '[pause]');
  const totalWords = regularLines.reduce((count, line) => {
    return count + line.split(/\s+/).length;
  }, 0);
  
  // Calculate base timing for content
  const totalTimeMs = totalDurationMinutes * 60 * 1000;
  
  // Reserve time for pauses (about 20% of total time)
  const pauseTimeReserve = totalTimeMs * 0.2;
  const pauseCount = lines.filter(line => line === '[pause]').length;
  
  // Calculate base time per word for regular lines
  const contentTimeAvailable = totalTimeMs - pauseTimeReserve;
  const averageTimePerWordMs = contentTimeAvailable / Math.max(1, totalWords);
  
  // Calculate timing for each line
  return lines.map(line => {
    // Special case for pause markers
    if (line === '[pause]') {
      return pauseCount > 0 ? (pauseTimeReserve / pauseCount) : 3000; 
    }
    
    // For breathing instructions, add extra time
    const wordCount = line.split(/\s+/).length;
    let lineTime = Math.max(1500, wordCount * averageTimePerWordMs);
    
    // Add extra time for breathing cues
    if (
      line.toLowerCase().includes('breath') || 
      line.toLowerCase().includes('inhale') || 
      line.toLowerCase().includes('exhale')
    ) {
      lineTime += 2000;
    }
    
    return lineTime;
  });
};

/**
 * Read meditation text using speech synthesis
 */
export const speakMeditationLine = (
  line: string, 
  onLineComplete?: () => void
): SpeechSynthesisUtterance | null => {
  // Check if speech synthesis is supported
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onLineComplete) setTimeout(onLineComplete, 1000);
    return null;
  }

  // If this is a pause marker, don't speak it but still invoke completion
  if (line === '[pause]') {
    if (onLineComplete) {
      // Delay callback to create the pause effect
      setTimeout(onLineComplete, 3000);
    }
    return null;
  }
  
  // Handle normal speech for non-pause lines
  window.speechSynthesis.cancel();
  
  const utterance = createEnhancedMeditationUtterance(line);
  
  if (onLineComplete) {
    utterance.onend = onLineComplete;
  }
  
  window.speechSynthesis.speak(utterance);
  return utterance;
};

/**
 * Pause or resume speech synthesis
 */
export const toggleSpeechSynthesis = (isPaused: boolean): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  if (isPaused) {
    window.speechSynthesis.pause();
  } else {
    window.speechSynthesis.resume();
  }
};

/**
 * Stop any ongoing speech synthesis
 */
export const stopSpeechSynthesis = (): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
};

/**
 * Initialize meditation speech synthesis interface
 */
export const initializeSpeechSynthesis = (): boolean => {
  // Ensure the browser supports speech synthesis
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.error('Speech synthesis not supported in this browser');
    return false;
  }
  
  // Force voice loading
  window.speechSynthesis.getVoices();
  
  // Workaround for Chrome speech synthesis bug
  if ('chrome' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
  
  return true;
};

/**
 * Get the best available voice for meditation
 */
export const getBestMeditationVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  
  const allVoices = window.speechSynthesis.getVoices();
  
  // First try to find premium female voices
  const premiumFemaleVoices = allVoices.filter(voice => 
    (voice.name.toLowerCase().includes('female') || 
     voice.name.includes('Samantha') || 
     voice.name.includes('Moira') || 
     voice.name.includes('Karen')) &&
    (voice.name.includes('Neural') || 
     voice.name.includes('Premium') || 
     voice.name.includes('Wavenet'))
  );
  
  if (premiumFemaleVoices.length > 0) return premiumFemaleVoices[0];
  
  // Then try any premium voice
  const premiumVoices = allVoices.filter(voice => 
    voice.name.includes('Neural') ||
    voice.name.includes('Premium') ||
    voice.name.includes('Wavenet')
  );
  
  if (premiumVoices.length > 0) return premiumVoices[0];
  
  // Then try any female voice
  const femaleVoices = allVoices.filter(voice => 
    voice.name.toLowerCase().includes('female') || 
    voice.name.includes('Samantha') || 
    voice.name.includes('Moira') || 
    voice.name.includes('Karen')
  );
  
  if (femaleVoices.length > 0) return femaleVoices[0];
  
  // Fallback to any available voice
  return allVoices.length > 0 ? allVoices[0] : null;
};

/**
 * Create an enhanced meditation utterance with optimal settings
 */
export const createEnhancedMeditationUtterance = (
  text: string, 
  voice?: SpeechSynthesisVoice
): SpeechSynthesisUtterance => {
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Use provided voice or find the best available one
  if (voice) {
    utterance.voice = voice;
  } else {
    const bestVoice = getBestMeditationVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
    }
  }
  
  // Optimize settings for meditation speech
  utterance.rate = 0.85;     // Slower pace for meditation
  utterance.pitch = 1.0;     // Natural pitch
  utterance.volume = 0.9;    // Clear but not too loud
  
  return utterance;
};

// New types for voice management
export interface MeditationVoiceOptions {
  preferFemale?: boolean;
  preferPremium?: boolean;
}

/**
 * Loads and filters voices suitable for meditation
 */
export const loadMeditationVoices = async (options: MeditationVoiceOptions = {}): Promise<{
  voices: SpeechSynthesisVoice[];
  bestVoice: SpeechSynthesisVoice | null;
  premiumCount: number;
}> => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { voices: [], bestVoice: null, premiumCount: 0 };
  }

  // Initialize speech synthesis
  const synth = window.speechSynthesis;
  
  // Try to force voice loading
  synth.getVoices();
  
  // Get available voices with a small delay to ensure loading
  return new Promise((resolve) => {
    setTimeout(() => {
      const allVoices = synth.getVoices();
      
      if (allVoices.length === 0) {
        resolve({ voices: [], bestVoice: null, premiumCount: 0 });
        return;
      }
      
      // Filter for voices suitable for meditation
      const meditationVoices = allVoices.filter(voice => {
        const isFemale = voice.name.toLowerCase().includes('female') || 
                          voice.name.includes('Samantha') || 
                          voice.name.includes('Moira');
        const isPremium = voice.name.includes('Neural') || 
                          voice.name.includes('Premium') || 
                          voice.name.includes('Wavenet');
        
        // Apply filters based on options
        if (options.preferFemale && options.preferPremium) {
          return isFemale && isPremium;
        } else if (options.preferFemale) {
          return isFemale;
        } else if (options.preferPremium) {
          return isPremium;
        }
        
        return isFemale || isPremium || voice.name.includes('Calm');
      });
      
      // Use filtered voices if available, otherwise all voices
      const voicesToUse = meditationVoices.length > 0 ? meditationVoices : allVoices;
      
      // Find the best voice
      const bestVoice = getBestMeditationVoice();
      
      // Count premium voices
      const premiumCount = voicesToUse.filter(v => 
        v.name.includes('Neural') || 
        v.name.includes('Premium') || 
        v.name.includes('Wavenet')
      ).length;
      
      resolve({
        voices: voicesToUse,
        bestVoice,
        premiumCount
      });
    }, 100);
  });
};

/**
 * Meditation session controller for managing guided meditation state
 */
export class MeditationSessionController {
  private lines: string[] = [];
  private timings: number[] = [];
  private currentLineIndex: number = -1;
  private isActive: boolean = false;
  private currentTimerId: NodeJS.Timeout | null = null;
  private speechSupported: boolean;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private onLineChangeCallback: ((line: string, index: number) => void) | null = null;
  private onStateChangeCallback: ((isActive: boolean) => void) | null = null;
  private onCompletionCallback: (() => void) | null = null;
  
  constructor() {
    this.speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
  
  /**
   * Initialize the session with meditation content
   */
  async initialize(mbtiType: string, focus: string, durationMinutes: number): Promise<void> {
    try {
      // Generate meditation content
      this.lines = await generateMeditationContent(mbtiType, focus, durationMinutes);
      
      // Calculate timing for each line
      this.timings = calculateLineTiming(this.lines, durationMinutes);
      
      this.currentLineIndex = -1;
      this.isActive = false;
      
      if (this.currentTimerId) {
        clearTimeout(this.currentTimerId);
        this.currentTimerId = null;
      }
      
      return;
    } catch (error) {
      console.error('Error initializing meditation session:', error);
      throw error;
    }
  }
  
  /**
   * Start the meditation session
   */
  start(): void {
    if (this.lines.length === 0) {
      console.error('No meditation content available to start session');
      return;
    }
    
    this.isActive = true;
    this.currentLineIndex = 0;
    
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(true);
    }
    
    if (this.onLineChangeCallback) {
      this.onLineChangeCallback(this.lines[0], 0);
    }
    
    // Start speaking the first line
    if (this.speechSupported) {
      this.speakCurrentLine(() => {
        this.scheduleNextLine();
      });
    } else {
      this.scheduleNextLine();
    }
  }
  
  /**
   * Pause the meditation session
   */
  pause(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    if (this.currentTimerId) {
      clearTimeout(this.currentTimerId);
      this.currentTimerId = null;
    }
    
    if (this.speechSupported) {
      toggleSpeechSynthesis(true);
    }
    
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(false);
    }
  }
  
  /**
   * Resume the meditation session
   */
  resume(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    
    if (this.speechSupported) {
      toggleSpeechSynthesis(false);
    }
    
    if (this.currentLineIndex < this.lines.length - 1) {
      this.scheduleNextLine();
    }
    
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(true);
    }
  }
  
  /**
   * Stop the meditation session
   */
  stop(): void {
    this.isActive = false;
    
    if (this.currentTimerId) {
      clearTimeout(this.currentTimerId);
      this.currentTimerId = null;
    }
    
    if (this.speechSupported) {
      stopSpeechSynthesis();
    }
    
    this.currentLineIndex = -1;
    
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(false);
    }
  }
  
  /**
   * Set voice to use for meditation
   */
  setVoice(voice: SpeechSynthesisVoice | null): void {
    this.selectedVoice = voice;
  }
  
  /**
   * Register callback for line changes
   */
  onLineChange(callback: (line: string, index: number) => void): void {
    this.onLineChangeCallback = callback;
  }
  
  /**
   * Register callback for active state changes
   */
  onStateChange(callback: (isActive: boolean) => void): void {
    this.onStateChangeCallback = callback;
  }
  
  /**
   * Register callback for session completion
   */
  onCompletion(callback: () => void): void {
    this.onCompletionCallback = callback;
  }
  
  /**
   * Get current meditation state
   */
  getState(): {
    lines: string[];
    currentLineIndex: number;
    isActive: boolean;
    progress: number;
  } {
    return {
      lines: this.lines,
      currentLineIndex: this.currentLineIndex,
      isActive: this.isActive,
      progress: this.lines.length > 0 
        ? Math.min(((this.currentLineIndex + 1) / this.lines.length), 1) 
        : 0
    };
  }
  
  private scheduleNextLine(): void {
    // Check if we've reached the end
    if (this.currentLineIndex >= this.lines.length - 1) {
      if (this.onCompletionCallback) {
        this.onCompletionCallback();
      }
      return;
    }
    
    // Move to the next line
    const nextIndex = this.currentLineIndex + 1;
    
    // Calculate timing based on speech support
    const timing = this.speechSupported ? 500 : this.timings[this.currentLineIndex];
    
    // Schedule the next line
    this.currentTimerId = setTimeout(() => {
      this.currentLineIndex = nextIndex;
      
      // Notify about line change
      if (this.onLineChangeCallback) {
        this.onLineChangeCallback(this.lines[nextIndex], nextIndex);
      }
      
      // Speak the new line
      if (this.speechSupported && this.isActive) {
        this.speakCurrentLine(() => {
          this.scheduleNextLine();
        });
      } else if (this.isActive) {
        this.scheduleNextLine();
      }
    }, timing);
  }
  
  private speakCurrentLine(onComplete?: () => void): void {
    if (!this.speechSupported || this.currentLineIndex < 0 || this.currentLineIndex >= this.lines.length) {
      if (onComplete) onComplete();
      return;
    }
    
    const line = this.lines[this.currentLineIndex];
    
    // Use the library function which already handles pause markers
    const utterance = speakMeditationLine(line, onComplete);
    
    // If an utterance was created (not a pause) and we have a selected voice, set it
    if (utterance && this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
  }
}

/**
 * Video background controller for managing meditation backgrounds
 */
export class VideoBackgroundController {
  private videos: MeditationVideo[] = [];
  private currentVideoIndex: number = -1;
  private videoTimer: NodeJS.Timeout | null = null;
  private durationTimer: NodeJS.Timeout | null = null;
  private onVideoChangeCallback: ((video: MeditationVideo) => void) | null = null;
  private onVideosLoadedCallback: ((videos: MeditationVideo[]) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  
  /**
   * Load videos for a specific theme
   */
  async loadVideosForTheme(theme: string, count: number = 5): Promise<MeditationVideo[]> {
    try {
      const videos = await getPexelsVideo(theme, count);
      
      if (videos.length > 0) {
        this.videos = videos;
        this.currentVideoIndex = 0;
        
        if (this.onVideosLoadedCallback) {
          this.onVideosLoadedCallback(videos);
        }
        
        if (this.onVideoChangeCallback) {
          this.onVideoChangeCallback(videos[0]);
        }
        
        // Setup rotation timer
        this.setupVideoRotation();
      }
      
      return videos;
    } catch (error) {
      console.error('Error loading videos for theme:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(`Failed to load videos for theme: ${theme}`);
      }
      return [];
    }
  }
  
  /**
   * Move to the next video in the rotation
   */
  moveToNextVideo(): void {
    if (this.videos.length <= 1) return;
    
    this.clearVideoTimer();
    
    // Get next index
    this.currentVideoIndex = getNextVideoIndex(this.currentVideoIndex, this.videos.length);
    
    // Notify about video change
    if (this.onVideoChangeCallback) {
      this.onVideoChangeCallback(this.videos[this.currentVideoIndex]);
    }
    
    // Reset rotation timer
    this.setupVideoRotation();
  }
  
  /**
   * Move to a specific video
   */
  setCurrentVideo(videoOrIndex: MeditationVideo | number): void {
    if (this.videos.length === 0) return;
    
    let newIndex: number;
    
    if (typeof videoOrIndex === 'number') {
      newIndex = Math.max(0, Math.min(this.videos.length - 1, videoOrIndex));
    } else {
      const foundIndex = this.videos.findIndex(v => v.id === videoOrIndex.id);
      if (foundIndex === -1) return;
      newIndex = foundIndex;
    }
    
    if (newIndex === this.currentVideoIndex) return;
    
    this.currentVideoIndex = newIndex;
    
    // Notify about video change
    if (this.onVideoChangeCallback) {
      this.onVideoChangeCallback(this.videos[newIndex]);
    }
    
    // Reset rotation timer
    this.clearVideoTimer();
    this.setupVideoRotation();
  }
  
  /**
   * Get the current video
   */
  getCurrentVideo(): MeditationVideo | null {
    if (this.videos.length === 0 || this.currentVideoIndex < 0) {
      return null;
    }
    return this.videos[this.currentVideoIndex];
  }
  
  /**
   * Get all loaded videos
   */
  getAllVideos(): MeditationVideo[] {
    return this.videos;
  }
  
  /**
   * Set up a timer to refresh videos after a meditation duration
   */
  setupDurationTimer(durationMinutes: number, theme: string): void {
    this.clearDurationTimer();
    
    if (durationMinutes <= 0) return;
    
    // Convert minutes to milliseconds
    const durationMs = durationMinutes * 60 * 1000;
    
    this.durationTimer = setTimeout(async () => {
      try {
        await this.loadVideosForTheme(theme);
      } catch (error) {
        console.error('Error refreshing videos after duration:', error);
      }
    }, durationMs);
  }
  
  /**
   * Clean up all timers
   */
  cleanup(): void {
    this.clearVideoTimer();
    this.clearDurationTimer();
  }
  
  /**
   * Register callback for video changes
   */
  onVideoChange(callback: (video: MeditationVideo) => void): void {
    this.onVideoChangeCallback = callback;
  }
  
  /**
   * Register callback for when videos are loaded
   */
  onVideosLoaded(callback: (videos: MeditationVideo[]) => void): void {
    this.onVideosLoadedCallback = callback;
  }
  
  /**
   * Register callback for errors
   */
  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }
  
  /**
   * Get the best source URL for a video
   */
  getBestVideoSource(video: MeditationVideo | null): string {
    if (!video || !video.video_files || video.video_files.length === 0) {
      return '';
    }
    
    // Try HD first, then SD, then any available source
    const hdSource = video.video_files.find(f => f.quality === 'hd');
    if (hdSource && hdSource.link) return hdSource.link;
    
    const sdSource = video.video_files.find(f => f.quality === 'sd');
    if (sdSource && sdSource.link) return sdSource.link;
    
    return video.video_files[0]?.link || '';
  }
  
  private setupVideoRotation(): void {
    this.clearVideoTimer();
    
    this.videoTimer = setTimeout(() => {
      this.moveToNextVideo();
    }, VIDEO_DURATION_MS);
  }
  
  private clearVideoTimer(): void {
    if (this.videoTimer) {
      clearTimeout(this.videoTimer);
      this.videoTimer = null;
    }
  }
  
  private clearDurationTimer(): void {
    if (this.durationTimer) {
      clearTimeout(this.durationTimer);
      this.durationTimer = null;
    }
  }
}

/**
 * Utility function to safely handle promises for video playback
 */
export const safePlayVideo = async (videoElement: HTMLVideoElement): Promise<void> => {
  if (!videoElement) return;
  
  try {
    // Try to play and handle the promise
    const promise = videoElement.play();
    
    // If the browser returns a promise (most modern browsers)
    if (promise !== undefined) {
      await promise;
    }
  } catch (error: unknown) {
    // Don't throw AbortError which is expected when switching videos
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error("Video playback error:", error);
      throw error;
    }
  }
};

/**
 * Process a user's natural language command into a search query
 */
export const processMeditationCommand = (command: string): string => {
  if (!command.trim()) return '';
  
  // Extract search query from commands like "show me ocean waves" -> "ocean waves"
  return command.toLowerCase().includes('watch') || command.toLowerCase().includes('see') ? 
    command.replace(/^(i want to |show me |let me see |i want to see |i want to watch |show |watch )/i, '') :
    command;
};
