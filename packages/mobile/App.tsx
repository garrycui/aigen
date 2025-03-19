import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from './src/context/AuthContext';
import { AnimationProvider } from './src/components/common/AnimationProvider';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AssistantScreen from './src/screens/AssistantScreen';
import TutorialsScreen from './src/screens/TutorialsScreen';
import MindScreen from './src/screens/MindScreen';
import ForumScreen from './src/screens/ForumScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <AuthProvider>
        <AnimationProvider>
          <Stack.Navigator initialRouteName="Home">
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Assistant" component={AssistantScreen} />
            <Stack.Screen name="Tutorials" component={TutorialsScreen} />
            <Stack.Screen name="Mind" component={MindScreen} />
            <Stack.Screen name="Forum" component={ForumScreen} />
          </Stack.Navigator>
        </AnimationProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}