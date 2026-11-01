import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEvent } from 'expo';
import * as Brightness from 'expo-brightness';
import { Image as ExpoImage } from 'expo-image';
import * as Network from 'expo-network';
import { type AudioTrack, type SubtitleTrack, type VideoSource, VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, PanResponder, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useDownloads } from '../downloads/DownloadProvider';
import type { RootStackParamList } from '../navigation/types';
import { syncPlaybackCheckpoint } from '../services/playbackApi';
import { useAppState } from '../state/AppState';
import { useCatalog } from '../state/CatalogState';
import { colors, radii, spacing } from '../theme';
import type { StreamSource } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoPlayer'>;
type Drawer = 'quality' | 'tracks' | 'servers' | null;
type GestureMode = 'brightness' | 'volume' | null;
type PlaybackSource = StreamSource & { offline?: boolean };

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const qualities = ['Auto', '480p', '720p', '1080p', '4K'] as const;

function asVideoSource(source: PlaybackSource | undefined): VideoSource {
  if (!source) return null;
  return {
    uri: source.url,
    contentType: source.protocol === 'HLS' ? 'hls' : source.protocol === 'DASH' ? 'dash' : 'progressive',
    useCaching: source.protocol === 'MP4',
  };
}

function formatTime(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function PlayerScreen({ route, navigation }: Props) {
  const { mediaId, episodeId, sourceId, offline: offlineRequested = false } = route.params;
  const { getMedia } = useCatalog();
  const media = getMedia(mediaId);
  const episode = media?.episodes?.find((item) => item.id === episodeId);
  const localHistoryKey = episodeId ? `${mediaId}:${episodeId}` : mediaId;
  const { activeProfile, data, saveProgress } = useAppState();
  const { getOfflineAsset } = useDownloads();
  const network = Network.useNetworkState();
  const offlineAsset = getOfflineAsset(mediaId, episodeId);
  const networkUnavailable = network.isConnected === false || network.isInternetReachable === false;
  const remoteSources = episode?.sources ?? media?.sources ?? [];
  const sources = useMemo<PlaybackSource[]>(() => {
    if (offlineRequested || networkUnavailable) {
      if (!offlineAsset) return [];
      return [{ id: `offline-${offlineAsset.id}`, label: 'Offline file', url: offlineAsset.localUri, resolution: offlineAsset.quality, protocol: 'MP4', speed: 'Ultra', offline: true }];
    }
    return remoteSources;
  }, [networkUnavailable, offlineAsset, offlineRequested, remoteSources]);
  const initialIndex = Math.max(0, sources.findIndex((candidate) => sourceId ? candidate.id === sourceId : candidate.label === 'Fast CDN'));
  const [sourceIndex, setSourceIndex] = useState(initialIndex);
  const source = sources[sourceIndex];
  const loadedSourceId = useRef(source?.id);
  const initialVideoSource = useRef(asVideoSource(source)).current;
  const player = useVideoPlayer(initialVideoSource, (instance) => {
    instance.currentTime = data.history[localHistoryKey] ?? 0;
    instance.timeUpdateEventInterval = 1;
    instance.volume = 1;
    instance.play();
  });
  const videoRef = useRef<VideoView>(null);
  const { width, height } = useWindowDimensions();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [selectedQuality, setSelectedQuality] = useState<(typeof qualities)[number]>(sourceId && source ? source.resolution : 'Auto');
  const [previewTime, setPreviewTime] = useState(0);
  const [previewThumbnail, setPreviewThumbnail] = useState<React.ComponentProps<typeof ExpoImage>['source']>(null);
  const [seeking, setSeeking] = useState(false);
  const [error, setError] = useState('');
  const [failureRevision, setFailureRevision] = useState(0);
  const [gestureMode, setGestureMode] = useState<GestureMode>(null);
  const [gestureValue, setGestureValue] = useState(1);
  const gestureModeRef = useRef<GestureMode>(null);
  const gestureStartRef = useRef(1);
  const brightnessRef = useRef(0.5);
  const lastSyncBucket = useRef(-1);
  const failedSources = useRef(new Set<string>());
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playingEvent = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const timeEvent = useEvent(player, 'timeUpdate', { currentTime: player.currentTime, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const statusEvent = useEvent(player, 'statusChange', { status: player.status });
  const sourceLoad = useEvent(player, 'sourceLoad', { videoSource: null, duration: 0, availableVideoTracks: [], availableSubtitleTracks: [], availableAudioTracks: [] });
  const duration = sourceLoad.duration || player.duration || media?.durationSeconds || 0;
  const currentTime = seeking ? previewTime : timeEvent.currentTime;

  useEffect(() => { Brightness.getBrightnessAsync().then((value) => { brightnessRef.current = value; }).catch(() => undefined); }, []);
  useEffect(() => { if (sourceIndex >= sources.length) setSourceIndex(0); }, [sourceIndex, sources.length]);

  const sync = useCallback((position: number) => {
    if (!media) return;
    saveProgress(localHistoryKey, position);
    void syncPlaybackCheckpoint({
      profileId: activeProfile.id,
      mediaId: media.id,
      ...(episode?.id ? { episodeId: episode.id } : {}),
      positionSeconds: Math.max(0, position),
      durationSeconds: Math.max(0, duration),
      completed: duration > 0 && position / duration >= 0.95,
      occurredAt: new Date().toISOString(),
    }).catch(() => undefined);
  }, [activeProfile.id, duration, episode?.id, localHistoryKey, media, saveProgress]);

  useEffect(() => {
    if (sourceLoad.duration > 0 && player.currentTime >= sourceLoad.duration) {
      player.currentTime = Math.max(0, sourceLoad.duration - 5);
    }
  }, [player, sourceLoad.duration]);

  useEffect(() => {
    const bucket = Math.floor(timeEvent.currentTime / 10);
    if (bucket > 0 && bucket !== lastSyncBucket.current) {
      lastSyncBucket.current = bucket;
      sync(timeEvent.currentTime);
    }
  }, [sync, timeEvent.currentTime]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') sync(player.currentTime); });
    return () => { subscription.remove(); sync(player.currentTime); };
  }, [player, sync]);

  const switchSource = useCallback(async (index: number, reason?: string) => {
    const next = sources[index];
    if (!next) return;
    const resumeAt = player.currentTime;
    player.pause();
    setError(reason ?? '');
    try {
      await player.replaceAsync(asVideoSource(next));
      player.currentTime = resumeAt;
      loadedSourceId.current = next.id;
      failedSources.current.delete(next.id);
      setSourceIndex(index);
      setPreviewThumbnail(null);
      setError('');
      player.play();
    } catch {
      failedSources.current.add(next.id);
      setFailureRevision((revision) => revision + 1);
      setError(`${next.label} could not be loaded.`);
    }
  }, [player, sources]);

  const updatePreview = useCallback((value: number) => {
    setPreviewTime(value);
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      player.generateThumbnailsAsync(value, { maxWidth: 320 }).then((thumbnails) => {
        if (thumbnails[0]) setPreviewThumbnail(thumbnails[0]);
      }).catch(() => setPreviewThumbnail(null));
    }, 140);
  }, [player]);

  useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);

  useEffect(() => {
    if (statusEvent.status !== 'error' || !source) return;
    failedSources.current.add(source.id);
    const nextIndex = sources.findIndex((candidate, index) => index !== sourceIndex && !failedSources.current.has(candidate.id));
    if (nextIndex >= 0) void switchSource(nextIndex, `Switching from ${source.label}…`);
    else setError(networkUnavailable || source.offline ? 'The offline file cannot be played.' : 'Every authorized server is currently unavailable.');
  }, [failureRevision, networkUnavailable, source, sourceIndex, sources, statusEvent.status, switchSource]);

  useEffect(() => {
    if (!source || loadedSourceId.current === source.id) return;
    const message = source.offline ? 'Switching to the offline copy…' : undefined;
    void switchSource(sourceIndex, message);
  }, [source, sourceIndex, switchSource]);

  useEffect(() => {
    if (!controlsVisible || !playingEvent.isPlaying || drawer) return undefined;
    const timer = setTimeout(() => setControlsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [controlsVisible, drawer, playingEvent.isPlaying]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: (event) => {
      const mode: GestureMode = event.nativeEvent.pageX < width / 2 ? 'brightness' : 'volume';
      gestureModeRef.current = mode;
      setGestureMode(mode);
      gestureStartRef.current = mode === 'brightness' ? brightnessRef.current : player.volume;
      setGestureValue(gestureStartRef.current);
      setControlsVisible(true);
    },
    onPanResponderMove: (_event, gesture) => {
      const value = clamp(gestureStartRef.current - gesture.dy / Math.max(220, height * 0.72));
      setGestureValue(value);
      if (gestureModeRef.current === 'brightness') {
        brightnessRef.current = value;
        void Brightness.setBrightnessAsync(value).catch(() => undefined);
      } else if (gestureModeRef.current === 'volume') player.volume = value;
    },
    onPanResponderRelease: () => { setTimeout(() => setGestureMode(null), 650); gestureModeRef.current = null; },
    onPanResponderTerminate: () => { setGestureMode(null); gestureModeRef.current = null; },
  }), [height, player, width]);

  const chooseQuality = (quality: (typeof qualities)[number]) => {
    setSelectedQuality(quality);
    setDrawer(null);
    if (quality === 'Auto') {
      const automatic = sources.findIndex((candidate) => candidate.label === 'Fast CDN');
      if (automatic >= 0) void switchSource(automatic);
      return;
    }
    const match = sources.findIndex((candidate) => candidate.resolution === quality);
    if (match >= 0) void switchSource(match);
    else setError(`${quality} is not available from the current servers.`);
  };

  if (!media) return <Unavailable message="This title is no longer available." onBack={() => navigation.goBack()}/>;
  if (!source) return <Unavailable message={offlineRequested ? 'The downloaded file is no longer available on this device.' : networkUnavailable ? 'You are offline and this title has not been downloaded.' : 'No authorized source is available.'} onBack={() => navigation.goBack()}/>;

  return <View style={styles.screen} {...panResponder.panHandlers}>
    <StatusBar hidden/>
    <Pressable style={StyleSheet.absoluteFill} onPress={() => setControlsVisible((visible) => !visible)}>
      <VideoView ref={videoRef} player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} fullscreenOptions={{ enable: true, orientation: 'landscape' }} allowsPictureInPicture/>
    </Pressable>

    {statusEvent.status === 'loading' ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={colors.purple} size="large"/><Text style={styles.loadingText}>Loading {source.label}…</Text></View> : null}
    {error ? <View style={styles.error}><Ionicons name="warning" size={17} color={colors.gold}/><Text style={styles.errorText}>{error}</Text></View> : null}
    {gestureMode ? <View pointerEvents="none" style={styles.gestureIndicator}><Ionicons name={gestureMode === 'brightness' ? 'sunny' : 'volume-high'} size={30} color={colors.text}/><Text style={styles.gestureLabel}>{gestureMode === 'brightness' ? 'Brightness' : 'Volume'} · {Math.round(gestureValue * 100)}%</Text><View style={styles.gestureTrack}><View style={[styles.gestureFill, { width: `${gestureValue * 100}%` }]}/></View></View> : null}

    {controlsVisible ? <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={styles.topOverlay}><Pressable accessibilityLabel="Close player" onPress={() => navigation.goBack()} style={styles.iconButton}><Ionicons name="arrow-back" size={24} color={colors.text}/></Pressable><View style={styles.titleWrap}><Text numberOfLines={1} style={styles.title}>{episode ? `${media.title} · E${episode.number} ${episode.title}` : media.title}</Text><Text style={styles.sourceLabel}>{source.offline ? 'Offline playback' : `${source.label} · ${selectedQuality}`}</Text></View><Pressable accessibilityLabel="Choose server" onPress={() => setDrawer('servers')} style={styles.iconButton}><Ionicons name="server-outline" size={22} color={colors.text}/></Pressable></View>

      <View style={styles.centerControls}><Pressable accessibilityLabel="Skip backward 10 seconds" onPress={() => player.seekBy(-10)} style={styles.seekButton}><Ionicons name="play-back" size={30} color={colors.text}/><Text style={styles.seekLabel}>10</Text></Pressable><Pressable accessibilityLabel={playingEvent.isPlaying ? 'Pause' : 'Play'} onPress={() => playingEvent.isPlaying ? player.pause() : player.play()} style={styles.playButton}><Ionicons name={playingEvent.isPlaying ? 'pause' : 'play'} size={39} color={colors.background}/></Pressable><Pressable accessibilityLabel="Skip forward 10 seconds" onPress={() => player.seekBy(10)} style={styles.seekButton}><Ionicons name="play-forward" size={30} color={colors.text}/><Text style={styles.seekLabel}>10</Text></Pressable></View>

      <View style={styles.bottomOverlay}>
        {seeking ? <View style={[styles.preview, { left: Math.max(12, Math.min(width - 172, previewTime / Math.max(duration, 1) * (width - 160)) - 80) }]}><ExpoImage source={previewThumbnail ?? { uri: episode?.thumbnail ?? media.backdrop }} style={StyleSheet.absoluteFill} contentFit="cover"/><View style={styles.previewShade}><Text style={styles.previewTime}>{formatTime(previewTime)}</Text></View></View> : null}
        <View style={styles.timelineRow}><Text style={styles.time}>{formatTime(currentTime)}</Text><Slider style={styles.slider} minimumValue={0} maximumValue={Math.max(duration, 1)} value={Math.min(currentTime, Math.max(duration, 1))} minimumTrackTintColor={colors.purple} maximumTrackTintColor="#FFFFFF55" thumbTintColor={colors.text} onSlidingStart={(value) => { setSeeking(true); updatePreview(value); }} onValueChange={updatePreview} onSlidingComplete={(value) => { player.currentTime = value; updatePreview(value); setSeeking(false); sync(value); }}/><Text style={styles.time}>{formatTime(duration)}</Text></View>
      <View style={styles.toolRow}><View style={styles.toolGroup}><Tool icon="speedometer-outline" label={`${player.playbackRate}×`} onPress={() => { player.playbackRate = player.playbackRate >= 2 ? 0.5 : player.playbackRate + 0.5; setControlsVisible(true); }}/><Tool icon="options-outline" label="Quality" onPress={() => setDrawer('quality')}/><Tool icon="chatbox-ellipses-outline" label="Audio & Subs" onPress={() => setDrawer('tracks')}/></View><View style={styles.toolGroup}><Text style={[styles.network, source.offline && styles.offline]}>{source.offline ? 'OFFLINE' : 'ONLINE'}</Text><Tool icon="scan-outline" label="Fullscreen" onPress={() => { void videoRef.current?.enterFullscreen(); }}/></View></View>
      </View>
    </View> : null}

    <OptionsDrawer visible={drawer === 'quality'} title="Video quality" onClose={() => setDrawer(null)}>
      {qualities.map((quality) => <DrawerOption key={quality} title={quality} detail={quality === 'Auto' ? 'Adaptive quality based on connection' : `Use ${quality} rendition`} selected={selectedQuality === quality} onPress={() => chooseQuality(quality)}/>) }
    </OptionsDrawer>
    <OptionsDrawer visible={drawer === 'servers'} title="Playback server" onClose={() => setDrawer(null)}>
      {sources.map((candidate, index) => <DrawerOption key={candidate.id} title={candidate.label} detail={`${candidate.protocol} · ${candidate.resolution} · ${candidate.speed}`} selected={index === sourceIndex} onPress={() => { setDrawer(null); void switchSource(index); }}/>) }
    </OptionsDrawer>
    <OptionsDrawer visible={drawer === 'tracks'} title="Audio & subtitles" onClose={() => setDrawer(null)}>
      <Text style={styles.drawerSection}>AUDIO</Text>
      {sourceLoad.availableAudioTracks.length ? sourceLoad.availableAudioTracks.map((track) => <TrackOption key={track.id} track={track} selected={player.audioTrack?.id === track.id} onPress={() => { player.audioTrack = track; }}/>) : <Text style={styles.noTracks}>Default audio · no alternate tracks in this demo source</Text>}
      <Text style={styles.drawerSection}>SUBTITLES</Text>
      <DrawerOption title="Off" detail="Disable subtitles" selected={!player.subtitleTrack} onPress={() => { player.subtitleTrack = null; }}/>
      {sourceLoad.availableSubtitleTracks.map((track) => <TrackOption key={track.id} track={track} selected={player.subtitleTrack?.id === track.id} onPress={() => { player.subtitleTrack = track; }}/>) }
    </OptionsDrawer>
  </View>;
}

