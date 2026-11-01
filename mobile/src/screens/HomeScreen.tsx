import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroCarousel } from '../components/HeroCarousel';
import { MediaRail } from '../components/MediaRail';
import type { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { useCatalog } from '../state/CatalogState';
import { colors, radii, spacing } from '../theme';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { activeProfile, data } = useAppState();
  const { items: catalog, featured, trending, dynamic, loading } = useCatalog();
  const allowed = useMemo(() => catalog.filter((item) => item.ageRating <= activeProfile.maxAgeRating), [activeProfile.maxAgeRating, catalog]);
  const heroItems = featured.filter((item) => item.ageRating <= activeProfile.maxAgeRating);
  const continueWatching = allowed.filter((item) => (data.history[item.id] ?? 0) > 0 && (data.history[item.id] ?? 0) < item.durationSeconds * 0.95);
  const progressById = Object.fromEntries(continueWatching.map((item) => [item.id, (data.history[item.id] ?? 0) / item.durationSeconds * 100]));
  const topTen = trending.filter((item) => item.ageRating <= activeProfile.maxAgeRating).slice(0, 10);
  const action = allowed.filter((item) => item.genre === 'Action');
  const recommended = [...allowed].sort((a, b) => b.rating - a.rating).slice(0, 8);

  if (!heroItems.length) return <View style={styles.empty}><Text style={styles.emptyTitle}>No titles available</Text><Text style={styles.muted}>Try another profile or check the catalog later.</Text></View>;

  return <View style={styles.screen}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <HeroCarousel items={heroItems} navigation={navigation}/>
      <View style={styles.welcome}><View style={styles.welcomeRow}><Text style={styles.welcomeTitle}>Made for {activeProfile.name}</Text><Text style={styles.catalogStatus}>{loading ? 'UPDATING' : dynamic ? 'TMDB LIVE' : 'OFFLINE CATALOG'}</Text></View><Text style={styles.muted}>Stories chosen around what you enjoy.</Text></View>
      <MediaRail title="Continue Watching" subtitle="Pick up exactly where you stopped" items={continueWatching} navigation={navigation} progressById={progressById}/>
      <MediaRail title="Top 10 Today" subtitle="What everyone is watching" items={topTen} navigation={navigation} ranked/>
      <MediaRail title="Trending Now" items={topTen.slice(0, 8)} navigation={navigation}/>
      <MediaRail title="Action" subtitle="Adrenaline, heroes and impossible missions" items={action} navigation={navigation}/>
      <MediaRail title="Recommended For You" subtitle="Based on this profile" items={recommended} navigation={navigation}/>
    </ScrollView>
    <View pointerEvents="box-none" style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.logo}>flixora<Text style={styles.logoDot}>.</Text></Text>
      <View style={styles.topActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open search" onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} style={styles.topButton}><Ionicons name="search" size={22} color={colors.text}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose profile" onPress={() => navigation.navigate('ProfileSelection')} style={styles.avatar}><Text style={styles.avatarText}>{activeProfile.name[0]}</Text></Pressable>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 125 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0F0F0F35' },
  logo: { color: colors.text, fontSize: 27, lineHeight: 31, fontWeight: '900', letterSpacing: -1.2 },
  logoDot: { color: colors.purple },
  topActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  topButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, backgroundColor: '#00000066' },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: colors.purple, borderWidth: 2, borderColor: '#FFFFFF99' },
  avatarText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  welcome: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  welcomeTitle: { color: colors.text, fontSize: 23, fontWeight: '900' },
  catalogStatus: { color: colors.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  muted: { color: colors.muted, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
});
