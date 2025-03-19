import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import { getUser, updateUser } from '../common/cache'; // Import user service functions

// Initialize Stripe with publishable key
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Subscription plans
export const PLANS = {
  MONTHLY: {
    id: import.meta.env.VITE_STRIPE_MONTHLY_PLAN_ID,
    name: 'Monthly',
    price: 9.99,
    interval: 'month',
    trialDays: 7
  },
  ANNUAL: {
    id: import.meta.env.VITE_STRIPE_ANNUAL_PLAN_ID,
    name: 'Annual',
    price: 99.99,
    interval: 'year',
    trialDays: 7,
    discount: '17%'
  }
};

// Create checkout session
export const createCheckoutSession = async (userId: string, priceId: string) => {
  try {
    // First create a checkout session on the server
    const response = await axios.post('/api/create-checkout-session', {
      userId,
      priceId
    });
    
    // Check if we have a URL directly from the server - use it as fallback
    if (response.data.url) {
      window.location.href = response.data.url;
      return;
    }
    
    // Otherwise try to use the session ID with Stripe's redirectToCheckout
    if (!response.data || !response.data.id) {
      console.error('Invalid checkout session response:', response.data);
      throw new Error('Server did not return a valid session ID or URL');
    }

    // Then redirect to the checkout using the session ID
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe failed to initialize');
    }
    
    try {
      const { error } = await stripe.redirectToCheckout({
        sessionId: response.data.id
      });

      if (error) {
        console.error('Stripe checkout error:', error);
        throw error;
      }
    } catch (redirectError) {
      console.error('Redirect to checkout failed:', redirectError);
      
      // Fallback to direct URL if redirect failed and we have a URL
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw redirectError;
      }
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Start trial period
export const startTrial = async (userId: string) => {
  try {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + PLANS.MONTHLY.trialDays);

    // Replace direct Firestore with updateUser
    await updateUser(userId, {
      trialEndsAt,
      isTrialing: true,
      subscriptionStatus: 'trialing',
      subscriptionPlan: null
    });

    return {
      isTrialing: true,
      trialEndsAt
    };
  } catch (error) {
    console.error('Error starting trial:', error);
    throw error;
  }
};

// Cancel subscription
export const cancelSubscription = async (userId: string) => {
  try {
    const userData = await getUser(userId);
    if (!userData?.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    // Call server endpoint to cancel subscription
    const response = await axios.post('/api/cancel-subscription', {
      userId,
      subscriptionId: userData.stripeSubscriptionId
    });

    if (response.data.success) {
      // Update local state using user service
      await updateUser(userId, {
        cancelAtPeriodEnd: true
      });
      return { success: true };
    } else {
      throw new Error('Failed to cancel subscription');
    }
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// Resume canceled subscription
export const resumeSubscription = async (userId: string) => {
  try {
    const userData = await getUser(userId);
    if (!userData?.stripeSubscriptionId) {
      throw new Error('No subscription found');
    }

    // Call server endpoint to resume subscription
    const response = await axios.post('/api/resume-subscription', {
      userId,
      subscriptionId: userData.stripeSubscriptionId
    });

    if (response.data.success) {
      // Update local state using user service
      await updateUser(userId, {
        cancelAtPeriodEnd: false
      });
      return { success: true };
    } else {
      throw new Error('Failed to resume subscription');
    }
  } catch (error) {
    console.error('Error resuming subscription:', error);
    throw error;
  }
};

// Get billing portal URL
export const getBillingPortalUrl = async (userId: string) => {
  try {
    const response = await axios.post('/api/create-portal-session', {
      userId
    });
    return response.data.url;
  } catch (error) {
    console.error('Error getting billing portal URL:', error);
    throw error;
  }
};