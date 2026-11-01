import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { DetailsScreen } from '../screens/DetailsScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { DownloadsScreen } from '../screens/DownloadsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { ProfilesScreen } from '../screens/ProfilesScreen';
import { ProfileTabScreen } from '../screens/ProfileTabScreen';
import { colors } from '../theme';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: colors.purple, background: colors.background, card: colors.surface, border: colors.border, text: colors.text, notification: colors.cyan },
};

const tabIcons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Explore: 'compass',
  Downloads: 'download',
  Profile: 'person-circle',
};

function MainTabs() {
  return <Tab.Navigator
    initialRouteName="Home"
    screenOptions={({ route }) => ({
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
      tabBarActiveTintColor: colors.purple,
      tabBarInactiveTintColor: colors.muted,
      tabBarHideOnKeyboard: true,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 1 },
      tabBarStyle: { height: 72, paddingTop: 8, paddingBottom: 9, backgroundColor: '#151515F5', borderTopColor: colors.border, borderTopWidth: 1 },
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? tabIcons[route.name] : `${tabIcons[route.name]}-outline` as keyof typeof Ionicons.glyphMap} color={color} size={focused ? size + 2 : size}/>,
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen}/>
    <Tab.Screen name="Explore" component={DiscoverScreen}/>
    <Tab.Screen name="Downloads" component={DownloadsScreen}/>
    <Tab.Screen name="Profile" component={ProfileTabScreen}/>
  </Tab.Navigator>;
}

export function AppNavigator() {
  return <NavigationContainer theme={navigationTheme}>
    <Stack.Navigator initialRouteName="MainTabs" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={MainTabs}/>
      <Stack.Screen name="MovieDetails" component={DetailsScreen}/>
      <Stack.Screen name="VideoPlayer" component={PlayerScreen} options={{ animation: 'fade', orientation: 'landscape' }}/>
      <Stack.Screen name="ProfileSelection" component={ProfilesScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }}/>
    </Stack.Navigator>
  </NavigationContainer>;
}
