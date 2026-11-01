import { z } from 'zod';

const booleanFromString = z.preprocess(
  (value) => value === true || value === 'true',
  z.boolean(),
);
const optionalString = z.preprocess(
  (value) => value === '' || value === undefined ? undefined : value,
  z.string().optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PASSWORD_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  JWT_ISSUER: z.string().trim().min(1).default('flixora-api'),
  JWT_AUDIENCE: z.string().trim().min(1).default('flixora-client'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_DOMAIN: optionalString,
  COOKIE_SECURE: booleanFromString.default(false),
  TRUST_PROXY: booleanFromString.default(false),
}).superRefine((value, context) => {
  if (value.ACCESS_TOKEN_SECRET === value.REFRESH_TOKEN_SECRET) {
    context.addIssue({ code: 'custom', path: ['REFRESH_TOKEN_SECRET'], message: 'Token secrets must be different' });
  }
  if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
    context.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'COOKIE_SECURE must be true in production' });
  }
});

function parseCorsOrigins(raw: string): string[] {
  return raw.split(',').map((value) => value.trim()).filter(Boolean).map((value) => {
    const url = new URL(value);
    if (url.origin !== value.replace(/\/$/, '') || url.username || url.password) {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${value}`);
    }
    return url.origin;
  });
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env) {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    accessTokenSecret: parsed.data.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: parsed.data.REFRESH_TOKEN_SECRET,
    accessTokenTtlSeconds: parsed.data.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: parsed.data.REFRESH_TOKEN_TTL_DAYS,
    passwordSaltRounds: parsed.data.PASSWORD_SALT_ROUNDS,
    jwtIssuer: parsed.data.JWT_ISSUER,
    jwtAudience: parsed.data.JWT_AUDIENCE,
    corsOrigins: parseCorsOrigins(parsed.data.CORS_ORIGINS),
    cookieDomain: parsed.data.COOKIE_DOMAIN,
    cookieSecure: parsed.data.COOKIE_SECURE,
    trustProxy: parsed.data.TRUST_PROXY,
  } as const;
}

export type AppConfig = ReturnType<typeof loadConfig>;
export const config = loadConfig();
