const ALLOWED_LICENSE = /^https?:\/\/creativecommons\.org\/(?:publicdomain|licenses)\//i;
const SAFE_IDENTIFIER = /^[a-zA-Z0-9._-]{1,160}$/;
const OPEN_MOVIE_LICENSE = 'https://creativecommons.org/licenses/by/3.0/';
const FALLBACK_OPEN_MOVIES = [
  {id: 'big-buck-bunny', title: 'Big Buck Bunny', year: 2008, description: 'A gentle giant rabbit turns the tables on three mischievous woodland creatures.', file: 'BigBuckBunny.mp4', image: 'BigBuckBunny.jpg'},
  {id: 'sintel', title: 'Sintel', year: 2010, description: 'A lone warrior searches a dangerous fantasy world for the dragon she once rescued.', file: 'Sintel.mp4', image: 'Sintel.jpg'},
  {id: 'elephants-dream', title: 'Elephants Dream', year: 2006, description: 'Two characters journey through the strange and beautiful machinery of a dreamlike world.', file: 'ElephantsDream.mp4', image: 'ElephantsDream.jpg'},
  {id: 'tears-of-steel', title: 'Tears of Steel', year: 2012, description: 'Scientists and warriors gather in Amsterdam to save the world from destructive robots.', file: 'TearsOfSteel.mp4', image: 'TearsOfSteel.jpg'},
].map((movie, index) => ({
  id: `blender:${movie.id}`,
  providerId: movie.id,
  title: movie.title,
  description: movie.description,
  category: 'Open Movies',
  type: 'Movie',
  genres: ['Open Movie', index % 2 ? 'Fantasy' : 'Animation'],
  year: movie.year,
  rating: 7.5 + index / 10,
  duration: 'Full movie',
  views: 'Open content',
  image: `https://storage.googleapis.com/gtv-videos-bucket/sample/images/${movie.image}`,
  backdrop: `https://storage.googleapis.com/gtv-videos-bucket/sample/images/${movie.image}`,
  licenseUrl: OPEN_MOVIE_LICENSE,
  attribution: `${movie.title} — Blender Foundation Open Movie`,
  audioTracks: ['Original'],
  subtitleTracks: [],
  qualities: ['Auto'],
  sources: [{
    id: `blender-${movie.id}`,
    label: 'Open Movie CDN',
    quality: 'Auto',
    type: 'video/mp4',
    url: `https://storage.googleapis.com/gtv-videos-bucket/sample/${movie.file}`,
    audioLanguages: ['Original'],
    subtitles: [],
    isDemo: true,
  }],
}));

export class PublicMediaApiError extends Error {
  constructor(message, {status = 502, code = 'PUBLIC_MEDIA_ERROR'} = {}) {
    super(message);
    this.name = 'PublicMediaApiError';
    this.status = status;
    this.code = code;
  }
}

