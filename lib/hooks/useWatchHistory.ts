import { useState, useEffect } from 'react';
import type { TMDBMovie } from '../../types/tmdb';

const STORAGE_KEY = 'sage_movies_watch_history';
const MAX_HISTORY = 20;

function mediaTypeOf(movie: Pick<TMDBMovie, 'media_type' | 'first_air_date'>) {
  return movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
}

export function useWatchHistory() {
  const [history, setHistory] = useState<TMDBMovie[]>([]);

  useEffect(() => {
    let active = true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          queueMicrotask(() => {
            if (active) {
              setHistory(parsed.filter((item): item is TMDBMovie => Boolean(item && typeof item === 'object' && item.id)));
            }
          });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to read watch history', error);
    }
    return () => {
      active = false;
    };
  }, []);

  const addToHistory = (movie: TMDBMovie) => {
    setHistory((prev) => {
      // Remove existing entry if it exists
      const filtered = prev.filter(
        (m) => m.id !== movie.id || mediaTypeOf(m) !== mediaTypeOf(movie)
      );
      // Add new entry to the beginning
      const updated = [movie, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage can be unavailable in private browsing or restricted webviews.
      }
      return updated;
    });
  };

  const removeFromHistory = (movieId: number) => {
    setHistory((prev) => {
      const updated = prev.filter((m) => m.id !== movieId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage can be unavailable in private browsing or restricted webviews.
      }
      return updated;
    });
  };

  const clearHistory = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures; the in-memory history is still cleared.
    }
    setHistory([]);
  };

  return { history, addToHistory, removeFromHistory, clearHistory };
}
