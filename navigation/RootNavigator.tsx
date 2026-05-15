import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CameraScreen from '../screens/CameraScreen';
import DocumentScanResultScreen from '../screens/DocumentScanResultScreen';
import SummaryScreen from '../screens/SummaryScreen';
import DocumentDetailsScreen from '../screens/DocumentDetailsScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import LoadingScreen from '../screens/LoadingScreen';
import GroupScreen from '../screens/GroupScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import SearchGroupScreen from '../screens/SearchGroupScreen';
import FlashcardScreen from '../screens/FlashcardScreen';
import FlashcardDetailScreen from '../screens/FlashcardDetailScreen';
import { TabScreenWrapper } from './TabScreenWrapper';
import { useAuth } from '../contexts/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Wrapper để thêm BottomNavigationBar vào mỗi tab screen
const WrappedDashboard = () => (
  <TabScreenWrapper>
    <DashboardScreen />
  </TabScreenWrapper>
);

const WrappedDocuments = () => (
  <TabScreenWrapper>
    <DocumentsScreen />
  </TabScreenWrapper>
);

const WrappedProfile = () => (
  <TabScreenWrapper>
    <ProfileScreen />
  </TabScreenWrapper>
);

const WrappedFlashcard = () => (
  <TabScreenWrapper>
    <FlashcardScreen />
  </TabScreenWrapper>
);

// Bottom Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={WrappedDashboard}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Documents"
        component={WrappedDocuments}
        options={{ title: 'Documents' }}
      />
      <Tab.Screen
        name="Flashcard"
        component={WrappedFlashcard}
        options={{ title: 'Flashcard' }}
      />
      <Tab.Screen
        name="Profile"
        component={WrappedProfile}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Root Stack Navigator
export function RootNavigator() {
  const { isLoggedIn, authLoading } = useAuth();

  if (authLoading) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="Loading"
            component={LoadingScreen}
            options={{ animation: 'none' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={isLoggedIn ? 'app-stack' : 'auth-stack'}
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName={isLoggedIn ? 'TabNavigator' : 'SignIn'}
      >
        {!isLoggedIn ? (
          <Stack.Group navigationKey="auth">
            <Stack.Screen
              name="SignIn"
              component={SignInScreen}
              options={{ animation: 'none' }}
            />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </Stack.Group>
        ) : (
          <>
            <Stack.Group navigationKey="app" screenOptions={{ animation: 'none' }}>
              <Stack.Screen name="TabNavigator" component={TabNavigator} />
            </Stack.Group>

            <Stack.Group
              navigationKey="app-screens"
              screenOptions={{
                presentation: 'card',
              }}
            >
              <Stack.Screen name="Camera" component={CameraScreen} />
              <Stack.Screen name="DocumentScanResult" component={DocumentScanResultScreen} />
              <Stack.Screen name="Summary" component={SummaryScreen} />
              <Stack.Screen name="DocumentDetails" component={DocumentDetailsScreen} />
              <Stack.Screen name="Groups" component={GroupScreen} />
              <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
              <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
              <Stack.Screen name="SearchGroups" component={SearchGroupScreen} />
              <Stack.Screen name="FlashcardDetail" component={FlashcardDetailScreen} />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
