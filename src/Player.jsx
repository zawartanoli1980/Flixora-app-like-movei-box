import React, {useEffect, useMemo, useRef, useState} from 'react';
import Hls from 'hls.js';
import {
  X,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Maximize,
  Volume2,
  VolumeX,
} from 'lucide-react';

const DEMO_SOURCES = [
  {
    id: 'demo-primary',
    label: 'Demo CDN 1',
    quality: 'Auto',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: 'video/mp4',
    audioLanguages: ['Default'],
    subtitles: [],
    isDemo: true,
  },
  {
    id: 'demo-backup',
    label: 'Demo CDN 2',
    quality: '720p',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    type: 'video/mp4',
    audioLanguages: ['Default'],
    subtitles: [],
    isDemo: true,
  },
];

function isSafeMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  if (value.startsWith('./')) return !value.includes('..') && !value.startsWith('.//');
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeSources(candidateSources) {
  const provided = Array.isArray(candidateSources) ? candidateSources : [];
  const safe = provided
    .map((source, index) => {
      if (typeof source === 'string') {
        return {id: `source-${index}`, label: `Server ${index + 1}`, url: source};
      }
      return source && typeof source === 'object'
        ? {
            id: source.id || `source-${index}`,
            label: source.label || `Server ${index + 1}`,
            quality: source.quality || 'Auto',
            url: source.url,
            type: source.type,
            audioLanguages: Array.isArray(source.audioLanguages) ? source.audioLanguages : [],
            subtitles: Array.isArray(source.subtitles) ? source.subtitles : [],
            isDemo: Boolean(source.isDemo),
          }
        : null;
    })
    .filter((source) => source && isSafeMediaUrl(source.url));

  const unique = [...safe];
  for (const demoSource of DEMO_SOURCES) {
    if (!unique.some((source) => source.url === demoSource.url)) unique.push(demoSource);
  }
  return unique;
}

function getMediaIdentity(movie, episode) {
  return episode?.id ? `${movie.id}:episode:${episode.id}` : movie.id;
}

