import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '@shared/common/firebase';
import { 
  getUserWithSubscription,
  createUser,
  updateUser,
  invalidateUserCache,
  cleanupAllSubscriptionListeners
} from '@shared/common/cache';
import { startTrial } from '@shared/payment/stripe';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  // ... other user properties from shared AuthUser type
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  googleSignIn: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        try {
          const userId = firebaseUser.uid;
          const userData = await getUserWithSubscription(userId);
          
          if (userData) {
            if (!userData.name && firebaseUser.displayName) {
              await updateUser(userId, {
                name: firebaseUser.displayName,
                displayName: firebaseUser.displayName
              });
              userData.name = firebaseUser.displayName;
              userData.displayName = firebaseUser.displayName;
            }
            setUser(userData as AuthUser);
          } else {
            const newUserData = {
              email: firebaseUser.email!,
              name: firebaseUser.displayName || '',
              displayName: firebaseUser.displayName || '',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const createdUser = await createUser(userId, newUserData);
            setUser(createdUser as AuthUser);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      cleanupAllSubscriptionListeners();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return {};
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error: error.message };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(firebaseUser, {
        displayName: name
      });

      const userData = {
        name: name,
        email: email,
        displayName: name
      };

      await createUser(firebaseUser.uid, userData);
      await startTrial(firebaseUser.uid);
      await new Promise(resolve => setTimeout(resolve, 500));
      invalidateUserCache(firebaseUser.uid);

      return {};
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { error: error.message };
    }
  };

  const googleSignIn = async () => {
    // Note: Google Sign-In requires additional setup for mobile
    Alert.alert('Not Available', 'Google Sign-In is not available in the mobile app yet.');
    return { error: 'Google Sign-In not available' };
  };

  const signOut = async () => {
    try {
      if (user) {
        invalidateUserCache(user.id);
      }
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      signIn, 
      signUp, 
      googleSignIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};