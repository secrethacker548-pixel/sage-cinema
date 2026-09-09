import type { TMDBMovie } from '../types/tmdb';

const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p';
const detailsCache = new Map<string, Promise<TMDBMovie | null>>();
const imageCache = new Set<string>();

function mediaTypeOf(movie: Pick<TMDBMovie, 'media_type' | 'first_air_date'>) {
  return movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
}

export function getMovieDetails<T extends TMDBMovie = TMDBMovie>(id: number | string, mediaType: 'movie' | 'tv') {
  const cacheKey = `${mediaType}:${id}`;
  const cached = detailsCache.get(cacheKey);
  if (cached) return cached as Promise<T | null>;

  const request = fetch(`/api/movie/${id}?type=${mediaType}`, { cache: 'force-cache' })
    .then((response) => (response.ok ? response.json() as Promise<T> : null))
    .catch(() => null);
  detailsCache.set(cacheKey, request as Promise<TMDBMovie | null>);
  return request;
}

export function prefetchMovieDetails(movie: TMDBMovie) {
  void getMovieDetails(movie.id, mediaTypeOf(movie));
}

export function preloadMovieImage(path: string | null | undefined, size: 'w500' | 'w1280' | 'original' = 'w500') {
  if (typeof window === 'undefined' || !path || imageCache.has(path)) return;
  if ('connection' in navigator && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;

  const image = new window.Image();
  image.decoding = 'async';
  image.src = `${TMDB_IMAGE_URL}/${size}${path}`;
  imageCache.add(path);
}
