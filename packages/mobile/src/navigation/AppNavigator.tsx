import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { FirebaseProvider } from '../context/FirebaseContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import HomeScreen from '../screens/HomeScreen';
import ChatAssessmentScreen from '../screens/ChatAssessmentScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, refreshUserProfile } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showAssessment, setShowAssessment] = useState(false);

  useEffect(() => {
    if (user) {
      const hasCompletedAssessment = user.hasCompletedAssessment || false;
      
      if (!hasCompletedAssessment) {
        setShowAssessment(true);
        setShowSplash(false);
      } else {
        setShowSplash(true);
        setShowAssessment(false);
      }
    }
  }, [user]);

  const handleAssessmentComplete = async () => {
    // Refresh user profile to get updated assessment status
    if (refreshUserProfile) {
      await refreshUserProfile();
    }
    setShowAssessment(false);
    setShowSplash(true);
  };

  return (
    <FirebaseProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : showAssessment ? (
          <Stack.Screen name="ChatAssessment">
            {props => (
              <ChatAssessmentScreen
                {...props}
                onComplete={handleAssessmentComplete}
              />
            )}
          </Stack.Screen>
        ) : showSplash ? (
          <Stack.Screen
            name="Home"
            options={{ animation: 'fade' }}
          >
            {props => (
              <HomeScreen
                {...props}
                onFinishSplash={() => setShowSplash(false)}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </FirebaseProvider>
  );
}