import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MessageCircle, Compass, BookOpen, User } from 'lucide-react-native';
import ChatScreen from '../screens/ChatScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { navigationStyles } from '../theme';

const Tab = createBottomTabNavigator();

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
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ tabBarLabel: 'Discover' }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarLabel: 'Library' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}