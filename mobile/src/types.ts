export type Profile = {
  id: 'alex' | 'kids';
  name: string;
  isKids: boolean;
  maxAgeRating: number;
};

export type StreamSource = {
  id: string;
  label: string;
  url: string;
  resolution: '480p' | '720p' | '1080p' | '4K';
  protocol: 'HLS' | 'DASH' | 'MP4';
  speed: 'Standard' | 'Fast' | 'Ultra';
};

export type Episode = {
  id: string;
  number: number;
  title: string;
  synopsis: string;
  duration: string;
  thumbnail: string;
  sources: StreamSource[];
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type MediaItem = {
  id: string;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  imdbId?: string | null;
  title: string;
  synopsis: string;
  year: number;
  kind: 'Movie' | 'TV Series' | 'Anime' | 'Documentary';
  genre: string;
  genres?: string[];
  country: string;
  countries?: string[];
  language: string;
  originalLanguage?: string;
  rating: number;
  ratingCount?: number;
  popularity?: number;
  ageRating: number;
  duration: string;
  durationSeconds: number;
  poster: string;
  backdrop: string;
  sources: StreamSource[];
  featured?: boolean;
  trendingRank?: number;
  quality: 'HD' | '4K';
  cast: string[];
  castDetails?: Array<{ id: number; name: string; character: string; photo: string }>;
  director: string;
  trailerUrl?: string | null;
  trailers?: Array<{ id: string; name: string; type: string; provider: string; key: string; official: boolean; publishedAt: string | null; url: string }>;
  episodes?: Episode[];
  reviews: Review[];
};

export type DownloadItem = {
  mediaId: string;
  quality: '480p' | '720p' | '1080p' | '4K';
  state: 'queued' | 'paused' | 'ready';
  progress: number;
};

