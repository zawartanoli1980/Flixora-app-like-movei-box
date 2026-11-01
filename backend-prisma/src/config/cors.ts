import type { RequestHandler } from 'express';
import { config } from './env.js';
import { AppError } from '../lib/errors.js';

const allowedOrigins = new Set(config.corsOrigins);

/** Exact-origin CORS. Wildcard credentialed origins are intentionally unsupported. */
export const corsMiddleware: RequestHandler = (request, response, next) => {
  const origin = request.get('origin');
  if (!origin) return next();
  if (!allowedOrigins.has(origin)) return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed'));
  response.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Request-ID, X-Client-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  });
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  return next();
};
