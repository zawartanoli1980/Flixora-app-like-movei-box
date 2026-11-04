import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

async function withServer(options, run) {
  const server = createApp({
    logger: { error() {} },
    ...options,
  }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('liveness, readiness, request IDs, and JSON 404 work without a database', async () => {
  await withServer({}, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.match(health.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
    assert.deepEqual(await health.json(), { status: 'ok', mode: 'standard' });

    const readiness = await fetch(`${baseUrl}/api/v1/readiness`);
    assert.equal(readiness.status, 503);
    assert.equal((await readiness.json()).status, 'not_ready');

    const missing = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Route not found' });
  });
});

test('demo mode serves a read-only filtered catalog and rejects unknown filters', async () => {
  await withServer({ config: { demoMode: true } }, async (baseUrl) => {
    const readiness = await fetch(`${baseUrl}/api/v1/readiness`);
    assert.equal(readiness.status, 200);
    assert.equal((await readiness.json()).mode, 'demo');

    const catalog = await fetch(`${baseUrl}/api/v1/media?genre=Sci-Fi&country=us&rating=8.6`);
    assert.equal(catalog.status, 200);
    const body = await catalog.json();
    assert.equal(body.mode, 'demo');
    assert.deepEqual(body.items.map((item) => item.title), ['Interstellar']);

    const invalid = await fetch(`${baseUrl}/api/v1/media?surprise=true`);
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error, 'Invalid request');
  });
});

test('CORS permits configured exact origins and rejects all other browser origins', async () => {
  await withServer({ config: { webOrigins: ['https://app.flixora.test'] } }, async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: 'https://app.flixora.test' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.flixora.test');

    const preflight = await fetch(`${baseUrl}/api/v1/profiles`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.flixora.test' },
    });
    assert.equal(preflight.status, 204);

    const denied = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: 'https://attacker.test' },
    });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error, 'Origin is not allowed');
  });
});

test('protected routes fail explicitly when auth or database services are absent', async () => {
  await withServer({}, async (baseUrl) => {
    const profiles = await fetch(`${baseUrl}/api/v1/profiles`);
    assert.equal(profiles.status, 503);
    assert.equal((await profiles.json()).error, 'Authentication is not configured');
  });
  await withServer({ authVerifier: async () => ({ sub: 'user-1' }) }, async (baseUrl) => {
    const profiles = await fetch(`${baseUrl}/api/v1/profiles`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    assert.equal(profiles.status, 503);
    assert.equal((await profiles.json()).error, 'Database is not configured');
  });
});

test('malformed JSON is reported as a client error', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/unknown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Malformed JSON body');
  });
});

test('Gemini chat validates input and uses only the injected backend service', async () => {
  const calls = [];
  const geminiService = {
    async chat(input) {
      calls.push(input);
      return {answer: 'Watch Arrival next.', model: 'gemini-test'};
    },
  };
  await withServer({geminiService}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/ai/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: 'Suggest a thoughtful sci-fi movie', profile: 'general', locale: 'en'}),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {answer: 'Watch Arrival next.', model: 'gemini-test'});
    assert.equal(calls[0].message, 'Suggest a thoughtful sci-fi movie');

    const invalid = await fetch(`${baseUrl}/api/v1/ai/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: ''}),
    });
    assert.equal(invalid.status, 400);
  });
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/ai/chat`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: 'Recommend a movie'}),
    });
    assert.equal(response.status, 503);
  });
});

test('TMDB routes validate input and dispatch normalized service options', async () => {
  const calls = [];
  const tmdbService = {
    async getTrending(options) {
      calls.push(options);
      return { items: [{ id: 'tmdb:movie:1', title: 'Dynamic title' }], page: 1, totalPages: 1, totalResults: 1, source: 'tmdb' };
    },
  };
  await withServer({ tmdbService }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tmdb/trending?type=movie&window=week&region=gb&page=2`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).items[0].id, 'tmdb:movie:1');
    assert.equal(calls[0].mediaType, 'movie');
    assert.equal(calls[0].window, 'week');
    assert.equal(calls[0].region, 'GB');
    assert.equal(calls[0].page, 2);

    const invalid = await fetch(`${baseUrl}/api/v1/tmdb/trending?unexpected=true`);
    assert.equal(invalid.status, 400);
  });

  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tmdb/trending`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'TMDB integration is not configured');
  });
});

test('playback sessions enforce profile ownership and use only an injected signer', async () => {
  const profileId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const mediaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const queries = [];
  const pool = {
    async query(text, values = []) {
      queries.push({ text, values });
      if (text.includes('FROM profiles p')) {
        return {
          rowCount: 1,
          rows: [{ id: profileId, user_id: 'user-1', max_age_rating: 13 }],
        };
      }
      if (text.includes('FROM media m JOIN media_rights')) {
        return {
          rowCount: 1,
          rows: [{ id: mediaId, title: 'Licensed title', age_rating: 13, valid_until: '2030-01-01T00:00:00Z' }],
        };
      }
      if (text.includes('FROM stream_assets')) {
        return {
          rowCount: 1,
          rows: [{
            id: 'asset-1',
            source_label: 'Fast CDN',
            manifest_key: 'licensed/master.m3u8',
            protocol: 'hls',
            max_resolution: 1080,
            audio_languages: ['en'],
            subtitle_languages: ['en'],
          }],
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };
  const playbackSigner = async ({ source }) => ({
    id: source.id,
    label: source.source_label,
    url: 'https://cdn.flixora.test/licensed/master.m3u8?token=signed',
    expiresInSeconds: 300,
  });
  await withServer({
    pool,
    authVerifier: async () => ({ sub: 'auth-user-1' }),
    playbackSigner,
    config: { defaultCountry: 'US' },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/profiles/${profileId}/playback-sessions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaId }),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.sources[0].url, 'https://cdn.flixora.test/licensed/master.m3u8?token=signed');
    assert.equal(JSON.stringify(body).includes('manifest_key'), false);
    assert.equal(queries.find((query) => query.text.includes('media_rights')).values[1], 'US');
  });
});

test('profile PIN unlock applies a five-attempt database lockout', async () => {
  const profileId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const state = {
    pin_hash: 'stored-hash',
    pin_failed_attempts: 0,
    pin_locked_until: null,
  };
  const pool = {
    async query(text) {
      if (text.includes('FROM profiles p')) {
        return {
          rowCount: 1,
          rows: [{
            id: profileId,
            user_id: 'user-1',
            max_age_rating: 18,
            pin_protected: true,
          }],
        };
      }
      if (text.includes('SELECT pin_hash')) return { rowCount: 1, rows: [{ ...state }] };
      if (text.includes('pin_failed_attempts = pin_failed_attempts + 1')) {
        state.pin_failed_attempts += 1;
        if (state.pin_failed_attempts >= 5) state.pin_locked_until = '2035-01-01T00:00:00.000Z';
        return { rowCount: 1, rows: [{ ...state }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };
  await withServer({
    pool,
    authVerifier: async () => ({ sub: 'auth-user-1' }),
    pinService: {
      verifyPin: async () => false,
      issueUnlock: async () => ({ token: 'should-not-be-issued' }),
    },
  }, async (baseUrl) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/v1/profiles/${profileId}/unlock`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: '0000' }),
      });
      assert.equal(response.status, 401);
    }
    const locked = await fetch(`${baseUrl}/api/v1/profiles/${profileId}/unlock`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin: '0000' }),
    });
    assert.equal(locked.status, 423);
    assert.equal((await locked.json()).lockedUntil, state.pin_locked_until);
  });
});
