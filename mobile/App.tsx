import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DownloadProvider } from './src/downloads/DownloadProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppStateProvider } from './src/state/AppState';
import { CatalogProvider } from './src/state/CatalogState';
import { colors } from './src/theme';

export default function App() {
  return <SafeAreaProvider><AppStateProvider><CatalogProvider><DownloadProvider><StatusBar barStyle="light-content" backgroundColor={colors.background}/><AppNavigator/></DownloadProvider></CatalogProvider></AppStateProvider></SafeAreaProvider>;
}
