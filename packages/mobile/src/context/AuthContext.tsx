import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  initializeAuth, 
  getReactNativePersistence, 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  signInWithCredential,
  createUserWithEmailAndPassword, 
  updateProfile, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Fix the import path
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Use Expo's process.env for .env variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Add this for debugging:
console.log('FIREBASE CONFIG', firebaseConfig);

const app = initializeApp(firebaseConfig);
// Use initializeAuth for React Native persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
const db = getFirestore(app);

interface AuthUser {
  id: string;
  email: string;
  name: string;
  hasCompletedAssessment?: boolean;
  mbtiType?: string;
  aiPreference?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn?: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp?: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  googleSignIn?: () => Promise<{ error: string | null }>;
  signOut?: () => Promise<{ error: string | null }>;
  refreshUserProfile?: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (uid: string, email: string, displayName: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: uid,
          email: email,
          name: displayName || 'User',
          hasCompletedAssessment: userData.hasCompletedAssessment || false,
          mbtiType: userData.mbtiType,
          aiPreference: userData.aiPreference,
        };
      } else {
        // User document doesn't exist yet, return basic info
        return {
          id: uid,
          email: email,
          name: displayName || 'User',
          hasCompletedAssessment: false,
        };
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return {
        id: uid,
        email: email,
        name: displayName || 'User',
        hasCompletedAssessment: false,
      };
    }
  };

  const refreshUserProfile = async () => {
    if (auth.currentUser) {
      const updatedUser = await fetchUserProfile(
        auth.currentUser.uid,
        auth.currentUser.email!,
        auth.currentUser.displayName || 'User'
      );
      setUser(updatedUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const userProfile = await fetchUserProfile(
          firebaseUser.uid,
          firebaseUser.email!,
          firebaseUser.displayName || 'User'
        );
        setUser(userProfile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Login failed' };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Signup failed' };
    }
  };

  const googleSignIn = async () => {
    try {
      // For now, return an informative error message
      // TODO: Implement proper Google Sign-In for React Native
      return { 
        error: 'Google Sign-In is not yet configured for mobile. Please use email/password authentication for now.' 
      };
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      return { error: error.message || 'Google sign in failed' };
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      return { error: null };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return { error: error.message || 'Sign out failed' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signUp, 
      googleSignIn, 
      signOut: handleSignOut, 
      refreshUserProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
}