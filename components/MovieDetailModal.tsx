'use client';

import { motion } from 'framer-motion';
import { Building2, Clock3, Globe2, Play, Star, Users, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TMDBMovie } from '../types/tmdb';

const IMG_URL = 'https://image.tmdb.org/t/p/original';
const PROFILE_URL = 'https://image.tmdb.org/t/p/w185';

type MovieCastMember = {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
};

type MovieDetails = TMDBMovie & {
  tagline?: string;
  runtime?: number;
  episode_run_time?: number[];
  status?: string;
  original_language?: string;
  credits?: { cast?: MovieCastMember[] };
};

interface MovieDetailModalProps {
  movie: TMDBMovie;
  onClose: () => void;
  genres: Record<number, string>;
  onPlay?: (movie: TMDBMovie) => void;
}

export default function MovieDetailModal({ movie, onClose, genres, onPlay }: MovieDetailModalProps) {
  const router = useRouter();
  const [details, setDetails] = useState<MovieDetails>(movie);
  const [loadedDetailsKey, setLoadedDetailsKey] = useState<string | null>(null);
  const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
  const detailsKey = `${mediaType}:${movie.id}`;
  const activeDetails: MovieDetails = details.id === movie.id ? details : movie;
  const isLoadingDetails = loadedDetailsKey !== detailsKey;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/movie/${movie.id}?type=${mediaType}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: MovieDetails | null) => {
        if (data && !controller.signal.aborted) setDetails(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoadedDetailsKey(detailsKey);
      });

    return () => controller.abort();
  }, [detailsKey, mediaType, movie.id]);

  const title = activeDetails.title || activeDetails.name || 'Untitled';
  const year = (activeDetails.release_date || activeDetails.first_air_date || '').slice(0, 4) || '—';
  const genreNames = activeDetails.genres?.map((genre) => genre.name).slice(0, 5)
    || activeDetails.genre_ids?.map((id) => genres[id]).filter(Boolean).slice(0, 5)
    || [];
  const studioNames = activeDetails.production_companies?.map((company) => company.name).filter(Boolean).slice(0, 4) || [];
  const cast = activeDetails.credits?.cast?.filter((member) => member.name).slice(0, 8) || [];
  const runtime = activeDetails.runtime || activeDetails.episode_run_time?.[0];
  const runtimeLabel = runtime ? runtime >= 60 ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : `${runtime}m` : '—';
  const statusLabel = activeDetails.status === 'Released' ? 'Available now' : activeDetails.status || 'Available now';

  const handlePlay = () => {
    onClose();
    if (onPlay) {
      onPlay(activeDetails);
      return;
    }
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    router.push(`/movie/${movie.id}/${mediaType}-${slug}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="detail-layer"
      onClick={onClose}
    >
      <motion.div
        className="detail-card"
        initial={{ y: 26, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close details">
          <X size={18} />
        </button>
        <div className="detail-art">
          {activeDetails.backdrop_path ? (
            <Image src={`${IMG_URL}${activeDetails.backdrop_path}`} alt="" fill sizes="700px" />
          ) : (
            <div />
          )}
        </div>
        <div className="detail-body">
          <span className="section-eyebrow">{mediaType === 'tv' ? 'Series' : 'Feature film'} / {year}</span>
          <h2>{title}</h2>
          <div className="detail-meta">
            <span><Star size={14} fill="currentColor" /> {activeDetails.vote_average?.toFixed(1) || '—'}</span>
            <span>{statusLabel}</span>
            <span>{activeDetails.release_date || activeDetails.first_air_date ? year : '—'}</span>
          </div>
          {activeDetails.tagline && <p className="detail-tagline">{activeDetails.tagline}</p>}
          <p>{activeDetails.overview || 'A story without a synopsis yet. Press play to enter.'}</p>
          <button className="button-primary" type="button" onClick={handlePlay}>
            <Play size={16} fill="currentColor" /> Enter the story
          </button>

          {isLoadingDetails ? (
            <div className="detail-loading-copy" role="status">Gathering the full screening notes…</div>
          ) : (
            <div className="detail-extra">
              <div className="detail-fact-grid">
                <div><Clock3 size={15} /><span>Runtime</span><strong>{runtimeLabel}</strong></div>
                <div><Globe2 size={15} /><span>Language</span><strong>{activeDetails.original_language?.toUpperCase() || '—'}</strong></div>
                <div><Building2 size={15} /><span>Studios</span><strong>{studioNames.length || '—'}</strong></div>
              </div>

              {genreNames.length > 0 && (
                <section className="detail-info-block">
                  <div className="detail-info-heading"><span className="section-eyebrow">The signal</span><strong>Genres</strong></div>
                  <div className="detail-chip-list">
                    {genreNames.map((genre) => <span key={genre}>{genre}</span>)}
                  </div>
                </section>
              )}

              {studioNames.length > 0 && (
                <section className="detail-info-block">
                  <div className="detail-info-heading"><span className="section-eyebrow">Behind the frame</span><strong>Studios</strong></div>
                  <p className="detail-info-copy">{studioNames.join(' · ')}</p>
                </section>
              )}

              {cast.length > 0 && (
                <section className="detail-info-block">
                  <div className="detail-info-heading"><span className="section-eyebrow">In the story</span><strong><Users size={15} /> Cast</strong></div>
                  <div className="detail-cast-grid">
                    {cast.map((member) => (
                      <div className="detail-cast-member" key={member.id}>
                        <span className="detail-cast-avatar">
                          {member.profile_path ? <Image src={`${PROFILE_URL}${member.profile_path}`} alt="" fill sizes="48px" /> : <Users size={15} />}
                        </span>
                        <span><strong>{member.name}</strong><small>{member.character || 'Cast'}</small></span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
