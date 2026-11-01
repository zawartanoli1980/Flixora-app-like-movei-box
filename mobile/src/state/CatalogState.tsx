import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { catalog as fallbackCatalog } from '../data/catalog';
import { dynamicCatalogEnabled, fetchTmdbDetails, fetchTrending, searchTmdb } from '../services/catalogApi';
import type { MediaItem } from '../types';

type CatalogContextValue = {
  items: MediaItem[];
  featured: MediaItem[];
  trending: MediaItem[];
  loading: boolean;
  error: string | null;
  dynamic: boolean;
  refresh: () => Promise<void>;
  search: (query: string) => Promise<MediaItem[]>;
  getMedia: (id: string) => MediaItem | undefined;
  loadDetails: (id: string) => Promise<MediaItem | undefined>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);
const catalogCacheKey = 'flixora.tmdb.catalog.v1';

function mergeCatalog(primary: MediaItem[], fallback: MediaItem[]): MediaItem[] {
  const used = new Set(primary.map((item) => item.id));
  return [...primary, ...fallback.filter((item) => !used.has(item.id))];
}

export function CatalogProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<MediaItem[]>(fallbackCatalog);
  const [loading, setLoading] = useState(dynamicCatalogEnabled);
  const [error, setError] = useState<string | null>(null);
  const [dynamic, setDynamic] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const refresh = useCallback(async () => {
    if (!dynamicCatalogEnabled) return;
    setLoading(true);
    try {
      const result = await fetchTrending({ type: 'all', window: 'day' });
      setItems(mergeCatalog(result.items, fallbackCatalog));
      setDynamic(true);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dynamic catalog is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(catalogCacheKey).then((value) => {
      if (!active || !value) return;
      const cached = JSON.parse(value) as MediaItem[];
      if (Array.isArray(cached) && cached.length) {
        setItems(mergeCatalog(cached, fallbackCatalog));
        setDynamic(true);
      }
    }).catch(() => undefined).finally(() => { if (active) void refresh(); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    const dynamicItems = items.filter((item) => item.id.startsWith('tmdb:')).slice(0, 200);
    if (dynamicItems.length) AsyncStorage.setItem(catalogCacheKey, JSON.stringify(dynamicItems)).catch(() => undefined);
  }, [items]);

  const search = useCallback(async (query: string) => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!dynamicCatalogEnabled || normalized.length < 2) {
      return itemsRef.current.filter((item) => `${item.title} ${item.synopsis} ${item.country} ${item.language}`.toLocaleLowerCase().includes(normalized));
    }
    const result = await searchTmdb(query);
    setItems((current) => mergeCatalog(result.items, current));
    setDynamic(true);
    setError(null);
    return result.items;
  }, []);

  const getMedia = useCallback((id: string) => itemsRef.current.find((item) => item.id === id), []);

  const loadDetails = useCallback(async (id: string) => {
    if (!id.startsWith('tmdb:')) return itemsRef.current.find((item) => item.id === id);
    try {
      const details = await fetchTmdbDetails(id);
      setItems((current) => [details, ...current.filter((item) => item.id !== id)]);
      setDynamic(true);
      setError(null);
      return details;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Title details are unavailable.');
      return itemsRef.current.find((item) => item.id === id);
    }
  }, []);

  const value = useMemo<CatalogContextValue>(() => {
    const ranked = items.filter((item) => item.trendingRank).sort((a, b) => (a.trendingRank ?? 999) - (b.trendingRank ?? 999));
    const featuredItems = items.filter((item) => item.featured).slice(0, 12);
    return {
      items,
      featured: featuredItems.length ? featuredItems : items.slice(0, 5),
      trending: ranked.length ? ranked : items.slice(0, 10),
      loading,
      error,
      dynamic,
      refresh,
      search,
      getMedia,
      loadDetails,
    };
  }, [dynamic, error, getMedia, items, loadDetails, loading, refresh, search]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider');
  return value;
}
