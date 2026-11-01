import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.js';
import { createPlaybackSigner } from './playback.js';
import { createProfilePinService, hashPin, verifyPin } from './pin.js';

test('configuration validates paired auth/playback settings and exact origins', () => {
  assert.throws(() => loadConfig({ AUTH_ISSUER: 'https://issuer.test' }), /AUTH_AUDIENCE/);
  assert.throws(() => loadConfig({
    CDN_BASE_URL: 'https://cdn.test',
    PLAYBACK_SIGNING_SECRET: 'short',
  }), /at least 32/);
  assert.throws(() => loadConfig({ WEB_ORIGINS: 'https://app.test/path' }), /invalid origin/);
  assert.throws(() => loadConfig({ PROFILE_UNLOCK_SECRET: 'short' }), /at least 32/);
  assert.throws(() => loadConfig({ TMDB_API_TOKEN: 'short' }), /at least 20/);

  const config = loadConfig({
    PORT: '4000',
    WEB_ORIGINS: 'https://app.test, https://admin.test/',
    DEFAULT_COUNTRY: 'gb',
    TMDB_API_TOKEN: 'tmdb-read-token-long-enough-for-validation',
    DEMO_MODE: 'true',
  });
  assert.equal(config.port, 4000);
  assert.deepEqual(config.webOrigins, ['https://app.test', 'https://admin.test']);
  assert.equal(config.defaultCountry, 'GB');
  assert.equal(config.demoMode, true);
  assert.equal(config.tmdbLanguage, 'en-US');
  assert.equal(config.tmdbApiToken, 'tmdb-read-token-long-enough-for-validation');
});

test('profile PIN hashing and unlock tokens are constant-time compatible and owner-bound', async () => {
  const encoded = await hashPin('2468');
  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyPin('2468', encoded), true);
  assert.equal(await verifyPin('1357', encoded), false);
  assert.equal(await verifyPin('2468', 'invalid'), false);

  const service = createProfilePinService({
    profileUnlockSecret: 'a-separate-profile-unlock-secret-longer-than-32-characters',
  });
  const issued = await service.issueUnlock({ profileId: 'profile-1', authSubject: 'owner-1' });
  assert.equal(issued.expiresInSeconds, 900);
  assert.equal(await service.verifyUnlock(issued.token, {
    profileId: 'profile-1',
    authSubject: 'owner-1',
  }), true);
  assert.equal(await service.verifyUnlock(issued.token, {
    profileId: 'profile-1',
    authSubject: 'owner-2',
  }), false);
  await assert.rejects(() => service.verifyUnlock(issued.token, {
    profileId: 'profile-2',
    authSubject: 'owner-1',
  }));
});

test('playback signer creates short-lived CDN URLs and rejects external manifest URLs', async () => {
  const signer = createPlaybackSigner({
    playbackSigningSecret: 'a-secure-test-secret-with-more-than-32-characters',
    cdnBaseUrl: 'https://cdn.flixora.test/media/',
  });
  const signed = await signer({
    source: {
      id: 'asset-1',
      source_label: 'Fast CDN',
      manifest_key: 'dune/master.m3u8',
      protocol: 'hls',
      max_resolution: 2160,
      audio_languages: ['en'],
      subtitle_languages: ['en', 'ur'],
    },
    profileId: 'profile-1',
    mediaId: 'media-1',
    episodeId: null,
  });
  const url = new URL(signed.url);
  assert.equal(url.origin, 'https://cdn.flixora.test');
  assert.equal(url.pathname, '/media/dune/master.m3u8');
  assert.ok(url.searchParams.get('token'));
  assert.equal(signed.expiresInSeconds, 300);

  await assert.rejects(() => signer({
    source: {
      id: 'asset-2',
      source_label: 'Unsafe',
      manifest_key: 'https://attacker.test/master.m3u8',
      protocol: 'hls',
      max_resolution: 1080,
      audio_languages: [],
      subtitle_languages: [],
    },
    profileId: 'profile-1',
    mediaId: 'media-1',
    episodeId: null,
  }), /relative storage key/);

  await assert.rejects(() => signer({
    source: {
      id: 'asset-3',
      source_label: 'Traversal',
      manifest_key: '../private/master.m3u8',
      protocol: 'hls',
      max_resolution: 1080,
      audio_languages: [],
      subtitle_languages: [],
    },
    profileId: 'profile-1',
    mediaId: 'media-1',
    episodeId: null,
  }), /relative storage key/);
});
