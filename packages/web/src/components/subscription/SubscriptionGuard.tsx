import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import SubscriptionModal from './SubscriptionModal';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  // Use useMemo to calculate subscription status
  const subscriptionStatus = useMemo(() => {
    if (!user) return { hasNoAccess: false, isLoading: true };
    
    try {
      const isExpired = user.subscriptionStatus === 'expired';
      const now = new Date();
      const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
      const isTrialExpired = trialEndsAt ? now > trialEndsAt : false;
      const subscriptionEnd = user.subscriptionEnd ? new Date(user.subscriptionEnd) : null;
      const isSubscriptionEnded = subscriptionEnd ? now > subscriptionEnd : false;
      
      // Fixed logic - check trial expiration separately for users on trial
      const hasNoAccess = isExpired || isSubscriptionEnded || 
                         (user.isTrialing && isTrialExpired);
      
      return { hasNoAccess, isLoading: false };
    } catch (error) {
      console.error('Error checking subscription:', error);
      return { hasNoAccess: false, isLoading: false };
    }
  }, [user]);

  useEffect(() => {
    setIsSubscriptionExpired(subscriptionStatus.hasNoAccess ?? false);
    setIsLoading(subscriptionStatus.isLoading ?? false);
    
    if (subscriptionStatus.hasNoAccess) {
      setIsModalOpen(true);
    }
  }, [subscriptionStatus]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Immediately redirect to subscription page when modal is closed
    navigate('/subscription', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // If subscription is expired, show modal and prevent access to the protected content
  if (isSubscriptionExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <SubscriptionModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
          expiredSubscription={true}
        />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Required</h2>
          <p className="text-gray-600 mb-6">Your subscription has expired. Please renew to access this content.</p>
          <button 
            onClick={() => navigate('/subscription')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            View Subscription Options
          </button>
        </div>
      </div>
    );
  }

  // If subscription is active, render the children
  return <>{children}</>;
};

export default SubscriptionGuard;