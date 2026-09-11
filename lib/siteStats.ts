import { hasCookieConsent } from './cookieConsent';

export interface SiteStats {
  totalVisits: number;
  movieViews: Record<string, number>;
}

export const EMPTY_SITE_STATS: SiteStats = {
  totalVisits: 0,
  movieViews: {},
};

let visitRequest: Promise<SiteStats> | null = null;

function parseStats(value: unknown): SiteStats {
  if (!value || typeof value !== 'object') return EMPTY_SITE_STATS;
  const data = value as Partial<SiteStats>;
  const movieViews: Record<string, number> = {};
  if (data.movieViews && typeof data.movieViews === 'object') {
    Object.entries(data.movieViews).forEach(([movieId, count]) => {
      if (/^\d+$/.test(movieId) && Number.isFinite(count)) {
        movieViews[movieId] = Math.max(0, Number(count));
      }
    });
  }
  return {
    totalVisits: Number.isFinite(data.totalVisits) ? Math.max(0, Number(data.totalVisits)) : 0,
    movieViews,
  };
}

async function requestStats(init?: RequestInit) {
  const response = await fetch('/api/analytics', { cache: 'no-store', ...init });
  if (!response.ok) throw new Error('Analytics request failed');
  return parseStats(await response.json());
}

export async function recordSiteVisit() {
  if (typeof window === 'undefined') return EMPTY_SITE_STATS;
  if (!hasCookieConsent('analytics')) return EMPTY_SITE_STATS;

  const visitMarker = 'sage-cinema-visit-recorded';
  let hasRecordedVisit = false;
  try {
    hasRecordedVisit = window.sessionStorage.getItem(visitMarker) === '1';
  } catch {
    // Continue with a best-effort visit request when session storage is blocked.
  }

  if (!hasRecordedVisit) {
    if (!visitRequest) {
      visitRequest = requestStats({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'visit' }),
      }).then((stats) => {
        try {
          window.sessionStorage.setItem(visitMarker, '1');
        } catch {
          // Ignore storage failures; the server can still count this visit.
        }
        return stats;
      }).finally(() => {
        visitRequest = null;
      });
    }
    return visitRequest;
  }

  return requestStats();
}

export function recordMovieView(movieId: number) {
  if (!hasCookieConsent('analytics')) return Promise.resolve(EMPTY_SITE_STATS);
  return requestStats({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'movie_view', movieId }),
  });
}
