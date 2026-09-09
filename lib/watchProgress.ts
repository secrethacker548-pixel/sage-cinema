export interface WatchProgress {
  position: number;
  duration: number;
  updatedAt: number;
}

export type WatchProgressMap = Record<string, WatchProgress>;

const STORAGE_KEY = 'sage-cinema-watch-progress';

function isProgress(value: unknown): value is WatchProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Partial<WatchProgress>;
  return Number.isFinite(progress.position) && Number.isFinite(progress.duration);
}

export function readAllWatchProgress(): WatchProgressMap {
  if (typeof window === 'undefined') return {};

  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(stored).filter(([, value]) => isProgress(value))) as WatchProgressMap;
  } catch {
    return {};
  }
}

export function readWatchProgress(key: string) {
  return readAllWatchProgress()[key] || null;
}

export function saveWatchProgress(key: string, position: number, duration: number) {
  if (typeof window === 'undefined' || !key || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;

  try {
    const progress = readAllWatchProgress();
    progress[key] = {
      position: Math.max(0, Math.min(position, duration)),
      duration,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }
}
