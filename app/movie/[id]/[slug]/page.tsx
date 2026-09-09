'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  Play,
  RotateCw,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useAppContext } from '../../../../lib/context/AppContext';
import { useWatchHistory } from '../../../../lib/hooks/useWatchHistory';
import { useWatchedEpisodes } from '../../../../lib/hooks/useWatchedEpisodes';
import { useScroll } from '../../../../lib/hooks/useScroll';
import { getSimilarMovies } from '../../../../lib/recommendations';
import {
  clearActivePlayback,
  readActivePlayback,
  saveActivePlayback,
} from '../../../../lib/activePlayback';
import type { TMDBMovie } from '../../../../types/tmdb';
import { cn } from '../../../../lib/utils';
import { AdsterraNativeBanner, openAdsterraDirectLink } from '../../../../components/Adsterra';
import UnifiedPlayer from '../../../../components/UnifiedPlayer';
import SageLoader from '../../../../components/SageLoader';
import type { UnifiedSource } from '../../../../lib/unifiedSources';
import {
  DEFAULT_LANG,
  DEFAULT_SERVER,
  getServer,
  SUBTITLE_LANGUAGES,
  VIDEO_SERVERS,
} from '../../../../lib/videoServers';

const IMG_URL = 'https://image.tmdb.org/t/p/original';
const THUMB_URL = 'https://image.tmdb.org/t/p/w500';
const SOURCE_SERVER_OPTIONS = VIDEO_SERVERS.slice(0, 2);

