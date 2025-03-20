import express from 'express';
import Stripe from 'stripe';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, getDocs, query, where, getDoc } from 'firebase/firestore';
import cron from 'node-cron';
import path from 'path';
import { CONTENT_CATEGORIES, generateContent, publishContent } from '../lib/post/contentGenerator.js';

// Create a fixed dirname that works for deployment
// In production the server runs from the root directory
const __dirname = process.cwd();

const app = express();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('Stripe secret key is not defined');
}
const stripe = new Stripe(stripeSecretKey);

// Subscription plans
const PLANS = {
  MONTHLY: {
    id: process.env.STRIPE_MONTHLY_PLAN_ID!,
    name: 'Monthly',
    price: 9.99,
    interval: 'month',
    trialDays: 7
  },
  ANNUAL: {
    id: process.env.STRIPE_ANNUAL_PLAN_ID!,
    name: 'Annual',
    price: 99.99,
    interval: 'year',
    trialDays: 7,
    discount: '17%'
  }
};

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Use JSON parser for all non-webhook routes
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// API endpoint to cancel subscription
app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    // Cancel the subscription at period end
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// API endpoint to resume subscription
app.post('/api/resume-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    // Resume the subscription
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
});

// API endpoint to create billing portal session
app.post('/api/create-portal-session', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Get user's Stripe customer ID
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;

    if (!stripeCustomerId) {
      throw new Error('No Stripe customer ID found');
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.VITE_APP_URL}/subscription`
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// API endpoint to create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId, priceId } = req.body;
    
    if (!userId || !priceId) {
      console.error('Missing required parameters:', { userId, priceId });
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    
    // Get user's current subscription info
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const currentSubscriptionId = userData?.stripeSubscriptionId;
    const currentPlan = userData?.subscriptionPlan;

    // Determine if this is a plan switch
    let isSwitchingPlan = false;
    let currentSubscriptionDetails: Stripe.Subscription | null = null;

    if (currentSubscriptionId) {
      isSwitchingPlan = true;
      try {
        // Get details of the current subscription
        currentSubscriptionDetails = await stripe.subscriptions.retrieve(currentSubscriptionId);
      } catch (error) {
        console.error('Error retrieving current subscription:', error);
        // Continue even if this fails
      }
    }

    // Configure the session with proper Stripe types
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription' as Stripe.Checkout.SessionCreateParams.Mode,
      success_url: `${process.env.VITE_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.VITE_APP_URL}/subscription`,
      client_reference_id: `${userId}:${priceId}`,
      subscription_data: {
        metadata: {
          userId,
          isSwitchingPlan: isSwitchingPlan ? 'true' : 'false',
          oldPlan: currentPlan || 'none',
          oldSubscriptionId: currentSubscriptionId || 'none',
        },
        // Add trial end if needed for proration
        ...(currentSubscriptionDetails && {
          trial_end: currentSubscriptionDetails.current_period_end
        })
      }
    };

    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    // Send both the ID and URL as a backup
    res.json({ 
      id: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Webhook endpoint
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('Stripe signature is missing');
      res.status(400).send('Stripe signature is required');
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      if (err instanceof Error) {
        console.log(`❌ Error message: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
      } else {
        console.log('❌ Unknown error');
        res.status(400).send('Webhook Error: Unknown error');
      }
      return;
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clientReferenceId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!clientReferenceId || !customerId || !subscriptionId) {
          res.status(400).send('Missing required fields');
          return;
        }

        console.log('[Webhook] Processing checkout.session.completed');
        
        const [userId, priceId] = clientReferenceId.split(':');
        
        // Retrieve subscription from Stripe to get its details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        const metadata = subscription.metadata || {};
        
        // Check if this is a plan switch
        const isSwitchingPlan = metadata.isSwitchingPlan === 'true';
        const oldSubscriptionId = metadata.oldSubscriptionId;
        
        // If switching plans and there's a previous subscription, cancel it
        if (isSwitchingPlan && oldSubscriptionId && oldSubscriptionId !== 'none') {
          console.log(`[Webhook] Handling plan switch. Cancelling old subscription: ${oldSubscriptionId}`);
          
          try {
            // Mark the old subscription as being switched
            await stripe.subscriptions.update(oldSubscriptionId, {
              metadata: { 
                isSwitchingPlan: 'true',
                replacedBySubscriptionId: subscriptionId
              }
            });
            
            // Then cancel it
            await stripe.subscriptions.cancel(oldSubscriptionId);
          } catch (error) {
            console.error('[Webhook] Error cancelling old subscription:', error);
            // Continue even if this fails
          }
        }

        // Determine subscription details
        let plan;
        let subscriptionEnd;
        const subscriptionStart = new Date(subscription.current_period_start * 1000);

        if (priceId === PLANS.MONTHLY.id) {
          plan = 'monthly';
          subscriptionEnd = new Date(subscription.current_period_end * 1000);
        } else if (priceId === PLANS.ANNUAL.id) {
          plan = 'annual';
          subscriptionEnd = new Date(subscription.current_period_end * 1000);
        } else {
          console.error('[Webhook] Invalid price ID:', priceId);
          res.status(400).send('Invalid price ID');
          return;
        }

        // Update user in Firestore with new subscription details
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: 'active',
          subscriptionPlan: plan,
          subscriptionStart,
          subscriptionEnd,
          isTrialing: subscription.status === 'trialing',
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          updatedAt: new Date()
        });
        
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;

        if (!userId) {
          res.status(400).send('Missing user ID in metadata');
          return;
        }

        console.log('[Webhook] Processing subscription update:', {
          subscriptionId: subscription.id,
          status: subscription.status,
          userId
        });

        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          subscriptionEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          subscriptionStatus: subscription.status === 'active' ? 'active' : 
                             subscription.status === 'trialing' ? 'active' : 'inactive',
          updatedAt: new Date()
        });
        
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;
        
        // Check if this deletion is part of a plan switch
        const isSwitchingPlan = subscription.metadata.isSwitchingPlan === 'true';

        if (!userId) {
          res.status(400).send('Missing user ID in metadata');
          return;
        }

        console.log('[Webhook] Processing subscription deletion:', {
          subscriptionId: subscription.id,
          userId,
          isSwitchingPlan
        });

        // Only update Firestore if this isn't part of a plan switch
        if (!isSwitchingPlan) {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, {
            subscriptionStatus: 'expired',
            stripeSubscriptionId: null,
            updatedAt: new Date()
          });
        }
        
        break;
      }
    }

    res.status(200).send('Webhook processed');
  }
);