export default function Player({movie, onClose, onProgress, initialProgress = 0}) {
  const videoRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const hlsRef = useRef(null);
  const lastSavedAtRef = useRef(0);
  const pendingPositionRef = useRef(Number(initialProgress) || 0);
  const switchingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onProgressRef = useRef(onProgress);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Loading video…');
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [audioLanguage, setAudioLanguage] = useState('Default');
  const [subtitleLanguage, setSubtitleLanguage] = useState('Off');

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const episodes = Array.isArray(movie.episodes) ? movie.episodes : [];
  const activeEpisode = episodes[episodeIndex] || null;
  const availableSeasons = [...new Set(episodes.map(episode => Number(episode.season) || 1))];
  const mediaIdentity = getMediaIdentity(movie, activeEpisode);
  const sources = useMemo(
    () => normalizeSources(activeEpisode?.sources || movie.sources || (movie.streamUrl ? [movie.streamUrl] : [])),
    [activeEpisode, movie],
  );
  const activeSource = sources[sourceIndex] || sources[0];
  const qualityOptions = [...new Set(sources.map(source => source.quality || 'Auto'))];
  const audioOptions = activeSource?.audioLanguages?.length
    ? [...new Set(activeSource.audioLanguages)]
    : Array.isArray(movie.audioTracks) && movie.audioTracks.length
      ? [...new Set(movie.audioTracks)]
      : ['Default'];
  const availableSubtitles = activeSource?.subtitles?.length
    ? activeSource.subtitles
    : (movie.subtitleTracks || []).map((language) => ({language, label: language}));
  const subtitleOptions = [
    'Off',
    ...new Set(availableSubtitles.map((track) => track.language || track.label).filter(Boolean)),
  ];

  const reportProgress = (force = false) => {
    const video = videoRef.current;
    if (!video || typeof onProgressRef.current !== 'function') return;
    const nextTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    if (!force && Math.abs(nextTime - lastSavedAtRef.current) < 10) return;
    lastSavedAtRef.current = nextTime;
    onProgressRef.current(movie.id, nextTime, Number.isFinite(video.duration) ? video.duration : 0, {
      mediaIdentity,
      episodeId: activeEpisode?.id || null,
      sourceId: activeSource?.id || null,
      completed: Boolean(video.duration && nextTime / video.duration >= 0.95),
    });
  };

  const switchToNextSource = (message) => {
    const video = videoRef.current;
    if (switchingRef.current) return;
    if (sourceIndex + 1 >= sources.length) {
      setStatus('');
      setError(message || 'No working demo source is available right now.');
      return;
    }
    switchingRef.current = true;
    pendingPositionRef.current = Number.isFinite(video?.currentTime) ? video.currentTime : 0;
    setError('');
    setStatus(`Switching to ${sources[sourceIndex + 1].label}…`);
    setSourceIndex((current) => current + 1);
  };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), video[controls], [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource) return undefined;
    let cancelled = false;
    switchingRef.current = false;
    setPlaying(false);
    setError('');
    setStatus(`Loading ${activeSource.label}…`);
    setAudioLanguage(audioOptions[0] || 'Default');
    setSubtitleLanguage('Off');
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const sourceUrl = activeSource.url;
    const isHls = activeSource.type === 'application/vnd.apple.mpegurl' || /\.m3u8(?:$|\?)/i.test(sourceUrl);
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({enableWorker: true, maxBufferLength: 30});
      hlsRef.current = hls;
      hls.loadSource(sourceUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) setStatus('');
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;
        switchToNextSource(
          data.type === Hls.ErrorTypes.NETWORK_ERROR
            ? 'The stream could not be reached.'
            : 'This browser could not decode the stream.',
        );
      });
    } else {
      video.src = sourceUrl;
      video.load();
    }

    return () => {
      cancelled = true;
      reportProgress(true);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [activeSource?.id, mediaIdentity]);

  const restorePosition = () => {
    const video = videoRef.current;
    if (!video) return;
    const position = Number(pendingPositionRef.current) || 0;
    if (position > 0 && Number.isFinite(video.duration) && position < video.duration - 3) {
      video.currentTime = position;
    }
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setStatus('');
    switchingRef.current = false;
  };

  const seek = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    setTime(video.currentTime);
    reportProgress(true);
  };

  const chooseSource = (event) => {
    const nextIndex = Number(event.target.value);
    if (!Number.isInteger(nextIndex) || nextIndex === sourceIndex) return;
    pendingPositionRef.current = Number(videoRef.current?.currentTime) || 0;
    setSourceIndex(nextIndex);
  };

  const chooseEpisode = (event) => {
    const nextIndex = Number(event.target.value);
    if (!Number.isInteger(nextIndex) || nextIndex === episodeIndex) return;
    reportProgress(true);
    pendingPositionRef.current = 0;
    lastSavedAtRef.current = 0;
    setEpisodeIndex(nextIndex);
    setSourceIndex(0);
  };

  const chooseSeason = (event) => {
    const season = Number(event.target.value);
    const nextIndex = episodes.findIndex(episode => (Number(episode.season) || 1) === season);
    if (nextIndex < 0 || nextIndex === episodeIndex) return;
    reportProgress(true);
    pendingPositionRef.current = 0;
    lastSavedAtRef.current = 0;
    setEpisodeIndex(nextIndex);
    setSourceIndex(0);
  };

  const chooseQuality = (event) => {
    const nextIndex = sources.findIndex(source => (source.quality || 'Auto') === event.target.value);
    if (nextIndex < 0 || nextIndex === sourceIndex) return;
    pendingPositionRef.current = Number(videoRef.current?.currentTime) || 0;
    setSourceIndex(nextIndex);
  };

  const skipIntro = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(activeEpisode?.introEnd || movie.introEnd || 75, video.duration || 75);
    setTime(video.currentTime);
    reportProgress(true);
  };

  const nextEpisode = () => {
    if (episodeIndex >= episodes.length - 1) return;
    reportProgress(true);
    pendingPositionRef.current = 0;
    lastSavedAtRef.current = 0;
    setEpisodeIndex(index => index + 1);
    setSourceIndex(0);
  };

  const chooseAudio = (event) => {
    const selected = event.target.value;
    setAudioLanguage(selected);
    const tracks = videoRef.current?.audioTracks;
    if (!tracks) return;
    for (const track of tracks) track.enabled = track.language === selected || track.label === selected;
  };

  const chooseSubtitle = (event) => {
    const selected = event.target.value;
    setSubtitleLanguage(selected);
    const tracks = videoRef.current?.textTracks || [];
    for (const track of tracks) {
      track.mode = selected !== 'Off' && (track.language === selected || track.label === selected)
        ? 'showing'
        : 'disabled';
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setError('Playback could not start. Choose another source or try again.'));
    } else {
      video.pause();
    }
  };

  const formatTime = (value) => {
    const safe = Number.isFinite(value) ? value : 0;
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = Math.floor(safe % 60);
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="modal-overlay player-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCloseRef.current?.();
    }}>
      <section
        ref={dialogRef}
        className="player-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-title"
        aria-describedby="player-description"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">NOW PLAYING · {activeSource?.isDemo ? 'PUBLIC DEMO VIDEO' : 'AUTHORIZED SOURCE'}</span>
            <h2 id="player-title">{activeEpisode ? `S${activeEpisode.season || 1} E${activeEpisode.number || episodeIndex + 1} · ${activeEpisode.title}` : movie.title}</h2>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close video player">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="player-stage" aria-busy={Boolean(status)}>
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={movie.backdrop || movie.image}
            onLoadedMetadata={restorePosition}
            onCanPlay={() => setStatus('')}
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
              reportProgress(true);
            }}
            onEnded={() => reportProgress(true)}
            onTimeUpdate={(event) => {
              setTime(event.currentTarget.currentTime);
              setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
              reportProgress(false);
            }}
            onError={() => switchToNextSource('The selected source could not be played.')}
          />
          {status && <div className="player-status" role="status">{status}</div>}
          {!status && <div className="player-actions-overlay">
            {time < (activeEpisode?.introEnd || movie.introEnd || 75) && <button onClick={skipIntro}>Skip Intro <SkipForward size={15} aria-hidden="true" /></button>}
            {episodeIndex < episodes.length - 1 && <button onClick={nextEpisode}>Next Episode <SkipForward size={15} aria-hidden="true" /></button>}
          </div>}
        </div>
        {error && <p className="player-error" role="alert">{error}</p>}
        <div className="player-controls">
          <button onClick={() => seek(-10)} aria-label="Skip backward 10 seconds">
            <SkipBack size={18} aria-hidden="true" /> 10s
          </button>
          <button onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <button onClick={() => seek(10)} aria-label="Skip forward 10 seconds">
            10s <SkipForward size={18} aria-hidden="true" />
          </button>
          <span aria-label={`${formatTime(time)} of ${formatTime(duration)}`}>
            {formatTime(time)} / {formatTime(duration)}
          </span>
          <label>
            Speed
            <select aria-label="Playback speed" defaultValue="1" onChange={(event) => {
              if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value);
            }}>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                <option key={speed} value={speed}>{speed}×</option>
              ))}
            </select>
          </label>
          <button onClick={() => {
            const nextMuted = !videoRef.current?.muted;
            if (videoRef.current) videoRef.current.muted = nextMuted;
            setMuted(nextMuted);
          }} aria-label={muted ? 'Unmute video' : 'Mute video'}>
            {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          </button>
          <button onClick={() => videoRef.current?.requestFullscreen?.()} aria-label="Open video fullscreen">
            <Maximize size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="player-selectors" aria-label="Playback options">
          <label>
            Server
            <select value={sourceIndex} onChange={chooseSource}>
              {sources.map((source, index) => (
                <option key={source.id} value={index}>{source.label}</option>
              ))}
            </select>
          </label>
          <label>
            Quality
            <select value={activeSource?.quality || 'Auto'} onChange={chooseQuality}>
              {qualityOptions.map(quality => <option key={quality}>{quality}</option>)}
            </select>
          </label>
          <label>
            Audio
            <select value={audioLanguage} onChange={chooseAudio}>
              {audioOptions.map((language) => <option key={language}>{language}</option>)}
            </select>
          </label>
          <label>
            Subtitles
            <select value={subtitleLanguage} onChange={chooseSubtitle}>
              {subtitleOptions.map((language) => <option key={language}>{language}</option>)}
            </select>
          </label>
          {episodes.length > 0 && (
            <>
              <label>
                Season
                <select value={Number(activeEpisode?.season) || 1} onChange={chooseSeason}>
                  {availableSeasons.map(season => <option key={season} value={season}>Season {season}</option>)}
                </select>
              </label>
              <label>
                Episode
                <select value={episodeIndex} onChange={chooseEpisode}>
                  {episodes.map((episode, index) => (
                    <option key={episode.id || index} value={index}>
                      S{episode.season || 1} E{episode.number || index + 1} · {episode.title || `Episode ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <p id="player-description" className="muted">
          {activeSource?.isDemo
            ? 'Public sample footage is playing. Licensed titles use server-authorized sources, tracks, and episodes.'
            : 'Playback uses the authorized source selected for this title.'}
        </p>
        {movie.licenseUrl && <p className="muted">Source: Internet Archive · <a href={movie.licenseUrl} target="_blank" rel="noreferrer">View licence and attribution</a></p>}
      </section>
    </div>
  );
}
