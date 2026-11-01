import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => value === '' || value === undefined ? undefined : value,
  z.string().optional(),
);

const optionalUrl = z.preprocess(
  (value) => value === '' || value === undefined ? undefined : value,
  z.string().url().optional(),
);

const optionalTmdbToken = z.preprocess(
  (value) => value === '' || value === undefined ? undefined : value,
  z.string().trim().min(20, 'TMDB_API_TOKEN must contain at least 20 characters').max(4096).optional(),
);

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: optionalString,
  AUTH_ISSUER: optionalUrl,
  AUTH_AUDIENCE: optionalString,
  AUTH_JWKS_URL: optionalUrl,
  WEB_ORIGINS: optionalString,
  DEFAULT_COUNTRY: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default('US'),
  PLAYBACK_SIGNING_SECRET: optionalString,
  CDN_BASE_URL: optionalUrl,
  PROFILE_UNLOCK_SECRET: optionalString,
  TMDB_API_TOKEN: optionalTmdbToken,
  TMDB_API_BASE_URL: z.string().url().default('https://api.themoviedb.org/3'),
  TMDB_IMAGE_BASE_URL: z.string().url().default('https://image.tmdb.org/t/p'),
  TMDB_LANGUAGE: z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).default('en-US'),
  STREAM_SERVER_1_TEMPLATE: optionalString,
  STREAM_SERVER_2_TEMPLATE: optionalString,
  STREAM_CDN_HLS_TEMPLATE: optionalString,
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
}).superRefine((env, context) => {
  const authValues = [env.AUTH_ISSUER, env.AUTH_AUDIENCE];
  if (authValues.some(Boolean) && !authValues.every(Boolean)) {
    context.addIssue({
      code: 'custom',
      message: 'AUTH_ISSUER and AUTH_AUDIENCE must be configured together',
      path: ['AUTH_ISSUER'],
    });
  }
  const playbackValues = [env.PLAYBACK_SIGNING_SECRET, env.CDN_BASE_URL];
  if (playbackValues.some(Boolean) && !playbackValues.every(Boolean)) {
    context.addIssue({
      code: 'custom',
      message: 'PLAYBACK_SIGNING_SECRET and CDN_BASE_URL must be configured together',
      path: ['PLAYBACK_SIGNING_SECRET'],
    });
  }
  if (env.PLAYBACK_SIGNING_SECRET && env.PLAYBACK_SIGNING_SECRET.length < 32) {
    context.addIssue({
      code: 'custom',
      message: 'PLAYBACK_SIGNING_SECRET must contain at least 32 characters',
      path: ['PLAYBACK_SIGNING_SECRET'],
    });
  }
  if (env.PROFILE_UNLOCK_SECRET && env.PROFILE_UNLOCK_SECRET.length < 32) {
    context.addIssue({
      code: 'custom',
      message: 'PROFILE_UNLOCK_SECRET must contain at least 32 characters',
      path: ['PROFILE_UNLOCK_SECRET'],
    });
  }
});

function parseOrigins(value) {
  if (!value) return [];
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);
  return origins.map((origin) => {
    const url = new URL(origin);
    if (url.origin !== origin.replace(/\/$/, '') || url.username || url.password) {
      throw new Error(`WEB_ORIGINS contains an invalid origin: ${origin}`);
    }
    return url.origin;
  });
}

export function loadConfig(environment = process.env) {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return {
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    authIssuer: parsed.data.AUTH_ISSUER,
    authAudience: parsed.data.AUTH_AUDIENCE,
    authJwksUrl: parsed.data.AUTH_JWKS_URL,
    webOrigins: parseOrigins(parsed.data.WEB_ORIGINS),
    defaultCountry: parsed.data.DEFAULT_COUNTRY,
    playbackSigningSecret: parsed.data.PLAYBACK_SIGNING_SECRET,
    cdnBaseUrl: parsed.data.CDN_BASE_URL,
    profileUnlockSecret: parsed.data.PROFILE_UNLOCK_SECRET,
    tmdbApiToken: parsed.data.TMDB_API_TOKEN,
    tmdbApiBaseUrl: parsed.data.TMDB_API_BASE_URL,
    tmdbImageBaseUrl: parsed.data.TMDB_IMAGE_BASE_URL,
    tmdbLanguage: parsed.data.TMDB_LANGUAGE,
    streamServer1Template: parsed.data.STREAM_SERVER_1_TEMPLATE,
    streamServer2Template: parsed.data.STREAM_SERVER_2_TEMPLATE,
    streamCdnHlsTemplate: parsed.data.STREAM_CDN_HLS_TEMPLATE,
    demoMode: parsed.data.DEMO_MODE === 'true',
  };
}
