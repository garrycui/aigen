import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { PLANS, createCheckoutSession } from '../../lib/payment/stripe';
import { useAuth } from '../../context/AuthContext';
import PrivacyPolicyModal from '../login/PrivacyPolicyModal';
import TermsModal from '../login/TermsModal';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  trialDaysLeft?: number;
  expiredSubscription?: boolean;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ 
  isOpen, 
  onClose, 
  trialDaysLeft,
  expiredSubscription = false
}) => {
  const { user } = useAuth();
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  if (!isOpen) return null;

  const handleSubscribe = async (priceId: string) => {
    if (!user) return;
    try {
      await createCheckoutSession(user.id, priceId);
    } catch (error) {
      console.error('Error creating checkout session:', error);
    }
  };

  const features = [
    'Personalized AI adaptation insights',
    'Access to all tutorials and guides',
    'Community forum participation',
    'AI chat assistant',
    'Progress tracking and analytics',
    'Exclusive webinars and resources',
    'Priority support',
    'Advanced AI tools integration',
    'Custom learning paths'
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        {/* Modal backdrop */}
        <div className="fixed inset-0 bg-black opacity-40" onClick={expiredSubscription ? undefined : onClose}></div>
        
        {/* Modal content */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto z-10">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              {expiredSubscription 
                ? "Your Subscription Has Expired" 
                : trialDaysLeft 
                  ? `${trialDaysLeft} Days Left in Your Trial` 
                  : "Choose Your Subscription Plan"}
            </h2>
            {!expiredSubscription && (
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            )}
          </div>
          
          {/* Modal body */}
          <div className="p-6">
            {expiredSubscription && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 font-medium">
                  Your subscription has expired. Please renew your subscription to continue accessing all features.
                </p>
              </div>
            )}
            
            {/* Plan options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Monthly Plan */}
              <div className="border rounded-lg p-6 hover:border-indigo-600 transition-colors">
                <h3 className="text-xl font-semibold mb-2">{PLANS.MONTHLY.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">${PLANS.MONTHLY.price}</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-2" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(PLANS.MONTHLY.id)}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start Monthly Plan
                </button>
              </div>

              {/* Annual Plan */}
              <div className="border-2 border-indigo-600 rounded-lg p-6 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm">
                    Best Value
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{PLANS.ANNUAL.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">${PLANS.ANNUAL.price}</span>
                  <span className="text-gray-600">/year</span>
                  <div className="text-green-600 text-sm font-medium">
                    Save {PLANS.ANNUAL.discount}
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-2" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(PLANS.ANNUAL.id)}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start Annual Plan
                </button>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              By subscribing, you agree to our{' '}
              <button 
                className="text-indigo-600 hover:underline" 
                onClick={() => setIsTermsOpen(true)}
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button 
                className="text-indigo-600 hover:underline" 
                onClick={() => setIsPrivacyOpen(true)}
              >
                Privacy Policy
              </button>
              . You can cancel your subscription at any time.
            </div>
          </div>
        </div>
      </div>
      
      {/* Terms and Privacy Policy Modals */}
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </div>
  );
};

export default SubscriptionModal;