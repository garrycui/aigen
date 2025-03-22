import { useState, useRef, useEffect } from 'react';
import { 
  MeditationVideo,
  VideoBackgroundController,
  safePlayVideo,
  processMeditationCommand
} from '@shared/lib/mind/meditationspace';
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

  // State for video playback and error handling
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoadAttempts, setVideoLoadAttempts] = useState(0);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const isPlayingRef = useRef(false);
  const maxRetryAttempts = 3;

  // Use video background controller
  const videoControllerRef = useRef<VideoBackgroundController>(new VideoBackgroundController());
  
  // Set up controller callbacks
  useEffect(() => {
    const controller = videoControllerRef.current;
    
    // Handle video changes
    controller.onVideoChange((video) => {
      setCurrentVideo(video);
    });
    
    // Handle loaded videos
    controller.onVideosLoaded((videos) => {
      setBackgroundVideos(videos);
      
      if (onBackgroundChange && videos.length > 0) {
        const currentVideo = controller.getCurrentVideo();
        if (currentVideo) {
          onBackgroundChange(videos, currentVideo);
        }
      }
    });
    
    // Handle errors
    controller.onError((errorMsg) => {
      setVideoError(errorMsg);
    });
    
    return () => {
      controller.cleanup();
    };
  }, [onBackgroundChange]);

  // Load videos when theme changes
  useEffect(() => {
    if (!backgroundTheme) return;
    
    setIsLoading(true);
    
    videoControllerRef.current.loadVideosForTheme(backgroundTheme, 5)
      .finally(() => {
        setIsLoading(false);
      });
  }, [backgroundTheme]);
  
  // Set up duration timer when meditation is active
  useEffect(() => {
    if (isMeditationActive && meditationDuration > 0) {
      videoControllerRef.current.setupDurationTimer(meditationDuration, backgroundTheme);
    }
  }, [isMeditationActive, meditationDuration, backgroundTheme]);

  // Video playback with proper promise handling
  const playVideo = async () => {
    if (!videoRef.current || isPlayingRef.current) return;
    
    try {
      isPlayingRef.current = true;
      setIsVideoLoading(true);
      
      await safePlayVideo(videoRef.current);
    } catch (error) {
      console.error("Video playback error:", error);
      setVideoError(`Playback error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isPlayingRef.current = false;
      setIsVideoLoading(false);
    }
  };

  // Handle video source changes
  useEffect(() => {
    if (!currentVideo || !videoRef.current) return;
    
    // Reset video state
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setVideoError(null);
    
    // Small delay before playing
    setTimeout(() => {
      playVideo();
    }, 150);
  }, [currentVideo?.id]);

  // Process user commands for meditation space
  const handleUserCommand = async (command: string) => {
    if (!command.trim()) return;
    
    setIsSearching(true);
    setCommandHistory(prev => [...prev, command]);
    
    try {
      // Parse command using shared helper
      const searchQuery = processMeditationCommand(command);
      
      // Load videos for the search query
      await videoControllerRef.current.loadVideosForTheme(searchQuery, 6);
    } catch (error) {
      console.error('Error processing meditation command:', error);
      
      // Try a fallback theme
      const fallbackTerms = ['nature', 'ocean', 'mountains', 'forest', 'clouds'];
      const randomTerm = fallbackTerms[Math.floor(Math.random() * fallbackTerms.length)];
      
      await videoControllerRef.current.loadVideosForTheme(randomTerm, 3);
    } finally {
      setIsSearching(false);
      setUserCommand('');
    }
  };
  
  // Handle command submission
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUserCommand(userCommand);
  };
  
  // Handle video click to change current video
  const handleChangeVideo = (video: MeditationVideo) => {
    videoControllerRef.current.setCurrentVideo(video);
  };

  // Video event handlers
  const handleVideoLoadedData = () => {
    setIsVideoLoading(false);
    setVideoError(null);
    setVideoLoadAttempts(0); // Reset retry counter
    
    // Make sure video is playing
    if (!isPlayingRef.current) {
      playVideo();
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
        videoControllerRef.current.moveToNextVideo();
      }, 500);
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Background Video */}
      {currentVideo ? (
        <video
          ref={videoRef}
          src={currentVideo.video_files[0]?.link || ''}
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
              playVideo();
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
                handleUserCommand(fallbackThemes[Math.floor(Math.random() * fallbackThemes.length)]);
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
                    onClick={() => handleUserCommand(cmd)}
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
