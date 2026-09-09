'use client';

import { Maximize2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ActivePlayback } from '../lib/activePlayback';

interface MiniPlayerProps {
  playback: ActivePlayback;
  onOpen: () => void;
  onClose: () => void;
}

export default function MiniPlayer({ playback, onOpen, onClose }: MiniPlayerProps) {
  const title = playback.movie.title || playback.movie.name || 'Current screening';

  return (
    <motion.aside
      className="mini-player"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      aria-label={`Mini player for ${title}`}
    >
      <div className="mini-player-heading">
        <div className="mini-player-title">
          <span><i /> Now playing</span>
          <strong>{title}</strong>
        </div>
        <div className="mini-player-actions">
          <button type="button" onClick={onOpen} aria-label="Open full player" title="Open full player">
            <Maximize2 size={16} />
          </button>
          <button type="button" onClick={onClose} aria-label="Close mini player" title="Close mini player">
            <X size={17} />
          </button>
        </div>
      </div>
      <div className="mini-player-stage">
        <iframe
          src={playback.embedUrl}
          title={`Mini player for ${title}`}
          allow="autoplay; fullscreen *; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
          tabIndex={-1}
        />
        <button type="button" className="mini-player-open-label" onClick={onOpen}>
          <Maximize2 size={14} /> Open player
        </button>
      </div>
    </motion.aside>
  );
}
