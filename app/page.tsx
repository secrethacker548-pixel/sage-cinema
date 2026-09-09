'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Command,
  Film,
  Info,
  Menu,
  Play,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useSearch } from '../lib/hooks/useSearch';
import { useWatchHistory } from '../lib/hooks/useWatchHistory';
import { useAppContext } from '../lib/context/AppContext';
import MiniPlayer from '../components/MiniPlayer';
import MovieDetailModal from '../components/MovieDetailModal';
import SageLoader from '../components/SageLoader';
import { clearActivePlayback, readActivePlayback, type ActivePlayback } from '../lib/activePlayback';
import type { TMDBMovie } from '../types/tmdb';

const IMAGE_URL = 'https://image.tmdb.org/t/p/original';
const POSTER_URL = 'https://image.tmdb.org/t/p/w500';

type Collections = {
  trending: TMDBMovie[];
  tv: TMDBMovie[];
  latest: TMDBMovie[];
  topRated: TMDBMovie[];
  action: TMDBMovie[];
  anime: TMDBMovie[];
};

const EMPTY_COLLECTIONS: Collections = {
  trending: [],
  tv: [],
  latest: [],
  topRated: [],
  action: [],
  anime: [],
};

const titleOf = (movie: TMDBMovie) => movie.title || movie.name || 'Untitled';
const yearOf = (movie: TMDBMovie) =>
  (movie.release_date || movie.first_air_date || '').slice(0, 4) || '—';
const mediaTypeOf = (movie: TMDBMovie) =>
  movie.media_type || (movie.first_air_date ? 'tv' : 'movie');

