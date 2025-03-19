import { useState, useEffect } from 'react';
import { BookOpen, Target, Trophy, TrendingUp, ArrowRight, HelpCircle } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AIChat from '@components/chat/AIChat';
import DailyContent from '@components/dailyContent/DailyContent';
import ReviewModal from '@components/review/ReviewModal';
import TutorialCard from '@components/tutorial/TutorialCard';
import ProgressModal from '@components/dashboard/ProgressModal';
import BadgesModal from '@components/dashboard/BadgesModal';
import Loader from '@components/common/Loader';
import { useReviewPrompt } from '../../hooks/review/useReviewPrompt';
import { getRecommendedTutorials, Tutorial } from '@shared/lib/tutorial/tutorials';
import { getUserBadges, checkAndAwardBadges, Badge } from '@shared/lib/dashboard/badges';
import { useAuth } from '@context/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { getUser, updateUser, getLearningGoals, getUserMoodEntries, tutorialCache } from '@shared/lib/common/cache';
import { getLatestAssessment } from '@shared/lib/assessment/assessment';
import GrowthModal from '@components/mind/GrowthModal';
import { motion } from 'framer-motion';
import TourGuide from '@components/dashboard/TourGuide';

interface UserProgress {
  assessment: boolean;
  goals: {
    total: number;
    completed: number;
    set: number;
  };
  tutorials: {
    total: number;
    completed: number;
  };
  posts: {
    total: number;
    published: number;
  };
}

interface PsychRecord {
  id: string;
  rating: number;
  mood: string;
  notes: string;
  tags: string[];
  createdAt: any;
}

