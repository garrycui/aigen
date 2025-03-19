import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  CreditCard, Clock, Shield, CheckCircle, AlertTriangle, 
  CreditCard as BillingIcon, Settings, ArrowRight 
} from 'lucide-react';
import { 
  PLANS, 
  createCheckoutSession, 
  cancelSubscription, 
  resumeSubscription,
  getBillingPortalUrl 
} from '../../lib/payment/stripe';
import PrivacyPolicyModal from '../../components/login/PrivacyPolicyModal';
import TermsModal from '../../components/login/TermsModal';

const UserSubscription = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<{
    status: string;
    plan: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
  } | null>(null);

  // Add validation and safeguards for subscription data
  useEffect(() => {
    if (user) {
      try {
        const currentPeriodEnd = user.subscriptionEnd instanceof Date 
          ? user.subscriptionEnd 
          : null;
        
        setSubscriptionData({
          status: user.subscriptionStatus || 'inactive',
          plan: user.subscriptionPlan || '',
          currentPeriodEnd,
          cancelAtPeriodEnd: !!user.cancelAtPeriodEnd,
          stripeSubscriptionId: user.stripeSubscriptionId || null
        });
      } catch (error) {
        console.error('Error processing subscription data:', error);
        // Use fallback data
        setSubscriptionData({
          status: 'inactive',
          plan: '',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: null
        });
        setError('There was an issue loading your subscription data');
      } finally {
        setIsLoading(false);
      }
    }
  }, [user]);

  const handleUpgrade = async (priceId: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await createCheckoutSession(user.id, priceId);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError('Failed to start upgrade process');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !subscriptionData?.stripeSubscriptionId) return;
    try {
      setIsProcessing(true);
      await cancelSubscription(user.id);
      setSubscriptionData(prev => prev ? {
        ...prev,
        cancelAtPeriodEnd: true
      } : null);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setError('Failed to cancel subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResume = async () => {
    if (!user || !subscriptionData?.stripeSubscriptionId) return;
    try {
      setIsProcessing(true);
      await resumeSubscription(user.id);
      setSubscriptionData(prev => prev ? {
        ...prev,
        cancelAtPeriodEnd: false
      } : null);
    } catch (error) {
      console.error('Error resuming subscription:', error);
      setError('Failed to resume subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBillingPortal = async () => {
    if (!user) return;
    try {
      setIsProcessing(true);
      const url = await getBillingPortalUrl(user.id);
      window.location.href = url;
    } catch (error) {
      console.error('Error accessing billing portal:', error);
      setError('Failed to access billing portal');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="bg-indigo-100 p-3 rounded-full">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
              <p className="text-gray-600">Manage your subscription and billing</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Current Subscription Status */}
          <div className="mb-8 p-6 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Current Plan</h2>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-gray-900">
                  {subscriptionData?.plan ? `${subscriptionData.plan.charAt(0).toUpperCase() + subscriptionData.plan.slice(1)} Plan` : 'Free Trial'}
                </p>
                <p className="text-sm text-gray-600">
                  {subscriptionData?.currentPeriodEnd && subscriptionData?.cancelAtPeriodEnd === false
                    ? `Next billing date: ${subscriptionData.currentPeriodEnd.toLocaleDateString()}`
                    : 'No active subscription'}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                subscriptionData?.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {subscriptionData?.status === 'active' ? 'Active' : 'Inactive'}
              </div>
            </div>

            {/* Subscription Actions */}
            {subscriptionData?.stripeSubscriptionId && (
              <div className="space-y-4">
                {subscriptionData.cancelAtPeriodEnd ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" />
                      <div>
                        <p className="text-yellow-800 font-medium">Subscription Scheduled to Cancel</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          Your subscription will end on {subscriptionData.currentPeriodEnd?.toLocaleDateString()}.
                          You can resume your subscription to continue uninterrupted access.
                        </p>
                        <button
                          onClick={handleResume}
                          disabled={isProcessing}
                          className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                        >
                          {isProcessing ? 'Processing...' : 'Resume Subscription'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={handleBillingPortal}
                      className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <BillingIcon className="h-5 w-5 mr-2" />
                      Manage Billing
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel Subscription
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Available Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Plan */}
            <div className="border rounded-lg p-6 hover:border-indigo-600 transition-colors">
              <h3 className="text-xl font-semibold mb-2">{PLANS.MONTHLY.name}</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">${PLANS.MONTHLY.price}</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Full access to all features</span>
                </li>
                <li className="flex items-center">
                  <Clock className="h-5 w-5 text-green-500 mr-2" />
                  <span>Cancel anytime</span>
                </li>
                <li className="flex items-center">
                  <Shield className="h-5 w-5 text-green-500 mr-2" />
                  <span>Priority support</span>
                </li>
              </ul>
              <button
                onClick={() => handleUpgrade(PLANS.MONTHLY.id)}
                disabled={isProcessing || subscriptionData?.plan === 'monthly'}
                className={`w-full bg-indigo-600 text-white py-2 px-4 rounded-lg transition-colors ${
                  isProcessing || subscriptionData?.plan === 'monthly'
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-indigo-700'
                }`}
              >
                {isProcessing ? 'Processing...' : 
                 subscriptionData?.plan === 'monthly' ? 'Current Plan' : 
                 'Switch to Monthly'}
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
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>All monthly plan features</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Two months free</span>
                </li>
                <li className="flex items-center">
                  <Shield className="h-5 w-5 text-green-500 mr-2" />
                  <span>Premium support</span>
                </li>
              </ul>
              <button
                onClick={() => handleUpgrade(PLANS.ANNUAL.id)}
                disabled={isProcessing || subscriptionData?.plan === 'annual'}
                className={`w-full bg-indigo-600 text-white py-2 px-4 rounded-lg transition-colors ${
                  isProcessing || subscriptionData?.plan === 'annual'
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-indigo-700'
                }`}
              >
                {isProcessing ? 'Processing...' : 
                 subscriptionData?.plan === 'annual' ? 'Current Plan' : 
                 'Switch to Annual'}
              </button>
            </div>
          </div>

          {/* Billing History & Settings */}
          {subscriptionData?.stripeSubscriptionId && (
            <div className="mt-8 border-t pt-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Billing & Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleBillingPortal}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    <BillingIcon className="h-5 w-5 text-gray-600 mr-3" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Billing History</p>
                      <p className="text-sm text-gray-600">View past invoices</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </button>

                <button
                  onClick={handleBillingPortal}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    <Settings className="h-5 w-5 text-gray-600 mr-3" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Payment Methods</p>
                      <p className="text-sm text-gray-600">Manage payment options</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 text-center text-sm text-gray-500">
            By subscribing, you agree to our{' '}
            <button 
              onClick={() => setTermsModalOpen(true)}
              className="text-indigo-600 hover:text-indigo-800 underline"
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button 
              onClick={() => setPrivacyModalOpen(true)}
              className="text-indigo-600 hover:text-indigo-800 underline"
            >
              Privacy Policy
            </button>.
            You can cancel your subscription at any time.
          </div>
        </div>
      </div>

      {/* Modals */}
      <TermsModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
      <PrivacyPolicyModal isOpen={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
    </div>
  );
};

export default UserSubscription;