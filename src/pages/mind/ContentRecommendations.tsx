import { useState, useEffect, useCallback, useRef } from 'react';
import { Youtube, Globe, ThumbsUp, Eye, RefreshCw, AlertCircle, Send, Sliders } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getLatestAssessment } from '../../lib/assessment/assessment';
import { getMoodEntries, analyzeMoodEntries } from '../../lib/mind/mindTracker';
import { 
  saveContentFeedback, 
  trackContentView, 
  saveContentPreferences,
  getContentPreferences,
  getPersonalizedRecommendations,
  ContentPreferences,
  Video,
  Website
} from '../../lib/mind/recommendations';

const ContentRecommendations = () => {
  const { user } = useAuth();
  const [mbtiType, setMbtiType] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<{[key: string]: boolean}>({});
  
  // New state for personalization
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [contentType, setContentType] = useState<string>('');
  const [formalityLevel, setFormalityLevel] = useState<number>(3);
  const [specificRequest, setSpecificRequest] = useState<string>('');
  const [preferences, setPreferences] = useState<ContentPreferences | null>(null);
  
  // References to prevent unnecessary re-renders
  const lastFetchTime = useRef<number>(0);
  const cacheDuration = 5 * 60 * 1000; // 5 minutes

  // Memoized handler for content links
  const handleContentClick = useCallback(async (
    contentId: string,
    contentType: 'video' | 'website',
    contentTitle: string,
    contentUrl: string
  ) => {
    if (user) {
      try {
        await trackContentView(
          user.id,
          contentId,
          contentType,
          contentTitle,
          contentUrl
        );
      } catch (error) {
        console.error('Error tracking content view:', error);
      }
    }
  }, [user]);

  const loadRecommendations = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    
    const currentTime = Date.now();
    // Return cached results if not forced refresh and within cache duration
    if (!forceRefresh && currentTime - lastFetchTime.current < cacheDuration) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get user's MBTI type
      const { data: assessment } = await getLatestAssessment(user.id);
      const userMbtiType = assessment?.mbti_type || "INFJ"; // Default if not available
      setMbtiType(userMbtiType);
      
      // Get the user's recent mood data
      const moodEntries = await getMoodEntries(user.id, undefined, undefined);
      const recentMoods = moodEntries.slice(0, 5); // Use last 5 mood entries
      
      // Prepare mood data with better defaults
      let moodData = {
        rating: 5,
        mood: "neutral",
        tags: [] as string[]
      };
      
      if (recentMoods.length > 0) {
        const analysis = await analyzeMoodEntries(recentMoods);
        moodData = {
          rating: recentMoods[0].rating,
          mood: recentMoods[0].mood,
          tags: [...new Set(recentMoods.flatMap(entry => entry.tags))], // Unique tags
        };
      }
      
      // Get user preferences and feedback history
      const userPreferences = await getContentPreferences(user.id);
      
      // Set form values from saved preferences
      if (userPreferences) {
        setPreferences(userPreferences);
        setContentType(userPreferences.contentType || '');
        setFormalityLevel(userPreferences.formalityLevel || 3);
        setSpecificRequest(userPreferences.specificRequest || '');
      }
      
      // Prepare user preferences object with current or saved values
      const preferenceData = {
        contentType: contentType || userPreferences?.contentType || '',
        formalityLevel: formalityLevel || userPreferences?.formalityLevel || 3,
        specificRequest: specificRequest || userPreferences?.specificRequest || ''
      };
      
      // Get personalized recommendations
      const recommendations = await getPersonalizedRecommendations(
        user.id,
        userMbtiType,
        moodData,
        preferenceData,
        forceRefresh
      );
      
      setVideos(recommendations.videos);
      setWebsites(recommendations.websites);
      lastFetchTime.current = Date.now(); // Update last fetch time
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setError('Failed to load recommendations. Please try again later.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user, contentType, formalityLevel, specificRequest]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const handleRefresh = () => {
    setRefreshing(true);
    setFeedbackSubmitted({});
    loadRecommendations(true); // Force refresh
  };

  const handleFeedback = async (id: string, title: string, url: string, type: 'video' | 'website', isPositive: boolean) => {
    if (!user) return;
    
    try {
      // Save feedback to Firestore
      await saveContentFeedback(
        user.id,
        id,
        type,
        title,
        url,
        isPositive
      );
      
      // Mark feedback as submitted for this item
      setFeedbackSubmitted(prev => ({
        ...prev,
        [id]: true
      }));
      
      console.log(`User ${isPositive ? 'liked' : 'disliked'} ${type} content: "${title}"`);
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  };
  
  const savePreferences = async () => {
    if (!user) return;
    
    try {
      // Validate formality level is within range
      const validFormalityLevel = Math.max(1, Math.min(5, formalityLevel));
      
      await saveContentPreferences(user.id, {
        contentType,
        formalityLevel: validFormalityLevel,
        specificRequest,
        updatedAt: new Date()
      });
      
      // Close personalization menu
      setShowPersonalization(false);
      
      // Refresh recommendations with new preferences
      handleRefresh();
    } catch (error) {
      console.error('Error saving preferences:', error);
      setError('Failed to save preferences. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Personalized Joy Feed</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowPersonalization(!showPersonalization)}
            className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Sliders className="h-4 w-4 mr-1.5" />
            <span>Personalize</span>
          </button>
          <button 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Personalization Options */}
      {showPersonalization && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-3">Personalize Your Content</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="contentType" className="block text-sm font-medium text-gray-700 mb-1">
                Content Type
              </label>
              <select
                id="contentType"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">No preference</option>
                <option value="educational">Educational</option>
                <option value="entertainment">Entertainment</option>
                <option value="motivational">Motivational</option>
                <option value="relaxation">Relaxation</option>
                <option value="humor">Humor/Comedy</option>
                <option value="productivity">Productivity</option>
                <option value="creative">Creative</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content Formality Level: {formalityLevel}
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Casual</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formalityLevel}
                  onChange={(e) => setFormalityLevel(parseInt(e.target.value))}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">Formal</span>
              </div>
            </div>

            <div>
              <label htmlFor="specificRequest" className="block text-sm font-medium text-gray-700 mb-1">
                Specific Request (e.g., "jokes about technology", "cooking tips")
              </label>
              <div className="flex">
                <input
                  id="specificRequest"
                  type="text"
                  value={specificRequest}
                  onChange={(e) => setSpecificRequest(e.target.value)}
                  className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter specific content request..."
                />
                <button
                  onClick={savePreferences}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 focus:outline-none"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="flex items-center p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Videos Section */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Youtube className="h-6 w-6 text-red-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recommended Videos</h2>
        </div>
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleContentClick(video.id, 'video', video.title, video.url)}
                  className="block"
                >
                  <div className="relative">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = "https://placehold.co/600x400?text=Video";
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <div className="bg-red-600 text-white rounded-full p-3">
                        <Youtube className="h-8 w-8" />
                      </div>
                    </div>
                  </div>
                </a>
                <div className="p-4">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{video.title}</h3>
                  </a>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{video.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {video.views !== undefined && (
                        <div className="flex items-center">
                          <Eye className="h-4 w-4 mr-1" />
                          <span>{video.views.toLocaleString()}</span>
                        </div>
                      )}
                      {video.likes !== undefined && (
                        <div className="flex items-center">
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          <span>{video.likes.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    {!feedbackSubmitted[video.id] && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleFeedback(video.id, video.title, video.url, 'video', true)}
                          className="p-1 hover:bg-gray-100 rounded"
                          aria-label="Like this recommendation"
                        >
                          <ThumbsUp className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleFeedback(video.id, video.title, video.url, 'video', false)}
                          className="p-1 hover:bg-gray-100 rounded"
                          aria-label="Dislike this recommendation"
                        >
                          <ThumbsUp className="h-4 w-4 text-gray-500 transform rotate-180" />
                        </button>
                      </div>
                    )}
                    {feedbackSubmitted[video.id] && (
                      <span className="text-xs text-green-600">Thanks for your feedback</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No video recommendations available</p>
          </div>
        )}
      </div>

      {/* Websites Section */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Globe className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Recommended Websites</h2>
        </div>
        {websites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {websites.map((website) => (
              <div
                key={website.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <a
                  href={website.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleContentClick(website.id, 'website', website.title, website.url)}
                  className="block"
                >
                  <img
                    src={website.image}
                    alt={website.title}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = "https://placehold.co/600x400?text=Website";
                    }}
                  />
                </a>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <a
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <h3 className="font-medium text-gray-900 line-clamp-1">{website.title}</h3>
                    </a>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {website.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{website.description}</p>
                  {!feedbackSubmitted[website.id] && (
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleFeedback(website.id, website.title, website.url, 'website', true)}
                        className="p-1 hover:bg-gray-100 rounded"
                        aria-label="Like this recommendation"
                      >
                        <ThumbsUp className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleFeedback(website.id, website.title, website.url, 'website', false)}
                        className="p-1 hover:bg-gray-100 rounded"
                        aria-label="Dislike this recommendation"
                      >
                        <ThumbsUp className="h-4 w-4 text-gray-500 transform rotate-180" />
                      </button>
                    </div>
                  )}
                  {feedbackSubmitted[website.id] && (
                    <div className="flex justify-end">
                      <span className="text-xs text-green-600">Thanks for your feedback</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No website recommendations available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentRecommendations;