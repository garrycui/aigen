import { db } from '../common/firebase';
import { doc, arrayUnion, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { getLatestAssessment } from '../assessment/assessment';
import { 
  getUser, 
  updateUserField, 
  getLearningGoals, 
  userCache, 
  getUserCacheKey,
  updateCachedUser 
} from '../common/cache';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'achievement' | 'learning' | 'community' | 'milestone';
  createdAt: Date;
}

export const BADGES = {
  ASSESSMENT_COMPLETE: {
    id: 'assessment_complete',
    name: 'Self-Aware',
    description: 'Completed the AI adaptation assessment',
    icon: '🎯',
    category: 'achievement'
  },
  FIRST_GOAL: {
    id: 'first_goal',
    name: 'Goal Setter',
    description: 'Set your first learning goal',
    icon: '🎯',
    category: 'achievement'
  },
  GOAL_MASTER: {
    id: 'goal_master',
    name: 'Goal Master',
    description: 'Completed all three learning goals',
    icon: '🏆',
    category: 'achievement'
  },
  FIRST_POST: {
    id: 'first_post',
    name: 'Community Voice',
    description: 'Published your first forum post',
    icon: '📝',
    category: 'community'
  },
  TUTORIAL_COMPLETE: {
    id: 'tutorial_complete',
    name: 'Quick Learner',
    description: 'Completed your first tutorial',
    icon: '📚',
    category: 'learning'
  },
  TUTORIAL_MASTER: {
    id: 'tutorial_master',
    name: 'Tutorial Master',
    description: 'Completed 10 tutorials',
    icon: '🎓',
    category: 'learning'
  },
  ENGAGEMENT_STAR: {
    id: 'engagement_star',
    name: 'Engagement Star',
    description: 'Received 50 likes on your posts and comments',
    icon: '⭐',
    category: 'community'
  },
  MILESTONE_30_DAYS: {
    id: 'milestone_30_days',
    name: '30 Days of Growth',
    description: 'Actively learning for 30 days',
    icon: '📅',
    category: 'milestone'
  }
};

// New helper to retrieve badge by its id
const getBadgeById = (badgeId: string) => {
  return Object.values(BADGES).find(badge => badge.id === badgeId);
};

export const awardBadge = async (userId: string, badgeId: string) => {
  try {
    const userData = await getUser(userId);
    
    if (!userData) return;
    
    const badges = userData.badges || [];
    if (badges.includes(badgeId)) return;
    
    // Use updateUserField instead of direct Firestore update
    await updateUserField(userId, 'badges', arrayUnion(badgeId));
    
    return getBadgeById(badgeId);
  } catch (error) {
    console.error('Error awarding badge:', error);
    throw error;
  }
};

// New function to award multiple badges at once using batch operations
export const awardMultipleBadges = async (userId: string, badgeIds: string[]) => {
  if (!userId || !badgeIds.length) return [];
  
  try {
    const userData = await getUser(userId);
    if (!userData) return [];
    
    const existingBadges = userData.badges || [];
    
    // Filter out badges the user already has
    const newBadgeIds = badgeIds.filter(id => !existingBadges.includes(id));
    
    if (!newBadgeIds.length) return [];
    
    // Use batch write for awarding multiple badges
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', userId);
    
    batch.update(userRef, {
      badges: arrayUnion(...newBadgeIds),
      updatedAt: new Date()
    });
    
    await batch.commit();
    
    // Update the cache manually to avoid another Firestore read
    const updatedBadges = [...existingBadges, ...newBadgeIds];
    // Fix the manual cache update
    if (userData) {
      const updatedUserData = {
        ...userData,
        badges: updatedBadges,
        updatedAt: new Date()
      };
      userCache.set(getUserCacheKey(userId), updatedUserData);
    }
    
    return newBadgeIds.map(id => getBadgeById(id)).filter(Boolean);
  } catch (error) {
    console.error('Error awarding multiple badges:', error);
    throw error;
  }
};

