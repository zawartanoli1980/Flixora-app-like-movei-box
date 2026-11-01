const genreNames = new Map([
  [12, 'Adventure'], [14, 'Fantasy'], [16, 'Animation'], [18, 'Drama'], [27, 'Horror'],
  [28, 'Action'], [35, 'Comedy'], [36, 'History'], [37, 'Western'], [53, 'Thriller'],
  [80, 'Crime'], [99, 'Documentary'], [878, 'Sci-Fi'], [9648, 'Mystery'], [10402, 'Music'],
  [10749, 'Romance'], [10751, 'Family'], [10752, 'War'], [10759, 'Action & Adventure'],
  [10762, 'Kids'], [10763, 'News'], [10764, 'Reality'], [10765, 'Sci-Fi & Fantasy'],
  [10766, 'Soap'], [10767, 'Talk'], [10768, 'War & Politics'], [10770, 'TV Movie'],
]);

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

export class TmdbApiError extends Error {
  constructor(message, { status = 502, code = 'TMDB_UPSTREAM_ERROR' } = {}) {
    super(message);
    this.name = 'TmdbApiError';
    this.status = status;
    this.code = code;
  }
}

function assertMediaType(mediaType, { allowAll = false, allowMulti = false } = {}) {
  const allowed = ['movie', 'tv', ...(allowAll ? ['all'] : []), ...(allowMulti ? ['multi'] : [])];
  if (!allowed.includes(mediaType)) throw new TypeError(`mediaType must be ${allowed.join(', ')}`);
}

function imageUrl(baseUrl, size, path) {
  return path ? `${baseUrl}/${size}${path}` : '';
}

function displayLanguage(code) {
  if (!code) return 'Unknown';
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function formatDuration(minutes, fallback = '') {
  if (!Number.isFinite(minutes) || minutes <= 0) return fallback;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours}h${remaining ? ` ${remaining}m` : ''}` : `${remaining}m`;
}

function normalizeGenres(raw) {
  if (Array.isArray(raw.genres)) return raw.genres.map((genre) => genre.name).filter(Boolean);
  return (raw.genre_ids ?? []).map((id) => genreNames.get(id)).filter(Boolean);
}

function normalizeKind(mediaType, genreIds, originalLanguage) {
  if (genreIds.includes(99)) return 'Documentary';
  if (genreIds.includes(16) && originalLanguage === 'ja') return 'Anime';
  return mediaType === 'tv' ? 'TV Series' : 'Movie';
}

function normalizeTrailer(video) {
  const url = video.site === 'YouTube'
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(video.key)}`
    : video.site === 'Vimeo' ? `https://vimeo.com/${encodeURIComponent(video.key)}` : null;
  return {
    id: video.id,
    name: video.name,
    type: video.type,
    provider: video.site,
    key: video.key,
    official: Boolean(video.official),
    publishedAt: video.published_at ?? null,
    url,
  };
}

function selectTrailer(videos = []) {
  const playable = videos.filter((video) => video.key && ['YouTube', 'Vimeo'].includes(video.site));
  return playable.sort((a, b) => {
    const score = (video) => (video.type === 'Trailer' ? 4 : video.type === 'Teaser' ? 2 : 0) + (video.official ? 1 : 0);
    return score(b) - score(a);
  })[0];
}

function certificationToAge(certification) {
  const value = String(certification ?? '').toUpperCase().replace(/\s/g, '');
  const known = {
    G: 0, TVY: 0, TVG: 0, PG: 7, TVY7: 7, TVPG: 7,
    PG13: 13, 'PG-13': 13, TV14: 14, R: 17, NC17: 18, 'NC-17': 18, TVMA: 18,
  };
  if (known[value] !== undefined) return known[value];
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(18, Math.max(0, number)) : 18;
}

function extractAgeRating(raw, mediaType, region) {
  if (mediaType === 'movie') {
    const releases = raw.release_dates?.results?.find((entry) => entry.iso_3166_1 === region)?.release_dates ?? [];
    const certification = releases.find((entry) => entry.certification)?.certification;
    return certificationToAge(certification);
  }
  const rating = raw.content_ratings?.results?.find((entry) => entry.iso_3166_1 === region)?.rating;
  return certificationToAge(rating);
}

function resolveMediaType(raw, fallback) {
  const mediaType = raw.media_type ?? fallback;
  return mediaType === 'movie' || mediaType === 'tv' ? mediaType : null;
}

