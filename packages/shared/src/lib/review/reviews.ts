import { db } from '../common/firebase';
import { doc, setDoc, serverTimestamp} from 'firebase/firestore';
import { 
  getUser, 
  updateUser, 
  getUserSubcollectionDoc, 
  updateUserSubcollectionDoc 
} from '../common/cache';

interface ReviewData {
  rating: number;
  usabilityRating?: number;
  contentRating?: number;
  mostValuedFeature?: string;
  biggestChallenge?: string;
  generalFeedback?: string;
  featureSuggestion?: string;
  platform?: 'ios' | 'android' | 'web';
  createdAt: Date;
}

export const shouldShowReview = async (userId: string, forceShow: boolean = false): Promise<boolean> => {
  // If testing mode is enabled, bypass all checks
  if (forceShow) return true;
  
  try {
    const userData = await getUser(userId);
    if (!userData) return false;

    // Check if user has already reviewed
    if (userData.hasReviewed) return false;

    // Check if user has dismissed the review recently (within 7 days)
    if (userData.reviewDismissedAt) {
      const dismissedAt = userData.reviewDismissedAt instanceof Date 
        ? userData.reviewDismissedAt 
        : userData.reviewDismissedAt.toDate?.();
      
      if (!dismissedAt) return false;
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      if (dismissedAt > sevenDaysAgo) {
        return false; // Don't show if dismissed within last 7 days
      }
    }

    // Check if user has been active for at least 3 days
    // Handle both Date objects and Firestore timestamps
    let createdAt = null;
    if (userData.createdAt) {
      createdAt = userData.createdAt instanceof Date 
        ? userData.createdAt 
        : userData.createdAt.toDate?.();
    }
    
    if (!createdAt) return false;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Basic time-based condition
    const isOldEnough = createdAt < threeDaysAgo;
    
    // Additional engagement-based condition - tutorials
    const hasCompletedTutorials = (userData.completedTutorials?.length || 0) >= 2;
    
    // Only check account age and tutorial completion for now
    return isOldEnough && hasCompletedTutorials;
  } catch (error) {
    console.error('Error checking review status:', error);
    return false;
  }
};

export const shouldShowPeriodicReview = async (userId: string): Promise<boolean> => {
  try {
    const userData = await getUser(userId);
    if (!userData) return false;

    // User must have completed at least one review already
    if (!userData.hasReviewed || !userData.lastReviewedAt) return false;

    // Handle both Date objects and Firestore timestamps
    const lastReviewDate = userData.lastReviewedAt instanceof Date 
      ? userData.lastReviewedAt 
      : userData.lastReviewedAt.toDate?.();
    
    if (!lastReviewDate) return false;
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 1);

    // Check if it's been at least 1 month since the last review
    return lastReviewDate < threeMonthsAgo;
  } catch (error) {
    console.error('Error checking periodic review status:', error);
    return false;
  }
};

export const saveReview = async (userId: string, data: Omit<ReviewData, 'createdAt'>, isPeriodic = false) => {
  try {
    if (isPeriodic) {
      // For periodic reviews, store them in user subcollection using cache service
      const reviewData = {
        ...data,
        createdAt: new Date()
      };
      
      // Use a timestamp-based document ID for the review history
      const timestamp = new Date().getTime();
      const docId = `review_${timestamp}`;
      
      await updateUserSubcollectionDoc(userId, 'reviewHistory', docId, reviewData);
    } else {
      // For first-time reviews, use the separate reviews collection
      const reviewRef = doc(db, 'reviews', userId);
      await setDoc(reviewRef, {
        ...data,
        createdAt: serverTimestamp()
      });
    }

    // Update user document using user service
    await updateUser(userId, {
      hasReviewed: true,
      lastReviewedAt: new Date() // Use JS Date instead of serverTimestamp
    });

    return true;
  } catch (error) {
    console.error('Error saving review:', error);
    throw error;
  }
};

export const getReviewHistory = async (userId: string) => {
  try {
    // Use the cache service to get the user's review history
    const reviewHistory = await getUserSubcollectionDoc(userId, 'reviewHistory', 'reviews');
    return reviewHistory || [];
  } catch (error) {
    console.error('Error getting review history:', error);
    return [];
  }
};

export const dismissReview = async (userId: string): Promise<boolean> => {
  try {
    // Update user document with dismissal timestamp
    await updateUser(userId, {
      reviewDismissedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error dismissing review:', error);
    return false;
  }
};

export const getStoreReviewUrl = (platform: 'ios' | 'android'): string => {
  return platform === 'ios'
    ? 'https://apps.apple.com/app/id[YOUR_APP_ID]?action=write-review'
    : 'https://play.google.com/store/apps/details?id=[YOUR_APP_ID]';
};