function Tool({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.tool}><Ionicons name={icon} size={20} color={colors.text}/><Text style={styles.toolText}>{label}</Text></Pressable>;
}

function OptionsDrawer({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.modalShade} onPress={onClose}><Pressable style={styles.drawer} onPress={(event) => event.stopPropagation()}><View style={styles.drawerHandle}/><View style={styles.drawerHeader}><Text style={styles.drawerTitle}>{title}</Text><Pressable accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.drawerClose}><Ionicons name="close" size={22} color={colors.text}/></Pressable></View>{children}</Pressable></Pressable></Modal>;
}

function DrawerOption({ title, detail, selected, onPress }: { title: string; detail: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.drawerOption}><View style={styles.drawerOptionCopy}><Text style={styles.drawerOptionTitle}>{title}</Text><Text style={styles.drawerOptionDetail}>{detail}</Text></View>{selected ? <Ionicons name="checkmark-circle" size={23} color={colors.cyan}/> : <View style={styles.radio}/>}</Pressable>;
}

function TrackOption({ track, selected, onPress }: { track: AudioTrack | SubtitleTrack; selected: boolean; onPress: () => void }) {
  return <DrawerOption title={track.label || track.language || 'Unknown track'} detail={track.language?.toUpperCase() || 'UND'} selected={selected} onPress={onPress}/>;
}

