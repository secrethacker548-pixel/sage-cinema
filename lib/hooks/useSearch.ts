import { useState, useEffect, useCallback } from 'react';
import type { TMDBMovie } from '../../types/tmdb';
import { getCachedRequest, setCachedRequest } from '../utils/requestCache';

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: TMDBMovie[];
  isSearching: boolean;
}

export function useSearch(debounceMs: number = 500): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const updateQuery = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    const hasQuery = nextQuery.trim().length > 0;
    setIsSearching(hasQuery);
    setResults([]);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    const controller = new AbortController();
    const delayDebounce = setTimeout(async () => {
      try {
        const cacheKey = `search-${normalizedQuery}`;
        const cachedData = getCachedRequest(cacheKey);

        if (cachedData) {
          setResults(cachedData);
          setIsSearching(false);
          return;
        }

        const res = await fetch(`/api/search?query=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search request failed with status ${res.status}`);
        const data = await res.json();
        const searchResults = data.results || [];

        setResults(searchResults);
        setCachedRequest(cacheKey, searchResults);
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Search error:', error);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, debounceMs);
    return () => {
      clearTimeout(delayDebounce);
      controller.abort();
    };
  }, [query, debounceMs]);

  return { query, setQuery: updateQuery, results, isSearching };
}
