import styled from 'styled-components';
import { Volume, Volume1, Volume2, VolumeOff } from 'lucide-react';

interface Props {
  volume: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onVolumeChange: (v: number) => void;
  disabled?: boolean;
}

const VolumeButton = ({
  volume,
  isMuted,
  onToggleMute,
  onVolumeChange,
  disabled,
}: Props) => {
  const displayedVolume = isMuted ? 0 : volume;

  const icon = isMuted ? (
    <VolumeOff size={24} strokeWidth={2.5} />
  ) : volume === 0 ? (
    <Volume size={24} strokeWidth={2.5} />
  ) : volume < 50 ? (
    <Volume1 size={24} strokeWidth={2.5} />
  ) : (
    <Volume2 size={24} strokeWidth={2.5} />
  );

  return (
    <Container
      className={isMuted ? 'muted' : ''}
      style={
        {
          '--val': `${displayedVolume}%`,
          '--color': isMuted ? '#ff6b6b' : 'var(--accent)',
        } as React.CSSProperties
      }
    >
      <IconButton onClick={onToggleMute} disabled={disabled}>
        <span className="icon-wrap">{icon}</span>
      </IconButton>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={displayedVolume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        disabled={disabled}
        className="slider"
      />

      <span className="value">{displayedVolume}%</span>
    </Container>
  );
};

export default VolumeButton;

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  height: 45px;
  padding: 0 10px;

  background: var(--bg3);
  border-radius: 12px;

  &:hover {
    background: var(--surface);
  }

  &.muted .icon-wrap {
    color: #ff6b6b;
  }

  .slider {
    width: 110px;
    height: 4px;
    appearance: none;
    outline: none;
    cursor: pointer;
    background: transparent;
  }

  .slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      var(--color) 0%,
      var(--color) var(--val),
      var(--bg4) var(--val),
      var(--bg4) 100%
    );
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    border: none;
    margin-top: -4px;
  }

  .value {
    width: 32px;
    font-size: 14px;
    font-weight: 600;
    font-family: monospace;
    color: var(--text2);
    text-align: right;
  }
`;

const IconButton = styled.button`
  width: 34px;

  border-radius: 10px;
  border: none;
  background: transparent;

  cursor: pointer;

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffffbb;
    animation: pop-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .icon-wrap:hover {
    color: #ffffff;
  }

  &:hover .icon-wrap {
    color: white;
  }

  &:active {
    transform: scale(0.95);
  }
`;
