'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Maximize2, Minimize2, MonitorPlay, Pause, Play, RotateCw, Settings2, X } from 'lucide-react';
import type Hls from 'hls.js';
import type { UnifiedSource } from '../lib/unifiedSources';

interface UnifiedPlayerProps {
  title: string;
  poster?: string;
  sources: UnifiedSource[];
  compact?: boolean;
  autoPlay?: boolean;
  onClose?: () => void;
  onRefresh?: () => void;
  onChooseSource?: () => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];
const QUALITY_RANK: Record<string, number> = { '4K': 2160, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360 };

function qualityRank(quality: string) {
  return QUALITY_RANK[quality] || Number.parseInt(quality, 10) || 0;
}

export default function UnifiedPlayer({
  title,
  poster,
  sources,
  compact = false,
  autoPlay = false,
  onClose,
  onRefresh,
  onChooseSource,
}: UnifiedPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const playbackRateRef = useRef(1);

  const playableSources = useMemo(
    () => sources.filter((source) => source.type === 'hls' || source.type === 'mp4'),
    [sources]
  );
  const qualities = useMemo(
    () => Array.from(new Set(playableSources.map((source) => source.quality))).sort((a, b) => qualityRank(b) - qualityRank(a)),
    [playableSources]
  );
  const activeSource = useMemo(() => {
    if (selectedQuality !== 'Auto') {
      return playableSources.find((source) => source.quality === selectedQuality) || playableSources[0];
    }
    return playableSources[0];
  }, [playableSources, selectedQuality]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource) return;

    let cancelled = false;
    let hls: Hls | null = null;
    const resumeAt = video.currentTime || 0;
    const shouldResume = autoPlay || !video.paused || resumeAt > 0;
    const startPlayback = () => {
      if (cancelled) return;
      if (resumeAt > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(resumeAt, video.duration - 0.5);
      video.playbackRate = playbackRateRef.current;
      if (shouldResume) video.play().catch(() => undefined);
    };

    setPlaybackError(null);
    video.pause();
    video.removeAttribute('src');
    video.load();

    const loadNative = () => {
      video.src = activeSource.playbackUrl;
      video.addEventListener('loadedmetadata', startPlayback, { once: true });
      video.load();
    };

    if (activeSource.type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setPlaybackError('This browser cannot play the clean stream format.');
          return;
        }
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
        hls.on(Hls.Events.ERROR, (...args: unknown[]) => {
          const data = args[1] as { fatal?: boolean } | undefined;
          if (data?.fatal) setPlaybackError('The clean stream stopped responding. Try refresh or another quality.');
        });
        hls.loadSource(activeSource.playbackUrl);
        hls.attachMedia(video);
      }).catch(() => setPlaybackError('The clean player could not start in this browser.'));
    } else {
      loadNative();
    }

    return () => {
      cancelled = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [activeSource, autoPlay]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current.requestFullscreen();
    } catch {
      setPlaybackError('Fullscreen is not available in this browser.');
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  if (!activeSource) {
    return (
      <div className="unified-player unified-player-empty">
        <MonitorPlay size={26} />
        <strong>Clean playback is unavailable</strong>
        <span>Try refreshing the source list.</span>
        {onRefresh && <button type="button" className="player-control-button" onClick={onRefresh}><RotateCw size={15} /> Refresh source</button>}
      </div>
    );
  }

  return (
    <div className={`unified-player${compact ? ' unified-player-compact' : ''}`} ref={containerRef}>
      <video
        ref={videoRef}
        className="unified-video"
        poster={poster}
        playsInline
        controls
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setPlaybackError('The clean stream could not be loaded.')}
        aria-label={`Watch ${title}`}
      />

      {!compact && (
        <>
          {playbackError && <div className="unified-player-error" role="status">{playbackError}</div>}
          <button type="button" className="player-close" onClick={onClose} aria-label="Close player">
            <X size={18} />
          </button>
          <div className="unified-player-toolbar">
            <button type="button" className="player-control-button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause video' : 'Play video'}>
              {isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
            </button>
            <button type="button" className={`player-control-button${showControls ? ' is-active' : ''}`} onClick={() => setShowControls((open) => !open)} aria-expanded={showControls}>
              <Settings2 size={15} /> Controls
            </button>
            <button type="button" className="player-control-button" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {isFullscreen ? 'Exit' : 'Full screen'}
            </button>
          </div>
          {showControls && (
            <div className="unified-player-menu">
              <div className="unified-player-menu-heading"><span>Player controls</span><small>Clean native player</small></div>
              <div className="unified-player-menu-grid">
                <div className="unified-player-menu-group">
                  <span><MonitorPlay size={14} /> Quality</span>
                  <button type="button" className="unified-select-button" onClick={() => { setShowQuality((open) => !open); setShowSpeed(false); }}>
                    {selectedQuality} <span>⌄</span>
                  </button>
                  {showQuality && (
                    <div className="unified-option-list">
                      {['Auto', ...qualities].map((quality) => (
                        <button key={quality} type="button" className={selectedQuality === quality ? 'is-selected' : ''} onClick={() => { setSelectedQuality(quality); setShowQuality(false); }}>
                          {quality}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="unified-player-menu-group">
                  <span><Gauge size={14} /> Speed</span>
                  <button type="button" className="unified-select-button" onClick={() => { setShowSpeed((open) => !open); setShowQuality(false); }}>
                    {playbackRate}× <span>⌄</span>
                  </button>
                  {showSpeed && (
                    <div className="unified-option-list">
                      {SPEED_OPTIONS.map((speed) => (
                        <button key={speed} type="button" className={playbackRate === speed ? 'is-selected' : ''} onClick={() => { setPlaybackRate(speed); setShowSpeed(false); }}>
                          {speed}×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="player-control-note">Quality switches between the clean stream files. Speed is controlled by Sage Cinema.</p>
              <div className="player-control-actions">
                {onRefresh && <button type="button" onClick={onRefresh}><RotateCw size={14} /> Refresh source</button>}
                {onChooseSource && <button type="button" onClick={onChooseSource}><MonitorPlay size={14} /> Choose source</button>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
