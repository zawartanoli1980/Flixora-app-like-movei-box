const supportedProtocols = new Set(['HLS', 'DASH', 'MP4']);
const supportedResolutions = new Set(['480p', '720p', '1080p', '4K']);
const supportedSpeeds = new Set(['Standard', 'Fast', 'Ultra']);
const knownPlaceholders = new Set(['mediaType', 'tmdbId', 'season', 'episode']);

function inferProtocol(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.m3u8')) return 'HLS';
  if (pathname.endsWith('.mpd')) return 'DASH';
  return 'MP4';
}

function validateTemplate(definition) {
  if (!definition.template.includes('{tmdbId}')) {
    throw new Error(`${definition.id} source template must include {tmdbId}`);
  }
  for (const match of definition.template.matchAll(/\{([^}]+)\}/g)) {
    if (!knownPlaceholders.has(match[1])) throw new Error(`${definition.id} source template contains unknown placeholder {${match[1]}}`);
  }
  const sample = definition.template
    .replaceAll('{mediaType}', 'movie')
    .replaceAll('{tmdbId}', '1')
    .replaceAll('{season}', '1')
    .replaceAll('{episode}', '1');
  const url = new URL(sample);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${definition.id} source template must use credential-free HTTPS`);
  }
}

function renderTemplate(definition, context) {
  if ((definition.template.includes('{season}') || definition.template.includes('{episode}'))
    && (!Number.isInteger(context.seasonNumber) || !Number.isInteger(context.episodeNumber))) return null;
  const values = {
    mediaType: context.mediaType,
    tmdbId: String(context.tmdbId),
    season: String(context.seasonNumber ?? ''),
    episode: String(context.episodeNumber ?? ''),
  };
  const rendered = definition.template.replace(/\{([^}]+)\}/g, (_match, key) => encodeURIComponent(values[key]));
  const url = new URL(rendered);
  const episodeSuffix = Number.isInteger(context.seasonNumber) && Number.isInteger(context.episodeNumber)
    ? `-s${context.seasonNumber}-e${context.episodeNumber}` : '';
  return {
    id: `tmdb-${context.mediaType}-${context.tmdbId}${episodeSuffix}-${definition.id}`,
    label: definition.label,
    url: url.toString(),
    resolution: definition.resolution,
    protocol: definition.protocol ?? inferProtocol(url.toString()),
    speed: definition.speed,
  };
}

export function createSourceMapper({ definitions = [] } = {}) {
  const activeDefinitions = definitions.filter((definition) => definition?.template).map((definition) => {
    const normalized = {
      id: String(definition.id),
      label: String(definition.label),
      template: String(definition.template),
      resolution: definition.resolution ?? '1080p',
      protocol: definition.protocol,
      speed: definition.speed ?? 'Standard',
    };
    if (!supportedResolutions.has(normalized.resolution)) throw new Error(`${normalized.id} has an unsupported resolution`);
    if (normalized.protocol && !supportedProtocols.has(normalized.protocol)) throw new Error(`${normalized.id} has an unsupported protocol`);
    if (!supportedSpeeds.has(normalized.speed)) throw new Error(`${normalized.id} has an unsupported speed`);
    validateTemplate(normalized);
    return Object.freeze(normalized);
  });

  return Object.freeze({
    map(context) {
      if (!['movie', 'tv'].includes(context.mediaType)) throw new Error('mediaType must be movie or tv');
      if (!Number.isInteger(context.tmdbId) || context.tmdbId < 1) throw new Error('tmdbId must be a positive integer');
      return activeDefinitions.map((definition) => renderTemplate(definition, context)).filter(Boolean);
    },
  });
}

export function sourceDefinitionsFromConfig(config) {
  return [
    config.streamServer1Template && { id: 'server-1', label: 'Server 1', template: config.streamServer1Template, resolution: '1080p', speed: 'Standard' },
    config.streamServer2Template && { id: 'server-2', label: 'Server 2', template: config.streamServer2Template, resolution: '720p', speed: 'Fast' },
    config.streamCdnHlsTemplate && { id: 'fast-cdn', label: 'Fast CDN', template: config.streamCdnHlsTemplate, resolution: '4K', protocol: 'HLS', speed: 'Ultra' },
  ].filter(Boolean);
}
