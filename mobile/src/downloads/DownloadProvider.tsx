import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAppState } from '../state/AppState';
import type { ManagedDownload, StartDownloadInput } from './types';

const stateKey = 'flixora.native-downloads.v1';
const downloadDirectory = `${FileSystem.documentDirectory ?? ''}flixora-downloads/`;

type DownloadContextValue = {
  downloads: ManagedDownload[];
  start: (input: StartDownloadInput) => Promise<string>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getOfflineAsset: (mediaId: string, episodeId?: string) => ManagedDownload | undefined;
  usedBytes: number;
  hydrated: boolean;
};

const DownloadContext = createContext<DownloadContextValue | null>(null);

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

async function requireNetwork(): Promise<void> {
  const state = await Network.getNetworkStateAsync();
  if (state.isConnected === false || state.isInternetReachable === false) throw new Error('An internet connection is required to download this title.');
}

export function DownloadProvider({ children }: PropsWithChildren) {
  const { activeProfile } = useAppState();
  const [allDownloads, setAllDownloads] = useState<ManagedDownload[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const tasks = useRef(new Map<string, FileSystem.DownloadResumable>());
  const lastProgressUpdate = useRef(new Map<string, number>());
  const latestDownloads = useRef<ManagedDownload[]>([]);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    AsyncStorage.getItem(stateKey).then(async (value) => {
      const parsed = value ? JSON.parse(value) as ManagedDownload[] : [];
      const normalized = parsed.map((item) => item.status === 'downloading' ? { ...item, status: 'paused' as const, error: 'Download was interrupted. Tap resume.' } : item);
      const verified = await Promise.all(normalized.map(async (item) => {
        if (item.status !== 'completed') return item;
        const info = await FileSystem.getInfoAsync(item.localUri);
        return info.exists ? item : { ...item, status: 'failed' as const, error: 'Offline file is missing.' };
      }));
      setAllDownloads(verified);
    }).catch(() => setAllDownloads([])).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    latestDownloads.current = allDownloads;
    if (!hydrated || persistTimer.current) return;
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      const snapshot = JSON.stringify(latestDownloads.current);
      persistChain.current = persistChain.current.catch(() => undefined).then(() => AsyncStorage.setItem(stateKey, snapshot));
    }, 750);
  }, [allDownloads, hydrated]);

  useEffect(() => () => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    const snapshot = JSON.stringify(latestDownloads.current);
    persistChain.current = persistChain.current.catch(() => undefined).then(() => AsyncStorage.setItem(stateKey, snapshot));
  }, []);

  const patch = useCallback((id: string, change: Partial<ManagedDownload>) => {
    setAllDownloads((current) => current.map((item) => item.id === id ? { ...item, ...change, updatedAt: Date.now() } : item));
  }, []);

  const run = useCallback(async (entry: ManagedDownload, resume: boolean) => {
    const task = FileSystem.createDownloadResumable(
      entry.remoteUri,
      entry.localUri,
      { md5: true, sessionType: FileSystem.FileSystemSessionType.BACKGROUND },
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const progress = totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0;
        const now = Date.now();
        if (progress < 1 && now - (lastProgressUpdate.current.get(entry.id) ?? 0) < 250) return;
        lastProgressUpdate.current.set(entry.id, now);
        patch(entry.id, { status: 'downloading', progress, bytesWritten: totalBytesWritten, totalBytes: Math.max(0, totalBytesExpectedToWrite), error: undefined });
      },
      entry.resumeData,
    );
    tasks.current.set(entry.id, task);
    patch(entry.id, { status: 'downloading', error: undefined });
    try {
      const result = resume ? await task.resumeAsync() : await task.downloadAsync();
      if (!result || tasks.current.get(entry.id) !== task) return;
      tasks.current.delete(entry.id);
      lastProgressUpdate.current.delete(entry.id);
      patch(entry.id, { status: 'completed', progress: 1, localUri: result.uri, checksum: result.md5, resumeData: undefined });
      await SecureStore.setItemAsync(
        `flixora.offline-receipt.${entry.id}`,
        JSON.stringify({ mediaId: entry.mediaId, checksum: result.md5 ?? null, completedAt: new Date().toISOString() }),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
      );
    } catch (error) {
      if (tasks.current.get(entry.id) !== task) return;
      tasks.current.delete(entry.id);
      lastProgressUpdate.current.delete(entry.id);
      patch(entry.id, { status: 'failed', error: error instanceof Error ? error.message : 'Download failed.' });
    }
  }, [patch]);

  const start = useCallback(async (input: StartDownloadInput) => {
    await requireNetwork();
    const isDirectFile = input.protocol === 'MP4' || /\.(mp4|m4v)(?:$|\?)/i.test(input.remoteUri);
    if (!isDirectFile) throw new Error('Offline HLS/DASH requires the native DRM download adapter. Select a downloadable MP4 rendition.');
    if (!FileSystem.documentDirectory) throw new Error('Application document storage is unavailable on this device.');
    await FileSystem.makeDirectoryAsync(downloadDirectory, { intermediates: true });
    const id = `${activeProfile.id}-${input.mediaId}-${input.episodeId ?? 'movie'}-${input.quality}`;
    const localUri = `${downloadDirectory}${safeId(id)}.mp4`;
    const existingTask = tasks.current.get(id);
    tasks.current.delete(id);
    if (existingTask) await existingTask.cancelAsync().catch(() => undefined);
    lastProgressUpdate.current.delete(id);
    await FileSystem.deleteAsync(localUri, { idempotent: true });
    await SecureStore.deleteItemAsync(`flixora.offline-receipt.${id}`).catch(() => undefined);
    const entry: ManagedDownload = {
      id,
      profileId: activeProfile.id,
      mediaId: input.mediaId,
      ...(input.episodeId ? { episodeId: input.episodeId } : {}),
      sourceId: input.sourceId,
      quality: input.quality,
      remoteUri: input.remoteUri,
      localUri,
      status: 'queued',
      progress: 0,
      bytesWritten: 0,
      totalBytes: 0,
      updatedAt: Date.now(),
    };
    setAllDownloads((current) => [...current.filter((item) => item.id !== id), entry]);
    void run(entry, false);
    return id;
  }, [activeProfile.id, run]);

  const pause = useCallback(async (id: string) => {
    const task = tasks.current.get(id);
    if (!task) return;
    const state = await task.pauseAsync();
    tasks.current.delete(id);
    lastProgressUpdate.current.delete(id);
    patch(id, { status: 'paused', resumeData: state.resumeData });
  }, [patch]);

  const resume = useCallback(async (id: string) => {
    await requireNetwork();
    if (tasks.current.has(id)) return;
    const entry = allDownloads.find((item) => item.id === id);
    if (!entry || entry.status === 'completed') return;
    if (!entry.resumeData) await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
    void run(entry, Boolean(entry.resumeData));
  }, [allDownloads, run]);

  const cancel = useCallback(async (id: string) => {
    const entry = allDownloads.find((item) => item.id === id);
    const task = tasks.current.get(id);
    tasks.current.delete(id);
    lastProgressUpdate.current.delete(id);
    if (task) await task.cancelAsync().catch(() => undefined);
    if (entry) await FileSystem.deleteAsync(entry.localUri, { idempotent: true }).catch(() => undefined);
    await SecureStore.deleteItemAsync(`flixora.offline-receipt.${id}`).catch(() => undefined);
    patch(id, { status: 'cancelled', progress: 0, bytesWritten: 0, totalBytes: 0, resumeData: undefined, error: undefined });
  }, [allDownloads, patch]);

  const remove = useCallback(async (id: string) => {
    const entry = allDownloads.find((item) => item.id === id);
    await cancel(id);
    if (entry) await FileSystem.deleteAsync(entry.localUri, { idempotent: true }).catch(() => undefined);
    setAllDownloads((current) => current.filter((item) => item.id !== id));
  }, [allDownloads, cancel]);

  const downloads = useMemo(() => allDownloads.filter((item) => item.profileId === activeProfile.id), [activeProfile.id, allDownloads]);
  const value = useMemo<DownloadContextValue>(() => ({
    downloads,
    start,
    pause,
    resume,
    cancel,
    remove,
    getOfflineAsset: (mediaId, episodeId) => downloads.find((item) => item.mediaId === mediaId && item.episodeId === episodeId && item.status === 'completed'),
    usedBytes: downloads.reduce((total, item) => total + item.bytesWritten, 0),
    hydrated,
  }), [cancel, downloads, hydrated, pause, remove, resume, start]);

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
}

export function useDownloads(): DownloadContextValue {
  const value = useContext(DownloadContext);
  if (!value) throw new Error('useDownloads must be used within DownloadProvider');
  return value;
}