export const getUserBadges = async (userId: string) => {
  try {
    const userData = await getUser(userId);
    
    if (!userData) return [];
    
    const badgeIds = userData.badges || [];
    return badgeIds.map((id: string) => getBadgeById(id)).filter(Boolean);
  } catch (error) {
    console.error('Error getting user badges:', error);
    throw error;
  }
};

export const checkAndAwardBadges = async (userId: string) => {
  try {
    const userData = await getUser(userId);
    if (!userData) return;
    
    // Use getLearningGoals instead of direct Firestore access
    const goals = await getLearningGoals(userId);
    
    // Use userData directly
    let hasAssessment = userData.hasCompletedAssessment;
    if (!hasAssessment) {
      const assessmentResult = await getLatestAssessment(userId);
      hasAssessment = !!assessmentResult.data;
      
      // If assessment was found but not in user data, update cache
      if (hasAssessment && !userData.hasCompletedAssessment) {
        updateCachedUser(userId, (user) => ({
          ...user,
          hasCompletedAssessment: true
        }));
      }
    }
    
    const newBadges: string[] = [];
    
    // Quick check for existing badges to avoid unnecessary processing
    const existingBadges = userData.badges || [];
    
    // Updated condition for Self-Aware badge using progress.assessment logic
    if (hasAssessment && !existingBadges.includes(BADGES.ASSESSMENT_COMPLETE.id)) {
      newBadges.push(BADGES.ASSESSMENT_COMPLETE.id);
    }
    
    // Existing conditions
    if (goals.length > 0 && !existingBadges.includes(BADGES.FIRST_GOAL.id)) {
      newBadges.push(BADGES.FIRST_GOAL.id);
    }
    if (goals.length > 0 && goals.every((goal: any) => goal.status === 'completed') && 
        !existingBadges.includes(BADGES.GOAL_MASTER.id)) {
      newBadges.push(BADGES.GOAL_MASTER.id);
    }
    
    if ((userData.completedTutorials?.length > 0) && !existingBadges.includes(BADGES.TUTORIAL_COMPLETE.id)) {
      newBadges.push(BADGES.TUTORIAL_COMPLETE.id);
    }
    if ((userData.completedTutorials?.length >= 10) && !existingBadges.includes(BADGES.TUTORIAL_MASTER.id)) {
      newBadges.push(BADGES.TUTORIAL_MASTER.id);
    }
    
    // Award FIRST_POST if the user has published posts
    if ((userData.publishedPosts?.length > 0) && !existingBadges.includes(BADGES.FIRST_POST.id)) {
      newBadges.push(BADGES.FIRST_POST.id);
    }

    // Replace multiple Firestore reads with a single batch read for engagement star badge
    if ((userData.publishedPosts?.length > 0) && !existingBadges.includes(BADGES.ENGAGEMENT_STAR.id)) {
      // Optimize: Get all posts in a single query instead of individual requests
      const postsRef = collection(db, 'posts');
      const userPostsQuery = query(postsRef, where('userId', '==', userId));
      const postsSnapshot = await getDocs(userPostsQuery);
      
      let totalLikes = 0;
      postsSnapshot.forEach(doc => {
        const postData = doc.data();
        if (typeof postData.likes_count === 'number') {
          totalLikes += postData.likes_count;
        }
      });
      
      if (totalLikes >= 50) {
        newBadges.push(BADGES.ENGAGEMENT_STAR.id);
      }
    }

    // Award MILESTONE_30_DAYS if the account is older than or equal to 30 days
    if (userData.createdAt && !existingBadges.includes(BADGES.MILESTONE_30_DAYS.id)) {
      const createdAt = new Date(userData.createdAt);
      const now = new Date();
      const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 30) {
        newBadges.push(BADGES.MILESTONE_30_DAYS.id);
      }
    }
    
    // Award new badges using the batch operation
    if (newBadges.length > 0) {
      await awardMultipleBadges(userId, newBadges);
    }
    
    return newBadges.map((id: string) => getBadgeById(id)).filter(Boolean);
  } catch (error) {
    console.error('Error checking badges:', error);
    throw error;
  }
};