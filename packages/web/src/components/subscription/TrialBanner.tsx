import React from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '@context/AuthContext';

interface TrialBannerProps {
  onUpgrade: () => void;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ onUpgrade }) => {
  const { user } = useAuth();

  if (!user || !user.trialEndsAt || user?.isTrialing === false || user.subscriptionStatus === 'active') return null;

  const trialEndsAt = new Date(user.trialEndsAt);
  const now = new Date();
  const daysLeft = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) return null;

  return (
    <div className="bg-indigo-600">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex-1 flex items-center">
            <span className="flex p-2">
              <Clock className="h-6 w-6 text-white" />
            </span>
            <p className="ml-3 font-medium text-white truncate">
              <span className="md:hidden">
                {daysLeft} days left in trial
              </span>
              <span className="hidden md:inline">
                You have {daysLeft} days left in your free trial. Upgrade now to keep access to all features!
              </span>
            </p>
          </div>
          <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
            <button
              onClick={onUpgrade}
              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;