function Unavailable({ message, onBack }: { message: string; onBack: () => void }) {
  return <View style={styles.unavailable}><Ionicons name="cloud-offline-outline" size={48} color={colors.muted}/><Text style={styles.unavailableTitle}>Playback unavailable</Text><Text style={styles.unavailableMessage}>{message}</Text><Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backButtonText}>Go back</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  loading: { position: 'absolute', alignSelf: 'center', top: '43%', alignItems: 'center' },
  loadingText: { color: colors.text, marginTop: spacing.sm, fontSize: 12 },
  error: { position: 'absolute', top: 68, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#201A0FEF', borderColor: '#FBBF2455', borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxWidth: '80%' },
  errorText: { color: colors.text, fontSize: 12, flexShrink: 1 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: '#000000AA' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, backgroundColor: '#FFFFFF13' },
  titleWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  sourceLabel: { color: colors.cyan, fontSize: 10, marginTop: 3, fontWeight: '800' },
  centerControls: { position: 'absolute', top: '38%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 42 },
  playButton: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFFE8' },
  seekButton: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000099' },
  seekLabel: { position: 'absolute', color: colors.text, fontSize: 9, fontWeight: '900' },
  bottomOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, backgroundColor: '#000000C4' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slider: { flex: 1, height: 34 },
  time: { color: colors.text, fontSize: 10, fontVariant: ['tabular-nums'], minWidth: 39, textAlign: 'center' },
  preview: { position: 'absolute', bottom: 88, width: 160, height: 90, borderRadius: radii.sm, overflow: 'hidden', borderWidth: 2, borderColor: colors.text },
  previewShade: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#00000030', padding: 5 },
  previewTime: { color: colors.text, fontWeight: '900', backgroundColor: '#000000B8', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, fontVariant: ['tabular-nums'] },
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toolGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tool: { minWidth: 54, alignItems: 'center', gap: 3 },
  toolText: { color: colors.text, fontSize: 9, fontWeight: '700' },
  network: { color: colors.success, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  offline: { color: colors.gold },
  gestureIndicator: { position: 'absolute', top: '35%', alignSelf: 'center', width: 190, alignItems: 'center', backgroundColor: '#111111E8', borderRadius: radii.lg, padding: spacing.lg },
  gestureLabel: { color: colors.text, fontWeight: '800', marginTop: spacing.sm },
  gestureTrack: { width: '100%', height: 5, backgroundColor: colors.surfaceRaised, marginTop: spacing.md, borderRadius: 3, overflow: 'hidden' },
  gestureFill: { height: 5, backgroundColor: colors.cyan },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' },
  drawer: { maxHeight: '84%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  drawerHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  drawerTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  drawerClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  drawerOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  drawerOptionCopy: { flex: 1 },
  drawerOptionTitle: { color: colors.text, fontWeight: '800' },
  drawerOptionDetail: { color: colors.muted, fontSize: 11, marginTop: 3 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  drawerSection: { color: colors.cyan, fontSize: 10, letterSpacing: 1.6, fontWeight: '900', marginTop: spacing.md, marginBottom: spacing.sm },
  noTracks: { color: colors.muted, lineHeight: 19, paddingVertical: spacing.md },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  unavailableTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: spacing.md },
  unavailableMessage: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm },
  backButton: { backgroundColor: colors.purple, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radii.md, marginTop: spacing.lg },
  backButtonText: { color: colors.text, fontWeight: '900' },
});
