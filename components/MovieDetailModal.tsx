'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Play } from 'lucide-react';
import Image from 'next/image';
import type { TMDBMovie } from '../types/tmdb';

const IMG_URL = 'https://image.tmdb.org/t/p/original';

interface MovieDetailModalProps {
  movie: TMDBMovie;
  onClose: () => void;
  genres: Record<number, string>;
}

export default function MovieDetailModal({ movie, onClose, genres }: MovieDetailModalProps) {
  const router = useRouter();

  const handlePlay = () => {
    const slug = (movie.title || movie.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    onClose();
    router.push(`/movie/${movie.id}/${mediaType}-${slug}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 overflow-y-auto"
    >
      <button 
        onClick={onClose}
        className="fixed top-5 left-5 z-[60] bg-black/60 text-white rounded-full p-2 hover:bg-netflix-red transition"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-16">
        <div className="mb-6 text-center md:text-left">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
            {movie.title || movie.name}
          </h2>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm md:text-base">
            <span className="text-yellow-400 font-semibold flex items-center">
              <Star className="w-4 h-4 mr-1 fill-current" /> {movie.vote_average?.toFixed(1)}
            </span>
            <span className="text-neutral-400">
              {movie.genre_ids?.map(id => genres[id]).filter(Boolean).join(', ')}
            </span>
            <span className="text-neutral-400">
              {movie.release_date || movie.first_air_date}
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8 mb-8">
          <div className="w-full md:w-[70%] aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative">
            {movie.backdrop_path ? (
              <Image src={`${IMG_URL}${movie.backdrop_path}`} alt="" fill className="object-cover opacity-70" sizes="(max-width: 768px) 100vw, 70vw" />
            ) : <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-black" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
              <span className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-lime-300">Unified player</span>
              <h3 className="mb-5 text-2xl font-bold md:text-3xl">Ready for the screening room</h3>
              <button onClick={handlePlay} className="bg-lime-300 px-6 py-3 font-bold text-black transition hover:bg-cyan-300">
                <Play className="mr-2 inline h-5 w-5 fill-current" /> Open clean player
              </button>
            </div>
          </div>

          <div className="w-full md:w-[30%] flex flex-col gap-6">
            <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
              <Image src={`${IMG_URL}${movie.poster_path || ''}`} alt={movie.title || movie.name || 'Movie Poster'} fill className="object-cover" sizes="(max-width: 768px) 100vw, 30vw" />
            </div>

            {/* Play Now Button */}
            <button
              onClick={handlePlay}
              className="w-full bg-netflix-red hover:bg-red-700 text-white font-bold py-3 rounded flex items-center justify-center transition transform hover:scale-[1.02]"
            >
              <Play className="w-5 h-5 mr-2 fill-current" /> PLAY NOW
            </button>

            <div className="w-full rounded border border-cyan-400/20 bg-cyan-400/5 p-3 text-center text-sm font-semibold text-cyan-200">
              Quality and speed are controlled by Sage Cinema.
            </div>

            <div className="bg-netflix-dark p-4 rounded-lg">
              <p className="text-sm font-semibold text-neutral-200">Playback sources are normalized into one player.</p>
              <p className="mt-2 text-sm text-neutral-400">Open the player to choose quality, playback speed, subtitles, and fullscreen.</p>
            </div>
          </div>
        </div>

        <div className="bg-netflix-dark/50 p-8 rounded-xl">
          <h3 className="text-2xl font-bold mb-4">Overview</h3>
          <p className="text-lg text-neutral-300 leading-relaxed max-w-4xl">
            {movie.overview}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
