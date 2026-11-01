import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MediaBadge } from '../components/MediaBadge';
import { useDownloads } from '../downloads/DownloadProvider';
import type { DownloadQuality } from '../downloads/types';
import type { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { useCatalog } from '../state/CatalogState';
import { colors, radii, spacing } from '../theme';
import type { MediaItem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MovieDetails'>;
type DetailTab = 'Overview' | 'Servers' | 'Episodes' | 'Reviews';
const qualities: DownloadQuality[] = ['480p', '720p', '1080p'];

export function DetailsScreen({ route, navigation }: Props) {
  const { getMedia, loadDetails } = useCatalog();
  const item = getMedia(route.params.mediaId);
  const insets = useSafeAreaInsets();
  const { data, toggleWatchlist } = useAppState();
  const { downloads, start } = useDownloads();
  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [quality, setQuality] = useState<DownloadQuality>('1080p');
  const [enriching, setEnriching] = useState(route.params.mediaId.startsWith('tmdb:'));
  const tabs = useMemo<DetailTab[]>(() => item?.episodes?.length ? ['Overview', 'Servers', 'Episodes', 'Reviews'] : ['Overview', 'Servers', 'Reviews'], [item?.episodes?.length]);

  useEffect(() => {
    if (!route.params.mediaId.startsWith('tmdb:')) { setEnriching(false); return; }
    let active = true;
    setEnriching(true);
    loadDetails(route.params.mediaId).finally(() => { if (active) setEnriching(false); });
    return () => { active = false; };
  }, [loadDetails, route.params.mediaId]);

  if (!item && enriching) return <View style={styles.missing}><ActivityIndicator size="large" color={colors.purple}/><Text style={styles.missingTitle}>Loading title…</Text></View>;
  if (!item) return <View style={styles.missing}><Ionicons name="alert-circle-outline" size={46} color={colors.muted}/><Text style={styles.missingTitle}>This title is unavailable</Text><Pressable onPress={() => navigation.goBack()} style={styles.retry}><Text style={styles.retryText}>Go back</Text></Pressable></View>;
  const saved = data.watchlist.includes(item.id);
  const downloaded = downloads.some((entry) => entry.mediaId === item.id && !['cancelled', 'failed'].includes(entry.status));

  const play = (sourceId?: string, episodeId?: string) => navigation.navigate('VideoPlayer', { mediaId: item.id, sourceId, episodeId });
  const share = () => Share.share({ title: item.title, message: `Watch ${item.title} on Flixora` });
  const download = async () => {
    const source = item.sources.find((candidate) => candidate.resolution === quality && candidate.protocol === 'MP4');
    if (!source) return Alert.alert('Download unavailable', `${quality} is not available for this title.`);
    try {
      await start({ mediaId: item.id, sourceId: source.id, quality, remoteUri: source.url, protocol: source.protocol });
      Alert.alert('Download started', `${item.title} is downloading in ${quality}.`);
    } catch (error) {
      Alert.alert('Download failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return <View style={styles.screen}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <ImageBackground source={{ uri: item.backdrop }} style={styles.backdrop} resizeMode="cover">
        <LinearGradient colors={['#00000015', '#0F0F0F55', colors.background]} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill}/>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.badges}><MediaBadge label={item.quality} tone="purple"/><MediaBadge label={`IMDb ${item.rating}`} tone="gold"/><MediaBadge label={`${item.ageRating}+`}/><MediaBadge label={item.kind} tone="cyan"/></View>
          <Text style={styles.meta}>{item.year} · {item.duration} · {item.language}</Text>
        </View>
      </ImageBackground>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Play ${item.title}`} onPress={() => play()} style={({ pressed }) => [styles.play, pressed && styles.pressed]}><Ionicons name="play" size={21} color={colors.background}/><Text style={styles.playText}>Play</Text></Pressable>
        <ActionButton icon={downloaded ? 'checkmark-circle' : 'download-outline'} label={downloaded ? 'Queued' : 'Download'} active={downloaded} onPress={() => { void download(); }}/>
        <ActionButton icon={saved ? 'checkmark' : 'add'} label={saved ? 'My List' : 'Watchlist'} active={saved} onPress={() => toggleWatchlist(item.id)}/>
        <ActionButton icon="share-social-outline" label="Share" onPress={share}/>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroller} contentContainerStyle={styles.tabs}>
        {tabs.map((tab) => <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}><Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text></Pressable>)}
      </ScrollView>

      <View style={styles.tabContent}>
        {activeTab === 'Overview' && <Overview item={item} quality={quality} setQuality={setQuality}/>} 
        {activeTab === 'Servers' && <Servers item={item} onPlay={(sourceId) => play(sourceId)}/>} 
        {activeTab === 'Episodes' && <Episodes item={item} onPlay={(episodeId, sourceId) => play(sourceId, episodeId)}/>} 
        {activeTab === 'Reviews' && <Reviews item={item}/>} 
      </View>
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={[styles.back, { top: insets.top + 8 }]}><Ionicons name="arrow-back" size={23} color={colors.text}/></Pressable>
  </View>;
}

function ActionButton({ icon, label, onPress, active = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}><View style={[styles.actionIcon, active && styles.activeAction]}><Ionicons name={icon} size={21} color={active ? colors.background : colors.text}/></View><Text numberOfLines={1} style={styles.actionLabel}>{label}</Text></Pressable>;
}

function Overview({ item, quality, setQuality }: { item: MediaItem; quality: DownloadQuality; setQuality: (quality: DownloadQuality) => void }) {
  return <View><Text style={styles.synopsis}>{item.synopsis}</Text>{item.trailerUrl ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(item.trailerUrl!); }} style={styles.trailerButton}><Ionicons name="logo-youtube" size={20} color={colors.text}/><Text style={styles.trailerText}>Watch official trailer</Text></Pressable> : null}<Text style={styles.sectionTitle}>About this title</Text><Info label="Cast" value={item.cast.length ? item.cast.join(', ') : 'Cast metadata is being updated'}/><Info label="Director" value={item.director}/><Info label="Genre" value={`${item.genres?.join(', ') ?? item.genre} · ${item.country}`}/><Text style={styles.sectionTitle}>Download quality</Text><View style={styles.qualityRow}>{qualities.map((value) => <Pressable key={value} onPress={() => setQuality(value)} style={[styles.quality, quality === value && styles.activeQuality]}><Text style={[styles.qualityText, quality === value && styles.activeQualityText]}>{value}</Text></Pressable>)}</View><Text style={styles.note}>Offline playback requires an authorized encrypted download and DRM license in production.</Text></View>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function Servers({ item, onPlay }: { item: MediaItem; onPlay: (sourceId: string) => void }) {
  return <View><Text style={styles.sectionIntro}>Choose an authorized playback source. Flixora automatically falls back when a source is unavailable.</Text>{item.sources.length ? item.sources.map((source) => { const fast = source.label === 'Fast CDN'; return <Pressable key={source.id} onPress={() => onPlay(source.id)} style={styles.serverRow}><View style={[styles.serverIcon, fast && styles.fastServer]}><Ionicons name={fast ? 'flash' : 'server-outline'} size={22} color={fast ? colors.background : colors.cyan}/></View><View style={styles.serverCopy}><Text style={styles.serverTitle}>{source.label}</Text><Text style={styles.serverMeta}>{source.protocol} · {source.resolution} · {source.speed}</Text></View><View style={styles.onlineDot}/><Text style={styles.online}>Online</Text><Ionicons name="play-circle" size={29} color={colors.purple}/></Pressable>; }) : <Text style={styles.note}>No licensed stream template is configured for this TMDB title.</Text>}</View>;
}

function Episodes({ item, onPlay }: { item: MediaItem; onPlay: (episodeId: string, sourceId: string) => void }) {
  if (!item.episodes?.length) return <Text style={styles.sectionIntro}>This title has no episodes.</Text>;
  return <View><View style={styles.seasonHeader}><Text style={styles.sectionTitle}>Season 1</Text><Text style={styles.episodeCount}>{item.episodes.length} episodes</Text></View>{item.episodes.map((episode) => <Pressable key={episode.id} onPress={() => onPlay(episode.id, episode.sources[0]!.id)} style={styles.episode}><Image source={{ uri: episode.thumbnail }} style={styles.episodeImage}/><View style={styles.episodeCopy}><Text style={styles.episodeTitle}>{episode.number}. {episode.title}</Text><Text numberOfLines={2} style={styles.episodeSynopsis}>{episode.synopsis}</Text><Text style={styles.episodeDuration}>{episode.duration}</Text></View><Ionicons name="play-circle" size={31} color={colors.text}/></Pressable>)}</View>;
}

function Reviews({ item }: { item: MediaItem }) {
  return <View><View style={styles.ratingSummary}><Text style={styles.ratingNumber}>{item.rating}</Text><View><Text style={styles.ratingStars}>★★★★★</Text><Text style={styles.ratingCaption}>IMDb audience rating</Text></View></View>{item.reviews.map((review) => <View key={review.id} style={styles.review}><View style={styles.reviewHeader}><View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{review.author[0]}</Text></View><View style={styles.reviewAuthor}><Text style={styles.serverTitle}>{review.author}</Text><Text style={styles.serverMeta}>{review.createdAt}</Text></View><Text style={styles.reviewStars}>{'★'.repeat(review.rating)}</Text></View><Text style={styles.reviewComment}>{review.comment}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 50 },
  backdrop: { height: 470, justifyContent: 'flex-end', backgroundColor: colors.surface },
  heroCopy: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  meta: { color: '#CBD5E1', fontSize: 13, marginTop: spacing.sm },
  back: { position: 'absolute', left: spacing.md, width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000A6', borderWidth: 1, borderColor: '#FFFFFF26' },
  actions: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.md, gap: spacing.md },
  play: { height: 52, minWidth: 122, borderRadius: radii.md, backgroundColor: colors.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  playText: { color: colors.background, fontWeight: '900', fontSize: 16 },
  pressed: { opacity: 0.75 },
  action: { alignItems: 'center', flex: 1, maxWidth: 74 },
  actionIcon: { width: 46, height: 46, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  activeAction: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  actionLabel: { color: colors.muted, fontSize: 10, marginTop: 6, fontWeight: '700' },
  tabScroller: { marginTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabs: { paddingHorizontal: spacing.md, gap: spacing.lg },
  tab: { paddingBottom: 13 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: colors.purple },
  tabText: { color: colors.muted, fontWeight: '800', fontSize: 14 },
  activeTabText: { color: colors.text },
  tabContent: { padding: spacing.lg },
  synopsis: { color: '#CBD5E1', fontSize: 15, lineHeight: 24 },
  trailerButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, backgroundColor: colors.red, borderRadius: radii.md, paddingHorizontal: 15, paddingVertical: 11 },
  trailerText: { color: colors.text, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: spacing.xl, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', paddingVertical: 8 },
  infoLabel: { color: colors.muted, width: 80, fontSize: 13 },
  infoValue: { color: colors.text, flex: 1, fontSize: 13, lineHeight: 19 },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quality: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 13, paddingVertical: 9 },
  activeQuality: { backgroundColor: colors.purple, borderColor: colors.purple },
  qualityText: { color: colors.muted, fontWeight: '800' },
  activeQualityText: { color: colors.text },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  sectionIntro: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: spacing.md },
  serverRow: { flexDirection: 'row', alignItems: 'center', minHeight: 78, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  serverIcon: { width: 43, height: 43, borderRadius: radii.md, backgroundColor: '#06B6D41A', alignItems: 'center', justifyContent: 'center' },
  fastServer: { backgroundColor: colors.cyan },
  serverCopy: { flex: 1 },
  serverTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  serverMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  online: { color: colors.success, fontSize: 10, fontWeight: '800' },
  seasonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  episodeCount: { color: colors.muted, fontSize: 12 },
  episode: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  episodeImage: { width: 112, height: 68, borderRadius: radii.sm, backgroundColor: colors.surface },
  episodeCopy: { flex: 1 },
  episodeTitle: { color: colors.text, fontWeight: '800', fontSize: 13 },
  episodeSynopsis: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  episodeDuration: { color: colors.cyan, fontSize: 10, marginTop: 4, fontWeight: '700' },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface },
  ratingNumber: { color: colors.text, fontSize: 44, fontWeight: '900' },
  ratingStars: { color: colors.gold, letterSpacing: 2 },
  ratingCaption: { color: colors.muted, fontSize: 11, marginTop: 4 },
  review: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  reviewAvatar: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purpleDark },
  reviewAvatarText: { color: colors.text, fontWeight: '900' },
  reviewAuthor: { flex: 1, marginLeft: spacing.sm },
  reviewStars: { color: colors.gold, fontSize: 11 },
  reviewComment: { color: '#CBD5E1', lineHeight: 21, marginTop: spacing.md },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  missingTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: spacing.md },
  retry: { backgroundColor: colors.purple, borderRadius: radii.md, paddingHorizontal: 18, paddingVertical: 12, marginTop: spacing.lg },
  retryText: { color: colors.text, fontWeight: '900' },
});