function movieSlug(movie: TMDBMovie) {
  return titleOf(movie)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function Poster({
  movie,
  index,
  onSelect,
}: {
  movie: TMDBMovie;
  index: number;
  onSelect: (movie: TMDBMovie) => void;
}) {
  return (
    <motion.button
      type="button"
      className="shelf-card"
      style={{ '--card-index': index } as CSSProperties}
      whileHover={{ y: -12, rotateY: index % 2 === 0 ? -2 : 2, scale: 1.035 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(movie)}
      aria-label={`Open ${titleOf(movie)}`}
    >
      <span className="shelf-poster">
        {movie.poster_path ? (
          <Image
            src={`${POSTER_URL}${movie.poster_path}`}
            alt=""
            fill
            sizes="(max-width: 640px) 42vw, (max-width: 1100px) 22vw, 15vw"
          />
        ) : (
          <span className="poster-fallback">
            <Film size={26} />
            <small>No artwork</small>
          </span>
        )}
        <span className="poster-vignette" />
        <span className="poster-rating">
          <Star size={12} fill="currentColor" /> {movie.vote_average?.toFixed(1) || '—'}
        </span>
        <span className="poster-play">
          <Play size={14} fill="currentColor" />
        </span>
      </span>
      <span className="shelf-meta">
        <strong>{titleOf(movie)}</strong>
        <span>
          {yearOf(movie)} <i /> {mediaTypeOf(movie) === 'tv' ? 'Series' : 'Film'}
        </span>
      </span>
    </motion.button>
  );
}

function Section({
  id,
  eyebrow,
  title,
  note,
  items,
  onSelect,
}: {
  id: string;
  eyebrow: string;
  title: string;
  note: string;
  items: TMDBMovie[];
  onSelect: (movie: TMDBMovie) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const updateScrollState = () => {
      setCanScrollPrev(row.scrollLeft > 4);
      setCanScrollNext(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    };

    updateScrollState();
    row.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      row.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [items.length]);

  const scroll = (direction: 'prev' | 'next') => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({
      left: direction === 'prev' ? -row.clientWidth * 0.82 : row.clientWidth * 0.82,
      behavior: 'smooth',
    });
  };

  if (items.length === 0) return null;

  return (
    <motion.section
      id={id}
      className="cinema-section"
      initial={{ opacity: 0, y: 46, scale: 0.965 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.75, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="section-heading">
        <div>
          <span className="section-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <div className="section-heading-actions">
          <span className="section-note">{note}</span>
          <div className="section-controls" aria-label={`${title} navigation`}>
            <button
              type="button"
              className="section-scroll-button"
              onClick={() => scroll('prev')}
              disabled={!canScrollPrev}
              aria-label={`Previous ${title} titles`}
            >
              <ChevronLeft size={17} strokeWidth={2.5} />
              <span>Prev</span>
            </button>
            <button
              type="button"
              className="section-scroll-button"
              onClick={() => scroll('next')}
              disabled={!canScrollNext}
              aria-label={`Next ${title} titles`}
            >
              <span>Next</span>
              <ChevronRight size={17} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
      <div className="shelf-viewport">
        <div className="shelf-track" ref={rowRef}>
          {items.slice(0, 24).map((movie, index) => (
            <Poster key={`${movie.id}-${index}`} movie={movie} index={index} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

export default function Home() {
  const router = useRouter();
  const [collections, setCollections] = useState<Collections>(EMPTY_COLLECTIONS);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [activePlayback, setActivePlayback] = useState<ActivePlayback | null>(null);
  const { history, addToHistory } = useWatchHistory();
  const { genres } = useAppContext();
  const { query, setQuery, results, isSearching } = useSearch(450);

  const featured = collections.trending[featuredIndex] || collections.latest[0] || null;

  useEffect(() => {
    const storedPlayback = readActivePlayback();
    if (storedPlayback) {
      // The session store is an external browser-only source of truth.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePlayback(storedPlayback);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCollections() {
      try {
        setIsLoading(true);
        const requests = await Promise.all([
          fetch('/api/movies/collection'),
          fetch('/api/tv/collection'),
          fetch('/api/movies/latest'),
          fetch('/api/movies/top-rated'),
          fetch('/api/movies/genre/28'),
          fetch('/api/anime/collection'),
        ]);
        const payloads = await Promise.all(requests.map((response) => response.json()));
        if (!active) return;
        setCollections({
          trending: payloads[0].results || [],
          tv: payloads[1].results || [],
          latest: payloads[2].results || [],
          topRated: payloads[3].results || [],
          action: payloads[4].results || [],
          anime: payloads[5].results || [],
        });
        setError('');
      } catch (loadError) {
        console.error('Sage Cinema collection error:', loadError);
        if (active) setError('The cinema signal is taking a little longer than usual.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadCollections();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (collections.trending.length < 2) return;
    const timer = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % Math.min(collections.trending.length, 8));
    }, 7200);
    return () => window.clearInterval(timer);
  }, [collections.trending.length]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const handleSearchKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setQuery('');
      }
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleSearchKeyDown);
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener('keydown', handleSearchKeyDown);
    };
  }, [searchOpen, setQuery]);

  const openMovie = (movie: TMDBMovie) => setSelectedMovie(movie);

  const startMovie = (movie: TMDBMovie) => {
    clearActivePlayback();
    addToHistory(movie);
    router.push(`/movie/${movie.id}/${mediaTypeOf(movie)}-${movieSlug(movie)}`);
  };

  const openActivePlayback = () => {
    if (!activePlayback) return;
    const movie = activePlayback.movie;
    router.push(`/movie/${movie.id}/${mediaTypeOf(movie)}-${movieSlug(movie)}`);
  };

  const closeActivePlayback = () => {
    clearActivePlayback();
    setActivePlayback(null);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleHeroPointer = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    setHeroTilt({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
  };

  const resetHeroPointer = () => setHeroTilt({ x: 0, y: 0 });

  if (isLoading && !error) {
    return <SageLoader label="Tuning the projector" detail="Loading the living catalog" />;
  }

  return (
    <main className="cinema-app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className={`topbar${scrollY > 24 ? ' is-scrolled' : ''}`}>
        <a className="brand-mark" href="#top" aria-label="Sage Cinema home">
          <span className="brand-orbit"><span /></span>
          <span>SAGE<span>CINEMA</span></span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a className="active" href="#top">Home</a>
          <a href="#films">Films</a>
          <a href="#series">Series</a>
          <a href="#anime">Anime</a>
        </nav>
        <button className="search-trigger" type="button" onClick={() => setSearchOpen(true)}>
          <Search size={16} />
          <span>Search the universe</span>
          <kbd><Command size={12} /> K</kbd>
        </button>
        <button
          className="mobile-menu-trigger"
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="mobile-nav-panel"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <nav className="mobile-nav-links" aria-label="Mobile navigation">
              <a href="#top" onClick={closeMobileMenu}>Home</a>
              <a href="#films" onClick={closeMobileMenu}>Films</a>
              <a href="#series" onClick={closeMobileMenu}>Series</a>
              <a href="#anime" onClick={closeMobileMenu}>Anime</a>
            </nav>
            <div className="mobile-genre-list">
              <span>Genres</span>
              <div>
                {Object.entries(genres).map(([genreId, genreName]) => (
                  <button
                    type="button"
                    key={genreId}
                    onClick={() => {
                      closeMobileMenu();
                      router.push(`/genre/${genreId}`);
                    }}
                  >
                    {genreName}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section
        id="top"
        className="hero-stage"
        onPointerMove={handleHeroPointer}
        onPointerLeave={resetHeroPointer}
      >
        {featured?.backdrop_path && (
          <motion.div
            className="hero-backdrop"
            animate={{ scale: 1.05 + Math.min(scrollY / 4200, 0.06), x: heroTilt.x * -10, y: heroTilt.y * -8 }}
            transition={{ type: 'spring', stiffness: 70, damping: 20 }}
            style={{ backgroundImage: `url(${IMAGE_URL}${featured.backdrop_path})` }}
          />
        )}
        <div className="hero-wash" />
        <div className="hero-grid" />
        <div className="hero-copy">
          <motion.div
            className="eyebrow-pip"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            SAGE CINEMA / SIGNAL 01
          </motion.div>
          <AnimatePresence mode="wait">
            {featured ? (
              <motion.div
                key={featured.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.55 }}
              >
                <h1>{titleOf(featured)}</h1>
                <div className="hero-meta">
                  <span className="match-score">{Math.round((featured.vote_average || 0) * 10)}% match</span>
                  <span>{yearOf(featured)}</span>
                  <span>{mediaTypeOf(featured) === 'tv' ? 'Series' : 'Feature film'}</span>
                  <span>4K</span>
                </div>
                <p>{featured.overview || 'A new story is waiting for you.'}</p>
                <div className="hero-actions">
                  <button className="button-primary" type="button" onClick={() => startMovie(featured)}>
                    <Play size={17} fill="currentColor" /> Enter the story
                  </button>
                  <button className="button-ghost" type="button" onClick={() => openMovie(featured)}>
                    <Info size={17} /> Details
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="hero-loading"><span /> Tuning the projector...</div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          className="hero-poster-plane"
          animate={{ rotateY: heroTilt.x * 7, rotateX: heroTilt.y * -5, y: scrollY * -0.045 }}
          transition={{ type: 'spring', stiffness: 65, damping: 18 }}
        >
          <div className="poster-backplate" />
          <div className="hero-poster">
            {featured?.poster_path ? (
              <Image src={`${IMAGE_URL}${featured.poster_path}`} alt={titleOf(featured)} fill priority sizes="360px" />
            ) : (
              <div className="poster-fallback"><Film size={46} /></div>
            )}
            <div className="poster-glint" />
            <div className="poster-stamp">NOW<br />PLAYING</div>
          </div>
          {collections.trending.slice(1, 4).map((movie, index) => (
            <button
              type="button"
              key={movie.id}
              className={`orbit-poster orbit-poster-${index + 1}`}
              onClick={() => openMovie(movie)}
              aria-label={`Open ${titleOf(movie)}`}
            >
              {movie.poster_path && <Image src={`${POSTER_URL}${movie.poster_path}`} alt="" fill sizes="110px" />}
            </button>
          ))}
        </motion.div>

        <div className="hero-footer">
          <span><i className="live-dot" /> Live catalog signal</span>
          <span>Scroll to explore</span>
          <button type="button" onClick={() => document.getElementById('films')?.scrollIntoView({ behavior: 'smooth' })} aria-label="Explore films">
            <ArrowUpRight size={15} />
          </button>
        </div>
      </section>

      <section className="intro-strip">
        <span className="intro-number">01</span>
        <div>
          <span className="section-eyebrow">A living catalog</span>
          <h2>Pick a feeling.<br /><em>Find a world.</em></h2>
        </div>
        <p>Freshly tuned from the movie universe. Move through the shelves, open a title, and let the next story find you.</p>
      </section>

      <div className="content-wrap">
        {error && <div className="signal-error"><span />{error} <button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
        {isLoading ? (
          <div className="loading-shelves" aria-label="Loading movie catalog">
            {[1, 2, 3].map((item) => <div className="skeleton-row" key={item}><span /><span /><span /><span /><span /></div>)}
          </div>
        ) : (
          <>
            {history.length > 0 && <Section id="continue" eyebrow="Your orbit" title="Continue watching" note="Pick up where you left off" items={history} onSelect={openMovie} />}
            <Section id="films" eyebrow="The main feature" title="Trending now" note="Most watched in the catalog" items={collections.trending} onSelect={openMovie} />
            <Section id="latest" eyebrow="Fresh arrivals" title="New on the reel" note="Just added to the signal" items={collections.latest} onSelect={openMovie} />
            <Section id="series" eyebrow="Long-form worlds" title="Series to disappear into" note="One more episode" items={collections.tv} onSelect={openMovie} />
            <Section id="action" eyebrow="High velocity" title="Turn up the voltage" note="Action, adventure, adrenaline" items={collections.action} onSelect={openMovie} />
            <Section id="top-rated" eyebrow="The inner circle" title="Critics' orbit" note="Highest rated right now" items={collections.topRated} onSelect={openMovie} />
            <Section id="anime" eyebrow="Beyond reality" title="Animated dimensions" note="Stories with no ceiling" items={collections.anime} onSelect={openMovie} />
          </>
        )}
      </div>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-top">
            <div className="site-footer-lede">
              <span className="section-eyebrow">Your next screening</span>
              <h2>Stay curious.<br /><em>Keep watching.</em></h2>
              <a className="site-footer-arrow" href="#top" aria-label="Back to the top">
                <ArrowUpRight size={22} />
              </a>
            </div>
            <div className="site-footer-links">
              <div className="site-footer-column">
                <span>Explore</span>
                <a href="#top">Home</a>
                <a href="#films">Films</a>
                <a href="#series">Series</a>
                <a href="#anime">Anime</a>
              </div>
              <div className="site-footer-column">
                <span>Find your next</span>
                <a href="#continue">Continue watching</a>
                <a href="#latest">Fresh arrivals</a>
                <a href="#top-rated">Critics&apos; orbit</a>
                <a href="#action">High velocity</a>
              </div>
            </div>
          </div>
          <div className="site-footer-bottom">
            <div className="brand-mark"><span className="brand-orbit"><span /></span><span>SAGE<span>CINEMA</span></span></div>
            <p>Stories worth staying up for.</p>
            <span>TMDB-powered discovery</span>
            <span>© {new Date().getFullYear()} Sage Cinema</span>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {activePlayback && (
          <MiniPlayer
            playback={activePlayback}
            onOpen={openActivePlayback}
            onClose={closeActivePlayback}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="search-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Search the catalog"
          >
            <div className="search-panel">
              <div className="search-head">
                <div className="search-title-block">
                  <span className="section-eyebrow">Search the catalog</span>
                  <h2>Find your next watch.</h2>
                  <p>Search films, series, and anime from one place.</p>
                </div>
                <button className="search-close-button" type="button" onClick={() => { setSearchOpen(false); setQuery(''); }} aria-label="Close search">Close</button>
              </div>
              <div className="search-input-wrap">
                <Search size={20} />
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try a title, series, or platform" />
                {query && (
                  <button
                    type="button"
                    className="search-clear-button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
                {isSearching && <span className="input-spinner" />}
              </div>
              <div className="search-helper-row">
                <span>{query ? (isSearching ? 'Scanning the catalog…' : `${Math.min(results.length, 12)} ${results.length === 1 ? 'match' : 'matches'} found`) : 'Start with a title, a character, or a platform.'}</span>
                <span className="search-helper-key">ESC <i>to close</i></span>
              </div>
              <div className="search-content">
                {query && results.length > 0 ? (
                  <>
                    <div className="search-results-heading">
                      <div>
                        <span className="section-eyebrow">Catalog results</span>
                        <strong>{results.length > 12 ? '12+' : results.length} signals</strong>
                      </div>
                      <span>Films <i /> Series <i /> Anime</span>
                    </div>
                    <div className="search-results">
                      {results.slice(0, 12).map((movie, index) => <Poster key={`${movie.id}-${mediaTypeOf(movie)}`} movie={movie} index={index} onSelect={(item) => { setSearchOpen(false); openMovie(item); }} />)}
                    </div>
                  </>
                ) : (
                  <div className={`search-empty${query ? ' is-no-results' : ''}`}>
                    <span className="search-empty-icon">{query ? <Film size={28} /> : <Search size={28} />}</span>
                    <span className="section-eyebrow">{query ? 'No matches yet' : 'Open the catalog'}</span>
                    <h3>{query ? 'Nothing in this signal.' : 'What are you in the mood for?'}</h3>
                    <p>{query ? 'Try another title, spelling, or platform.' : 'Search by title, series, or platform and we’ll bring the screening room to you.'}</p>
                    {!query && <div className="search-empty-chips"><span>Films</span><span>Series</span><span>Anime</span><span>Platforms</span></div>}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        {selectedMovie && (
          <MovieDetailModal
            movie={selectedMovie}
            genres={genres}
            onClose={() => setSelectedMovie(null)}
            onPlay={startMovie}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
