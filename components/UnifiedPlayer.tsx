'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours > 0 ? `${hours}:` : ''}${hours > 0 ? String(minutes).padStart(2, '0') : minutes}:${String(seconds).padStart(2, '0')}`;
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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playbackRateRef = useRef(1);
  const controlsTimerRef = useRef<number | null>(null);

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

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsTimer();
    if (!isPlaying || showControls) return;
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2400);
  }, [clearControlsTimer, isPlaying, showControls]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const closeControlsDialog = () => {
    setShowControls(false);
    setShowQuality(false);
    setShowSpeed(false);
  };

  const toggleControlsDialog = () => {
    setControlsVisible(true);
    setShowQuality(false);
    setShowSpeed(false);
    setShowControls((open) => !open);
  };

  const handleStageClick = (event: { target: EventTarget | null }) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, a')) return;
    togglePlayback();
  };

  useEffect(() => {
    scheduleControlsHide();
    return clearControlsTimer;
  }, [clearControlsTimer, scheduleControlsHide]);

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
      <div className={`unified-player unified-player-empty${compact ? ' unified-player-compact' : ''}`}>
        <MonitorPlay size={26} />
        <strong>Clean playback is unavailable</strong>
        <span>Try refreshing the source list.</span>
        {onRefresh && <button type="button" className="player-control-button" onClick={onRefresh}><RotateCw size={15} /> Refresh source</button>}
      </div>
    );
  }

  return (
    <div
      className={`unified-player${compact ? ' unified-player-compact' : ''}${!controlsVisible ? ' unified-controls-hidden' : ''}`}
      ref={containerRef}
      onPointerDown={revealControls}
      onFocusCapture={revealControls}
    >
      <div className="unified-player-stage" onClick={handleStageClick}>
        <video
          ref={videoRef}
          className="unified-video"
          poster={poster}
          playsInline
          controls={false}
          preload="metadata"
          onPlay={() => {
            setIsPlaying(true);
            setControlsVisible(false);
          }}
          onPause={() => {
            setIsPlaying(false);
            setControlsVisible(true);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onError={() => setPlaybackError('The clean stream could not be loaded.')}
          aria-label={`Watch ${title}`}
        />

        {!isPlaying && duration > 0 && !playbackError && (
          <button
            type="button"
            className="unified-paused-state"
            onClick={(event) => {
              event.stopPropagation();
              togglePlayback();
            }}
            aria-label={`Resume ${title}`}
          >
            <span className="unified-paused-content">
              <span className="unified-paused-icon"><Play size={22} fill="currentColor" /></span>
              <strong>Paused</strong>
              <small>Tap to continue</small>
            </span>
          </button>
        )}

        {!compact && (
          <>
            {playbackError && <div className="unified-player-error" role="status">{playbackError}</div>}
            <button type="button" className="player-close" onClick={onClose} aria-label="Close player">
              <X size={18} />
            </button>
          </>
        )}
      </div>

      {!compact && (
        <div className={`unified-player-dock${!controlsVisible ? ' is-hidden' : ''}`}>
          <div className="unified-player-progress-row">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => {
                const nextTime = Number(event.target.value);
                setCurrentTime(nextTime);
                if (videoRef.current) videoRef.current.currentTime = nextTime;
              }}
              disabled={!duration}
              aria-label="Seek video"
            />
            <span>{formatTime(duration)}</span>
          </div>
          <div className="unified-player-toolbar">
            <button type="button" className="player-control-button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause video' : 'Play video'}>
              {isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
            </button>
            <button type="button" className={`player-control-button${showControls ? ' is-active' : ''}`} onClick={toggleControlsDialog} aria-expanded={showControls}>
              <Settings2 size={15} /> Controls
            </button>
            <button type="button" className="player-control-button" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {isFullscreen ? 'Exit' : 'Full screen'}
            </button>
          </div>
        </div>
      )}

      {!compact && showControls && (
        <div
          className="unified-controls-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Player controls"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeControlsDialog();
          }}
        >
          <div className="unified-player-menu unified-player-menu-modal">
            <div className="unified-player-menu-heading">
              <span>Player controls</span>
              <div>
                <small>Clean native player</small>
                <button type="button" className="unified-menu-close" onClick={closeControlsDialog} aria-label="Close player controls">
                  <X size={16} />
                </button>
              </div>
            </div>
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
        </div>
      )}
    </div>
  );
}
