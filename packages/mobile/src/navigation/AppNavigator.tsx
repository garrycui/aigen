import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { FirebaseProvider } from '../context/FirebaseContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import HomeScreen from '../screens/dashboard/HomeScreen';
import AssessmentIntro from '../screens/assessment/AssessmentIntro';
import AssessmentScreen from '../screens/assessment/AssessmentScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, refreshUserProfile } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  return (
    <FirebaseProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
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
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="AssessmentIntro" component={AssessmentIntro} />
            <Stack.Screen name="Assessment" component={AssessmentScreen} />
          </>
        )}
      </Stack.Navigator>
    </FirebaseProvider>
  );
}