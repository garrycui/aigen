// generateContent.ts
import cron from 'node-cron';
import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { CONTENT_CATEGORIES, generateContent, publishContent } from '../src/lib/post/contentGenerator.ts';

config();

// Firebase configuration
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Username pool
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

async function generateDailyContent() {
  try {
    for (const category of CONTENT_CATEGORIES) {
      try {
        const content = await generateContent(category);
        for (const item of content) {
          // Use a random username for each published piece of content
          const randomUsername = getRandomUsername();
          const postId = await publishContent(item, randomUsername);
          // Delay between posts to prevent hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`Error for category "${category.name}":`, error);
      }
    }
    console.log('Daily content generation completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error in daily content generation:', error);
    process.exit(1);
  }
}

// Schedule to run daily at midnight (00:00)
cron.schedule('0 0 * * *', () => {
  generateDailyContent().catch(console.error);
});

// Allow manual execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDailyContent().catch(console.error).finally(() => process.exit(0));
}