const Dashboard = () => {
  const { showReview, setShowReview, isPeriodic } = useReviewPrompt(); 
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState(false);
  const [isGrowthModalOpen, setIsGrowthModalOpen] = useState(false);
  const [showTourGuide, setShowTourGuide] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation(); // Add this to track when we navigate back to Dashboard
  
  const [recommendedTutorials, setRecommendedTutorials] = useState<Tutorial[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    assessment: false,
    goals: { total: 3, completed: 0, set: 0 },
    tutorials: { total: 10, completed: 0 },
    posts: { total: 5, published: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [completedTutorialIds, setCompletedTutorialIds] = useState<string[]>([]);
  const [psychRecords, setPsychRecords] = useState<PsychRecord[]>([]);
  const [latestRating, setLatestRating] = useState<number>(0);
  const [psychTrend, setPsychTrend] = useState<number>(0);

  const refreshBadges = async () => {
    if (!user) return;
    try {
      await checkAndAwardBadges(user.id);
      const userBadges = await getUserBadges(user.id);
      setBadges(userBadges);
    } catch (error) {
      console.error('Error refreshing badges:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Use cache service for user data
        const userData = await getUser(user.id);
        if (!userData) return;
        
        setCompletedTutorialIds(userData.completedTutorials || []);

        // Use cache service for learning goals instead of direct Firestore
        const goals = await getLearningGoals(user.id);
        const completedGoals = goals.filter((g: any) => g.status === 'completed').length;
        const totalGoalsSet = goals.length;

        const completedTutorials = userData.completedTutorials?.length || 0;
        const publishedPosts = userData.publishedPosts?.length || 0;

        const assessmentResult = await getLatestAssessment(user.id);

        setProgress({
          assessment: !!assessmentResult.data,
          goals: {
            total: 3,
            completed: completedGoals,
            set: totalGoalsSet
          },
          tutorials: {
            total: 10,
            completed: completedTutorials
          },
          posts: {
            total: 5,
            published: publishedPosts
          }
        });

        await checkAndAwardBadges(user.id);
        const userBadges = await getUserBadges(user.id);
        setBadges(userBadges);
        
        // Force tutorial recommendations to refresh by clearing their cache
        // This ensures that when coming back from the learning goals page, we see the latest recommendations
        if (location.state?.fromGoals) {
          const recommendedCacheKeys = tutorialCache.keys().filter((key: string) => 
            key.includes(`recommended-tutorials-${user.id}`)
          );
          recommendedCacheKeys.forEach((key: string) => tutorialCache.delete(key));
          console.log("Cleared recommendations cache after returning from goals page");
        }
        
        const recTutorials = await getRecommendedTutorials(user.id, completedTutorialIds, 3);
        setRecommendedTutorials(recTutorials);

        // Check if user has completed the tour before
        const hasCompletedTour = userData.hasCompletedTour || false;
        setTourCompleted(hasCompletedTour);

        // Only show tour guide if assessment is completed AND goals are not set AND tour hasn't been completed
        setShowTourGuide(!!assessmentResult.data && totalGoalsSet === 0 && !hasCompletedTour);

      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user, location.key]); // Add location.key as dependency to refresh when navigating

  const fetchPsychDataForDashboard = async (forceRefresh = false) => {
    if (!user) return;
    try {
      // Use cache service but force a refresh if needed
      const records = await getUserMoodEntries(user.id, forceRefresh) as PsychRecord[];
      setPsychRecords(records);
      
      if (records.length) {
        // Get the most recent entry (first in the array since they're ordered by descending date)
        setLatestRating(records[0].rating);
      }
      if (records.length > 1) {
        // Calculate trend between oldest and newest entries
        const oldest = records[records.length - 1].rating;
        const newest = records[0].rating;
        setPsychTrend(newest - oldest);
      }
    } catch (error) {
      console.error('Error fetching psychology data for dashboard:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPsychDataForDashboard();
    }
  }, [user]);

  const handleTutorialClick = (tutorialId: string) => {
    navigate(`/tutorials/${tutorialId}`);
  };

  useEffect(() => {
    if (showReview) {
      // Add a slight delay so it doesn't appear immediately on page load
      const timer = setTimeout(() => {
        setIsReviewModalOpen(true);
      }, 2000); // 2 seconds delay for better UX
      return () => clearTimeout(timer);
    }
  }, [showReview]);

  const handleCloseReviewModal = () => {
    setIsReviewModalOpen(false);
    setShowReview(false);
    
    // Track when a user dismisses without submitting
    if (user) {
      // Use updateUser instead of direct Firestore
      updateUser(user.id, {
        reviewDismissedAt: serverTimestamp()
      }).catch(err => console.error('Error updating dismissal time:', err));
    }
  };

  const handleTourComplete = () => {
    setShowTourGuide(false);
    setTourCompleted(true);
    // Record that the user has completed the tour
    if (user) {
      updateUser(user.id, {
        hasCompletedTour: true
      }).catch(err => console.error('Error updating tour completion:', err));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded-md w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded-md w-2/3"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-md animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gray-200 p-3 rounded-lg h-12 w-12"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-16 mb-1"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6 h-64 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6 mb-4"></div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="flex justify-between items-center mb-6">
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded-md"></div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6 h-96 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="flex justify-center items-center py-16">
                <Loader variant="neural" text="Loading AI Assistant" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-6 pl-8 relative">
                <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-200"></div>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="relative">
                    <div className="absolute left-0 -ml-6 h-4 w-4 rounded-full bg-gray-200"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6 mb-2 ml-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 ml-2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const completionRate = Math.round(
    ((progress.assessment ? 1 : 0) +
      (progress.goals.completed / Math.max(progress.goals.total, 1)) +
      (progress.tutorials.completed / Math.max(progress.tutorials.total, 1)) +
      (progress.posts.published / Math.max(progress.posts.total, 1))) /
      4 *
      100
  );

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 relative"
      >
        <h1 className="text-2xl font-bold text-gray-900">Your AI Adaptation Journey</h1>
        <p className="text-gray-600 mt-2">Track your progress and access personalized resources</p>
        
        {/* Tour guide restart button - only visible after tour completed */}
        {tourCompleted && !showTourGuide && (
          <button
            onClick={() => setShowTourGuide(true)}
            className="absolute top-0 right-0 text-gray-400 hover:text-indigo-600 flex items-center text-sm p-2 rounded-full hover:bg-indigo-50 transition-colors"
            aria-label="Restart tour guide"
            title="Take the tour again"
          >
            <HelpCircle className="h-5 w-5 mr-1" />
            <span className="hidden md:inline">Tour</span>
          </button>
        )}
      </motion.div>
      
      <TourGuide 
        isOpen={showTourGuide} 
        onComplete={handleTourComplete}
        onSkip={() => {
          setShowTourGuide(false);
          setTourCompleted(true);
          // Also mark as completed when skipped
          if (user) {
            updateUser(user.id, {
              hasCompletedTour: true
            }).catch(err => console.error('Error updating tour completion:', err));
          }
        }}
      />

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        <button
          onClick={() => setIsProgressModalOpen(true)}
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Target className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Progress</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{completionRate}%</h3>
          <p className="text-gray-600 text-sm">Completion rate</p>
        </button>

        <button
          onClick={async () => { await refreshBadges(); setIsBadgesModalOpen(true); }}
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Trophy className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Achievements</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{badges.length}</h3>
          <p className="text-gray-600 text-sm">Badges earned</p>
        </button>

        <Link
          to="/tutorials"
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Learning</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{progress.tutorials.completed}</h3>
          <p className="text-gray-600 text-sm">Tutorials completed</p>
        </Link>

        <button
          onClick={() => setIsGrowthModalOpen(true)}
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Mind Tracker</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {latestRating ? `Rating: ${latestRating}` : 'No Data'}
          </h3>
          {psychRecords.length > 1 && (
            <p className="text-gray-600 text-sm">
              Trend: {psychTrend > 0 ? `+${psychTrend}` : psychTrend}
            </p>
          )}
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="space-y-8"
        >
          <DailyContent />
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recommended Tutorials</h2>
              <Link 
                to="/tutorials" 
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </div>
            {recommendedTutorials.length === 0 ? (
              <p className="text-center text-gray-600">No recommended tutorials available</p>
            ) : (
              <div className="flex flex-col gap-4">
                {recommendedTutorials.map((tutorial) => (
                  <TutorialCard
                    key={tutorial.id}
                    tutorial={tutorial}
                    onClick={handleTutorialClick}
                    isCompleted={completedTutorialIds.includes(tutorial.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="space-y-8"
        >
          <AIChat />
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Learning Path</h2>
            <div className="relative">
              <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                <div className="relative flex items-center">
                  <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                    progress.assessment
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}></div>
                  <div className="ml-8">
                    <h3 className="font-medium text-gray-900">Complete Assessment</h3>
                    <p className="text-sm text-gray-500">
                      {progress.assessment ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                    progress.goals.set >= progress.goals.total
                      ? 'bg-green-500 border-green-500'
                      : progress.goals.set > 0
                      ? 'bg-yellow-500 border-yellow-500'
                      : 'bg-white border-gray-300'
                  }`}></div>
                  <div className="ml-8">
                    <Link to="/learning-goals" className="font-medium text-gray-900 hover:text-indigo-600">
                      Set Learning Goals
                    </Link>
                    <p className="text-sm text-gray-500">
                      {progress.goals.set === 0
                        ? 'Not Started'
                        : progress.goals.set >= progress.goals.total
                        ? 'Completed'
                        : `${progress.goals.set} of ${progress.goals.total} goals set`}
                    </p>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                    progress.tutorials.completed > 0
                      ? progress.tutorials.completed >= 5
                        ? 'bg-green-500 border-green-500'
                        : 'bg-yellow-500 border-yellow-500'
                      : 'bg-white border-gray-300'
                  }`}></div>
                  <div className="ml-8">
                    <h3 className="font-medium text-gray-900">Complete Tutorials</h3>
                    <p className="text-sm text-gray-500">
                      {progress.tutorials.completed === 0
                        ? 'Not Started'
                        : progress.tutorials.completed >= 5
                        ? 'Completed'
                        : 'In Progress'}
                    </p>
                  </div>
                </div>

                <div className="relative flex items-center">
                  <div className={`absolute left-4 -ml-2 h-4 w-4 rounded-full border-2 ${
                    progress.posts.published > 0
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}></div>
                  <div className="ml-8">
                    <h3 className="font-medium text-gray-900">Join Community Discussion</h3>
                    <p className="text-sm text-gray-500">
                      {progress.posts.published > 0 ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={handleCloseReviewModal}
        platform="web"
        isPeriodic={isPeriodic}
      />

      <ProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        progress={progress}
      />

      <BadgesModal
        isOpen={isBadgesModalOpen}
        onClose={() => setIsBadgesModalOpen(false)}
        badges={badges}
      />
      
      <GrowthModal
        isOpen={isGrowthModalOpen}
        onClose={() => setIsGrowthModalOpen(false)}
        onUpdate={() => fetchPsychDataForDashboard(true)}
      />
    </div>
  );
};

export default Dashboard;