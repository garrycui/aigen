import React from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ExpiredBannerProps {
  onUpgrade: () => void;
}

const ExpiredBanner: React.FC<ExpiredBannerProps> = ({ onUpgrade }) => {
  const { user } = useAuth();

  if (!user?.subscriptionEnd || new Date(user.subscriptionEnd) > new Date()) return null;

  return (
    <div className="bg-red-600">
      <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex-1 flex items-center">
            <span className="flex p-2">
              <Clock className="h-6 w-6 text-white" />
            </span>
            <p className="ml-3 font-medium text-white truncate">
              <span className="md:hidden">
                Your subscription expired
              </span>
              <span className="hidden md:inline">
                Your subscription expired. Upgrade now to keep access to all features!
              </span>
            </p>
          </div>
          <div className="order-3 mt-2 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
            <button
              onClick={onUpgrade}
              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-red-600 bg-white hover:bg-red-50"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpiredBanner;