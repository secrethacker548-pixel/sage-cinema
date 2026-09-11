import { Redis } from '@upstash/redis';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface PersistentSiteStats {
  totalVisits: number;
  movieViews: Record<string, number>;
}

type AnalyticsEvent =
  | { type: 'visit' }
  | { type: 'movie_view'; movieId: string };

const REDIS_STATS_KEY = 'sage-cinema:analytics:stats';
const LOCAL_STATS_PATH = path.join(process.cwd(), '.local-data', 'site-stats.json');

let redisClient: Redis | null | undefined;
let localWriteLock = Promise.resolve();
let hasLoggedRedisFallback = false;

function emptyStats(): PersistentSiteStats {
  return { totalVisits: 0, movieViews: {} };
}

function canUseLocalFallback() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV;
}

function normalizeStats(value: unknown): PersistentSiteStats {
  if (!value || typeof value !== 'object') return emptyStats();
  const data = value as Partial<PersistentSiteStats>;
  const movieViews: Record<string, number> = {};
  if (data.movieViews && typeof data.movieViews === 'object') {
    Object.entries(data.movieViews).forEach(([movieId, count]) => {
      if (/^\d+$/.test(movieId) && Number.isFinite(count)) movieViews[movieId] = Math.max(0, Number(count));
    });
  }
  return {
    totalVisits: Number.isFinite(data.totalVisits) ? Math.max(0, Number(data.totalVisits)) : 0,
    movieViews,
  };
}

function getRedis() {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    if (!canUseLocalFallback()) throw new Error('Upstash Redis analytics is not configured');
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function noteRedisFallback(message: string, error: unknown) {
  if (!hasLoggedRedisFallback) {
    console.warn(`${message}; using the local analytics fallback.`, error);
    hasLoggedRedisFallback = true;
  }
}

async function readRedisStats(redis: Redis) {
  const values = await redis.hgetall<Record<string, string | number | null>>(REDIS_STATS_KEY);
  const stats = emptyStats();
  if (!values) return stats;

  Object.entries(values).forEach(([field, value]) => {
    const count = Number(value);
    if (!Number.isFinite(count)) return;
    if (field === 'totalVisits') stats.totalVisits = Math.max(0, count);
    if (field.startsWith('movie:') && /^movie:\d+$/.test(field)) {
      stats.movieViews[field.slice('movie:'.length)] = Math.max(0, count);
    }
  });
  return stats;
}

async function readLocalStats() {
  try {
    return normalizeStats(JSON.parse(await readFile(LOCAL_STATS_PATH, 'utf8')));
  } catch {
    return emptyStats();
  }
}

async function withLocalWriteLock<T>(operation: () => Promise<T>) {
  const previous = localWriteLock;
  let release!: () => void;
  localWriteLock = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function updateLocalStats(event: AnalyticsEvent) {
  return withLocalWriteLock(async () => {
    const stats = await readLocalStats();
    if (event.type === 'visit') stats.totalVisits += 1;
    if (event.type === 'movie_view') stats.movieViews[event.movieId] = (stats.movieViews[event.movieId] || 0) + 1;
    await mkdir(path.dirname(LOCAL_STATS_PATH), { recursive: true });
    await writeFile(LOCAL_STATS_PATH, JSON.stringify(stats, null, 2));
    return stats;
  });
}

export async function getPersistentStats() {
  const redis = getRedis();
  if (redis) {
    try {
      return await readRedisStats(redis);
    } catch (error) {
      if (!canUseLocalFallback()) throw error;
      noteRedisFallback('Upstash Redis analytics read failed', error);
    }
  }
  return readLocalStats();
}

export async function recordAnalyticsEvent(event: AnalyticsEvent) {
  const redis = getRedis();
  if (redis) {
    try {
      const field = event.type === 'visit' ? 'totalVisits' : `movie:${event.movieId}`;
      await redis.hincrby(REDIS_STATS_KEY, field, 1);
      return await readRedisStats(redis);
    } catch (error) {
      if (!canUseLocalFallback()) throw error;
      noteRedisFallback('Upstash Redis analytics write failed', error);
    }
  }
  return updateLocalStats(event);
}
