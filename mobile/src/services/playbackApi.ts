import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const accessTokenKey = 'flixora.access-token';
const historyVersions = new Map<string, number>();
const syncQueues = new Map<string, Promise<'synced' | 'local-only'>>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlaybackCheckpoint = {
  profileId: string;
  mediaId: string;
  episodeId?: string;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  occurredAt: string;
};

type HistoryItem = {
  media_id: string;
  episode_id: string | null;
  version: number;
};

function checkpointKey(checkpoint: PlaybackCheckpoint): string {
  return `${checkpoint.profileId}:${checkpoint.mediaId}:${checkpoint.episodeId ?? 'movie'}`;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

async function readServerVersion(checkpoint: PlaybackCheckpoint, accessToken: string): Promise<number> {
  const response = await fetch(`${apiBaseUrl}/api/v1/profiles/${encodeURIComponent(checkpoint.profileId)}/history`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) throw new Error(`Playback history refresh failed with status ${response.status}`);
  const payload = await response.json() as { items?: HistoryItem[] };
  const matching = payload.items?.find((item) => item.media_id === checkpoint.mediaId && (item.episode_id ?? undefined) === checkpoint.episodeId);
  return matching?.version ?? 0;
}

async function writeCheckpoint(checkpoint: PlaybackCheckpoint, accessToken: string, expectedVersion: number): Promise<Response> {
  const durationSeconds = Math.max(0.001, checkpoint.durationSeconds);
  return fetch(`${apiBaseUrl}/api/v1/profiles/${encodeURIComponent(checkpoint.profileId)}/history/${encodeURIComponent(checkpoint.mediaId)}`, {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      episodeId: checkpoint.episodeId ?? null,
      positionSeconds: Math.min(durationSeconds, Math.max(0, checkpoint.positionSeconds)),
      durationSeconds,
      completed: checkpoint.completed,
      expectedVersion,
      eventId: Crypto.randomUUID(),
    }),
  });
}

async function performSync(checkpoint: PlaybackCheckpoint): Promise<'synced' | 'local-only'> {
  if (!apiBaseUrl) return 'local-only';
  if (!uuidPattern.test(checkpoint.profileId) || !uuidPattern.test(checkpoint.mediaId)
    || (checkpoint.episodeId && !uuidPattern.test(checkpoint.episodeId))) return 'local-only';
  const accessToken = await SecureStore.getItemAsync(accessTokenKey);
  if (!accessToken) return 'local-only';

  const key = checkpointKey(checkpoint);
  let expectedVersion = historyVersions.get(key) ?? 0;
  let response = await writeCheckpoint(checkpoint, accessToken, expectedVersion);
  if (response.status === 409) {
    expectedVersion = await readServerVersion(checkpoint, accessToken);
    response = await writeCheckpoint(checkpoint, accessToken, expectedVersion);
  }
  if (!response.ok) throw new Error(`Playback sync failed with status ${response.status}`);
  const result = await response.json() as { version?: number };
  historyVersions.set(key, result.version ?? expectedVersion + 1);
  return 'synced';
}

export function saveAccessToken(accessToken: string): Promise<void> {
  return SecureStore.setItemAsync(accessTokenKey, accessToken, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export function clearAccessToken(): Promise<void> {
  historyVersions.clear();
  return SecureStore.deleteItemAsync(accessTokenKey);
}

export function syncPlaybackCheckpoint(checkpoint: PlaybackCheckpoint): Promise<'synced' | 'local-only'> {
  const key = checkpointKey(checkpoint);
  const previous = syncQueues.get(key) ?? Promise.resolve<'local-only'>('local-only');
  const current = previous.catch(() => 'local-only' as const).then(() => performSync(checkpoint));
  syncQueues.set(key, current);
  void current.finally(() => {
    if (syncQueues.get(key) === current) syncQueues.delete(key);
  }).catch(() => undefined);
  return current;
}
