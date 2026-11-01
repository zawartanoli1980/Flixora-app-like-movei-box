import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DownloadItem, Profile } from '../types';

const profiles: Profile[] = [
  { id: 'alex', name: 'Alex', isKids: false, maxAgeRating: 18 },
  { id: 'kids', name: 'Kids', isKids: true, maxAgeRating: 7 },
];

type ProfileData = {
  watchlist: string[];
  downloads: DownloadItem[];
  history: Record<string, number>;
};

const emptyData = (): ProfileData => ({ watchlist: [], downloads: [], history: {} });
const starterData = (): ProfileData => ({
  watchlist: ['interstellar', 'spider-verse'],
  downloads: [],
  history: { 'dune-part-two': 120, interstellar: 240, shogun: 90 },
});

type AppContextValue = {
  activeProfile: Profile;
  profiles: Profile[];
  data: ProfileData;
  switchProfile: (id: Profile['id']) => void;
  toggleWatchlist: (mediaId: string) => void;
  queueDownload: (mediaId: string, quality: DownloadItem['quality']) => void;
  removeDownload: (mediaId: string) => void;
  saveProgress: (mediaId: string, seconds: number) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [activeProfileId, setActiveProfileId] = useState<Profile['id']>('alex');
  const [dataByProfile, setDataByProfile] = useState<Record<Profile['id'], ProfileData>>({
    alex: starterData(),
    kids: emptyData(),
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('flixora.mobile.state')
      .then((value) => {
        if (value) {
          const parsed = JSON.parse(value) as Partial<Record<Profile['id'], ProfileData>>;
          setDataByProfile({ alex: parsed.alex ?? starterData(), kids: parsed.kids ?? emptyData() });
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem('flixora.mobile.state', JSON.stringify(dataByProfile)).catch(() => undefined);
  }, [dataByProfile, hydrated]);

  const updateActive = useCallback((update: (current: ProfileData) => ProfileData) => {
    setDataByProfile((current) => ({ ...current, [activeProfileId]: update(current[activeProfileId]) }));
  }, [activeProfileId]);

  const toggleWatchlist = useCallback((mediaId: string) => updateActive((current) => ({
    ...current,
    watchlist: current.watchlist.includes(mediaId)
      ? current.watchlist.filter((id) => id !== mediaId)
      : [...current.watchlist, mediaId],
  })), [updateActive]);

  const queueDownload = useCallback((mediaId: string, quality: DownloadItem['quality']) => updateActive((current) => ({
    ...current,
    downloads: [
      ...current.downloads.filter((item) => item.mediaId !== mediaId),
      { mediaId, quality, state: 'queued', progress: 0 },
    ],
  })), [updateActive]);

  const removeDownload = useCallback((mediaId: string) => updateActive((current) => ({
    ...current,
    downloads: current.downloads.filter((item) => item.mediaId !== mediaId),
  })), [updateActive]);

  const saveProgress = useCallback((mediaId: string, seconds: number) => updateActive((current) => ({
    ...current,
    history: { ...current.history, [mediaId]: Math.max(0, seconds) },
  })), [updateActive]);

  const value = useMemo<AppContextValue>(() => ({
    activeProfile: profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0]!,
    profiles,
    data: dataByProfile[activeProfileId],
    switchProfile: setActiveProfileId,
    toggleWatchlist,
    queueDownload,
    removeDownload,
    saveProgress,
  }), [activeProfileId, dataByProfile, queueDownload, removeDownload, saveProgress, toggleWatchlist]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppState must be used within AppStateProvider');
  return value;
}