function text(value, fallback = '') {
  if (Array.isArray(value)) return String(value[0] ?? fallback);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function description(value) {
  return text(value, 'A freely licensed film from the Internet Archive.')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function fileUrl(identifier, name) {
  const encodedName = name.split('/').map(encodeURIComponent).join('/');
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodedName}`;
}

function chooseVideo(files = []) {
  return files
    .filter((file) => {
      const name = text(file?.name);
      const format = text(file?.format).toLowerCase();
      const size = Number(file?.size || 0);
      return /\.mp4$/i.test(name)
        && (format.includes('mpeg4') || format.includes('h.264') || format.includes('512kb'))
        && (!size || size < 2_500_000_000);
    })
    .sort((a, b) => Number(b.size || 0) - Number(a.size || 0))[0];
}

export function createPublicMediaService({
  fetchImpl = globalThis.fetch,
  baseUrl = 'https://archive.org',
  timeoutMs = 5_000,
  cacheMs = 15 * 60_000,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  let cache = null;

  async function getJson(url, signal) {
    const response = await fetchImpl(url, {
      headers: {'User-Agent': 'Flixora/1.0 public-media-catalog'},
      signal,
    });
    if (!response.ok) throw new PublicMediaApiError('Public media provider is unavailable', {code: 'PUBLIC_MEDIA_UPSTREAM'});
    return response.json();
  }

  return {
    async list({limit = 8} = {}) {
      const safeLimit = Math.max(1, Math.min(12, Number(limit) || 8));
      if (cache && Date.now() - cache.createdAt < cacheMs && cache.items.length >= safeLimit) {
        return {items: cache.items.slice(0, safeLimit), source: 'internet-archive', cached: true};
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const query = 'mediatype:movies AND format:MPEG4 AND licenseurl:creativecommons.org*';
        const params = new URLSearchParams({
          q: query,
          'fl[]': ['identifier', 'title', 'description', 'date', 'year', 'licenseurl', 'downloads'],
          rows: String(Math.max(safeLimit * 2, 16)),
          page: '1',
          output: 'json',
          sort: ['downloads desc'],
        });
        const search = await getJson(`${normalizedBaseUrl}/advancedsearch.php?${params}`, controller.signal);
        const docs = Array.isArray(search?.response?.docs) ? search.response.docs : [];
        const licensed = docs.filter((doc) => SAFE_IDENTIFIER.test(text(doc.identifier)) && ALLOWED_LICENSE.test(text(doc.licenseurl)));
        const results = await Promise.allSettled(licensed.slice(0, safeLimit * 2).map(async (doc, index) => {
          const identifier = text(doc.identifier);
          const metadata = await getJson(`${normalizedBaseUrl}/metadata/${encodeURIComponent(identifier)}`, controller.signal);
          const licenseUrl = text(metadata?.metadata?.licenseurl, text(doc.licenseurl));
          if (!ALLOWED_LICENSE.test(licenseUrl)) return null;
          const video = chooseVideo(metadata?.files);
          if (!video) return null;
          const title = text(metadata?.metadata?.title, text(doc.title, identifier));
          return {
            id: `archive:${identifier}`,
            providerId: identifier,
            title,
            description: description(metadata?.metadata?.description || doc.description),
            category: 'Public Domain',
            type: 'Movie',
            genres: ['Classic', 'Free & Legal'],
            year: Number(text(metadata?.metadata?.year, text(doc.year))) || undefined,
            rating: Number((7.1 + index % 15 / 10).toFixed(1)),
            duration: 'Full movie',
            views: Number(doc.downloads || 0).toLocaleString('en-US'),
            image: `${normalizedBaseUrl}/services/img/${encodeURIComponent(identifier)}`,
            backdrop: `${normalizedBaseUrl}/services/img/${encodeURIComponent(identifier)}`,
            licenseUrl,
            attribution: `${title} — Internet Archive (${licenseUrl})`,
            audioTracks: ['Original'],
            subtitleTracks: [],
            qualities: ['Auto'],
            sources: [{
              id: `archive-${identifier}`,
              label: 'Internet Archive',
              quality: 'Auto',
              type: 'video/mp4',
              url: fileUrl(identifier, text(video.name)),
              audioLanguages: ['Original'],
              subtitles: [],
            }],
          };
        }));
        const items = results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []).slice(0, safeLimit);
        cache = {createdAt: Date.now(), items};
        return {items, source: 'internet-archive', cached: false};
      } catch (error) {
        const items = FALLBACK_OPEN_MOVIES.slice(0, safeLimit);
        cache = {createdAt: Date.now(), items};
        return {
          items,
          source: 'blender-open-movies',
          cached: false,
          fallback: true,
          providerStatus: error instanceof PublicMediaApiError ? error.code : error?.name === 'AbortError' ? 'PUBLIC_MEDIA_TIMEOUT' : 'PUBLIC_MEDIA_NETWORK',
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
