import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Badge, BADGES } from '@shared/lib/dashboard/badges';

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  badges: Badge[];
}

const BadgesModal: React.FC<BadgesModalProps> = ({ isOpen, onClose, badges }) => {
  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Handle modal close with animation
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
      setIsExiting(false);
    }, 300); // Match transition duration
  };

  if (!isOpen) return null;

  const earnedBadgeIds = new Set(badges.map(b => b.id));
  const allBadges = Object.values(BADGES).map(badge => ({
    ...badge,
    earned: earnedBadgeIds.has(badge.id)
  }));

  const categories = {
    achievement: 'Achievement Badges',
    learning: 'Learning Badges',
    community: 'Community Badges',
    milestone: 'Milestone Badges'
  };

  // Group all badges by category
  const groupedBadges = allBadges.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = [];
    }
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, Array<typeof allBadges[0]>>);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div 
          className={`fixed inset-0 bg-black transition-opacity duration-300 ${
            isVisible && !isExiting ? 'opacity-50' : 'opacity-0'
          }`}
          onClick={handleClose} 
        />
        
        <div 
          className={`relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto transition-all duration-300 ${
            isVisible && !isExiting 
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 translate-y-4'
          }`}
        >
          <div className="absolute right-4 top-4">
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Badges</h2>
            
            <div className="space-y-6">
              {Object.entries(categories).map(([category, title]) => (
                <div key={category}>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">{title}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {groupedBadges[category]?.map((badge) => (
                      <div
                        key={badge.id}
                        className={`p-4 border rounded-lg transition-colors hover:border-indigo-500 relative overflow-hidden ${
                          badge.earned 
                            ? 'badge-earned border-indigo-300 shadow-md' 
                            : 'border-gray-300 opacity-50 grayscale'
                        }`}
                      >
                        {badge.earned && (
                          <div className="badge-shine absolute inset-0 pointer-events-none"></div>
                        )}
                        <div className="flex items-center space-x-3 relative z-10">
                          <span className={`text-2xl ${badge.earned ? 'badge-glow' : ''}`}>
                            {badge.icon}
                          </span>
                          <div>
                            <h4 className="font-medium text-gray-900">{badge.name}</h4>
                            <p className="text-sm text-gray-600">{badge.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!groupedBadges[category] || groupedBadges[category].length === 0) && (
                      <div className="col-span-full text-center py-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No badges available in this category</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add CSS for badge effects */}
            <style>
              {`
              @keyframes shine {
                0% { transform: translateX(-100%) rotate(-45deg); }
                100% { transform: translateX(100%) rotate(-45deg); }
              }
              
              @keyframes glow {
                0% { filter: drop-shadow(0 0 2px rgba(99, 102, 241, 0.4)); }
                50% { filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.7)); }
                100% { filter: drop-shadow(0 0 2px rgba(99, 102, 241, 0.4)); }
              }
              
              .badge-shine::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(
                  to right,
                  transparent, rgba(255, 255, 255, 0.3), transparent
                );
                transform: rotate(45deg);
                animation: shine 3s infinite;
              }
              
              .badge-earned {
                background: linear-gradient(to bottom right, #ffffff, #f0f8ff);
              }
              
              .badge-glow {
                animation: glow 2s infinite;
              }
              `}
            </style>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgesModal;