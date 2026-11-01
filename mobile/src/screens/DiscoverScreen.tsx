import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaCard } from '../components/MediaCard';
import type { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { useCatalog } from '../state/CatalogState';
import { colors, spacing } from '../theme';
import type { MediaItem } from '../types';

export function DiscoverScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeProfile } = useAppState();
  const { items: catalog, search } = useCatalog();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All');
  const [remoteResults, setRemoteResults] = useState<MediaItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const genres = useMemo(() => ['All', ...new Set(catalog.flatMap((item) => item.genres?.length ? item.genres : [item.genre]))].slice(0, 12), [catalog]);
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) { setRemoteResults(null); setSearching(false); return undefined; }
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      search(normalized).then((items) => { if (active) setRemoteResults(items); }).catch(() => { if (active) setRemoteResults(null); }).finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query, search]);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return (remoteResults ?? catalog).filter((item) => item.ageRating <= activeProfile.maxAgeRating
      && (genre === 'All' || item.genre === genre || item.genres?.includes(genre))
      && (remoteResults !== null || !normalized || `${item.title} ${item.synopsis} ${item.country} ${item.language}`.toLocaleLowerCase().includes(normalized)));
  }, [activeProfile.maxAgeRating, catalog, genre, query, remoteResults]);
  const cardWidth = Math.max(140, Math.min(180, (Math.min(width, 720) - spacing.md * 4) / 2));

  return <SafeAreaView style={styles.screen} edges={['top']}><Text style={styles.eyebrow}>FIND YOUR NEXT STORY</Text><Text style={styles.title}>Explore</Text><View style={styles.searchWrap}><Ionicons name="search" size={20} color={colors.muted}/><TextInput accessibilityLabel="Search titles" value={query} onChangeText={setQuery} placeholder="Movies, shows, countries…" placeholderTextColor={colors.muted} style={styles.search}/>{searching ? <ActivityIndicator size="small" color={colors.cyan}/> : query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={20} color={colors.muted}/></Pressable> : null}</View><FlatList horizontal data={genres} keyExtractor={(item) => item} renderItem={({ item }) => <Pressable onPress={() => setGenre(item)} style={[styles.chip, item === genre && styles.activeChip]}><Text style={[styles.chipText, item === genre && styles.activeChipText]}>{item}</Text></Pressable>} showsHorizontalScrollIndicator={false} style={styles.chips}/><FlatList data={results} numColumns={2} columnWrapperStyle={styles.columns} keyExtractor={(item) => item.id} renderItem={({ item }) => <MediaCard item={item} width={cardWidth} onPress={() => navigation.navigate('MovieDetails', { mediaId: item.id })}/>} contentContainerStyle={styles.results} ListEmptyComponent={<View style={styles.empty}><Ionicons name="search-outline" size={42} color={colors.muted}/><Text style={styles.emptyTitle}>No matching stories</Text><Text style={styles.emptyCopy}>Try another title or genre.</Text></View>} /></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  eyebrow: { color: colors.cyan, fontSize: 10, letterSpacing: 1.8, fontWeight: '900', marginTop: spacing.md },
  title: { color: colors.text, fontSize: 34, fontWeight: '900' },
  searchWrap: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: spacing.md },
  search: { color: colors.text, flex: 1, paddingVertical: 12 },
  chips: { flexGrow: 0, marginTop: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderColor: colors.border, borderWidth: 1, borderRadius: 18, marginRight: spacing.sm },
  activeChip: { backgroundColor: colors.purple, borderColor: colors.purple },
  chipText: { color: colors.muted },
  activeChipText: { color: colors.background, fontWeight: '800' },
  results: { paddingTop: spacing.lg, paddingBottom: 110 },
  columns: { justifyContent: 'space-between', marginBottom: spacing.lg },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.md },
  emptyCopy: { color: colors.muted, marginTop: spacing.xs },
});