// Username pool for auto-generated content
const USERNAME_POOL = [
  'Sarah',
  'Mike',
  'Emma',
  'David',
  'Alex',
  'Jessica',
  'Jay',
  'Liam',
  'Olivia',
  'Ethan',
  'Sophia',
  'Noah',
  'Amelia',
  'James',
  'Isabella',
  'Logan',
  'Ava',
  'Benjamin',
  'Mia',
  'Lucas'
];

// Get a random username from the pool
const getRandomUsername = () => {
  const randomIndex = Math.floor(Math.random() * USERNAME_POOL.length);
  return USERNAME_POOL[randomIndex];
};

// Function to generate content
async function generateScheduledContent() {
  console.log('Starting scheduled content generation...');
  try {
    // Generate content for all categories
    for (const category of CONTENT_CATEGORIES) {
      console.log(`Generating content for category: ${category.name}`);
      
      // Generate content for this category
      const content = await generateContent(category);
      
      // If we got content, publish up to 2 pieces
      if (content && content.length > 0) {
        // Determine how many pieces to publish (up to 2)
        const countToPublish = Math.min(content.length, 2);
        
        for (let i = 0; i < countToPublish; i++) {
          // Use a random username for each published piece of content
          const randomUsername = getRandomUsername();
          const postId = await publishContent(content[i], randomUsername);
          console.log(`Successfully published content for ${category.name} with ID: ${postId}`);
          
          // Add a small delay between posts to prevent rate limiting
          if (i < countToPublish - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      } else {
        console.log(`No content was generated for category: ${category.name}`);
      }
      
      // Add a delay between categories to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('Content generation completed for all categories');
  } catch (error) {
    console.error('Error generating scheduled content:', error);
  }
}

// Schedule content generation at noon and midnight Eastern Time
// Eastern Time is UTC-5 (or UTC-4 during DST)
// 0 4,5 = midnight ET (either 4am or 5am UTC depending on DST)
// 0 16,17 = noon ET (either 4pm or 5pm UTC depending on DST)
cron.schedule('0 4,5,16,17 * * *', () => {
  // Check if this is the right hour for Eastern Time
  const now = new Date();
  const estHour = now.getUTCHours() - (now.getTimezoneOffset() / 60 + 5) % 24;
  
  // Only run at midnight and noon Eastern Time
  if (estHour === 0 || estHour === 12) {
    console.log(`Executing scheduled content generation at ${now.toISOString()}`);
    generateScheduledContent().catch(error => {
      console.error('Failed to generate scheduled content:', error);
    });
  }
});

// Scheduled job to check for expired subscriptions
cron.schedule('0 0 * * *', async () => {
  const now = new Date();
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('subscriptionEnd', '<=', now),
    where('subscriptionStatus', '==', 'active')
  );
  
  const querySnapshot = await getDocs(q);

  querySnapshot.forEach(async (doc) => {
    try {
      await updateDoc(doc.ref, {
        subscriptionStatus: 'expired',
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating subscription status:', error);
    }
  });
});

// Health check endpoint
app.get('/_ah/health', (_req, res) => {
  res.status(200).send('OK');
});

// Update static file paths for deployment structure
app.use(express.static(path.join(__dirname, '../')));

// Update catch-all route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});