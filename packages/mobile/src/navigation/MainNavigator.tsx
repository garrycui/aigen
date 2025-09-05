import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessageCircle, Compass, BookOpen, User } from 'lucide-react-native';
import ChatScreen from '../screens/chat/ChatScreen';
import ChatSessionsScreen from '../screens/chat/ChatSessionsScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';
import VideoRecommendationsScreen from '../screens/video/VideoRecommendationsScreen';
import { navigationStyles } from '../theme';

const Tab = createBottomTabNavigator();
const ChatStack = createNativeStackNavigator();

// Create a Chat Stack Navigator to handle Chat and ChatSessions
function ChatStackNavigator() {
  return (
    <ChatStack.Navigator 
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: true,
        animation: 'slide_from_right',
      }}
      initialRouteName="ChatMain"
    >
      <ChatStack.Screen 
        name="ChatMain" 
        component={ChatScreen}
        options={{
          gestureDirection: 'horizontal',
        }}
      />
      <ChatStack.Screen 
        name="ChatSessions" 
        component={ChatSessionsScreen}
        options={{
          gestureDirection: 'horizontal',
          presentation: 'card',
        }}
      />
    </ChatStack.Navigator>
  );
}

const getTabIcon = (routeName: string) => {
  switch (routeName) {
    case 'Chat':
      return MessageCircle;
    case 'Discover':
      return Compass;
    case 'Library':
      return BookOpen;
    case 'Profile':
      return User;
    case 'Videos':
      return Compass;
    default:
      return MessageCircle;
  }
};

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const Icon = getTabIcon(route.name);
          return <Icon color={focused ? color : navigationStyles.tabNavigator.inactiveTintColor} size={size} />;
        },
        tabBarActiveTintColor: navigationStyles.tabNavigator.activeTintColor,
        tabBarInactiveTintColor: navigationStyles.tabNavigator.inactiveTintColor,
        tabBarStyle: navigationStyles.tabNavigator.style,
        tabBarLabelStyle: navigationStyles.tabNavigator.labelStyle,
      })}
    >
      <Tab.Screen name="Chat" component={ChatStackNavigator} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="Videos" component={VideoRecommendationsScreen} options={{ tabBarLabel: 'Videos' }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarLabel: 'Library' }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ tabBarLabel: 'Discover' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}