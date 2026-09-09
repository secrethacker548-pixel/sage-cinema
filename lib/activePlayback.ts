import type { TMDBMovie } from '../types/tmdb';

export const ACTIVE_PLAYBACK_STORAGE_KEY = 'sage-cinema-active-playback';

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

export function readActivePlayback(): ActivePlayback | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.sessionStorage.getItem(ACTIVE_PLAYBACK_STORAGE_KEY);
    if (!stored) return null;

    const playback = JSON.parse(stored) as ActivePlayback;
    if (!playback?.movie?.id || !playback.embedUrl) return null;
    return playback;
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
