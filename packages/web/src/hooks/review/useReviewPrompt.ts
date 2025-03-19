import { useState, useEffect } from 'react';
import { shouldShowReview, shouldShowPeriodicReview } from '@shared/lib/review/reviews';
import { useAuth } from '@context/AuthContext';

export const useReviewPrompt = () => {
  const [showReview, setShowReview] = useState(false);
  const [isPeriodic, setIsPeriodic] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const checkReviewStatus = async () => {
      // First check for periodic review
      const shouldShowPeriodic = await shouldShowPeriodicReview(user.id);
      
      if (shouldShowPeriodic) {
        setShowReview(true);
        setIsPeriodic(true);
        return;
      }
      
      // If not due for a periodic review, check for initial review
      const shouldShowInitial = await shouldShowReview(user.id);
      setShowReview(shouldShowInitial);
      setIsPeriodic(false);
    };

    checkReviewStatus();
  }, [user]);

  return { showReview, setShowReview, isPeriodic };
};