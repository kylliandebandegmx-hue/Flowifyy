import type { Track, LoopMode } from '../types';
import './Player.css';
import PlayPauseButton from './player_controls/PlayPauseButton';
import NextPrevButton from './player_controls/NextPrevButton';
import ShuffleButton from './player_controls/ShuffleButton';
import RepeatButton from './player_controls/RepeatButton';
import VolumeButton from './player_controls/VolumeButton';
import ProgressBar from './player_controls/ProgressBar';

interface PlayerProps {
  track: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  loopMode: LoopMode;
  onCycleLoop: () => void;
  shuffle: boolean;
  onToggleShuffle: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  queue: Track[];
  queueIndex: number;
}

export function Player({
  track,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  loopMode,
  onCycleLoop,
  shuffle,
  onToggleShuffle,
  currentTime,
  duration,
  onSeek,
}: PlayerProps) {
  return (
    <div className="player">
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        onSeek={onSeek}
        disabled={!track}
      />
      <div className="player-inner">
        <div className="player-track">
          {track ? (
            <>
              <img src={track.thumbnail} alt="" className="player-thumb" />

              <div className="player-track-text">
                <p className="player-title">{track.title}</p>
                <p className="player-channel">{track.channel}</p>
              </div>
            </>
          ) : (
            <div className="player-track-text">
              <p className="player-title" style={{ color: 'var(--text2)' }}>
                Aucun titre
              </p>
            </div>
          )}
        </div>

        <div className="player-controls">
          <ShuffleButton
            active={shuffle}
            onClick={onToggleShuffle}
            disabled={!track}
          />

          <NextPrevButton type="prev" onClick={onPrev} disabled={!track} />

          <PlayPauseButton
            isPlaying={isPlaying}
            onClick={onTogglePlay}
            disabled={!track}
          />

          <NextPrevButton type="next" onClick={onNext} disabled={!track} />

          <RepeatButton
            mode={loopMode}
            onClick={onCycleLoop}
            disabled={!track}
          />
        </div>

        <div className="player-right">
          <div className="player-right">
            <VolumeButton
              volume={volume}
              isMuted={isMuted}
              onToggleMute={onToggleMute}
              onVolumeChange={onVolumeChange}
              disabled={!track}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
