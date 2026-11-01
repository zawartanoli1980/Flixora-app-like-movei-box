import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceMapper } from './source-mapper.js';
import { createTmdbService } from './tmdb.js';

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

test('source mapper renders only configured HTTPS source templates', () => {
  const mapper = createSourceMapper({ definitions: [
    { id: 'one', label: 'Server 1', template: 'https://stream.test/{mediaType}/{tmdbId}/video.mp4', resolution: '1080p', speed: 'Fast' },
    { id: 'cdn', label: 'Fast CDN', template: 'https://cdn.test/{mediaType}/{tmdbId}/s{season}/e{episode}.m3u8', resolution: '4K', protocol: 'HLS', speed: 'Ultra' },
  ] });
  const movieSources = mapper.map({ mediaType: 'movie', tmdbId: 42 });
  assert.equal(movieSources.length, 1);
  assert.equal(movieSources[0].url, 'https://stream.test/movie/42/video.mp4');
  assert.equal(movieSources[0].protocol, 'MP4');

  const episodeSources = mapper.map({ mediaType: 'tv', tmdbId: 99, seasonNumber: 2, episodeNumber: 4 });
  assert.equal(episodeSources[1].url, 'https://cdn.test/tv/99/s2/e4.m3u8');
  assert.throws(() => createSourceMapper({ definitions: [
    { id: 'unsafe', label: 'Unsafe', template: 'http://stream.test/{tmdbId}.mp4' },
  ] }), /HTTPS/);
});

test('TMDB trending responses normalize movies and TV into the Flixora schema', async () => {
  const requests = [];
  const sourceMapper = createSourceMapper({ definitions: [
    { id: 'one', label: 'Server 1', template: 'https://stream.test/{mediaType}/{tmdbId}.mp4', resolution: '1080p', speed: 'Standard' },
  ] });
  const service = createTmdbService({
    accessToken: 'secret-token',
    sourceMapper,
    fetchImpl: async (url, options) => {
      requests.push({ url: url.toString(), options });
      return jsonResponse({
        page: 1,
        total_pages: 1,
        total_results: 3,
        results: [
          { id: 10, media_type: 'movie', title: 'Orbit', overview: 'A mission.', release_date: '2025-04-03', original_language: 'en', origin_country: ['US'], genre_ids: [878], vote_average: 8.26, vote_count: 99, popularity: 500, poster_path: '/poster.jpg', backdrop_path: '/backdrop.jpg' },
          { id: 11, media_type: 'tv', name: 'Samurai', overview: 'A warrior.', first_air_date: '2024-01-01', original_language: 'ja', origin_country: ['JP'], genre_ids: [16], vote_average: 7.8, vote_count: 50, popularity: 200, poster_path: '/tv.jpg' },
          { id: 12, media_type: 'person', name: 'Not media' },
        ],
      });
    },
  });

  const result = await service.getTrending({ mediaType: 'all', window: 'week', page: 1 });
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].id, 'tmdb:movie:10');
  assert.equal(result.items[0].tmdbId, 10);
  assert.equal(result.items[0].title, 'Orbit');
  assert.equal(result.items[0].kind, 'Movie');
  assert.equal(result.items[0].genre, 'Sci-Fi');
  assert.equal(result.items[0].year, 2025);
  assert.equal(result.items[0].trendingRank, 1);
  assert.equal(result.items[0].poster, 'https://image.tmdb.org/t/p/w780/poster.jpg');
  assert.equal(result.items[0].sources[0].url, 'https://stream.test/movie/10.mp4');
  assert.equal(result.items[1].kind, 'Anime');
  assert.match(requests[0].url, /trending\/all\/week/);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer secret-token');
});

test('TMDB details include trailers, cast, director and regional certification', async () => {
  const service = createTmdbService({
    accessToken: 'secret-token',
    fetchImpl: async () => jsonResponse({
      id: 77,
      title: 'The Voyage',
      overview: 'Beyond the stars.',
      release_date: '2026-02-10',
      original_language: 'en',
      runtime: 125,
      genres: [{ id: 12, name: 'Adventure' }],
      production_countries: [{ iso_3166_1: 'GB' }],
      vote_average: 8.1,
      vote_count: 1200,
      poster_path: '/voyage.jpg',
      backdrop_path: '/space.jpg',
      imdb_id: 'tt1234567',
      videos: { results: [
        { id: 'teaser', key: 'teaser-key', site: 'YouTube', type: 'Teaser', name: 'Teaser', official: true },
        { id: 'trailer', key: 'trailer-key', site: 'YouTube', type: 'Trailer', name: 'Official Trailer', official: true },
      ] },
      credits: {
        cast: [{ id: 1, name: 'A. Actor', character: 'Captain', profile_path: '/actor.jpg' }],
        crew: [{ id: 2, name: 'D. Director', job: 'Director' }],
      },
      release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG-13' }] }] },
    }),
  });

  const item = await service.getDetails('movie', 77, { region: 'US' });
  assert.equal(item.durationSeconds, 7_500);
  assert.equal(item.duration, '2h 5m');
  assert.equal(item.ageRating, 13);
  assert.equal(item.trailerUrl, 'https://www.youtube.com/watch?v=trailer-key');
  assert.deepEqual(item.cast, ['A. Actor']);
  assert.equal(item.director, 'D. Director');
  assert.equal(item.imdbId, 'tt1234567');
});

test('TMDB search and discover map advanced filters to safe query parameters', async () => {
  const urls = [];
  const service = createTmdbService({
    accessToken: 'secret-token',
    fetchImpl: async (url) => {
      urls.push(new URL(url));
      return jsonResponse({ page: 1, total_pages: 1, total_results: 0, results: [] });
    },
  });
  await service.search({ query: 'Dune & Sand', mediaType: 'multi', includeAdult: false });
  await service.discover({ mediaType: 'movie', genreIds: [12, 878], year: 2024, country: 'US', ratingMin: 7.5, ratingMax: 9, sortBy: 'vote_average.desc' });

  assert.equal(urls[0].pathname, '/3/search/multi');
  assert.equal(urls[0].searchParams.get('query'), 'Dune & Sand');
  assert.equal(urls[1].pathname, '/3/discover/movie');
  assert.equal(urls[1].searchParams.get('with_genres'), '12,878');
  assert.equal(urls[1].searchParams.get('primary_release_year'), '2024');
  assert.equal(urls[1].searchParams.get('vote_average.gte'), '7.5');
  assert.equal(urls[1].searchParams.get('sort_by'), 'vote_average.desc');
});
