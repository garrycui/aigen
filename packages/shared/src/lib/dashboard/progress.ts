import { where, increment } from 'firebase/firestore';
import { 
  getUser, updateUser, tutorialCache, invalidateUserCache,
  getUserSubcollection, getUserSubcollectionDoc, updateUserSubcollectionDoc,
  improvementCache, invalidateImprovementCache
} from '../common/cache'; // Import additional cache functions

// New interface for progress data
export interface UserProgress {
  assessment: boolean;
  goals: {
    total: number;
    completed: number;
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

// New function to calculate total progress
export const calculateTotalProgress = (progress: UserProgress): number => {
  return Math.round(
    ((progress.assessment ? 1 : 0) +
      (progress.goals.completed / Math.max(progress.goals.total, 1)) +
      (progress.tutorials.completed / Math.max(progress.tutorials.total, 1)) +
      (progress.posts.published / Math.max(progress.posts.total, 1))) /
      4 *
      100
  );
};

interface MonthlyProgress {
  month: string;
  completedTutorials: number;
  forumPosts: number;
  goalsProgress: number;
  totalImprovement: number;
}

export const calculateMonthlyImprovement = async (userId: string): Promise<number> => {
  const cacheKey = `monthly-improvement-${userId}`;
  
  return improvementCache.getOrSet(cacheKey, async () => {
    try {
      const userData = await getUser(userId); // Use getUser instead of direct Firestore
      if (!userData) return 0;

      // Get current and previous month's data
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM format
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
        .toISOString()
        .slice(0, 7);

      // Use the cache service to get monthly progress records
      const currentMonthProgress = await getUserSubcollection(
        userId, 
        'monthlyProgress',
        [where('month', '==', currentMonth)]
      );
      
      const lastMonthProgress = await getUserSubcollection(
        userId, 
        'monthlyProgress',
        [where('month', '==', lastMonth)]
      );

      const currentMonthData = currentMonthProgress[0] as MonthlyProgress;
      const lastMonthData = lastMonthProgress[0] as MonthlyProgress;

      if (!lastMonthData) return 0;

      // Calculate improvement percentage
      const improvement = ((currentMonthData?.totalImprovement || 0) - lastMonthData.totalImprovement) / 
                         lastMonthData.totalImprovement * 100;

      return Math.round(improvement);
    } catch (error) {
      console.error('Error calculating monthly improvement:', error);
      return 0;
    }
  });
};

export const updateUserProgress = async (userId: string, type: 'tutorial' | 'post' | 'goal') => {
  try {
    // Get current counts from user data
    const userData = await getUser(userId);
    if (!userData) return;
    
    // Prepare updates using userData
    const updates: any = {};
    if (type === 'tutorial') {
      const currentCount = userData.completedTutorialsCount || 0;
      updates.completedTutorialsCount = currentCount + 1;
    } else if (type === 'post') {
      const currentCount = userData.publishedPostsCount || 0;
      updates.publishedPostsCount = currentCount + 1;
    } else if (type === 'goal') {
      const currentCount = userData.completedGoalsCount || 0;
      updates.completedGoalsCount = currentCount + 1;
    }
    
    // Update user with new counts
    await updateUser(userId, updates);

    // The monthly progress subcollection needs to handle document creation
    const month = new Date().toISOString().slice(0, 7);
    
    // Use cache service instead of direct Firestore access
    const progressDoc = await getUserSubcollectionDoc(userId, 'monthlyProgress', month);
    
    if (!Object.keys(progressDoc).length || !progressDoc.id) {
      // Document doesn't exist - create it instead of updating
      await updateUserSubcollectionDoc(userId, 'monthlyProgress', month, {
        month,
        completedTutorials: type === 'tutorial' ? 1 : 0,
        forumPosts: type === 'post' ? 1 : 0,
        goalsProgress: type === 'goal' ? 1 : 0,
        totalImprovement: 1,
        updatedAt: new Date() // Use Date object, cache service will handle conversion
      });
    } else {
      // Document exists - update it
      const updates: any = {
        updatedAt: new Date(),
        totalImprovement: increment(1)
      };
      if (type === 'tutorial') updates.completedTutorials = increment(1);
      if (type === 'post') updates.forumPosts = increment(1);
      if (type === 'goal') updates.goalsProgress = increment(1);
      
      await updateUserSubcollectionDoc(userId, 'monthlyProgress', month, updates);
    }

    // After updating monthly progress document, invalidate the improvement cache
    invalidateImprovementCache(userId);
    
  } catch (error) {
    console.error('Error updating user progress:', error);
    throw error;
  }
};

export const markTutorialComplete = async (userId: string, tutorialId: string) => {
  try {
    // Get existing completedTutorials
    const userData = await getUser(userId);
    if (!userData) return;
    
    // Prepare the complete list including the new one
    const completedTutorials = [...(userData.completedTutorials || [])];
    if (!completedTutorials.includes(tutorialId)) {
      completedTutorials.push(tutorialId);
      
      // Update the user document
      await updateUser(userId, { completedTutorials });
      
      // Update progress
      await updateUserProgress(userId, 'tutorial');
      
      // Invalidate all relevant caches
      invalidateUserCache(userId); // This will clear all user-related caches
      
      // Clear recommended tutorials cache which is based on completed tutorials
      const recommendedCacheKeys = tutorialCache.keys().filter(key => 
        key.includes(`recommended-tutorials-${userId}`)
      );
      recommendedCacheKeys.forEach(key => tutorialCache.delete(key));
      
      // When a tutorial is completed, also invalidate improvement cache
      invalidateImprovementCache(userId);
      
      console.log('Cache invalidated for completed tutorial', tutorialId);
    }
  } catch (error) {
    console.error('Error marking tutorial complete:', error);
    throw error;
  }
};