export default function MovieDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const slug = params?.slug as string;
  const { genres } = useAppContext();
  const { addToHistory } = useWatchHistory();
  const { isWatched, markWatched, toggleWatched } = useWatchedEpisodes();

  const [movie, setMovie] = useState<TMDBMovie | any>(null);
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [lang, setLang] = useState(DEFAULT_LANG);
  const [embedUrl, setEmbedUrl] = useState('');
  const [playbackSources, setPlaybackSources] = useState<UnifiedSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [similarMovies, setSimilarMovies] = useState<TMDBMovie[]>([]);
  const [showUpNext, setShowUpNext] = useState(false);

  type ServerStatus = 'up' | 'down' | 'checking';
  const [serverHealth, setServerHealth] = useState<Record<string, ServerStatus>>({});
  const healthReqId = React.useRef(0);
  const playbackInteractions = React.useRef(0);
  const isPlayingRef = React.useRef(false);
  const serverRef = React.useRef(DEFAULT_SERVER);
  const isNavScrolled = useScroll(16);
  const registerPlaybackAdInteraction = React.useCallback(() => {
    playbackInteractions.current += 1;
    if (playbackInteractions.current % 3 === 0) openAdsterraDirectLink();
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    serverRef.current = server;
  }, [server]);

  const persistActivePlayback = React.useCallback(() => {
    if (!movie || !isPlaying || (!embedUrl && playbackSources.length === 0)) return;
    saveActivePlayback({
      movie,
      embedUrl: embedUrl || playbackSources[0]?.playbackUrl || '',
      playerMode: playbackSources.length > 0 ? 'native' : 'embed',
      sources: playbackSources,
      server,
      lang,
      season: selectedSeason,
      episode: selectedEpisode,
    });
  }, [movie, isPlaying, embedUrl, playbackSources, server, lang, selectedSeason, selectedEpisode]);

  useEffect(() => {
    persistActivePlayback();
  }, [persistActivePlayback]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const mediaType = slug?.includes('tv') ? 'tv' : 'movie';
        const res = await fetch(`/api/movie/${id}?type=${mediaType}`);
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          setMovie(null);
          return;
        }

        setMovie(data);
        setError(null);

        const normalizedMovie = {
          ...data,
          genre_ids: data.genres ? data.genres.map((g: any) => g.id) : data.genre_ids || [],
        };
        const currentGenre = normalizedMovie.genre_ids?.[0];
        const vivamax = data.production_companies?.find((c: any) =>
          c.name?.toLowerCase().includes('vivamax')
        );
        const studioId = vivamax ? vivamax.id : data.production_companies?.[0]?.id;
        const isTv = Boolean(data.first_air_date);
        const endpoint = isTv ? '/api/tv/collection' : '/api/movies/collection';
        const collectionType = isTv ? 'tv' : 'movie';

        try {
          const [generalRes, genreRes, studioRes] = await Promise.all([
            fetch(endpoint).then((response) => response.json()),
            currentGenre
              ? fetch(`/api/movies/genre/${currentGenre}?type=${collectionType}`).then((response) => response.json())
              : Promise.resolve({ results: [] }),
            studioId
              ? fetch(`/api/movies/studio/${studioId}?type=${collectionType}`).then((response) => response.json())
              : Promise.resolve({ results: [] }),
          ]);

          const normalizedStudioResults = (studioRes.results || []).map((item: any) => ({
            ...item,
            production_companies: [
              { id: studioId, name: vivamax?.name || data.production_companies?.[0]?.name },
            ],
          }));
          const combinedResults = [
            ...normalizedStudioResults,
            ...(genreRes.results || []),
            ...(generalRes.results || []),
          ];
          const uniquePool = Array.from(
            new Map(combinedResults.map((item) => [item.id, item])).values()
          );
          setSimilarMovies(getSimilarMovies(normalizedMovie, uniquePool, 12));
        } catch (poolError) {
          console.error('Pool fetch error:', poolError);
        }
      } catch (fetchError) {
        console.error('Movie detail error:', fetchError);
        setError('Failed to load movie details');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchMovieDetails();
  }, [id, slug]);

  useEffect(() => {
    if (!movie) return;
    const storedPlayback = readActivePlayback();
    if (!storedPlayback || storedPlayback.movie.id !== movie.id) return;

    // Restore the browser session's active player when expanding the mini-player.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServer(
      SOURCE_SERVER_OPTIONS.some((item) => item.id === storedPlayback.server)
        ? storedPlayback.server
        : DEFAULT_SERVER
    );
    setLang(storedPlayback.lang || DEFAULT_LANG);
    setSelectedSeason(storedPlayback.season || 1);
    setSelectedEpisode(storedPlayback.episode || 1);
    setEmbedUrl(storedPlayback.embedUrl);
    setPlaybackSources(storedPlayback.sources || []);
    setIsPlaying(true);
  }, [movie]);

  const loadVideoSource = React.useCallback(async (
    selectedServer: string,
    selectedLang: string = lang,
    seasonNumber: number = selectedSeason,
    episodeNumber: number = selectedEpisode
  ) => {
    if (!movie) return;
    setIsLoading(true);
    setError(null);

    try {
      const type = movie.first_air_date ? 'tv' : 'movie';
      const title = movie.title || movie.name || '';
      const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
      const response = await fetch(
        `/api/video-sources/${type}/${movie.id}?player=unified&server=${selectedServer}&lang=${selectedLang}&season=${seasonNumber}&episode=${episodeNumber}&title=${encodeURIComponent(title)}&year=${year}&totalSeasons=${movie.number_of_seasons || ''}`
      );
      if (!response.ok) throw new Error('Failed to fetch video source');
      const data = await response.json();

      if (data.player !== 'unified' || !data.sources?.length) {
        setPlaybackSources([]);
        setEmbedUrl('');
        setError(data.error || 'Clean playback is not available for this title yet. Try another source.');
        if (!isPlaying) setIsPlaying(false);
        return;
      }

      setPlaybackSources(data.sources);
      setEmbedUrl(data.sources[0]?.playbackUrl || '');
      addToHistory(movie);
      if (type === 'tv') markWatched(movie.id, seasonNumber, episodeNumber);
    } catch (loadError) {
      console.error('Video source error:', loadError);
      setError('Failed to load video. Please try a different server.');
      if (!isPlaying) setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [movie, lang, selectedSeason, selectedEpisode, isPlaying, addToHistory, markWatched]);

  const runHealthCheck = React.useCallback(() => {
    if (!movie) return;
    const type = movie.first_air_date ? 'tv' : 'movie';
    const reqId = ++healthReqId.current;

    setServerHealth(Object.fromEntries(SOURCE_SERVER_OPTIONS.map((item) => [item.id, 'checking'])));
    fetch(
      `/api/video-health/${type}/${movie.id}?season=${selectedSeason}&episode=${selectedEpisode}`
    )
      .then((response) => response.json())
      .then((data) => {
        if (reqId !== healthReqId.current || !data?.servers) return;
        const scopedHealth = Object.fromEntries(
          SOURCE_SERVER_OPTIONS.map((item) => [item.id, data.servers[item.id] === 'up' ? 'up' : 'down'])
        ) as Record<string, ServerStatus>;
        setServerHealth(scopedHealth);
        if (scopedHealth[serverRef.current] === 'down') {
          const firstUp = SOURCE_SERVER_OPTIONS.find((item) => scopedHealth[item.id] === 'up');
          if (firstUp) {
            setServer(firstUp.id);
            if (isPlayingRef.current) loadVideoSource(firstUp.id, lang);
          }
        }
      })
      .catch(() => {
        if (reqId === healthReqId.current) setServerHealth({});
      });
  }, [movie, selectedSeason, selectedEpisode, lang, loadVideoSource]);

  useEffect(() => {
    // The request updates health state when the external probe resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runHealthCheck();
    // The health probe is intentionally keyed to the loaded title.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id]);

  const isCheckingHealth = Object.values(serverHealth).some((status) => status === 'checking');

  const handlePlay = (seasonNumber: number = selectedSeason, episodeNumber: number = selectedEpisode) => {
    setIsPlaying(true);
    loadVideoSource(server, lang, seasonNumber, episodeNumber);
  };

  const handleServerChange = (newServer: string) => {
    if (!SOURCE_SERVER_OPTIONS.some((item) => item.id === newServer) || serverHealth[newServer] === 'down') return;
    setServer(newServer);
    if (isPlaying) loadVideoSource(newServer, lang);
  };

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    if (isPlaying) loadVideoSource(server, newLang);
  };

  const handleClosePlayer = () => {
    setIsPlaying(false);
    setEmbedUrl('');
    setPlaybackSources([]);
    setShowUpNext(false);
    clearActivePlayback();
  };

  const handleLeaveToDiscovery = () => {
    persistActivePlayback();
    router.push('/');
  };

  const goToMovie = (item: TMDBMovie) => {
    const itemSlug = (item.title || item.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    clearActivePlayback();
    router.push(`/movie/${item.id}/${mediaType}-${itemSlug}`);
  };

  if (isLoading && !movie) {
    return <SageLoader label="Opening the screening room" detail="Preparing your feature" />;
  }

  if (error && !movie) {
    return (
      <div className="nebula-loading">
        <p className="nebula-error-copy">{error}</p>
        <button type="button" className="nebula-button nebula-button-primary" onClick={() => router.back()}>
          <ArrowLeft size={16} /> Go back
        </button>
      </div>
    );
  }

  if (!movie) return null;

  const title = movie.title || movie.name || 'Unknown title';
  const overview = movie.overview || 'No description available.';
  const backdropPath = movie.backdrop_path;
  const posterPath = movie.poster_path;
  const voteAverage = movie.vote_average?.toFixed(1) || 'N/A';
  const releaseDate = movie.release_date || movie.first_air_date;
  const year = releaseDate?.slice(0, 4) || '—';
  const mediaLabel = movie.first_air_date ? 'Series' : 'Film';
  const genreNames = movie.genres?.map((genre: any) => genre.name).slice(0, 3) || [];
  const seasonCount = movie.number_of_seasons || movie.seasons?.length || 1;
  const episodeCount =
    movie.seasons?.find((season: any) => season.season_number === selectedSeason)?.episode_count || 24;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="nebula-detail">
      <div className="nebula-glow nebula-glow-violet" />
      <div className="nebula-glow nebula-glow-cyan" />

      <header className={cn('nebula-nav', isNavScrolled && 'is-scrolled')}>
        <button type="button" className="nebula-back" onClick={handleLeaveToDiscovery}>
          <ArrowLeft size={17} />
          <span>Back to discovery</span>
        </button>
        <div className="nebula-wordmark" aria-label="Sage Cinema">
          <span className="nebula-orbit"><span /></span>
          <span>SAGE <b>CINEMA</b></span>
        </div>
        <button type="button" className="nebula-home" onClick={handleLeaveToDiscovery}>
          Home <span>↗</span>
        </button>
      </header>

      <main className="detail-shell">
        <section className="detail-player-column">
          <div className={cn('nebula-player', isPlaying && playbackSources.length > 0 && 'nebula-player-live')}>
            <div className={cn('player-chrome', isPlaying && 'player-chrome-live')}>
              <span className="player-state">
                <span className={cn('player-state-dot', isPlaying ? 'is-live' : 'is-ready')} />
                {isPlaying ? 'Live playback' : 'Ready to play'}
              </span>
              <span className="player-format">HD · {mediaLabel.toUpperCase()}</span>
            </div>

            {isPlaying ? (
              <>
                {isLoading && (
                  <div className="player-overlay player-loading-overlay">
                    <div className="nebula-loader-ring" />
                    <p>Finding a working stream…</p>
                  </div>
                )}
                {error && (
                  <div className="player-overlay player-error-overlay">
                    <span className="message-icon">!</span>
                    <p>{error}</p>
                    <button
                      type="button"
                      className="nebula-button nebula-button-primary"
                      onClick={() => {
                        setError(null);
                        setIsPlaying(false);
                      }}
                    >
                      Choose another server
                    </button>
                  </div>
                )}
                {playbackSources.length > 0 ? (
                  <UnifiedPlayer
                    title={title}
                    poster={backdropPath ? `${IMG_URL}${backdropPath}` : undefined}
                    sources={playbackSources}
                    onClose={handleClosePlayer}
                    onRefresh={() => loadVideoSource(server, lang)}
                    onChooseSource={() => document.getElementById('playback-sources')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  />
                ) : !isLoading ? (
                  <div className="player-message player-message-error">
                    <span className="message-icon">!</span>
                    <h2>Clean player unavailable</h2>
                    <p>{error || 'This title does not have a clean stream yet. Try another source.'}</p>
                    <button type="button" className="nebula-button nebula-button-primary" onClick={() => loadVideoSource(server, lang)}>
                      <RotateCw size={15} /> Try again
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="player-idle">
                {backdropPath ? (
                  <Image
                    src={`${IMG_URL}${backdropPath}`}
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 900px) 100vw, 68vw"
                    className="player-backdrop"
                  />
                ) : (
                  <div className="player-backdrop player-backdrop-fallback" />
                )}
                <div className="player-backdrop-wash" />
                <div className="idle-centerpiece">
                  <button type="button" className="idle-play" onClick={() => handlePlay()} aria-label={`Play ${title}`}>
                    <Play size={30} fill="currentColor" />
                  </button>
                  <span>Start screening</span>
                </div>
                <div className="idle-title-lockup">
                  <span>Tonight&apos;s feature</span>
                  <strong>{title}</strong>
                </div>
              </div>
            )}
          </div>

          <section id="playback-sources" className="source-card-under-player" aria-label="Servers">
            <div className="source-pill-list">
              {SOURCE_SERVER_OPTIONS.filter((item) => serverHealth[item.id] !== 'down').map((item) => {
                const index = SOURCE_SERVER_OPTIONS.findIndex((option) => option.id === item.id);
                const status = serverHealth[item.id];
                const selected = server === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={cn('source-pill', selected && 'is-selected', status === 'checking' && 'is-checking')}
                    onClick={() => {
                      registerPlaybackAdInteraction();
                      handleServerChange(item.id);
                    }}
                  >
                    <strong>Server {index + 1}</strong>
                  </button>
                );
              })}
              <button
                type="button"
                className="source-refresh-pill"
                onClick={runHealthCheck}
                disabled={isCheckingHealth}
                aria-label="Re-check servers"
                title="Re-check servers"
              >
                <RotateCw size={14} />
              </button>
            </div>
          </section>
        </section>

        <aside className="detail-sidebar">
          <section className="movie-intro-card">
            <div className="movie-poster-frame">
              {posterPath ? (
                <Image src={`${THUMB_URL}${posterPath}`} alt={title} fill sizes="112px" className="movie-poster-image" />
              ) : (
                <span className="poster-fallback-mark">S</span>
              )}
            </div>
            <div className="movie-intro-copy">
              <span className="detail-eyebrow">{mediaLabel} / {year}</span>
              <h1>{title}</h1>
              <div className="movie-meta-row">
                <span className="rating-pill"><Star size={13} fill="currentColor" /> {voteAverage}</span>
                <span>{mediaLabel}</span>
                <span>HD</span>
              </div>
              {genreNames.length > 0 && (
                <div className="genre-row">
                  {genreNames.map((name: string) => <span key={name}>{name}</span>)}
                </div>
              )}
            </div>
          </section>

          <button
            type="button"
            className="watch-cta"
            disabled={isLoading}
            onClick={() => {
              registerPlaybackAdInteraction();
              handlePlay();
            }}
          >
            <span className="watch-cta-icon"><Play size={17} fill="currentColor" /></span>
            <span className="watch-cta-copy">
              <strong>{isPlaying ? 'Reload this stream' : 'Start watching'}</strong>
              <small>{isPlaying ? 'Refresh the current source' : 'We will choose the best source'}</small>
            </span>
            <span className="watch-cta-arrow">↗</span>
          </button>

          <div className="movie-facts">
            <div><span>Rating</span><strong>{voteAverage} / 10</strong></div>
            <div><span>Release</span><strong>{year}</strong></div>
            <div><span>Format</span><strong>1080p</strong></div>
          </div>

          {(movie.first_air_date || movie.number_of_seasons) && (
            <section className="control-card episode-card">
              <div className="control-card-heading compact-heading">
                <div><span className="detail-eyebrow">Series guide</span><h2>Pick an episode</h2></div>
                <span className="season-count">S{selectedSeason} / {seasonCount}</span>
              </div>
              <label className="select-label" htmlFor="season-select">Season</label>
              <div className="select-shell">
                <select
                  id="season-select"
                  value={selectedSeason}
                  onChange={(event) => {
                    const nextSeason = parseInt(event.target.value, 10);
                    setSelectedSeason(nextSeason);
                    setSelectedEpisode(1);
                    if (isPlaying) loadVideoSource(server, lang, nextSeason, 1);
                  }}
                >
                  {Array.from({ length: seasonCount }, (_, index) => index + 1).map((seasonNumber) => (
                    <option key={seasonNumber} value={seasonNumber}>Season {seasonNumber}</option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
              <div className="episode-scroller" aria-label="Episodes">
                {Array.from({ length: episodeCount }, (_, index) => index + 1).map((episodeNumber) => {
                  const watched = isWatched(movie.id, selectedSeason, episodeNumber);
                  const selected = selectedEpisode === episodeNumber;
                  return (
                    <button
                      type="button"
                      key={episodeNumber}
                      className={cn('episode-chip', selected && 'is-selected', watched && 'is-watched')}
                      onClick={() => {
                        registerPlaybackAdInteraction();
                        setSelectedEpisode(episodeNumber);
                        if (isPlaying) loadVideoSource(server, lang, selectedSeason, episodeNumber);
                        else handlePlay(selectedSeason, episodeNumber);
                      }}
                    >
                      E{episodeNumber}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={watched ? `Mark episode ${episodeNumber} as unwatched` : `Mark episode ${episodeNumber} as watched`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleWatched(movie.id, selectedSeason, episodeNumber);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleWatched(movie.id, selectedSeason, episodeNumber);
                          }
                        }}
                        className="episode-check"
                      >
                        <Check size={11} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <details className="control-card settings-card">
            <summary>
              <span><i className={cn('settings-dot', serverHealth[server] === 'down' && 'is-down', serverHealth[server] === 'checking' && 'is-checking')} /> Stream settings</span>
              <ChevronDown size={17} />
            </summary>
            <div className="settings-body">
              <label className="select-label" htmlFor="language-select">Subtitle language</label>
              <div className="select-shell">
                <select
                  id="language-select"
                  value={lang}
                  onChange={(event) => handleLangChange(event.target.value)}
                  disabled={!getServer(server).supportsLang}
                >
                  {SUBTITLE_LANGUAGES.map((language) => (
                    <option key={language.code} value={language.code}>{language.label}</option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
            </div>
          </details>

          {isPlaying && embedUrl && !error && <AdsterraNativeBanner className="nebula-ad" />}

          <section className="story-card">
            <div className="story-heading">
              <div><span className="detail-eyebrow">The story</span><h2>What it feels like</h2></div>
              <Info size={18} />
            </div>
            <p className={cn('story-copy', !isDescExpanded && 'is-collapsed')}>{overview}</p>
            <button type="button" className="story-toggle" onClick={() => setIsDescExpanded((expanded) => !expanded)}>
              {isDescExpanded ? 'Show less' : 'Read more'} <span>↗</span>
            </button>
          </section>

          <section className="similar-section">
            <div className="similar-heading"><div><span className="detail-eyebrow">Curated next</span><h2>More to explore</h2></div><span>{similarMovies.length || '—'} titles</span></div>
            {similarMovies.length > 0 ? (
              <div className="similar-grid">
                {similarMovies.map((item) => {
                  const isSameStudio = item.production_companies?.some((company) =>
                    movie.production_companies?.some((currentCompany: any) => currentCompany.id === company.id)
                  );
                  return (
                    <button type="button" key={item.id} className="similar-card" onClick={() => goToMovie(item)}>
                      <span className="similar-poster">
                        {item.poster_path ? <Image src={`${THUMB_URL}${item.poster_path}`} alt={item.title || item.name || ''} fill sizes="(max-width: 620px) 120px, 150px" /> : <span className="poster-fallback-mark">S</span>}
                        <span className="similar-play"><Play size={16} fill="currentColor" /></span>
                        {isSameStudio && <em>Studio pick</em>}
                      </span>
                      <strong>{item.title || item.name}</strong>
                      <small><Star size={11} fill="currentColor" /> {item.vote_average?.toFixed(1) || '—'} · {item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || '—'}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="quiet-copy">Finding a few more titles for this shelf…</p>
            )}
          </section>

          <section className="credits-card">
            <div><span>Genres</span><p>{movie.genres?.map((genre: any) => genre.name).join(' · ') || '—'}</p></div>
            <div><span>Studios</span><p>{movie.production_companies?.slice(0, 3).map((company: any) => company.name).join(' · ') || '—'}</p></div>
            {Object.keys(genres).length > 0 && <span className="credits-note">Sage Cinema catalog · curated nightly</span>}
          </section>
        </aside>
      </main>

      {isPlaying && embedUrl && similarMovies.length > 0 && !showUpNext && (
        <button type="button" className="up-next-trigger" onClick={() => setShowUpNext(true)}>
          <Sparkles size={15} /> Browse next
        </button>
      )}

      <AnimatePresence>
        {isPlaying && showUpNext && similarMovies.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="up-next-drawer"
          >
            <div className="up-next-heading"><div><span className="detail-eyebrow">Keep watching</span><h2>Up next</h2></div><button type="button" onClick={() => setShowUpNext(false)} aria-label="Close up next"><X size={17} /></button></div>
            <div className="up-next-track">
              {similarMovies.slice(0, 6).map((item) => (
                <button type="button" key={item.id} className="up-next-card" onClick={() => goToMovie(item)}>
                  <span>{item.poster_path && <Image src={`${THUMB_URL}${item.poster_path}`} alt="" fill sizes="90px" />}</span>
                  <strong>{item.title || item.name}</strong>
                </button>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
