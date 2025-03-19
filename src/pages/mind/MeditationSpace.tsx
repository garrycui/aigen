import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLatestAssessment } from '../../lib/assessment/assessment';
import MeditationSession from '../../components/mind/MeditationSession';
import MeditationBackground from '../../components/mind/MeditationBackground';
import MusicPlayer from '../../components/mind/MusicPlayer';
import { MeditationVideo } from '../../lib/mind/meditationspace';

const MeditationSpace = () => {
  const { user } = useAuth();
  const [mbtiType, setMbtiType] = useState<string>('default');
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [mouseIdle, setMouseIdle] = useState(false);
  const [hideNavbar, setHideNavbar] = useState(false);
  const [isMeditationActive, setIsMeditationActive] = useState(false);
  
  // Shared state between components
  const [backgroundTheme, setBackgroundTheme] = useState("nature");
  const [currentBackgroundVideos, setCurrentBackgroundVideos] = useState<MeditationVideo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<MeditationVideo | null>(null);

  // Reference to the container for fullscreen
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse movement for UI visibility
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;

    const handleMouseMove = () => {
      setIsUiVisible(true);
      setMouseIdle(false);

      // Hide UI after 6 seconds of inactivity for more immersive experience
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setMouseIdle(true);
        setIsUiVisible(false);
      }, 6000);
    };

    // Show UI on mouse movement
    window.addEventListener('mousemove', handleMouseMove);
    // Initial idle timer
    idleTimer = setTimeout(() => {
      setMouseIdle(true);
      setIsUiVisible(false);
    }, 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(idleTimer);
    };
  }, []);

  // Load user MBTI type
  useEffect(() => {
    const loadUserMbti = async () => {
      if (!user) return;

      try {
        const { data: assessment } = await getLatestAssessment(user.id);
        const userMbtiType = assessment?.mbti_type || 'default';
        setMbtiType(userMbtiType);
      } catch (error) {
        console.error('Error loading user MBTI type:', error);
      }
    };

    loadUserMbti();
  }, [user]);

  // Handle music playback state changes
  const handleMusicPlayStateChange = (isPlaying: boolean) => {
    setIsMusicPlaying(isPlaying);
  };

  // Stable callback implementation for background changes
  const handleBackgroundChange = useCallback((videos: MeditationVideo[], current: MeditationVideo) => {
    
    // Batch updates to minimize rerenders
    setCurrentBackgroundVideos(videos);
    setCurrentVideo(current);
  }, []);

  // Handle theme changes from session component
  const handleThemeChange = (newTheme: string) => {
    setBackgroundTheme(newTheme);
  };

  // Handle meditation state changes
  const handleMeditationStateChange = useCallback((isActive: boolean) => {
    setIsMeditationActive(isActive);
  }, []);

  // Handle starting meditation session
  const handleStartMeditation = () => {
    if (!isMusicPlaying) {
      setIsMusicPlaying(true);
    }
    setHideNavbar(true);
    setIsMeditationActive(true); // Mark meditation as active
  };

  return (
    <div>
      {/* Main meditation content - with pointer-events layer configuration */}
      <div 
        ref={containerRef}
        className="h-[600px] relative rounded-lg overflow-hidden mb-6"
        style={{
          height: document.fullscreenElement === containerRef.current ? '100vh' : '600px'
        }}
      >
        {/* Background component - ensure it receives pointer events */}
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-auto">
          <MeditationBackground
            backgroundTheme={backgroundTheme}
            isPlayingMusic={isMusicPlaying}
            isSearchVisible={isUiVisible}
            onBackgroundChange={handleBackgroundChange}
            isMeditationActive={isMeditationActive}
            meditationDuration={5} // Default to 5 minutes, could be made dynamic
          />
        </div>
        
        {/* Session component - Use selective pointer-events */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <MeditationSession
            mbtiType={mbtiType}
            userId={user?.id}
            isPlayingMusic={isMusicPlaying}
            onStartMeditation={handleStartMeditation}
            isUiVisible={isUiVisible}
            showNavToggle={false}
            onNavToggle={() => {}}
            onThemeChange={handleThemeChange}
            backgroundVideos={currentBackgroundVideos}
            currentVideo={currentVideo}
            isMeditationActive={isMeditationActive}
            onMeditationStateChange={handleMeditationStateChange}
          />
        </div>
      </div>

      {/* Music player as before */}
      <div className={`bg-gray-50 p-4 rounded-lg shadow-sm transition-all duration-500 ${isMeditationActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Meditation Music</h3>
        <MusicPlayer 
          isCompact={true}
          onPlayStateChange={handleMusicPlayStateChange}
          initialPlayState={isMusicPlaying}
        />
      </div>

      {/* UI visibility hint - ensure proper z-index */}
      {document.fullscreenElement && !isUiVisible && (
        <div className="fixed top-0 left-0 right-0 text-center text-white/40 text-xs py-1 z-50 pointer-events-none bg-black/10">
          Move mouse to show controls
        </div>
      )}
    </div>
  );
};

export default MeditationSpace;