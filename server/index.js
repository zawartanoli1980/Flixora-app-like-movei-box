import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { createApp } from './app.js';
import { createJwtVerifier } from './auth.js';
import { loadConfig } from './config.js';
import { createPlaybackSigner } from './playback.js';
import { createProfilePinService } from './pin.js';
import { createSourceMapper, sourceDefinitionsFromConfig } from './source-mapper.js';
import { createTmdbService } from './tmdb.js';

export { createApp, loadConfig };

export function createPool(config) {
  if (!config.databaseUrl) return null;
  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

export function startServer(environment = process.env) {
  const config = loadConfig(environment);
  const pool = createPool(config);
  const sourceMapper = createSourceMapper({ definitions: sourceDefinitionsFromConfig(config) });
  const tmdbService = config.tmdbApiToken ? createTmdbService({
    accessToken: config.tmdbApiToken,
    baseUrl: config.tmdbApiBaseUrl,
    imageBaseUrl: config.tmdbImageBaseUrl,
    defaultLanguage: config.tmdbLanguage,
    defaultRegion: config.defaultCountry,
    sourceMapper,
  }) : null;
  const app = createApp({
    pool,
    authVerifier: createJwtVerifier(config),
    playbackSigner: createPlaybackSigner(config),
    pinService: createProfilePinService(config),
    tmdbService,
    config,
  });
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`Flixora API listening on port ${config.port} (${config.demoMode ? 'demo' : 'standard'} mode)`);
  });

  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => {
      console.error(`Forced shutdown after ${signal}`);
      process.exit(1);
    }, 10_000);
    timeout.unref();
    server.close(async () => {
      clearTimeout(timeout);
      await pool?.end();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return { app, server, pool };
}

const isEntryPoint = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) startServer();
