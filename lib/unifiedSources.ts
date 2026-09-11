import { createHmac, timingSafeEqual } from 'node:crypto';
import type { UnifiedSource, UnifiedSubtitle } from './unifiedTypes';
import { UNIFIED_RESOLVERS } from './unifiedResolvers';

const SPEEDRACELIGHT_API = 'https://api.speedracelight.com';
const PROXY_EXPIRY_MS = 30 * 60 * 1000;
const RESOLVER_TIMEOUT_MS = 15 * 1000;
const ENCRYPTION_HEADER = [109, 118, 109, 49];
const HASH_SEEDS = [
  1116352408, 1899447441, 3049323471, 3921009573,
  961987163, 1508970993, 2453635748, 2870763221,
  3624381080, 310598401, 607225278, 1426881987,
  1925078388, 2162078206, 2614888103, 3248222580,
];

export interface ResolveSourceOptions {
  type: 'movie' | 'tv';
  id: string;
  title: string;
  year?: string;
  totalSeasons?: number;
  season?: number;
  episode?: number;
  resolverId?: string;
}

function mix(value: number) {
  value >>>= 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822507) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 3266489909) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function rotate(value: number, amount: number) {
  value >>>= 0;
  amount &= 31;
  return amount === 0 ? value : ((value << amount) | (value >>> (32 - amount))) >>> 0;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(4 * Math.ceil(value.length / 4), '=');
  return Uint8Array.from(Buffer.from(normalized, 'base64'));
}

