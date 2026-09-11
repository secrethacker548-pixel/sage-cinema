import type { TMDBMovie } from '../types/tmdb';
import type { UnifiedSubtitle } from './unifiedTypes';

interface CaptionSearchOptions {
  movie: TMDBMovie;
  lang?: string;
  season?: number;
  episode?: number;
}

export async function searchOnlineCaptions({ movie, lang = 'en', season = 1, episode = 1 }: CaptionSearchOptions) {
  const type = movie.first_air_date ? 'tv' : 'movie';
  const title = movie.title || movie.name || '';
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
  const response = await fetch(
    `/api/subtitles/${type}/${movie.id}?title=${encodeURIComponent(title)}&year=${year}&lang=${encodeURIComponent(lang)}&season=${season}&episode=${episode}`
  );
  if (!response.ok) throw new Error('Caption search failed');
  const data = await response.json() as { subtitles?: UnifiedSubtitle[]; message?: string };
  if (data.message && !data.subtitles?.length) throw new Error(data.message);
  return data.subtitles || [];
}
