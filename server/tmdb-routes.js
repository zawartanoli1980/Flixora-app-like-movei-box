import { z } from 'zod';

const mediaType = z.enum(['movie', 'tv']);
const page = z.coerce.number().int().min(1).max(500).default(1);
const language = z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).default('en-US');
const region = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default('US');
const includeAdult = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

const trendingSchema = z.object({
  type: z.enum(['all', 'movie', 'tv']).default('all'),
  window: z.enum(['day', 'week']).default('day'),
  language,
  region,
  page,
}).strict();

const searchSchema = z.object({
  q: z.string().trim().min(1).max(120),
  type: z.enum(['multi', 'movie', 'tv']).default('multi'),
  language,
  region,
  page,
  includeAdult,
}).strict();

const discoverSchema = z.object({
  type: mediaType.default('movie'),
  language,
  region,
  page,
  genres: z.string().regex(/^\d+(?:,\d+)*$/).optional(),
  year: z.coerce.number().int().min(1888).max(2100).optional(),
  originalLanguage: z.string().trim().regex(/^[a-z]{2,3}$/).optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  ratingMin: z.coerce.number().min(0).max(10).optional(),
  ratingMax: z.coerce.number().min(0).max(10).optional(),
  sortBy: z.enum([
    'popularity.asc', 'popularity.desc', 'primary_release_date.asc', 'primary_release_date.desc',
    'first_air_date.asc', 'first_air_date.desc', 'vote_average.asc', 'vote_average.desc',
    'vote_count.asc', 'vote_count.desc',
  ]).default('popularity.desc'),
  includeAdult,
}).strict().refine((value) => value.ratingMin === undefined || value.ratingMax === undefined || value.ratingMin <= value.ratingMax, {
  message: 'ratingMin cannot exceed ratingMax',
  path: ['ratingMin'],
});

const identitySchema = z.object({
  type: mediaType,
  tmdbId: z.coerce.number().int().positive(),
}).strict();

const detailQuerySchema = z.object({ language, region }).strict();
const childQuerySchema = z.object({ language }).strict();

function validationError(response, error) {
  return response.status(400).json({
    error: 'Invalid request',
    details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  });
}

function parse(schema, input, response) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    validationError(response, parsed.error);
    return null;
  }
  return parsed.data;
}

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export function registerTmdbRoutes(app, { tmdbService } = {}) {
  const requireTmdb = (_request, response, next) => {
    if (!tmdbService) return response.status(503).json({ error: 'TMDB integration is not configured' });
    return next();
  };

  app.get('/api/v1/tmdb/trending', requireTmdb, asyncRoute(async (request, response) => {
    const query = parse(trendingSchema, request.query, response);
    if (!query) return;
    const result = await tmdbService.getTrending({ mediaType: query.type, ...query });
    response.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return response.json(result);
  }));

  app.get('/api/v1/tmdb/search', requireTmdb, asyncRoute(async (request, response) => {
    const query = parse(searchSchema, request.query, response);
    if (!query) return;
    const result = await tmdbService.search({ query: query.q, mediaType: query.type, ...query });
    response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=60');
    return response.json(result);
  }));

  app.get('/api/v1/tmdb/discover', requireTmdb, asyncRoute(async (request, response) => {
    const query = parse(discoverSchema, request.query, response);
    if (!query) return;
    const result = await tmdbService.discover({
      mediaType: query.type,
      ...query,
      genreIds: query.genres?.split(',').map(Number),
    });
    response.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return response.json(result);
  }));

  app.get('/api/v1/tmdb/:type/:tmdbId', requireTmdb, asyncRoute(async (request, response) => {
    const identity = parse(identitySchema, request.params, response);
    const query = parse(detailQuerySchema, request.query, response);
    if (!identity || !query) return;
    const item = await tmdbService.getDetails(identity.type, identity.tmdbId, query);
    response.set('Cache-Control', 'private, max-age=60');
    return response.json({ item, source: 'tmdb' });
  }));

  app.get('/api/v1/tmdb/:type/:tmdbId/trailers', requireTmdb, asyncRoute(async (request, response) => {
    const identity = parse(identitySchema, request.params, response);
    const query = parse(childQuerySchema, request.query, response);
    if (!identity || !query) return;
    const items = await tmdbService.getTrailers(identity.type, identity.tmdbId, query);
    return response.json({ items, source: 'tmdb' });
  }));

  app.get('/api/v1/tmdb/:type/:tmdbId/cast', requireTmdb, asyncRoute(async (request, response) => {
    const identity = parse(identitySchema, request.params, response);
    const query = parse(childQuerySchema, request.query, response);
    if (!identity || !query) return;
    const credits = await tmdbService.getCast(identity.type, identity.tmdbId, query);
    return response.json({ ...credits, source: 'tmdb' });
  }));
}