function createStreamState(seed: string, mediaId: number) {
  const table = Array<number | undefined>(61);
  let accumulator = mix(
    mix(
      Array.from(seed).reduce(
        (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
        2166136261
      )
    ) ^ mix((mediaId >>> 0) ^ 2654435769)
  ) >>> 0;

  for (let index = 0; index < 8; index += 1) {
    const slot = accumulator % 61;
    accumulator = rotate(accumulator + 2654435769, 7 + (7 & index));
    table[slot] = (accumulator ^ mix(accumulator)) >>> 0;
    accumulator = mix(accumulator + slot);
  }

  return { table, accumulator: mix(2779096485 ^ accumulator) >>> 0 };
}

function decryptSources(encoded: string, seed: string, mediaId: number) {
  const encrypted = decodeBase64Url(encoded);
  const state = createStreamState(seed, mediaId);
  const decrypted = new Uint8Array(encrypted.length);

  for (let position = 0, block = 0; position < encrypted.length; block += 1) {
    const slot = state.accumulator % 61;
    const present = 0 - Number(slot in state.table);
    const tableValue = (state.table[slot] ?? 0) >>> 0;
    const mixed = (tableValue ^ Math.imul(2654435769, block + 1)) >>> 0;
    let value = ((state.accumulator ^ mixed) | (state.accumulator & mixed & present)) >>> 0;
    value = (rotate((value + state.accumulator) >>> 0, 31 & slot) ^ rotate(
      state.accumulator,
      31 & Math.imul(slot, 7)
    )) >>> 0;
    state.accumulator = mix(value + 2654435769);
    state.table[slot] = state.accumulator;

    decrypted[position] = encrypted[position] ^ (state.accumulator & 255);
    position += 1;
    if (position < encrypted.length) {
      decrypted[position] = encrypted[position] ^ ((state.accumulator >>> 8) & 255);
      position += 1;
    }
    if (position < encrypted.length) {
      decrypted[position] = encrypted[position] ^ ((state.accumulator >>> 16) & 255);
      position += 1;
    }
    if (position < encrypted.length) {
      decrypted[position] = encrypted[position] ^ ((state.accumulator >>> 24) & 255);
      position += 1;
    }
  }

  if (!ENCRYPTION_HEADER.every((value, index) => decrypted[index] === value)) {
    throw new Error('Unified source payload could not be verified');
  }

  return JSON.parse(Buffer.from(decrypted.subarray(ENCRYPTION_HEADER.length)).toString('utf8')) as {
    sources?: Array<Record<string, unknown>>;
    subtitles?: Array<Record<string, unknown>>;
  };
}

function getProxySecret() {
  const secret = process.env.MEDIA_PROXY_SECRET || process.env.TMDB_API_KEY;
  if (!secret) throw new Error('MEDIA_PROXY_SECRET is not configured');
  return secret;
}

export function buildMediaProxyUrl(remoteUrl: string, expires = Date.now() + PROXY_EXPIRY_MS) {
  const signature = createHmac('sha256', getProxySecret())
    .update(`${remoteUrl}|${expires}`)
    .digest('base64url');
  return `/api/media-proxy?url=${encodeURIComponent(remoteUrl)}&expires=${expires}&sig=${signature}`;
}

export function buildSubtitleProxyUrl(remoteUrl: string, expires = Date.now() + PROXY_EXPIRY_MS) {
  const signature = createHmac('sha256', getProxySecret())
    .update(`${remoteUrl}|${expires}`)
    .digest('base64url');
  return `/api/subtitles/file?url=${encodeURIComponent(remoteUrl)}&expires=${expires}&sig=${signature}`;
}

export function isValidMediaProxySignature(remoteUrl: string, expiresValue: string, signature: string) {
  const expires = Number(expiresValue);
  if (!remoteUrl || !Number.isFinite(expires) || expires < Date.now() || !signature) return false;

  try {
    const expected = createHmac('sha256', getProxySecret())
      .update(`${remoteUrl}|${expires}`)
      .digest();
    const received = Buffer.from(signature, 'base64url');
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

function sourceType(source: Record<string, unknown>): UnifiedSource['type'] {
  const type = String(source.type || '').toLowerCase();
  const url = String(source.url || source.file || source.src || '').toLowerCase();
  if (type.includes('dash') || url.includes('.mpd')) return 'dash';
  if (type.includes('m3u') || url.includes('.m3u8')) return 'hls';
  if (type.includes('mp4') || url.includes('.mp4')) return 'mp4';
  return 'unknown';
}

function qualityLabel(value: unknown) {
  const quality = String(value || '').trim();
  if (!quality) return 'Auto';
  if (/^2160|4k/i.test(quality)) return '4K';
  if (/^1080/i.test(quality)) return '1080p';
  if (/^720/i.test(quality)) return '720p';
  if (/^480/i.test(quality)) return '480p';
  if (/^360/i.test(quality)) return '360p';
  return quality;
}

function requestParams(options: ResolveSourceOptions) {
  const mediaType = options.type === 'movie' ? 'Movie' : 'TV';
  const params: Record<string, string> = {
    title: options.title,
    mediaType,
    tmdbId: options.id,
  };
  if (options.year) params.year = options.year;
  if (options.totalSeasons) params.totalSeasons = String(options.totalSeasons);
  if (options.season) params.seasonId = String(options.season);
  if (options.episode) params.episodeId = String(options.episode);
  return params;
}

async function fetchEncryptedSources(path: string, params: Record<string, string>, seed: string, mediaId: number) {
  const url = new URL(`${SPEEDRACELIGHT_API}${path}`);
  Object.entries({ ...params, enc: '2', seed }).forEach(([key, value]) => url.searchParams.set(key, value));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESOLVER_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/plain' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Unified source resolver returned ${response.status}`);
    return decryptSources(await response.text(), seed, mediaId);
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveUnifiedSources(options: ResolveSourceOptions) {
  const mediaId = Number(options.id);
  if (!Number.isInteger(mediaId)) return { sources: [], subtitles: [] };

  const seedController = new AbortController();
  const seedTimeout = setTimeout(() => seedController.abort(), RESOLVER_TIMEOUT_MS);
  let seedResponse: Response;
  try {
    seedResponse = await fetch(`${SPEEDRACELIGHT_API}/seed?mediaId=${mediaId}`, {
      cache: 'no-store',
      signal: seedController.signal,
    });
  } finally {
    clearTimeout(seedTimeout);
  }
  if (!seedResponse.ok) throw new Error('Unified source seed unavailable');
  const seedData = (await seedResponse.json()) as { seed?: string };
  if (!seedData.seed) throw new Error('Unified source seed invalid');

  const params = requestParams(options);
  const resolvers = options.resolverId
    ? UNIFIED_RESOLVERS.filter((resolver) => resolver.id === options.resolverId)
    : UNIFIED_RESOLVERS;
  const results = await Promise.allSettled(
    resolvers.map(async (resolver) => ({
      resolver,
      payload: await fetchEncryptedSources(resolver.path, params, seedData.seed as string, mediaId),
    }))
  );

  const sources: UnifiedSource[] = [];
  const subtitles: UnifiedSubtitle[] = [];
  const seenSubtitleUrls = new Set<string>();
  const seenUrls = new Set<string>();

  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const { resolver, payload } = result.value;
    (payload.subtitles || []).forEach((subtitle) => {
      const url = String(subtitle.url || '');
      if (url && !seenSubtitleUrls.has(url)) {
        seenSubtitleUrls.add(url);
        subtitles.push({
          id: `subtitle-${subtitles.length + 1}`,
          lang: String(subtitle.lang || ''),
          language: String(subtitle.language || ''),
          url: buildSubtitleProxyUrl(url),
        });
      }
    });
    (payload.sources || []).forEach((source, index) => {
      const remoteUrl = String(source.url || source.file || source.src || '');
      const type = sourceType(source);
      if (!/^https?:\/\//i.test(remoteUrl) || (type !== 'hls' && type !== 'mp4') || seenUrls.has(remoteUrl)) return;
      seenUrls.add(remoteUrl);
      const quality = qualityLabel(source.quality || source.label || source.resolution);
      sources.push({
        id: `${resolver.id}-${quality}-${index}`,
        label: quality,
        quality,
        type,
        playbackUrl: buildMediaProxyUrl(remoteUrl),
        provider: resolver.label,
      });
    });
  });

  const qualityRank: Record<string, number> = { '4K': 2160, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360 };
  sources.sort((a, b) => (qualityRank[b.quality] || 0) - (qualityRank[a.quality] || 0));
  return {
    sources,
    subtitles,
  };
}
