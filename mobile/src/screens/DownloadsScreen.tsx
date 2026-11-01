import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDownloads } from '../downloads/DownloadProvider';
import type { ManagedDownload } from '../downloads/types';
import type { RootStackParamList } from '../navigation/types';
import { useCatalog } from '../state/CatalogState';
import { colors, radii, spacing } from '../theme';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

export function DownloadsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { downloads, usedBytes, pause, resume, cancel, remove } = useDownloads();
  const { getMedia } = useCatalog();
  const run = (operation: () => Promise<void>) => { operation().catch((error) => Alert.alert('Download error', error instanceof Error ? error.message : 'Please try again.')); };

  const controls = (item: ManagedDownload) => <View style={styles.controls}>
    {item.status === 'downloading' ? <Control icon="pause" label="Pause" onPress={() => run(() => pause(item.id))}/> : null}
    {['paused', 'failed'].includes(item.status) ? <Control icon="play" label="Resume" onPress={() => run(() => resume(item.id))}/> : null}
    {['queued', 'downloading', 'paused'].includes(item.status) ? <Control icon="close" label="Cancel" danger onPress={() => run(() => cancel(item.id))}/> : null}
    {['completed', 'cancelled', 'failed'].includes(item.status) ? <Control icon="trash-outline" label="Remove" danger onPress={() => run(() => remove(item.id))}/> : null}
    {item.status === 'completed' ? <Control icon="play-circle" label="Play offline" onPress={() => navigation.navigate('VideoPlayer', { mediaId: item.mediaId, offline: true, ...(item.episodeId ? { episodeId: item.episodeId } : {}) })}/> : null}
  </View>;

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <Text style={styles.eyebrow}>WATCH ANYWHERE</Text><Text style={styles.title}>Downloads</Text><Text style={styles.subtitle}>Resumable offline files for this profile</Text>
    <View style={styles.storage}><Ionicons name="phone-portrait-outline" size={22} color={colors.cyan}/><View style={styles.storageCopy}><Text style={styles.storageTitle}>{formatBytes(usedBytes)} used by Flixora</Text><View style={styles.storageTrack}><View style={[styles.storageUsed, { width: `${Math.min(100, usedBytes / (4 * 1024 * 1024 * 1024) * 100)}%` }]}/></View></View><Text style={styles.storageMeta}>{downloads.length} files</Text></View>
    <FlatList
      data={downloads}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="download-outline" size={38} color={colors.purple}/></View><Text style={styles.emptyTitle}>Nothing downloaded</Text><Text style={styles.subtitle}>Open a title, choose 480p, 720p or 1080p, then tap Download.</Text></View>}
      renderItem={({ item }) => {
        const media = getMedia(item.mediaId);
        if (!media) return null;
        const percent = Math.round(item.progress * 100);
        return <View style={styles.card}><View style={styles.row}><Image source={{ uri: media.poster }} style={styles.poster}/><View style={styles.rowText}><Text style={styles.mediaTitle}>{media.title}</Text><Text style={styles.subtitle}>{item.quality} · {item.status}</Text><Text style={styles.byteText}>{formatBytes(item.bytesWritten)}{item.totalBytes > 0 ? ` / ${formatBytes(item.totalBytes)}` : ''}</Text></View><Text style={styles.percent}>{percent}%</Text></View><View style={styles.progressTrack}><View style={[styles.progress, { width: `${Math.max(item.status === 'completed' ? 100 : 2, percent)}%` }]}/></View>{item.error ? <Text style={styles.error}>{item.error}</Text> : null}{controls(item)}</View>;
      }}
    />
  </SafeAreaView>;
}

function Control({ icon, label, onPress, danger = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.control}><Ionicons name={icon} size={17} color={danger ? colors.red : colors.cyan}/><Text style={[styles.controlText, danger && styles.danger]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  eyebrow: { color: colors.cyan, fontSize: 10, letterSpacing: 1.8, fontWeight: '900', marginTop: spacing.md },
  title: { color: colors.text, fontSize: 34, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  storage: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  storageCopy: { flex: 1 },
  storageTitle: { color: colors.text, fontWeight: '800', fontSize: 12 },
  storageTrack: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceRaised, marginTop: 7, overflow: 'hidden' },
  storageUsed: { minWidth: 3, height: 5, backgroundColor: colors.cyan },
  storageMeta: { color: colors.muted, fontSize: 10 },
  list: { paddingTop: spacing.lg, paddingBottom: 110 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  poster: { width: 58, height: 82, borderRadius: radii.sm, backgroundColor: colors.surfaceRaised },
  rowText: { flex: 1 },
  mediaTitle: { color: colors.text, fontWeight: '800' },
  byteText: { color: colors.muted, fontSize: 10, marginTop: 4 },
  percent: { color: colors.cyan, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceRaised, marginTop: spacing.sm, overflow: 'hidden' },
  progress: { height: 5, backgroundColor: colors.purple },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  control: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, backgroundColor: colors.surfaceRaised, borderRadius: radii.sm },
  controlText: { color: colors.cyan, fontSize: 10, fontWeight: '800' },
  danger: { color: colors.red },
  error: { color: colors.red, fontSize: 11, marginTop: spacing.sm },
  empty: { alignItems: 'center', paddingTop: 90 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#8B5CF61C', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
});
