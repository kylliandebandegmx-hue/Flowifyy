import { useState, useEffect, useRef, useCallback } from 'react';
import { wails } from '../lib/wails';
import type { Track, LoopMode } from '../types';

function getStoredVolume(): number {
  const v = Number(localStorage.getItem('yt-player-volume'));
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : 80;
}
function getStoredMuted(): boolean {
  return localStorage.getItem('yt-player-muted') === 'true';
}

// ── YouTube IFrame API types ──────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (id: string, opts: object) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  loadVideoById(id: string): void;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getPlayerState(): number;
  destroy(): void;
}

// Load YT IFrame API once
let ytApiLoaded = false;
function loadYTApi(): Promise<void> {
  if (ytApiLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { ytApiLoaded = true; resolve(); };
  });
}

export function usePlayer() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(getStoredVolume);
  const [isMuted, setIsMuted] = useState(getStoredMuted);
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  const [shuffle, setShuffle] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  // Keep a fake audioRef for compatibility with App.tsx (audio element not needed)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const loopModeRef = useRef(loopMode);
  const shuffleRef = useRef(shuffle);
  const playTrackRef = useRef<((t: Track, q?: Track[] | null, i?: number | null) => Promise<void>) | null>(null);

  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  loopModeRef.current = loopMode;
  shuffleRef.current = shuffle;

  // Persist volume/mute
  useEffect(() => {
    localStorage.setItem('yt-player-volume', String(volume));
    localStorage.setItem('yt-player-muted', String(isMuted));
  }, [volume, isMuted]);

  // Create hidden YT player container on mount
  useEffect(() => {
    const div = document.createElement('div');
    div.id = 'yt-player-container';
    div.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(div);
    ytContainerRef.current = div;
    return () => { div.remove(); ytPlayerRef.current?.destroy(); };
  }, []);

  const startPolling = useCallback(() => {
    if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    timeIntervalRef.current = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player) return;
      try {
        const state = player.getPlayerState();
        const ct = player.getCurrentTime();
        const dur = player.getDuration();
        if (ct >= 0) setCurrentTime(ct);
        if (dur > 0) setDuration(dur);
        if (state === window.YT?.PlayerState?.ENDED) {
          clearInterval(timeIntervalRef.current!);
          timeIntervalRef.current = null;
          handleTrackEndRef.current?.();
        }
      } catch {}
    }, 250);
  }, []);

  const handleTrackEndRef = useRef<(() => void) | null>(null);

  const playTrack = useCallback(async (
    track: Track,
    newQueue: Track[] | null = null,
    newIndex: number | null = null,
  ) => {
    if (newQueue) {
      setQueue(newQueue);
      setQueueIndex(newIndex ?? newQueue.findIndex(t => t.id === track.id));
    }
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setError('');

    try {
      await loadYTApi();
    } catch {
      setError('Impossible de charger le lecteur YouTube.');
      return;
    }

    if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);

    const onReady = (player: YTPlayer) => {
      player.setVolume(isMuted ? 0 : volume);
      if (isMuted) player.mute(); else player.unMute();
      player.playVideo();
      setIsPlaying(true);
      startPolling();
    };

    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.loadVideoById(track.id);
        ytPlayerRef.current.setVolume(isMuted ? 0 : volume);
        if (isMuted) ytPlayerRef.current.mute(); else ytPlayerRef.current.unMute();
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
        startPolling();
      } catch {
        ytPlayerRef.current = null;
      }
      if (ytPlayerRef.current) return;
    }

    // Create new player
    const containerId = 'yt-player-container';
    ytPlayerRef.current = new window.YT.Player(containerId, {
      height: '1',
      width: '1',
      videoId: track.id,
      playerVars: { autoplay: 1, playsinline: 1, controls: 0 },
      events: {
        onReady: (e: { target: YTPlayer }) => onReady(e.target),
        onStateChange: (e: { data: number }) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            startPolling();
          } else if (e.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (e.data === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            if (timeIntervalRef.current) { clearInterval(timeIntervalRef.current); timeIntervalRef.current = null; }
            handleTrackEndRef.current?.();
          }
        },
        onError: () => {
          setError('Impossible de lire cette vidéo.');
          setIsPlaying(false);
        },
      },
    });
    void onReady; // suppress lint
  }, [volume, isMuted, startPolling]);

  playTrackRef.current = playTrack;

  handleTrackEndRef.current = () => {
    const q = queueRef.current;
    const qi = queueIndexRef.current;
    const lm = loopModeRef.current;
    const sh = shuffleRef.current;
    const pt = playTrackRef.current;
    if (lm === 'one') {
      ytPlayerRef.current?.seekTo(0, true);
      ytPlayerRef.current?.playVideo();
      return;
    }
    if (!q.length) return;
    let nextIndex: number;
    if (sh) { nextIndex = Math.floor(Math.random() * q.length); }
    else { nextIndex = qi + 1; if (nextIndex >= q.length) { if (lm === 'all') nextIndex = 0; else return; } }
    setQueueIndex(nextIndex);
    pt?.(q[nextIndex], null, null);
  };

  useEffect(() => {
    if (!ytPlayerRef.current) return;
    try { ytPlayerRef.current.setVolume(volume); if (isMuted) ytPlayerRef.current.mute(); else ytPlayerRef.current.unMute(); } catch {}
  }, [volume, isMuted]);

  const handleNext = useCallback(() => {
    const q = queueRef.current; const qi = queueIndexRef.current;
    const sh = shuffleRef.current; const lm = loopModeRef.current;
    if (!q.length) return;
    let nextIndex: number;
    if (sh) { nextIndex = Math.floor(Math.random() * q.length); }
    else { nextIndex = qi + 1; if (nextIndex >= q.length) { if (lm === 'all') nextIndex = 0; else return; } }
    setQueueIndex(nextIndex);
    playTrack(q[nextIndex], null, null);
  }, [playTrack]);

  const handlePrev = useCallback(() => {
    const q = queueRef.current; const qi = queueIndexRef.current;
    if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime() > 3) { ytPlayerRef.current.seekTo(0, true); return; }
    if (!q.length) return;
    const prevIndex = Math.max(0, qi - 1);
    setQueueIndex(prevIndex);
    playTrack(q[prevIndex], null, null);
  }, [playTrack]);

  const togglePlay = useCallback(() => {
    const player = ytPlayerRef.current;
    if (!player || !currentTrack) return;
    const state = player.getPlayerState();
    if (state === window.YT?.PlayerState?.PLAYING) {
      player.pauseVideo();
      setIsPlaying(false);
      if (timeIntervalRef.current) { clearInterval(timeIntervalRef.current); timeIntervalRef.current = null; }
    } else {
      player.playVideo();
      setIsPlaying(true);
      startPolling();
    }
  }, [currentTrack, startPolling]);

  const handleSeek = useCallback((time: number) => {
    ytPlayerRef.current?.seekTo(time, true);
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    const normalized = Math.min(Math.max(v, 0), 100);
    setVolume(normalized);
    try { ytPlayerRef.current?.setVolume(normalized); if (normalized > 0 && isMuted) { ytPlayerRef.current?.unMute(); setIsMuted(false); } } catch {}
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (isMuted) { ytPlayerRef.current?.unMute(); setIsMuted(false); }
    else { ytPlayerRef.current?.mute(); setIsMuted(true); }
  }, [isMuted]);

  const cycleLoop = useCallback(() => { setLoopMode(m => m === 'none' ? 'all' : m === 'all' ? 'one' : 'none'); }, []);
  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);

  // Dummy setAudioPort for App.tsx compatibility
  const setAudioPort = useCallback((_: number) => {}, []);

  return {
    audioRef,
    currentTrack, setCurrentTrack,
    queue, setQueue,
    queueIndex, setQueueIndex,
    isPlaying,
    volume, isMuted,
    loopMode, shuffle,
    currentTime, duration,
    audioPort: 0,
    setAudioPort,
    error, setError,
    playTrack, handleNext, handlePrev, togglePlay, handleSeek,
    handleVolumeChange, toggleMute, cycleLoop, toggleShuffle,
  };
}