export function normalizeTmdbMedia(raw, {
  mediaType: fallbackMediaType,
  imageBaseUrl = 'https://image.tmdb.org/t/p',
  region = 'US',
  rank,
  sourceMapper,
} = {}) {
  const mediaType = resolveMediaType(raw, fallbackMediaType);
  if (!mediaType) return null;
  const title = mediaType === 'movie' ? raw.title : raw.name;
  if (!raw.id || !title) return null;
  const date = mediaType === 'movie' ? raw.release_date : raw.first_air_date;
  const genres = normalizeGenres(raw);
  const genreIds = raw.genre_ids ?? raw.genres?.map((genre) => genre.id) ?? [];
  const runtime = mediaType === 'movie' ? raw.runtime : raw.episode_run_time?.[0];
  const countries = raw.production_countries?.map((country) => country.iso_3166_1)
    ?? raw.origin_country ?? [];
  const trailer = selectTrailer(raw.videos?.results ?? []);
  const castDetails = (raw.credits?.cast ?? []).slice(0, 16).map((person) => ({
    id: person.id,
    name: person.name,
    character: person.character ?? '',
    photo: imageUrl(imageBaseUrl, 'w185', person.profile_path),
  }));
  const director = mediaType === 'movie'
    ? raw.credits?.crew?.find((person) => person.job === 'Director')?.name
    : raw.created_by?.[0]?.name;
  const sourceContext = { tmdbId: raw.id, mediaType };
  const sources = sourceMapper?.map(sourceContext) ?? [];
  const durationFallback = mediaType === 'tv' && raw.number_of_episodes
    ? `${raw.number_of_episodes} episode${raw.number_of_episodes === 1 ? '' : 's'}` : '';
  return {
    id: `tmdb:${mediaType}:${raw.id}`,
    tmdbId: raw.id,
    mediaType,
    imdbId: raw.imdb_id ?? raw.external_ids?.imdb_id ?? null,
    title,
    synopsis: raw.overview ?? '',
    year: Number.parseInt(String(date ?? '').slice(0, 4), 10) || 0,
    kind: normalizeKind(mediaType, genreIds, raw.original_language),
    genre: genres[0] ?? 'Other',
    genres,
    country: countries[0] ?? region,
    countries,
    language: displayLanguage(raw.original_language),
    originalLanguage: raw.original_language ?? '',
    rating: Number((raw.vote_average ?? 0).toFixed(1)),
    ratingCount: raw.vote_count ?? 0,
    popularity: raw.popularity ?? 0,
    ageRating: extractAgeRating(raw, mediaType, region),
    duration: formatDuration(runtime, durationFallback),
    durationSeconds: Number.isFinite(runtime) ? runtime * 60 : 0,
    quality: 'HD',
    poster: imageUrl(imageBaseUrl, 'w780', raw.poster_path),
    backdrop: imageUrl(imageBaseUrl, 'original', raw.backdrop_path ?? raw.poster_path),
    trailerUrl: trailer ? normalizeTrailer(trailer).url : null,
    trailers: (raw.videos?.results ?? []).map(normalizeTrailer).filter((video) => video.url),
    cast: castDetails.map((person) => person.name),
    castDetails,
    director: director ?? 'Unknown',
    sources,
    reviews: [],
    featured: rank !== undefined && rank <= 5,
    ...(rank !== undefined ? { trendingRank: rank } : {}),
  };
}

function listResult(payload, options) {
  const items = (payload.results ?? []).map((item, index) => normalizeTmdbMedia(item, {
    ...options,
    rank: options.includeRank ? (payload.page - 1) * 20 + index + 1 : undefined,
  })).filter(Boolean);
  return {
    items,
    page: payload.page ?? 1,
    totalPages: Math.min(payload.total_pages ?? 1, 500),
    totalResults: payload.total_results ?? items.length,
    source: 'tmdb',
  };
}

