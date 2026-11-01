import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { catalogQuery, filtersSchema } from './catalog-query.js';
import { filterDemoCatalog } from './demo-catalog.js';
import { registerTmdbRoutes } from './tmdb-routes.js';

const uuidSchema = z.string().uuid();
const historySchema = z.object({
  episodeId: uuidSchema.nullable().optional().default(null),
  positionSeconds: z.number().finite().min(0),
  durationSeconds: z.number().finite().positive(),
  completed: z.boolean().optional().default(false),
  expectedVersion: z.number().int().min(0),
  eventId: uuidSchema,
}).strict().refine((value) => value.positionSeconds <= value.durationSeconds, {
  message: 'positionSeconds cannot exceed durationSeconds',
  path: ['positionSeconds'],
});
const reviewSchema = z.object({
  stars: z.number().int().min(1).max(5),
  review: z.string().trim().min(1).max(2000).nullable().optional().default(null),
}).strict();
const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  parentId: uuidSchema.nullable().optional().default(null),
}).strict();
const playlistSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional().default(null),
  public: z.boolean().optional().default(false),
}).strict();
const profileCreateSchema = z.object({
  name: z.string().trim().min(1).max(40),
  avatarUrl: z.string().url().max(2048).nullable().optional().default(null),
  isKids: z.boolean().optional().default(false),
  maxAgeRating: z.number().int().min(0).max(18).optional(),
}).strict().refine((value) => !value.isKids || value.maxAgeRating === undefined || value.maxAgeRating <= 12, {
  message: 'Kids profiles cannot exceed age rating 12',
  path: ['maxAgeRating'],
});
const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  isKids: z.boolean().optional(),
  maxAgeRating: z.number().int().min(0).max(18).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one profile field is required',
}).refine((value) => value.isKids !== true || value.maxAgeRating === undefined || value.maxAgeRating <= 12, {
  message: 'Kids profiles cannot exceed age rating 12',
  path: ['maxAgeRating'],
});
const playbackSchema = z.object({
  mediaId: uuidSchema,
  episodeId: uuidSchema.nullable().optional().default(null),
  unlockToken: z.string().min(20).max(4096).optional(),
}).strict();
const pinSetSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must contain 4 to 8 digits'),
  currentPin: z.string().regex(/^\d{4,8}$/).optional(),
}).strict();
const pinUnlockSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must contain 4 to 8 digits'),
}).strict();
const viewingEventSchema = z.object({
  id: uuidSchema,
  mediaId: uuidSchema,
  episodeId: uuidSchema.nullable().optional().default(null),
  deviceId: uuidSchema.nullable().optional().default(null),
  sessionId: uuidSchema.nullable().optional().default(null),
  eventType: z.enum(['impression', 'start', 'progress', 'pause', 'complete', 'dismiss']),
  positionSeconds: z.number().finite().min(0).nullable().optional().default(null),
  occurredAt: z.string().datetime({ offset: true }),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
}).strict();

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function validationError(response, error) {
  return response.status(400).json({
    error: 'Invalid request',
    details: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

function parseUuid(value, response, field = 'id') {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    validationError(response, new z.ZodError(parsed.error.issues.map((issue) => ({ ...issue, path: [field] }))));
    return null;
  }
  return parsed.data;
}

function corsMiddleware(origins) {
  const allowed = new Set(origins);
  return (request, response, next) => {
    const origin = request.get('origin');
    if (!origin) return next();
    if (!allowed.has(origin)) {
      return response.status(403).json({ error: 'Origin is not allowed' });
    }
    response.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Request-ID',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    return next();
  };
}

function authMiddleware(authVerifier) {
  return asyncRoute(async (request, response, next) => {
    if (!authVerifier) return response.status(503).json({ error: 'Authentication is not configured' });
    const token = request.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) return response.status(401).json({ error: 'Bearer token required' });
    try {
      const payload = await authVerifier(token);
      if (!payload?.sub) return response.status(401).json({ error: 'Invalid token subject' });
      request.auth = { subject: payload.sub, claims: payload };
      return next();
    } catch {
      return response.status(401).json({ error: 'Invalid or expired token' });
    }
  });
}

function databaseMiddleware(pool) {
  return (_request, response, next) => {
    if (!pool) return response.status(503).json({ error: 'Database is not configured' });
    return next();
  };
}

async function findOwnedProfile(pool, profileId, authSubject) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.name, p.is_kids, p.max_age_rating,
      p.avatar_url, p.pin_hash IS NOT NULL AS pin_protected
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND u.auth_subject = $2 AND u.deleted_at IS NULL`,
    [profileId, authSubject],
  );
  return result.rows[0] ?? null;
}

async function getPinState(pool, profileId) {
  const result = await pool.query(
    `SELECT pin_hash, pin_failed_attempts, pin_locked_until
      FROM profiles WHERE id = $1`,
    [profileId],
  );
  return result.rows[0] ?? null;
}

async function recordPinFailure(pool, profileId) {
  const result = await pool.query(
    `UPDATE profiles SET
      pin_failed_attempts = pin_failed_attempts + 1,
      pin_locked_until = CASE
        WHEN pin_failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
        ELSE pin_locked_until
      END
      WHERE id = $1
      RETURNING pin_failed_attempts, pin_locked_until`,
    [profileId],
  );
  return result.rows[0];
}

async function mediaAllowedForProfile(pool, mediaId, profile) {
  const result = await pool.query(
    `SELECT 1 FROM media WHERE id = $1 AND published = true
      AND age_rating <= $2`,
    [mediaId, profile.max_age_rating],
  );
  return Boolean(result.rowCount);
}

function profileOwnershipMiddleware(pool) {
  return asyncRoute(async (request, response, next) => {
    const profileId = parseUuid(request.params.profileId, response, 'profileId');
    if (!profileId) return undefined;
    const profile = await findOwnedProfile(pool, profileId, request.auth.subject);
    if (!profile) return response.status(404).json({ error: 'Profile not found' });
    request.profile = profile;
    return next();
  });
}

export function createApp({
  pool = null,
  authVerifier = null,
  playbackSigner = null,
  pinService = null,
  tmdbService = null,
  config = {},
  logger = console,
} = {}) {
  const runtime = {
    webOrigins: [],
    defaultCountry: 'US',
    demoMode: false,
    ...config,
  };
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    request.id = randomUUID();
    response.set('X-Request-ID', request.id);
    next();
  });
  app.use(helmet());
  app.use(corsMiddleware(runtime.webOrigins));
  app.use(express.json({ limit: '32kb' }));
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ error: 'Too many requests' }),
  }));

  const requireAuth = authMiddleware(authVerifier);
  const requireDatabase = databaseMiddleware(pool);
  const requireOwnedProfile = profileOwnershipMiddleware(pool);

  const healthHandler = (_request, response) => response.json({
    status: 'ok',
    mode: runtime.demoMode ? 'demo' : 'standard',
  });
  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  app.get('/api/v1/readiness', asyncRoute(async (_request, response) => {
    if (!pool) {
      if (runtime.demoMode) {
        return response.json({
          status: 'ready',
          mode: 'demo',
          database: false,
          authentication: Boolean(authVerifier),
          playbackSigning: Boolean(playbackSigner),
          profilePinUnlock: Boolean(pinService),
          tmdb: Boolean(tmdbService),
        });
      }
      return response.status(503).json({
        status: 'not_ready',
        reason: 'Database is not configured',
      });
    }
    await pool.query('SELECT 1');
    return response.json({
      status: authVerifier ? 'ready' : 'degraded',
      mode: 'standard',
      database: true,
      authentication: Boolean(authVerifier),
      playbackSigning: Boolean(playbackSigner),
      profilePinUnlock: Boolean(pinService),
      tmdb: Boolean(tmdbService),
    });
  }));

  const catalogHandler = asyncRoute(async (request, response) => {
    const parsed = filtersSchema.safeParse(request.query);
    if (!parsed.success) return validationError(response, parsed.error);
    if (!pool) {
      if (!runtime.demoMode) return response.status(503).json({ error: 'Database is not configured' });
      const items = filterDemoCatalog(parsed.data);
      return response.json({
        items,
        page: parsed.data.page,
        limit: parsed.data.limit,
        mode: 'demo',
      });
    }
    const result = await pool.query(catalogQuery(parsed.data));
    return response.json({ items: result.rows, page: parsed.data.page, limit: parsed.data.limit });
  });
  app.get('/api/media', catalogHandler);
  app.get('/api/v1/media', catalogHandler);
  registerTmdbRoutes(app, { tmdbService });

  app.get('/api/v1/media/:mediaId/episodes', requireDatabase, asyncRoute(async (request, response) => {
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!mediaId) return undefined;
    const result = await pool.query(
      `SELECT id, media_id, season_number, episode_number, title, synopsis,
        duration_seconds, released_at
        FROM episodes WHERE media_id = $1
        ORDER BY season_number, episode_number`,
      [mediaId],
    );
    return response.json({ items: result.rows });
  }));

  app.get('/api/v1/media/:mediaId/reviews', requireDatabase, asyncRoute(async (request, response) => {
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!mediaId) return undefined;
    const result = await pool.query(
      `SELECT r.stars, r.review, r.updated_at, p.name AS author, p.avatar_url
        FROM ratings r JOIN profiles p ON p.id = r.profile_id
        WHERE r.media_id = $1 AND r.moderation_status = 'approved'
        ORDER BY r.updated_at DESC LIMIT 100`,
      [mediaId],
    );
    return response.json({ items: result.rows });
  }));

  app.get('/api/v1/media/:mediaId/comments', requireDatabase, asyncRoute(async (request, response) => {
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!mediaId) return undefined;
    const result = await pool.query(
      `SELECT c.id, c.parent_id, c.body, c.created_at, p.name AS author, p.avatar_url
        FROM comments c JOIN profiles p ON p.id = c.profile_id
        WHERE c.media_id = $1 AND c.moderation_status = 'approved'
        ORDER BY c.created_at ASC LIMIT 500`,
      [mediaId],
    );
    return response.json({ items: result.rows });
  }));

  app.get('/api/v1/playlists/public', requireDatabase, asyncRoute(async (_request, response) => {
    const result = await pool.query(
      `SELECT l.id, l.title, l.description, l.updated_at, p.name AS curator,
        COUNT(i.media_id)::int AS item_count
        FROM playlists l JOIN profiles p ON p.id = l.profile_id
        LEFT JOIN playlist_items i ON i.playlist_id = l.id
        WHERE l.public = true
        GROUP BY l.id, p.id ORDER BY l.updated_at DESC LIMIT 100`,
    );
    return response.json({ items: result.rows });
  }));

  app.get('/api/v1/rankings/top', requireDatabase, asyncRoute(async (_request, response) => {
    const result = await pool.query(
      `SELECT d.rank, d.engaged_profiles, m.id, m.title, m.kind,
        m.release_year, m.genres, m.imdb_rating, m.poster_url, m.backdrop_url
        FROM daily_rankings d JOIN media m ON m.id = d.media_id
        WHERE d.country = $1::bpchar AND d.ranking_date = CURRENT_DATE
        AND m.published = true ORDER BY d.rank`,
      [runtime.defaultCountry],
    );
    return response.json({ country: runtime.defaultCountry, items: result.rows });
  }));

  app.get('/api/v1/profiles', requireAuth, requireDatabase, asyncRoute(async (request, response) => {
    const result = await pool.query(
      `SELECT p.id, p.name, p.is_kids, p.max_age_rating, p.avatar_url,
        p.pin_hash IS NOT NULL AS pin_protected
        FROM profiles p JOIN users u ON u.id = p.user_id
        WHERE u.auth_subject = $1 AND u.deleted_at IS NULL
        ORDER BY p.created_at`,
      [request.auth.subject],
    );
    return response.json({ items: result.rows });
  }));

  app.post('/api/v1/profiles', requireAuth, requireDatabase, asyncRoute(async (request, response) => {
    const parsed = profileCreateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    const maxAgeRating = parsed.data.maxAgeRating ?? (parsed.data.isKids ? 12 : 18);
    const result = await pool.query(
      `INSERT INTO profiles(user_id, name, avatar_url, is_kids, max_age_rating)
        SELECT u.id, $2, $3, $4, $5 FROM users u
        WHERE u.auth_subject = $1 AND u.deleted_at IS NULL
        RETURNING id, name, avatar_url, is_kids, max_age_rating, created_at`,
      [request.auth.subject, parsed.data.name, parsed.data.avatarUrl,
        parsed.data.isKids, maxAgeRating],
    );
    if (!result.rowCount) {
      return response.status(409).json({ error: 'User account has not been provisioned' });
    }
    return response.status(201).json(result.rows[0]);
  }));

  const profileBase = '/api/v1/profiles/:profileId';
  app.use(profileBase, requireAuth, requireDatabase, requireOwnedProfile);

  app.patch(profileBase, asyncRoute(async (request, response) => {
    const parsed = profileUpdateSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    const columns = [];
    const values = [request.profile.id];
    const add = (column, value) => {
      values.push(value);
      columns.push(`${column} = $${values.length}`);
    };
    if (parsed.data.name !== undefined) add('name', parsed.data.name);
    if (Object.hasOwn(parsed.data, 'avatarUrl')) add('avatar_url', parsed.data.avatarUrl);
    if (parsed.data.isKids !== undefined) add('is_kids', parsed.data.isKids);
    if (parsed.data.maxAgeRating !== undefined) add('max_age_rating', parsed.data.maxAgeRating);
    else if (parsed.data.isKids === true) add('max_age_rating', 12);
    const result = await pool.query(
      `UPDATE profiles SET ${columns.join(', ')} WHERE id = $1
        RETURNING id, name, avatar_url, is_kids, max_age_rating, updated_at`,
      values,
    );
    return response.json(result.rows[0]);
  }));

  app.delete(profileBase, asyncRoute(async (request, response) => {
    const result = await pool.query(
      `DELETE FROM profiles WHERE id = $1
        AND (SELECT COUNT(*) FROM profiles WHERE user_id = $2) > 1
        RETURNING id`,
      [request.profile.id, request.profile.user_id],
    );
    if (!result.rowCount) return response.status(409).json({ error: 'The final profile cannot be deleted' });
    return response.sendStatus(204);
  }));

  app.put(`${profileBase}/pin`, asyncRoute(async (request, response) => {
    if (!pinService) return response.status(503).json({ error: 'Profile PIN service is not configured' });
    const parsed = pinSetSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    const state = await getPinState(pool, request.profile.id);
    if (state.pin_locked_until && new Date(state.pin_locked_until) > new Date()) {
      return response.status(423).json({ error: 'Profile PIN is temporarily locked', lockedUntil: state.pin_locked_until });
    }
    if (state.pin_hash) {
      if (!parsed.data.currentPin) return response.status(400).json({ error: 'currentPin is required' });
      const currentMatches = await pinService.verifyPin(parsed.data.currentPin, state.pin_hash);
      if (!currentMatches) {
        const failure = await recordPinFailure(pool, request.profile.id);
        return response.status(401).json({
          error: 'Current PIN is incorrect',
          lockedUntil: failure.pin_locked_until,
        });
      }
    }
    const pinHash = await pinService.hashPin(parsed.data.pin);
    await pool.query(
      `UPDATE profiles SET pin_hash = $2, pin_failed_attempts = 0,
        pin_locked_until = NULL WHERE id = $1`,
      [request.profile.id, pinHash],
    );
    return response.sendStatus(204);
  }));

  app.delete(`${profileBase}/pin`, asyncRoute(async (request, response) => {
    if (!pinService) return response.status(503).json({ error: 'Profile PIN service is not configured' });
    const parsed = pinUnlockSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    const state = await getPinState(pool, request.profile.id);
    if (!state.pin_hash) return response.status(409).json({ error: 'Profile does not have a PIN' });
    if (state.pin_locked_until && new Date(state.pin_locked_until) > new Date()) {
      return response.status(423).json({ error: 'Profile PIN is temporarily locked', lockedUntil: state.pin_locked_until });
    }
    if (!await pinService.verifyPin(parsed.data.pin, state.pin_hash)) {
      const failure = await recordPinFailure(pool, request.profile.id);
      return response.status(401).json({ error: 'PIN is incorrect', lockedUntil: failure.pin_locked_until });
    }
    await pool.query(
      'UPDATE profiles SET pin_hash = NULL, pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1',
      [request.profile.id],
    );
    return response.sendStatus(204);
  }));

  app.post(`${profileBase}/unlock`, asyncRoute(async (request, response) => {
    if (!pinService) return response.status(503).json({ error: 'Profile PIN service is not configured' });
    const parsed = pinUnlockSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    const state = await getPinState(pool, request.profile.id);
    if (!state.pin_hash) return response.status(409).json({ error: 'Profile does not have a PIN' });
    if (state.pin_locked_until && new Date(state.pin_locked_until) > new Date()) {
      return response.status(423).json({ error: 'Profile PIN is temporarily locked', lockedUntil: state.pin_locked_until });
    }
    if (!await pinService.verifyPin(parsed.data.pin, state.pin_hash)) {
      const failure = await recordPinFailure(pool, request.profile.id);
      return response.status(401).json({ error: 'PIN is incorrect', lockedUntil: failure.pin_locked_until });
    }
    await pool.query(
      'UPDATE profiles SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1',
      [request.profile.id],
    );
    return response.json(await pinService.issueUnlock({
      profileId: request.profile.id,
      authSubject: request.auth.subject,
    }));
  }));

  app.get(`${profileBase}/watchlist`, asyncRoute(async (request, response) => {
    const result = await pool.query(
      `SELECT m.id, m.title, m.synopsis, m.kind, m.release_year, m.genres,
        m.imdb_rating, m.poster_url, m.backdrop_url, w.created_at
        FROM watchlist w JOIN media m ON m.id = w.media_id
        WHERE w.profile_id = $1 AND m.published = true
        AND m.age_rating <= $2
        ORDER BY w.created_at DESC`,
      [request.profile.id, request.profile.max_age_rating],
    );
    return response.json({ items: result.rows });
  }));

  app.put(`${profileBase}/watchlist/:mediaId`, asyncRoute(async (request, response) => {
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!mediaId) return undefined;
    const result = await pool.query(
      `INSERT INTO watchlist(profile_id, media_id)
        SELECT $1, m.id FROM media m
        WHERE m.id = $2 AND m.published = true AND m.age_rating <= $3
        ON CONFLICT(profile_id, media_id) DO UPDATE SET created_at = watchlist.created_at
        RETURNING created_at`,
      [request.profile.id, mediaId, request.profile.max_age_rating],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Title is not available for this profile' });
    return response.status(200).json({ saved: true });
  }));

  app.delete(`${profileBase}/watchlist/:mediaId`, asyncRoute(async (request, response) => {
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!mediaId) return undefined;
    await pool.query('DELETE FROM watchlist WHERE profile_id = $1 AND media_id = $2', [request.profile.id, mediaId]);
    return response.sendStatus(204);
  }));

  app.get(`${profileBase}/history`, asyncRoute(async (request, response) => {
    const result = await pool.query(
      `SELECT h.id, h.media_id, h.episode_id, h.position_seconds,
        h.duration_seconds, h.completed, h.version, h.updated_at,
        m.title, m.poster_url, e.title AS episode_title,
        e.season_number, e.episode_number
        FROM playback_history h JOIN media m ON m.id = h.media_id
        LEFT JOIN episodes e ON e.id = h.episode_id
        WHERE h.profile_id = $1 AND m.age_rating <= $2
        ORDER BY h.updated_at DESC LIMIT 100`,
      [request.profile.id, request.profile.max_age_rating],
    );
    return response.json({ items: result.rows });
  }));

  app.get(`${profileBase}/recommendations`, asyncRoute(async (request, response) => {
    const result = await pool.query(
      `WITH latest AS (
        SELECT id, algorithm, reason, generated_at, expires_at
        FROM recommendation_sets
        WHERE profile_id = $1 AND expires_at > now()
        ORDER BY generated_at DESC LIMIT 1
      )
      SELECT i.rank, i.score, i.explanation, m.id, m.title, m.kind,
        m.release_year, m.genres, m.imdb_rating, m.poster_url, m.backdrop_url,
        l.algorithm, l.reason, l.generated_at, l.expires_at
      FROM latest l JOIN recommendation_items i ON i.recommendation_set_id = l.id
      JOIN media m ON m.id = i.media_id
      WHERE m.published = true AND m.age_rating <= $2
      ORDER BY i.rank`,
      [request.profile.id, request.profile.max_age_rating],
    );
    return response.json({ items: result.rows });
  }));

  app.post(`${profileBase}/events`, asyncRoute(async (request, response) => {
    const parsed = viewingEventSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    const value = parsed.data;
    if (!await mediaAllowedForProfile(pool, value.mediaId, request.profile)) {
      return response.status(404).json({ error: 'Title is not available for this profile' });
    }
    if (value.deviceId) {
      const device = await pool.query(
        'SELECT 1 FROM devices WHERE id = $1 AND user_id = $2',
        [value.deviceId, request.profile.user_id],
      );
      if (!device.rowCount) return response.status(404).json({ error: 'Device not found' });
    }
    const result = await pool.query(
      `INSERT INTO viewing_events(
        id, profile_id, media_id, episode_id, device_id, session_id,
        event_type, position_seconds, occurred_at, metadata
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT(id) DO NOTHING RETURNING id, received_at`,
      [value.id, request.profile.id, value.mediaId, value.episodeId, value.deviceId,
        value.sessionId, value.eventType, value.positionSeconds, value.occurredAt,
        JSON.stringify(value.metadata)],
    );
    if (!result.rowCount) {
      return response.status(200).json({ accepted: true, duplicate: true, id: value.id });
    }
    return response.status(202).json({ accepted: true, id: result.rows[0].id });
  }));

  app.put(`${profileBase}/history/:mediaId`, asyncRoute(async (request, response) => {
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!mediaId) return undefined;
    const parsed = historySchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    if (!await mediaAllowedForProfile(pool, mediaId, request.profile)) {
      return response.status(404).json({ error: 'Title is not available for this profile' });
    }
    const value = parsed.data;
    let result;
    if (value.expectedVersion === 0) {
      result = await pool.query(
        `INSERT INTO playback_history(
          profile_id, media_id, episode_id, position_seconds, duration_seconds,
          completed, version, last_event_id
        ) VALUES($1, $2, $3, $4, $5, $6, 1, $7)
        ON CONFLICT DO NOTHING
        RETURNING id, version, updated_at`,
        [request.profile.id, mediaId, value.episodeId, value.positionSeconds,
          value.durationSeconds, value.completed, value.eventId],
      );
    } else {
      result = await pool.query(
        `UPDATE playback_history SET position_seconds = $4, duration_seconds = $5,
          completed = $6, version = version + 1, last_event_id = $7
          WHERE profile_id = $1 AND media_id = $2
          AND episode_id IS NOT DISTINCT FROM $3::uuid
          AND version = $8 AND last_event_id <> $7
          RETURNING id, version, updated_at`,
        [request.profile.id, mediaId, value.episodeId, value.positionSeconds,
          value.durationSeconds, value.completed, value.eventId, value.expectedVersion],
      );
    }
    if (!result.rowCount) {
      return response.status(409).json({ error: 'Playback history version conflict or duplicate event' });
    }
    return response.json(result.rows[0]);
  }));

  app.put(`${profileBase}/reviews/:mediaId`, asyncRoute(async (request, response) => {
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!mediaId) return undefined;
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    if (!await mediaAllowedForProfile(pool, mediaId, request.profile)) {
      return response.status(404).json({ error: 'Title is not available for this profile' });
    }
    const result = await pool.query(
      `INSERT INTO ratings(profile_id, media_id, stars, review)
        VALUES($1, $2, $3, $4)
        ON CONFLICT(profile_id, media_id) DO UPDATE SET
          stars = EXCLUDED.stars, review = EXCLUDED.review,
          moderation_status = 'pending'
        RETURNING stars, review, moderation_status, updated_at`,
      [request.profile.id, mediaId, parsed.data.stars, parsed.data.review],
    );
    return response.json(result.rows[0]);
  }));

  app.post(`${profileBase}/comments/:mediaId`, asyncRoute(async (request, response) => {
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!mediaId) return undefined;
    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    if (!await mediaAllowedForProfile(pool, mediaId, request.profile)) {
      return response.status(404).json({ error: 'Title is not available for this profile' });
    }
    const result = await pool.query(
      `INSERT INTO comments(profile_id, media_id, parent_id, body)
        VALUES($1, $2, $3, $4)
        RETURNING id, parent_id, body, moderation_status, created_at`,
      [request.profile.id, mediaId, parsed.data.parentId, parsed.data.body],
    );
    return response.status(201).json(result.rows[0]);
  }));

  app.get(`${profileBase}/playlists`, asyncRoute(async (request, response) => {
    const result = await pool.query(
      `SELECT l.id, l.title, l.description, l.public, l.created_at, l.updated_at,
        COUNT(i.media_id)::int AS item_count
        FROM playlists l LEFT JOIN playlist_items i ON i.playlist_id = l.id
        WHERE l.profile_id = $1 GROUP BY l.id ORDER BY l.updated_at DESC`,
      [request.profile.id],
    );
    return response.json({ items: result.rows });
  }));

  app.post(`${profileBase}/playlists`, asyncRoute(async (request, response) => {
    const parsed = playlistSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    const result = await pool.query(
      `INSERT INTO playlists(profile_id, title, description, public)
        VALUES($1, $2, $3, $4)
        RETURNING id, title, description, public, created_at, updated_at`,
      [request.profile.id, parsed.data.title, parsed.data.description, parsed.data.public],
    );
    return response.status(201).json(result.rows[0]);
  }));

  app.put(`${profileBase}/playlists/:playlistId/items/:mediaId`, asyncRoute(async (request, response) => {
    const playlistId = parseUuid(request.params.playlistId, response, 'playlistId');
    const mediaId = parseUuid(request.params.mediaId, response, 'mediaId');
    if (!playlistId || !mediaId) return undefined;
    if (!await mediaAllowedForProfile(pool, mediaId, request.profile)) {
      return response.status(404).json({ error: 'Title is not available for this profile' });
    }
    const result = await pool.query(
      `INSERT INTO playlist_items(playlist_id, media_id, position)
        SELECT l.id, $3, COALESCE(MAX(i.position) + 1, 0)
        FROM playlists l LEFT JOIN playlist_items i ON i.playlist_id = l.id
        WHERE l.id = $1 AND l.profile_id = $2 GROUP BY l.id
        ON CONFLICT(playlist_id, media_id) DO NOTHING
        RETURNING playlist_id, media_id, position`,
      [playlistId, request.profile.id, mediaId],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Playlist not found or item already exists' });
    return response.status(201).json(result.rows[0]);
  }));

  app.post(`${profileBase}/playback-sessions`, asyncRoute(async (request, response) => {
    if (!playbackSigner) {
      return response.status(503).json({ error: 'Licensed playback signing is not configured' });
    }
    const parsed = playbackSchema.safeParse(request.body);
    if (!parsed.success) return validationError(response, parsed.error);
    const { mediaId, episodeId, unlockToken } = parsed.data;
    if (request.profile.pin_protected) {
      if (!pinService) return response.status(503).json({ error: 'Profile PIN service is not configured' });
      if (!unlockToken) return response.status(403).json({ error: 'A profile unlock token is required' });
      try {
        const unlocked = await pinService.verifyUnlock(unlockToken, {
          profileId: request.profile.id,
          authSubject: request.auth.subject,
        });
        if (!unlocked) throw new Error('Invalid unlock token claims');
      } catch {
        return response.status(403).json({ error: 'Profile unlock token is invalid or expired' });
      }
    }
    const rightsResult = await pool.query(
      `SELECT m.id, m.title, m.age_rating, r.valid_until
        FROM media m JOIN media_rights r ON r.media_id = m.id
        WHERE m.id = $1 AND m.published = true
        AND r.country = $2::bpchar
        AND r.valid_from <= now() AND r.valid_until > now()
        ORDER BY r.valid_until DESC LIMIT 1`,
      [mediaId, runtime.defaultCountry],
    );
    const media = rightsResult.rows[0];
    if (!media) return response.status(403).json({ error: 'Title is not available in this territory' });
    if (media.age_rating > request.profile.max_age_rating) {
      return response.status(403).json({ error: 'Title exceeds this profile age limit' });
    }
    const sourceResult = await pool.query(
      `SELECT id, source_label, manifest_key, protocol, max_resolution,
        audio_languages, subtitle_languages
        FROM stream_assets
        WHERE media_id = $1 AND episode_id IS NOT DISTINCT FROM $2::uuid
        AND enabled = true
        AND (available_from IS NULL OR available_from <= now())
        AND (available_until IS NULL OR available_until > now())
        ORDER BY priority ASC, id ASC LIMIT 3`,
      [mediaId, episodeId],
    );
    if (!sourceResult.rowCount) return response.status(503).json({ error: 'No licensed stream source is currently available' });
    const sources = await Promise.all(sourceResult.rows.map((source) => playbackSigner({
      source,
      profileId: request.profile.id,
      mediaId,
      episodeId,
    })));
    return response.status(201).json({
      id: randomUUID(),
      media: { id: media.id, title: media.title },
      episodeId,
      sources,
      rightsExpireAt: media.valid_until,
    });
  }));

  app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
  app.use((error, request, response, _next) => {
    logger.error?.('API request failed', {
      requestId: request.id,
      path: request.path,
      code: error.code ?? 'unknown',
    });
    if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'Malformed JSON body' });
    if (error.name === 'TmdbApiError') return response.status(error.status).json({ error: error.message, code: error.code });
    if (error.code === '23503') return response.status(409).json({ error: 'Referenced resource does not exist' });
    if (error.code === '23505') return response.status(409).json({ error: 'Resource already exists' });
    return response.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
