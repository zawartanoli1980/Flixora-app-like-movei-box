import type { MediaItem } from '../types';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export type CatalogPage = {
  items: MediaItem[];
  page: number;
  totalPages: number;
  totalResults: number;
  source: 'tmdb';
};

export type DiscoverFilters = {
  type?: 'movie' | 'tv';
  genres?: number[];
  year?: number;
  originalLanguage?: string;
  country?: string;
  ratingMin?: number;
  ratingMax?: number;
  sortBy?: 'popularity.asc' | 'popularity.desc' | 'primary_release_date.asc' | 'primary_release_date.desc' | 'first_air_date.asc' | 'first_air_date.desc' | 'vote_average.asc' | 'vote_average.desc' | 'vote_count.asc' | 'vote_count.desc';
  page?: number;
};

function endpoint(path: string, params: Record<string, string | number | boolean | undefined> = {}): string {
  if (!apiBaseUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  const query = Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${apiBaseUrl}${path}${query ? `?${query}` : ''}`;
}

async function request<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint(path, params), { headers: { Accept: 'application/json' }, signal: controller.signal });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `Catalog request failed with status ${response.status}`);
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Catalog request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function tmdbIdentity(id: string): { mediaType: 'movie' | 'tv'; tmdbId: number } | null {
  const match = /^tmdb:(movie|tv):(\d+)$/.exec(id);
  return match ? { mediaType: match[1] as 'movie' | 'tv', tmdbId: Number(match[2]) } : null;
}

export const dynamicCatalogEnabled = Boolean(apiBaseUrl);

export function fetchTrending({ type = 'all', window = 'day', page = 1 }:
  { type?: 'all' | 'movie' | 'tv'; window?: 'day' | 'week'; page?: number } = {}): Promise<CatalogPage> {
  return request('/api/v1/tmdb/trending', { type, window, page });
}

export async function fetchTmdbDetails(id: string): Promise<MediaItem> {
  const identity = tmdbIdentity(id);
  if (!identity) throw new Error('This item is not a TMDB catalog item.');
  const result = await request<{ item: MediaItem }>(`/api/v1/tmdb/${identity.mediaType}/${identity.tmdbId}`);
  return result.item;
}

export function searchTmdb(query: string, { type = 'multi', page = 1 }:
  { type?: 'multi' | 'movie' | 'tv'; page?: number } = {}): Promise<CatalogPage> {
  return request('/api/v1/tmdb/search', { q: query, type, page, includeAdult: false });
}

export function discoverTmdb(filters: DiscoverFilters = {}): Promise<CatalogPage> {
  return request('/api/v1/tmdb/discover', {
    type: filters.type ?? 'movie',
    genres: filters.genres?.join(','),
    year: filters.year,
    originalLanguage: filters.originalLanguage,
    country: filters.country,
    ratingMin: filters.ratingMin,
    ratingMax: filters.ratingMax,
    sortBy: filters.sortBy,
    page: filters.page,
    includeAdult: false,
  });
}
