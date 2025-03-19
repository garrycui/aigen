import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music } from 'lucide-react';
import { formatTime } from '../../lib/mind/meditationspace';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  image: string;
  category: string;
}

interface MusicPlayerProps {
  isFullscreen?: boolean;
  isCompact?: boolean;
  onPlayStateChange?: (isPlaying: boolean) => void;
  initialPlayState?: boolean; // New prop to allow external control
}

const MusicPlayer = ({ 
  isFullscreen = false, 
  isCompact = false,
  onPlayStateChange, 
  initialPlayState 
}: MusicPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [tracks] = useState<Track[]>([
    {
      id: '1',
      title: 'Calm Waters',
      artist: 'Nature Sounds',
      duration: 300,
      url: 'https://example.com/meditation1.mp3', // Replace with actual URL
      image: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84',
      category: 'Nature'
    },
    {
      id: '2',
      title: 'Forest Rain',
      artist: 'Ambient Sounds',
      duration: 360,
      url: 'https://example.com/meditation2.mp3', // Replace with actual URL
      image: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131',
      category: 'Nature'
    },
    // Add more tracks
  ]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (initialPlayState !== undefined && initialPlayState !== isPlaying) {
      if (initialPlayState) {
        handlePlay();
      } else {
        handlePause();
      }
    }
  }, [initialPlayState]);

  const handlePlay = () => {
    if (!currentTrack) {
      setCurrentTrack(tracks[0]);
    }
    setIsPlaying(true);
    audioRef.current?.play();
    if (onPlayStateChange) onPlayStateChange(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
    audioRef.current?.pause();
    if (onPlayStateChange) onPlayStateChange(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const handleTrackEnd = () => {
    const currentIndex = tracks.findIndex(track => track.id === currentTrack?.id);
    if (currentIndex < tracks.length - 1) {
      setCurrentTrack(tracks[currentIndex + 1]);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setCurrentTrack(null);
      setCurrentTime(0);
      if (onPlayStateChange) onPlayStateChange(false);
    }
  };

  const handleNextTrack = () => {
    const currentIndex = tracks.findIndex(track => track.id === currentTrack?.id);
    if (currentIndex < tracks.length - 1) {
      setCurrentTrack(tracks[currentIndex + 1]);
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    }
  };

  const handlePreviousTrack = () => {
    const currentIndex = tracks.findIndex(track => track.id === currentTrack?.id);
    if (currentIndex > 0) {
      setCurrentTrack(tracks[currentIndex - 1]);
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    }
  };

  // If we're in fullscreen mode, only show minimal controls
  if (isFullscreen) {
    return (
      <div className="fixed bottom-4 right-4 z-20">
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="p-3 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-md text-white"
          title={isPlaying ? "Pause Music" : "Play Music"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        
        <audio
          ref={audioRef}
          src={currentTrack?.url}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleTrackEnd}
        />
      </div>
    );
  }

  // Compact mode for displaying below meditation
  if (isCompact) {
    return (
      <div className="flex items-center">
        <div className="flex-shrink-0 mr-4">
          {currentTrack ? (
            <img
              src={currentTrack.image}
              alt={currentTrack.title}
              className="w-16 h-16 object-cover rounded-md"
            />
          ) : (
            <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center">
              <Music className="h-8 w-8 text-gray-400" />
            </div>
          )}
        </div>
        
        <div className="flex-grow">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="font-medium text-gray-800">{currentTrack?.title || 'Select a track'}</p>
              <p className="text-xs text-gray-500">{currentTrack?.artist || 'Background music'}</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePreviousTrack}
                className="p-1 text-gray-600 hover:text-indigo-600"
                disabled={!currentTrack}
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={isPlaying ? handlePause : handlePlay}
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={handleNextTrack}
                className="p-1 text-gray-600 hover:text-indigo-600"
                disabled={!currentTrack}
              >
                <SkipForward className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1 text-gray-600 hover:text-indigo-600 ml-1"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          
          <div className="w-full">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-150"
                style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={currentTrack?.url}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleTrackEnd}
        />
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Current Track Display */}
      <div className="relative h-64 mb-6">
        {currentTrack ? (
          <img
            src={currentTrack.image}
            alt={currentTrack.title}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Select a track to begin</p>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <h3 className="text-white font-medium">{currentTrack?.title || 'No track selected'}</h3>
          <p className="text-gray-200 text-sm">{currentTrack?.artist}</p>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-150"
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            ></div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center space-x-6">
          <button
            onClick={handlePreviousTrack}
            className="p-2 text-gray-600 hover:text-indigo-600"
            disabled={!currentTrack}
          >
            <SkipBack className="h-6 w-6" />
          </button>
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className="p-4 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </button>
          <button
            onClick={handleNextTrack}
            className="p-2 text-gray-600 hover:text-indigo-600"
            disabled={!currentTrack}
          >
            <SkipForward className="h-6 w-6" />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 text-gray-600 hover:text-indigo-600"
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
      
      {/* Track List */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Available Tracks</h3>
        <div className="space-y-2">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => {
                setCurrentTrack(track);
                setIsPlaying(true);
                if (onPlayStateChange) onPlayStateChange(true);
              }}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                currentTrack?.id === track.id
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'hover:bg-gray-50'
              }`}
            >
              <img
                src={track.image}
                alt={track.title}
                className="w-12 h-12 rounded object-cover"
              />
              <div className="ml-3 text-left">
                <h4 className="font-medium text-gray-900">{track.title}</h4>
                <p className="text-sm text-gray-500">{track.artist}</p>
              </div>
              <span className="ml-auto text-sm text-gray-500">
                {formatTime(track.duration)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={currentTrack?.url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleTrackEnd}
      />
    </div>
  );
};

export default MusicPlayer;