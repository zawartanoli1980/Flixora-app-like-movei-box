import { SignJWT } from 'jose';

function safeManifestUrl(baseUrl, manifestKey) {
  let decodedKey;
  try {
    decodedKey = decodeURIComponent(manifestKey);
  } catch {
    throw new Error('Stream manifest key contains invalid encoding');
  }
  if (!manifestKey || /^([a-z]+:)?\/\//i.test(manifestKey)
    || manifestKey.includes('\\')
    || decodedKey.split('/').includes('..')) {
    throw new Error('Stream manifest key must be a relative storage key');
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(manifestKey.replace(/^\/+/, ''), normalizedBase);
}

export function createPlaybackSigner(config) {
  if (!config.playbackSigningSecret || !config.cdnBaseUrl) return null;
  const secret = new TextEncoder().encode(config.playbackSigningSecret);

  return async ({ source, profileId, mediaId, episodeId }) => {
    const expiresInSeconds = 300;
    const token = await new SignJWT({
      mediaId,
      episodeId: episodeId ?? null,
      assetId: source.id,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(profileId)
      .setIssuedAt()
      .setExpirationTime(`${expiresInSeconds}s`)
      .sign(secret);
    const url = safeManifestUrl(config.cdnBaseUrl, source.manifest_key);
    url.searchParams.set('token', token);
    return {
      id: source.id,
      label: source.source_label,
      protocol: source.protocol,
      maxResolution: source.max_resolution,
      audioLanguages: source.audio_languages,
      subtitleLanguages: source.subtitle_languages,
      url: url.toString(),
      expiresInSeconds,
    };
  };
}
