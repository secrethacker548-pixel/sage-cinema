'use client';

import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import type { TMDBGenre } from '../../types/tmdb';
import type { ReactNode } from 'react';

interface AppContextType {
  genres: Record<number, string>;
  isLoadingGenres: boolean;
  refreshGenres: () => Promise<void>;
  hasDownloadedApp: boolean;
  markAppDownloaded: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [genres, setGenres] = useState<Record<number, string>>({});
  const [isLoadingGenres, setIsLoadingGenres] = useState(true);
  const [hasDownloadedApp, setHasDownloadedApp] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (typeof window === 'undefined') return;
      try {
        const downloaded = localStorage.getItem('sagemovies_app_downloaded') === 'true';
        if (downloaded) setHasDownloadedApp(true);
      } catch {
        // Storage may be blocked in private browsing or restricted webviews.
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const markAppDownloaded = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sagemovies_app_downloaded', 'true');
      } catch {
        // The in-memory state still applies for this session.
      }
    }
    setHasDownloadedApp(true);
  }, []);

  const fetchGenres = useCallback(async () => {
    setIsLoadingGenres(true);
    try {
      const res = await fetch('/api/genres');
      if (!res.ok) throw new Error(`Genres request failed with status ${res.status}`);
      const data = await res.json();

      const genreMap: Record<number, string> = {};
      if (Array.isArray(data.genres)) {
        data.genres.forEach((g: TMDBGenre) => {
          genreMap[g.id] = g.name;
        });
      } else {
        throw new Error('Genres response has an invalid shape');
      }
      setGenres(genreMap);
    } catch (error) {
      console.error('Error fetching genres:', error);
    } finally {
      setIsLoadingGenres(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void fetchGenres();
    });
    return () => {
      active = false;
    };
  }, [fetchGenres]);

  const refreshGenres = async () => {
    await fetchGenres();
  };

  return (
    <AppContext.Provider
      value={{
        genres,
        isLoadingGenres,
        refreshGenres,
        hasDownloadedApp,
        markAppDownloaded,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
