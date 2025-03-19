import { useState, useRef, useEffect } from 'react';
import { 
  MeditationVideo, 
  VIDEO_DURATION_MS,
  getNextVideoIndex
} from '../../lib/mind/meditationspace';
import { getPexelsVideo } from '../../lib/common/pexels';
import { Send } from 'lucide-react';

interface MeditationBackgroundProps {
  backgroundTheme: string;
  isPlayingMusic: boolean;
  isSearchVisible: boolean;
  onBackgroundChange?: (videos: MeditationVideo[], currentVideo: MeditationVideo) => void;
  isMeditationActive?: boolean; // New prop to know when meditation is active
  meditationDuration?: number; // Duration in minutes
}

const MeditationBackground = ({ 
  backgroundTheme, 
  isPlayingMusic,
  isSearchVisible,
  onBackgroundChange,
  isMeditationActive = false,
  meditationDuration = 5
}: MeditationBackgroundProps) => {
  // Video and background state
  const [backgroundVideos, setBackgroundVideos] = useState<MeditationVideo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<MeditationVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  
  // User command state
  const [userCommand, setUserCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  // Video timer state
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoTimerId, setVideoTimerId] = useState<NodeJS.Timeout | null>(null);
  const [durationTimerId, setDurationTimerId] = useState<NodeJS.Timeout | null>(null);

  // State for video playback and error handling
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoadAttempts, setVideoLoadAttempts] = useState(0);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const isPlayingRef = useRef(false);
  const maxRetryAttempts = 3;

  // Create a stable reference to the callback
  const onBackgroundChangeRef = useRef(onBackgroundChange);
  
  // Update the ref when the callback changes
  useEffect(() => {
    onBackgroundChangeRef.current = onBackgroundChange;
  }, [onBackgroundChange]);

  // Helper function to get the best video source
  const getBestVideoSource = (video: MeditationVideo | null): string => {
    if (!video || !video.video_files || video.video_files.length === 0) {
      return '';
    }
    
    // Try HD first, then SD, then any available source
    const hdSource = video.video_files.find(f => f.quality === 'hd');
    if (hdSource && hdSource.link) return hdSource.link;
    
    const sdSource = video.video_files.find(f => f.quality === 'sd');
    if (sdSource && sdSource.link) return sdSource.link;
    
    return video.video_files[0]?.link || '';
  };

  // Fetch background videos from Pexels when theme changes
  useEffect(() => {
    if (!backgroundTheme) return;
    
    let isMounted = true;
    
    const fetchVideos = async () => {
      setIsLoading(true);
      try {
        const videos = await getPexelsVideo(backgroundTheme, 5);
        
        if (isMounted && videos.length > 0) {
          const firstVideo = videos[0];
          
          // Update state first
          setBackgroundVideos(videos);
          setCurrentVideo(firstVideo);
          
          // Then notify parent in a separate effect
          setTimeout(() => {
            if (isMounted && onBackgroundChangeRef.current) {
              onBackgroundChangeRef.current(videos, firstVideo);
            }
          }, 0);
        }
      } catch (error) {
        console.error('Error fetching background videos:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchVideos();
    
    return () => { isMounted = false; };
  }, [backgroundTheme]);

  // Video playback with proper promise handling
  const safePlayVideo = async () => {
    if (!videoRef.current || isPlayingRef.current) return;
    
    try {
      // Mark as attempting to play
      isPlayingRef.current = true;
      setIsVideoLoading(true);
      
      // Cancel any existing play promise
      if (playPromiseRef.current) {
        await playPromiseRef.current.catch(() => {});
        playPromiseRef.current = null;
      }
      
      // Small delay to ensure the browser is ready
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Try to play and store the promise
      const promise = videoRef.current.play();
      playPromiseRef.current = promise;
      
      // Wait for the play operation to complete
      if (promise !== undefined) {
        await promise;
      }
    } catch (error: unknown) {
      // Don't log AbortError which is expected when switching videos
      if (error instanceof Error) {
        if (error.name !== 'AbortError') {
          console.error("Video playback error:", error);
          setVideoError(`Playback error: ${error.message}`);
        }
      } else {
        console.error("Unknown video playback error:", error);
        setVideoError(`Playback error: Unknown error`);
      }
    } finally {
      playPromiseRef.current = null;
      isPlayingRef.current = false;
      setIsVideoLoading(false);
    }
  };

  // Handle video source changes with improved error handling
  useEffect(() => {
    if (!currentVideo) return;
    
    let isMounted = true;
    
    const prepareVideo = async () => {
      if (!videoRef.current) return;
      
      try {
        // Stop any current playback
        try {
          videoRef.current.pause();
          // Cancel any pending play promise
          if (playPromiseRef.current) {
            await playPromiseRef.current.catch(() => {});
            playPromiseRef.current = null;
          }
        } catch (e) {}
        
        // Reset video state
        videoRef.current.currentTime = 0;
        setVideoError(null);
        
        // Wait a moment before attempting playback
        await new Promise(resolve => setTimeout(resolve, 150));
        
        if (isMounted && videoRef.current) {
          safePlayVideo();
        }
      } catch (error) {
        console.error("Error preparing video:", error);
      }
    };
    
    prepareVideo();
    
    return () => { isMounted = false; };
  }, [currentVideo?.id]);

  // Process user commands for meditation space
  const processUserCommand = async (command: string) => {
    if (!command.trim()) return;
    
    setIsSearching(true);
    setCommandHistory(prev => [...prev, command]);
    
    try {
      // Parse user command to determine what they want to see
      const searchQuery = command.toLowerCase().includes('watch') || command.toLowerCase().includes('see') ? 
        command.replace(/^(i want to |show me |let me see |i want to see |i want to watch |show |watch )/i, '') :
        command;
      
      // Fetch videos from Pexels API
      const videos = await getPexelsVideo(searchQuery, 6);
      
      if (videos.length > 0) {
        setBackgroundVideos(videos);
        setCurrentVideo(videos[0]);
        
        // Notify parent outside of render cycle
        setTimeout(() => {
          if (onBackgroundChangeRef.current) {
            onBackgroundChangeRef.current(videos, videos[0]);
          }
        }, 0);
      } else {
        // Fall back to default searches if no results
        const fallbackTerms = ['nature', 'ocean', 'mountains', 'forest', 'clouds'];
        const randomTerm = fallbackTerms[Math.floor(Math.random() * fallbackTerms.length)];
        const fallbackVideos = await getPexelsVideo(randomTerm, 3);
        
        if (fallbackVideos.length > 0) {
          setBackgroundVideos(fallbackVideos);
          setCurrentVideo(fallbackVideos[0]);
          
          if (onBackgroundChangeRef.current) {
            onBackgroundChangeRef.current(fallbackVideos, fallbackVideos[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error processing meditation command:', error);
    } finally {
      setIsSearching(false);
      setUserCommand('');
    }
  };
  
  // Handle command submission
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processUserCommand(userCommand);
  };
  
  // Move to the next video
  const moveToNextVideo = () => {
    if (backgroundVideos.length > 1) {
      const currentIndex = backgroundVideos.findIndex(v => v.id === currentVideo?.id);
      const nextIndex = getNextVideoIndex(currentIndex, backgroundVideos.length);
      const nextVideo = backgroundVideos[nextIndex];
      
      setCurrentVideo(nextVideo);
      setVideoEnded(false);
      
      if (onBackgroundChangeRef.current) {
        onBackgroundChangeRef.current(backgroundVideos, nextVideo);
      }
      
      // Reset video timer when changing videos
      if (videoTimerId) {
        clearTimeout(videoTimerId);
      }
      
      // Set new timer for the next video
      const newTimerId = setTimeout(() => {
        moveToNextVideo();
      }, VIDEO_DURATION_MS);
      
      setVideoTimerId(newTimerId);
    }
  };

  // Set up video timer when current video changes
  useEffect(() => {
    if (!currentVideo) return;
    
    // Clear any existing timer
    if (videoTimerId) {
      clearTimeout(videoTimerId);
    }
    
    // Set a new timer for this video
    const newTimerId = setTimeout(() => {
      moveToNextVideo();
    }, VIDEO_DURATION_MS);
    
    setVideoTimerId(newTimerId);
    
    return () => {
      if (videoTimerId) {
        clearTimeout(videoTimerId);
      }
    };
  }, [currentVideo?.id]);

  // Change the current video manually
  const handleChangeVideo = (video: MeditationVideo) => {
    if (currentVideo?.id === video.id) return;
    
    setCurrentVideo(video);
    
    setTimeout(() => {
      if (onBackgroundChangeRef.current) {
        onBackgroundChangeRef.current(backgroundVideos, video);
      }
    }, 0);
  };

  // Improved video event handlers
  const handleVideoLoadedData = () => {
    setIsVideoLoading(false);
    setVideoError(null);
    setVideoLoadAttempts(0); // Reset retry counter
    
    // Make sure video is playing
    if (!isPlayingRef.current) {
      safePlayVideo();
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.currentTarget;
    const error = videoElement.error;
    
    console.error("Video loading error:", {
      code: error?.code || 'unknown',
      message: error?.message || 'Unknown error',
      videoId: currentVideo?.id,
      url: videoElement.src
    });
    
    setVideoError(`Error loading video: ${error?.message || 'Unknown error'}`);
    setIsVideoLoading(false);
    isPlayingRef.current = false;
    
    // Try another video if available
    if (videoLoadAttempts < maxRetryAttempts && backgroundVideos.length > 1) {
      setVideoLoadAttempts(prev => prev + 1);
      
      setTimeout(() => {
        const currentIndex = backgroundVideos.findIndex(v => v.id === currentVideo?.id);
        const nextIndex = (currentIndex + 1) % backgroundVideos.length;
        setCurrentVideo(backgroundVideos[nextIndex]);
      }, 500);
    }
  };

  // Set up meditation duration timer
  useEffect(() => {
    if (durationTimerId) {
      clearTimeout(durationTimerId);
      setDurationTimerId(null);
    }
    
    if (isMeditationActive && meditationDuration > 0) {
      
      // Convert minutes to milliseconds
      const durationMs = meditationDuration * 60 * 1000;
      
      const timerId = setTimeout(async () => {
        
        try {
          const newVideos = await getPexelsVideo(backgroundTheme, 5);
          
          if (newVideos.length > 0) {
            setBackgroundVideos(newVideos);
            setCurrentVideo(newVideos[0]);
            
            if (onBackgroundChangeRef.current) {
              setTimeout(() => {
                onBackgroundChangeRef.current?.(newVideos, newVideos[0]);
              }, 0);
            }
          }
        } catch (error) {
          console.error("Error refreshing background videos:", error);
        }
      }, durationMs);
      
      setDurationTimerId(timerId);
    }
    
    return () => {
      if (durationTimerId) {
        clearTimeout(durationTimerId);
      }
    };
  }, [isMeditationActive, meditationDuration, backgroundTheme]);

  // Clean up all timers
  useEffect(() => {
    return () => {
      if (videoTimerId) clearTimeout(videoTimerId);
      if (durationTimerId) clearTimeout(durationTimerId);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Background Video */}
      {currentVideo ? (
        <video
          ref={videoRef}
          src={getBestVideoSource(currentVideo)}
          poster={currentVideo.image}
          className="absolute inset-0 w-full h-full object-cover"
          loop={true}
          muted
          playsInline
          autoPlay
          onLoadedData={handleVideoLoadedData}
          onLoadStart={() => setIsVideoLoading(true)}
          onError={handleVideoError}
          onEnded={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              safePlayVideo();
            }
          }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center">
          <p className="text-white text-opacity-70">
            {isSearching ? 'Searching for your perfect space...' : 'Tell me what you want to see'}
          </p>
        </div>
      )}
      
      {/* Loading indicator */}
      {isVideoLoading && !videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Video error message */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="bg-black/70 p-4 rounded-lg max-w-md text-center">
            <p className="text-white mb-3">Having trouble with this video.</p>
            <button
              onClick={() => {
                setVideoError(null);
                const fallbackThemes = ['nature', 'ocean', 'forest', 'sunset'];
                const randomTheme = fallbackThemes[Math.floor(Math.random() * fallbackThemes.length)];
                processUserCommand(randomTheme);
              }}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded"
            >
              Try a different background
            </button>
          </div>
        </div>
      )}
      
      {/* Dark overlay to improve UI visibility */}
      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      
      {/* Search functionality */}
      {isSearchVisible && !isMeditationActive && (
        <div className="absolute inset-x-0 top-24 z-30 pointer-events-auto">
          {/* User Command Input */}
          <form onSubmit={handleCommandSubmit} className="mb-6 max-w-2xl mx-auto">
            <div className="flex bg-white/20 backdrop-blur-md rounded-lg p-1 focus-within:bg-white/30 transition-all">
              <input
                type="text"
                value={userCommand}
                onChange={(e) => setUserCommand(e.target.value)}
                placeholder="Describe what you want to see... (e.g., 'ocean waves' or 'forest canopy')"
                className="flex-grow px-4 py-2 bg-transparent border-none focus:outline-none text-white placeholder-white/70"
                disabled={isSearching}
              />
              <button
                type="submit"
                className="p-2 text-white hover:text-indigo-200 rounded-full hover:bg-white/10 transition-colors"
                disabled={isSearching || !userCommand.trim()}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
          
          {/* Recent searches */}
          {commandHistory.length > 0 && (
            <div className="mb-8 text-sm max-w-2xl mx-auto">
              <div className="flex flex-wrap gap-2 justify-center">
                {commandHistory.slice(-3).map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => processUserCommand(cmd)}
                    className="px-3 py-1.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 transition-colors"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Video selector thumbnails */}
      {backgroundVideos.length > 0 && isSearchVisible && !isMeditationActive && (
        <div className="absolute bottom-36 left-1/2 transform -translate-x-1/2 z-30 px-4 pointer-events-auto">
          <div className="flex overflow-x-auto space-x-3 snap-x pb-2">
            {backgroundVideos.map((video) => (
              <button
                key={video.id}
                onClick={() => handleChangeVideo(video)}
                className={`relative rounded-lg overflow-hidden snap-start flex-shrink-0 w-20 h-16 ${
                  currentVideo?.id === video.id ? 'ring-2 ring-white' : ''
                }`}
              >
                <img 
                  src={video.image} 
                  alt="Background option" 
                  className="w-full h-full object-cover"
                />
                {currentVideo?.id === video.id && (
                  <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeditationBackground;