export function createTmdbService({
  accessToken,
  fetchImpl = globalThis.fetch,
  baseUrl = 'https://api.themoviedb.org/3',
  imageBaseUrl = 'https://image.tmdb.org/t/p',
  defaultLanguage = 'en-US',
  defaultRegion = 'US',
  sourceMapper,
  timeoutMs = 8_000,
  cacheTtlMs = 300_000,
  maxRetries = 2,
} = {}) {
  if (!accessToken) throw new Error('TMDB access token is required');
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
  const apiBase = `${baseUrl.replace(/\/$/, '')}/`;
  const cache = new Map();
  const inFlight = new Map();

  const request = async (path, params = {}, { cacheable = true } = {}) => {
    const url = new URL(path.replace(/^\//, ''), apiBase);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    const cacheKey = url.toString();
    const cached = cache.get(cacheKey);
    if (cacheable && cached?.expiresAt > Date.now()) return cached.value;
    if (cacheable && inFlight.has(cacheKey)) return inFlight.get(cacheKey);

    const execute = async () => {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(url, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            signal: controller.signal,
          });
          const payload = await response.json().catch(() => ({}));
          if (response.ok) {
            if (cacheable) {
              if (cache.size >= 250) cache.delete(cache.keys().next().value);
              cache.set(cacheKey, { value: payload, expiresAt: Date.now() + cacheTtlMs });
            }
            return payload;
          }
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable && attempt < maxRetries) {
            const retryAfter = Number(response.headers.get('retry-after')) || 0;
            await new Promise((resolve) => setTimeout(resolve, Math.min(2_000, Math.max(200 * (attempt + 1), retryAfter * 1_000))));
            continue;
          }
          throw new TmdbApiError(payload.status_message ?? 'TMDB request failed', {
            status: response.status === 404 ? 404 : 502,
            code: payload.status_code ? `TMDB_${payload.status_code}` : 'TMDB_UPSTREAM_ERROR',
          });
        } catch (error) {
          if (error instanceof TmdbApiError) throw error;
          if (attempt < maxRetries) continue;
          throw new TmdbApiError(error?.name === 'AbortError' ? 'TMDB request timed out' : 'TMDB is unavailable');
        } finally {
          clearTimeout(timeout);
        }
      }
      throw new TmdbApiError('TMDB is unavailable');
    };
    const promise = execute();
    if (cacheable) inFlight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      inFlight.delete(cacheKey);
    }
  };

  const normalizeOptions = (mediaType, region, includeRank = false) => ({ mediaType, imageBaseUrl, region, sourceMapper, includeRank });

  return Object.freeze({
    async getTrending({ mediaType = 'all', window = 'day', language = defaultLanguage, page = 1, region = defaultRegion } = {}) {
      assertMediaType(mediaType, { allowAll: true });
      if (!['day', 'week'].includes(window)) throw new TypeError('window must be day or week');
      const payload = await request(`trending/${mediaType}/${window}`, { language, page });
      return listResult(payload, normalizeOptions(mediaType === 'all' ? undefined : mediaType, region, true));
    },

    async getDetails(mediaType, tmdbId, { language = defaultLanguage, region = defaultRegion } = {}) {
      assertMediaType(mediaType);
      const append = mediaType === 'movie'
        ? 'videos,credits,external_ids,release_dates'
        : 'videos,credits,external_ids,content_ratings';
      const payload = await request(`${mediaType}/${tmdbId}`, { language, append_to_response: append });
      return normalizeTmdbMedia(payload, normalizeOptions(mediaType, region));
    },

    async getTrailers(mediaType, tmdbId, { language = defaultLanguage } = {}) {
      assertMediaType(mediaType);
      const payload = await request(`${mediaType}/${tmdbId}/videos`, { language });
      return (payload.results ?? []).map(normalizeTrailer).filter((video) => video.url);
    },

    async getCast(mediaType, tmdbId, { language = defaultLanguage } = {}) {
      assertMediaType(mediaType);
      const payload = await request(`${mediaType}/${tmdbId}/credits`, { language });
      return {
        cast: (payload.cast ?? []).slice(0, 40).map((person) => ({ id: person.id, name: person.name, character: person.character ?? '', photo: imageUrl(imageBaseUrl, 'w185', person.profile_path) })),
        crew: (payload.crew ?? []).slice(0, 40).map((person) => ({ id: person.id, name: person.name, job: person.job ?? '', department: person.department ?? '', photo: imageUrl(imageBaseUrl, 'w185', person.profile_path) })),
      };
    },

    async search({ query, mediaType = 'multi', language = defaultLanguage, page = 1, includeAdult = false, region = defaultRegion } = {}) {
      assertMediaType(mediaType, { allowMulti: true });
      if (!query?.trim()) throw new TypeError('A search query is required');
      const payload = await request(`search/${mediaType}`, { query: query.trim(), language, page, include_adult: includeAdult, region });
      return listResult(payload, normalizeOptions(mediaType === 'multi' ? undefined : mediaType, region));
    },

    async discover({
      mediaType = 'movie', language = defaultLanguage, page = 1, region = defaultRegion,
      genreIds, year, originalLanguage, country, ratingMin, ratingMax,
      sortBy = 'popularity.desc', includeAdult = false,
    } = {}) {
      assertMediaType(mediaType);
      const payload = await request(`discover/${mediaType}`, {
        language,
        page,
        region,
        with_genres: genreIds,
        ...(mediaType === 'movie' && year ? { primary_release_year: year } : {}),
        ...(mediaType === 'tv' && year ? { first_air_date_year: year } : {}),
        with_original_language: originalLanguage,
        with_origin_country: country,
        'vote_average.gte': ratingMin,
        'vote_average.lte': ratingMax,
        sort_by: sortBy,
        include_adult: includeAdult,
      });
      return listResult(payload, normalizeOptions(mediaType, region));
    },

    clearCache() {
      cache.clear();
    },
  });
}
