'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  MonitorPlay,
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
import { getSimilarMovies } from '../../../../lib/recommendations';
import type { TMDBMovie } from '../../../../types/tmdb';
import { cn } from '../../../../lib/utils';
import { AdsterraNativeBanner, openAdsterraDirectLink } from '../../../../components/Adsterra';
import {
  DEFAULT_LANG,
  DEFAULT_SERVER,
  getServer,
  SUBTITLE_LANGUAGES,
  VIDEO_SERVERS,
} from '../../../../lib/videoServers';

const PLAYER_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-forms allow-fullscreen';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
const THUMB_URL = 'https://image.tmdb.org/t/p/w500';

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
  const serverNumber = (sid: string) => VIDEO_SERVERS.findIndex((s) => s.id === sid) + 1;

  const registerPlaybackAdInteraction = React.useCallback(() => {
    playbackInteractions.current += 1;
    if (playbackInteractions.current % 3 === 0) openAdsterraDirectLink();
  }, []);

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
        const endpoint = slug?.includes('tv') ? '/api/tv/collection' : '/api/movies/collection';

        try {
          const [generalRes, genreRes, studioRes] = await Promise.all([
            fetch(endpoint).then((response) => response.json()),
            currentGenre
              ? fetch(`/api/movies/genre/${currentGenre}`).then((response) => response.json())
              : Promise.resolve({ results: [] }),
            studioId
              ? fetch(`/api/movies/studio/${studioId}`).then((response) => response.json())
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
      const response = await fetch(
        `/api/video-sources/${type}/${movie.id}?server=${selectedServer}&lang=${selectedLang}&season=${seasonNumber}&episode=${episodeNumber}`
      );
      if (!response.ok) throw new Error('Failed to fetch video source');
      const data = await response.json();

      if (!data.embedURL) {
        setError('Video source not available for this server. Try another server.');
        if (!isPlaying) setIsPlaying(false);
        return;
      }

      setEmbedUrl(data.embedURL);
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

    setServerHealth(Object.fromEntries(VIDEO_SERVERS.map((item) => [item.id, 'checking'])));
    fetch(
      `/api/video-health/${type}/${movie.id}?season=${selectedSeason}&episode=${selectedEpisode}`
    )
      .then((response) => response.json())
      .then((data) => {
        if (reqId !== healthReqId.current || !data?.servers) return;
        setServerHealth(data.servers);
        if (data.servers[server] === 'down') {
          const firstUp = VIDEO_SERVERS.find((item) => data.servers[item.id] === 'up');
          if (firstUp) {
            setServer(firstUp.id);
            if (isPlaying) loadVideoSource(firstUp.id, lang);
          }
        }
      })
      .catch(() => {
        if (reqId === healthReqId.current) setServerHealth({});
      });
  }, [movie, selectedSeason, selectedEpisode, isPlaying, server, lang, loadVideoSource]);

  useEffect(() => {
    // The request updates health state when the external probe resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runHealthCheck();
    // The health probe is intentionally keyed to the loaded title.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id]);

  const isCheckingHealth = Object.values(serverHealth).some((status) => status === 'checking');
  const allServersDown =
    Object.keys(serverHealth).length > 0 &&
    Object.values(serverHealth).every((status) => status === 'down');

  const handlePlay = (seasonNumber: number = selectedSeason, episodeNumber: number = selectedEpisode) => {
    setIsPlaying(true);
    loadVideoSource(server, lang, seasonNumber, episodeNumber);
  };

  const handleServerChange = (newServer: string) => {
    setServer(newServer);
    if (isPlaying) loadVideoSource(newServer, lang);
  };

  const handleNextServer = () => {
    const currentIndex = VIDEO_SERVERS.findIndex((item) => item.id === server);
    const nextServer = VIDEO_SERVERS[(currentIndex + 1) % VIDEO_SERVERS.length].id;
    setServer(nextServer);
    if (isPlaying) loadVideoSource(nextServer, lang);
  };

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    if (isPlaying) loadVideoSource(server, newLang);
  };

  const handleClosePlayer = () => {
    setIsPlaying(false);
    setEmbedUrl('');
    setShowUpNext(false);
  };

  const goToMovie = (item: TMDBMovie) => {
    const itemSlug = (item.title || item.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    router.push(`/movie/${item.id}/${mediaType}-${itemSlug}`);
  };

  if (isLoading && !movie) {
    return (
      <div className="nebula-loading">
        <div className="nebula-loader-ring" />
        <p>Opening the screening room</p>
      </div>
    );
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

      <header className="nebula-nav">
        <button type="button" className="nebula-back" onClick={() => router.back()}>
          <ArrowLeft size={17} />
          <span>Back to discovery</span>
        </button>
        <div className="nebula-wordmark" aria-label="Sage Cinema">
          <span className="nebula-orbit"><span /></span>
          <span>SAGE <b>CINEMA</b></span>
        </div>
        <button type="button" className="nebula-home" onClick={() => router.push('/')}>
          Home <span>↗</span>
        </button>
      </header>

      <main className="detail-shell">
        <section className="detail-player-column">
          <div className="nebula-player">
            <div className={cn('player-chrome', isPlaying && 'player-chrome-live')}>
              <span className="player-state">
                <span className={cn('player-state-dot', isPlaying ? 'is-live' : 'is-ready')} />
                {isPlaying ? 'Live playback' : 'Ready to play'}
              </span>
              <span className="player-format">HD · {mediaLabel.toUpperCase()}</span>
            </div>

            {allServersDown ? (
              <div className="player-message player-message-error">
                <span className="message-icon">!</span>
                <h2>Not available yet</h2>
                <p>
                  {releaseDate
                    ? `${title} is dated ${releaseDate}. Stream files may not be indexed yet.`
                    : `Streaming servers are still indexing ${title}.`}
                </p>
                <button type="button" className="nebula-button nebula-button-primary" onClick={() => router.push('/')}>
                  Browse other titles
                </button>
              </div>
            ) : isPlaying ? (
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
                {embedUrl && (
                  <iframe
                    key={`${embedUrl}|${getServer(server).sandboxTolerant}`}
                    src={embedUrl}
                    className="player-embed"
                    title={`Watch ${title}`}
                    width="100%"
                    height="100%"
                    loading="eager"
                    allow="autoplay; fullscreen *; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="origin"
                    sandbox={getServer(server).sandboxTolerant ? PLAYER_SANDBOX : undefined}
                  />
                )}
                <button type="button" className="player-close" onClick={handleClosePlayer} aria-label="Close player">
                  <X size={18} />
                </button>
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

          <div className="player-footer">
            <div className="player-now-playing">
              <span className={cn('player-state-dot', isPlaying ? 'is-live' : 'is-ready')} />
              <span>{isPlaying ? `Streaming ${title}` : 'Your stream is ready when you are'}</span>
            </div>
            {isPlaying && (
              <div className="player-footer-actions">
                <button
                  type="button"
                  onClick={() => {
                    registerPlaybackAdInteraction();
                    loadVideoSource(server, lang);
                  }}
                >
                  <RotateCw size={14} /> Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    registerPlaybackAdInteraction();
                    handleNextServer();
                  }}
                >
                  Next source <span>↗</span>
                </button>
              </div>
            )}
          </div>

          <div className="player-tip">
            <Sparkles size={14} />
            <span>We check the available sources before you press play.</span>
          </div>
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

          <section className="control-card source-card">
            <div className="control-card-heading">
              <div><span className="detail-eyebrow">Playback</span><h2>Choose a source</h2></div>
              <MonitorPlay size={20} />
            </div>
            <div className="source-grid">
              {VIDEO_SERVERS.map((item, index) => {
                const status = serverHealth[item.id];
                const selected = server === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={cn('source-tile', selected && 'is-selected')}
                    onClick={() => {
                      registerPlaybackAdInteraction();
                      handleServerChange(item.id);
                    }}
                  >
                    <span className="source-tile-top"><span>Source {String(index + 1).padStart(2, '0')}</span><i className={cn(status === 'up' && 'is-up', status === 'down' && 'is-down', status === 'checking' && 'is-checking')} /></span>
                    <strong>{item.id}</strong>
                    <small>{status === 'down' ? 'Offline' : status === 'checking' ? 'Checking' : status === 'up' ? 'Online' : 'Ready'}</small>
                  </button>
                );
              })}
            </div>
            <div className="source-card-footer">
              <span><i className="source-legend-dot" /> {isCheckingHealth ? 'Checking sources…' : `${serverNumber(server)} selected`}</span>
              <button type="button" onClick={runHealthCheck} disabled={isCheckingHealth}>
                <RotateCw size={13} /> {isCheckingHealth ? 'Checking' : 'Re-check'}
              </button>
            </div>
          </section>

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
              <label className="select-label" htmlFor="server-select">Streaming source</label>
              <div className="select-shell">
                <select
                  id="server-select"
                  value={server}
                  onChange={(event) => {
                    registerPlaybackAdInteraction();
                    handleServerChange(event.target.value);
                  }}
                >
                  {VIDEO_SERVERS.map((item, index) => (
                    <option key={item.id} value={item.id}>Source {index + 1} · {item.id}</option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
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
                        {item.poster_path ? <Image src={`${THUMB_URL}${item.poster_path}`} alt={item.title || item.name || ''} fill sizes="120px" /> : <span className="poster-fallback-mark">S</span>}
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
