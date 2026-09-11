import type { TMDBMovie } from '../types/tmdb';

export const ACTIVE_PLAYBACK_STORAGE_KEY = 'sage-cinema-active-playback';
const ACTIVE_PLAYBACK_MAX_AGE_MS = 25 * 60 * 1000;

export interface ActivePlaybackSource {
  id: string;
  label: string;
  quality: string;
  type: 'hls' | 'mp4' | 'dash' | 'unknown';
  playbackUrl: string;
  provider: string;
}

export interface ActivePlaybackSubtitle {
  id: string;
  lang: string;
  language: string;
  url: string;
}

export interface ActivePlayback {
  movie: TMDBMovie;
  embedUrl: string;
  playerMode?: 'native' | 'embed';
  sources?: ActivePlaybackSource[];
  subtitles?: ActivePlaybackSubtitle[];
  server: string;
  lang: string;
  season: number;
  episode: number;
  updatedAt: number;
}

function isPlaybackSource(value: unknown): value is ActivePlaybackSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<ActivePlaybackSource>;
  return typeof source.id === 'string' && typeof source.playbackUrl === 'string' &&
    (/^https?:\/\//i.test(source.playbackUrl) || source.playbackUrl.startsWith('/api/media-proxy?')) &&
    typeof source.quality === 'string' && typeof source.label === 'string' &&
    typeof source.provider === 'string' && ['hls', 'mp4', 'dash', 'unknown'].includes(source.type || '');
}

function isPlaybackSubtitle(value: unknown): value is ActivePlaybackSubtitle {
  if (!value || typeof value !== 'object') return false;
  const subtitle = value as Partial<ActivePlaybackSubtitle>;
  return typeof subtitle.id === 'string' && typeof subtitle.url === 'string' &&
    (/^https?:\/\//i.test(subtitle.url) || subtitle.url.startsWith('/api/subtitles/file?')) &&
    typeof subtitle.lang === 'string' && typeof subtitle.language === 'string';
}

export function readActivePlayback(): ActivePlayback | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.sessionStorage.getItem(ACTIVE_PLAYBACK_STORAGE_KEY);
    if (!stored) return null;

    const playback = JSON.parse(stored) as ActivePlayback;
    if (!playback?.movie?.id || !playback.embedUrl || typeof playback.embedUrl !== 'string' ||
        !Number.isFinite(playback.updatedAt)) return null;
    if (Date.now() - playback.updatedAt >= ACTIVE_PLAYBACK_MAX_AGE_MS) {
      window.sessionStorage.removeItem(ACTIVE_PLAYBACK_STORAGE_KEY);
      return null;
    }
    return {
      ...playback,
      sources: Array.isArray(playback.sources) ? playback.sources.filter(isPlaybackSource) : [],
      subtitles: Array.isArray(playback.subtitles) ? playback.subtitles.filter(isPlaybackSubtitle) : [],
      server: typeof playback.server === 'string' ? playback.server : '',
      lang: typeof playback.lang === 'string' ? playback.lang : 'en',
      season: Number.isInteger(playback.season) && playback.season > 0 ? playback.season : 1,
      episode: Number.isInteger(playback.episode) && playback.episode > 0 ? playback.episode : 1,
    };
  } catch {
    return null;
  }
}

export function saveActivePlayback(playback: Omit<ActivePlayback, 'updatedAt'>) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      ACTIVE_PLAYBACK_STORAGE_KEY,
      JSON.stringify({ ...playback, updatedAt: Date.now() })
    );
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }
}

export function clearActivePlayback() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(ACTIVE_PLAYBACK_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the player can still be closed locally.
  }
}
