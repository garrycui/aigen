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

// Text-to-speech functionality
export class MeditationSpeech {
  private speech: SpeechSynthesisUtterance | null = null;
  private lines: string[] = [];
  private currentLineIndex = 0;
  private isPlaying = false;
  private onLineChangeCallback: ((line: string, index: number) => void) | null = null;
  private onCompletedCallback: (() => void) | null = null;
  
  constructor(voice?: SpeechSynthesisVoice) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speech = new SpeechSynthesisUtterance();
      this.speech.rate = 0.9; // Slightly slower than normal
      this.speech.pitch = 0.9; // Slightly deeper voice
      this.speech.volume = 1.0;
      
      // Set a calm voice if specified, otherwise use default
      if (voice) {
        this.speech.voice = voice;
      } else {
        // Try to find a soothing voice
        setTimeout(() => {
          const voices = window.speechSynthesis.getVoices();
          const preferredVoices = ['Samantha', 'Google UK English Female', 'Daniel', 'Google US English'];
          
          for (const preferredVoice of preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferredVoice));
            if (voice) {
              if (this.speech) this.speech.voice = voice;
              break;
            }
          }
        }, 100);
      }
      
      // Set up event handlers
      this.speech.onend = this.handleSpeechEnd.bind(this);
    }
  }
  
  /**
   * Set the text to be read
   */
  setText(text: string): void {
    this.lines = splitGuidanceIntoLines(text);
    this.currentLineIndex = 0;
  }
  
  /**
   * Set lines directly
   */
  setLines(lines: string[]): void {
    this.lines = lines;
    this.currentLineIndex = 0;
  }
  
  /**
   * Set callback for when line changes
   */
  onLineChange(callback: (line: string, index: number) => void): void {
    this.onLineChangeCallback = callback;
  }
  
  /**
   * Set callback for when all lines complete
   */
  onCompleted(callback: () => void): void {
    this.onCompletedCallback = callback;
  }
  
  /**
   * Start or resume speaking
   */
  start(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !this.speech) {
      console.error('Speech synthesis not supported');
      return;
    }
    
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    if (this.lines.length <= 0) return;
    
    this.speakCurrentLine();
  }
  
  /**
   * Pause speaking
   */
  pause(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isPlaying = false;
    }
  }
  
  /**
   * Stop speaking and reset
   */
  stop(): void {
    this.pause();
    this.currentLineIndex = 0;
  }
  
  /**
   * Handle when a speech segment ends
   */
  private handleSpeechEnd(): void {
    // If we have more lines, continue after a pause
    if (this.isPlaying && this.currentLineIndex < this.lines.length - 1) {
      this.currentLineIndex++;
      
      // Notify about line change
      if (this.onLineChangeCallback) {
        this.onLineChangeCallback(this.lines[this.currentLineIndex], this.currentLineIndex);
      }
      
      // Add a pause between lines for a more natural meditation flow
      setTimeout(() => {
        if (this.isPlaying) {
          this.speakCurrentLine();
        }
      }, SPEECH_PAUSE_DURATION);
    } else {
      // We've reached the end
      if (this.onCompletedCallback) {
        this.onCompletedCallback();
      }
    }
  }
  
  /**
   * Speak the current line with proper pause handling
   */
  private speakCurrentLine(): void {
    if (!this.speech || this.currentLineIndex >= this.lines.length) return;
    
    const currentLine = this.lines[this.currentLineIndex];
    
    // Special handling for pause markers
    if (currentLine === '[pause]') {
      // For pause markers, just wait and then move to the next line
      setTimeout(() => {
        this.handleSpeechEnd();
      }, SPEECH_PAUSE_DURATION * 2); // Double the normal pause for explicit markers
      
      return;
    }
    
    // Normal speech for regular lines
    this.speech.text = currentLine;
    
    // Notify about initial line if it's the first one
    if (this.currentLineIndex === 0 && this.onLineChangeCallback) {
      this.onLineChangeCallback(currentLine, 0);
    }
    
    window.speechSynthesis.speak(this.speech);
  }
  
  /**
   * Get available voices
   */
  static getVoices(): SpeechSynthesisVoice[] {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }
  
  /**
   * Check if speech synthesis is supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
}

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
 * Create a speech synthesis utterance with meditation-appropriate settings
 */
export const createMeditationUtterance = (text: string): SpeechSynthesisUtterance => {
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Try to find a calm, soothing voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoices = voices.filter(voice => 
    voice.name.includes('Female') || 
    voice.name.includes('Calm') || 
    voice.name.includes('Samantha') ||
    voice.name.includes('Moira') ||
    voice.name.includes('Karen')
  );
  
  if (preferredVoices.length > 0) {
    utterance.voice = preferredVoices[0];
  }
  
  // Slow down the speech rate for meditation
  utterance.rate = 0.8;
  utterance.pitch = 1.0;
  utterance.volume = 0.8;
  
  return utterance;
};

/**
 * Read meditation text using speech synthesis
 */
export const speakMeditationLine = (
  line: string, 
  onLineComplete?: () => void
): SpeechSynthesisUtterance | null => {
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
  
  const utterance = createMeditationUtterance(line);
  
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
  window.speechSynthesis.cancel();
};

/**
 * Initialize meditation speech synthesis interface
 */
export const initializeSpeechSynthesis = (): boolean => {
  // Ensure the browser supports speech synthesis
  if (!('speechSynthesis' in window)) {
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

// Add these new functions to improve speech quality

/**
 * Get premium quality voices from available options
 */
export const getPremiumVoices = (): SpeechSynthesisVoice[] => {
  if (!('speechSynthesis' in window)) return [];
  
  const allVoices = window.speechSynthesis.getVoices();
  
  // Filter for premium/neural/natural voices which typically sound better
  return allVoices.filter(voice => 
    voice.name.includes('Neural') ||
    voice.name.includes('Premium') ||
    voice.name.includes('Wavenet') ||
    voice.name.includes('Natural') ||
    // Include these specific high quality voices
    voice.name.includes('Samantha') ||
    voice.name.includes('Daniel') ||
    voice.name.includes('Moira') ||
    voice.name.includes('Karen')
  );
};

/**
 * Get the best available voice for meditation
 */
export const getBestMeditationVoice = (): SpeechSynthesisVoice | null => {
  const premiumVoices = getPremiumVoices();
  
  if (premiumVoices.length > 0) {
    // Prefer female voices for meditation, they tend to be more soothing
    const femaleVoices = premiumVoices.filter(voice => 
      voice.name.includes('Female') || 
      voice.name.includes('Samantha') || 
      voice.name.includes('Moira') || 
      voice.name.includes('Karen')
    );
    
    if (femaleVoices.length > 0) {
      return femaleVoices[0];
    }
    
    return premiumVoices[0];
  }
  
  // No premium voices available, fall back to any voice
  const allVoices = window.speechSynthesis.getVoices();
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
