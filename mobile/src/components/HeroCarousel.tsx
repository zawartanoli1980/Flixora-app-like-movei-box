import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, ImageBackground, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { colors, radii, spacing } from '../theme';
import type { MediaItem } from '../types';
import { MediaBadge } from './MediaBadge';

export function HeroCarousel({ items, navigation }: { items: MediaItem[]; navigation: NativeStackNavigationProp<RootStackParamList> }) {
  const listRef = useRef<FlatList<MediaItem>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width } = useWindowDimensions();
  const { data, toggleWatchlist } = useAppState();

  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % items.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 6500);
    return () => clearInterval(timer);
  }, [items.length]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return <View>
    <FlatList
      ref={listRef}
      data={items}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => item.id}
      getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
      onMomentumScrollEnd={onScrollEnd}
      renderItem={({ item }) => {
        const saved = data.watchlist.includes(item.id);
        return <ImageBackground source={{ uri: item.backdrop }} style={[styles.hero, { width }]} resizeMode="cover">
          <LinearGradient colors={['transparent', '#0F0F0F55', colors.background]} locations={[0.18, 0.58, 0.98]} style={styles.gradient}>
            <View style={styles.copy}>
              <Text style={styles.eyebrow}>FLIXORA ORIGINAL · FEATURED</Text>
              <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
              <View style={styles.badges}><MediaBadge label={item.quality} tone="purple"/><MediaBadge label={`IMDb ${item.rating}`} tone="gold"/><MediaBadge label={`${item.ageRating}+`}/></View>
              <Text numberOfLines={3} style={styles.synopsis}>{item.synopsis}</Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Play ${item.title}`} onPress={() => navigation.navigate('VideoPlayer', { mediaId: item.id })} style={({ pressed }) => [styles.play, pressed && styles.pressed]}><Ionicons name="play" size={19} color={colors.background}/><Text style={styles.playText}>Play</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${saved ? 'Remove' : 'Add'} ${item.title} ${saved ? 'from' : 'to'} watchlist`} onPress={() => toggleWatchlist(item.id)} style={({ pressed }) => [styles.watchlist, pressed && styles.pressed]}><Ionicons name={saved ? 'checkmark' : 'add'} size={21} color={colors.text}/><Text style={styles.watchlistText}>{saved ? 'In My List' : 'Watchlist'}</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title} details`} onPress={() => navigation.navigate('MovieDetails', { mediaId: item.id })} style={styles.info}><Ionicons name="information-circle-outline" size={25} color={colors.text}/></Pressable>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>;
      }}
    />
    <View style={styles.dots}>{items.map((item, index) => <View key={item.id} style={[styles.dot, index === activeIndex && styles.activeDot]}/>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  hero: { height: 590, justifyContent: 'flex-end', backgroundColor: colors.surface },
  gradient: { flex: 1, justifyContent: 'flex-end' },
  copy: { paddingHorizontal: spacing.lg, paddingBottom: 42 },
  eyebrow: { color: colors.cyan, fontSize: 10, letterSpacing: 1.7, fontWeight: '900' },
  title: { color: colors.text, fontSize: 45, lineHeight: 48, letterSpacing: -1.5, fontWeight: '900', marginTop: spacing.sm, maxWidth: 540 },
  badges: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  synopsis: { color: '#E2E8F0', fontSize: 14, lineHeight: 21, marginTop: spacing.md, maxWidth: 560 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  play: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.text, borderRadius: radii.md, paddingHorizontal: 21 },
  playText: { color: colors.background, fontSize: 15, fontWeight: '900' },
  watchlist: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF26', borderColor: '#FFFFFF35', borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 16 },
  watchlistText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  info: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, backgroundColor: '#FFFFFF20' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  dots: { position: 'absolute', bottom: 18, right: spacing.lg, flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF4D' },
  activeDot: { width: 24, backgroundColor: colors.purple },
});
