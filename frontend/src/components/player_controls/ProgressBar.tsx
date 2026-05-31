import styled from 'styled-components';

interface Props {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  disabled?: boolean;
}

function formatTime(s: number): string {
  if (!s || isNaN(s)) return '0:00';

  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sec
      .toString()
      .padStart(2, '0')}`;
  }

  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const ProgressBar = ({ currentTime, duration, onSeek, disabled }: Props) => {
  const progressValue = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Container style={{ '--val': `${progressValue}%` } as React.CSSProperties}>
      <input
        type="range"
        className="slider"
        min={0}
        max={100}
        step={0.1}
        value={progressValue}
        onChange={(e) => onSeek((Number(e.target.value) / 100) * duration)}
        disabled={disabled}
        aria-label="Progression"
      />
      <span className="time mono">{formatTime(currentTime)}</span>
      <span className="separator">:</span>
      <span className="time mono">{formatTime(duration)}</span>
    </Container>
  );
};

export default ProgressBar;

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  margin: 12px 24px;
  padding: 24px 10px;
  height: 45px;

  background: var(--bg3);
  border-radius: 12px;

  &:hover {
    background: var(--surface);
  }

  .slider {
    flex: 1;
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
      var(--accent) 0%,
      var(--accent) var(--val),
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

  .slider:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .time {
    font-size: 14px;
    font-weight: 600;
    font-family: monospace;
    color: var(--text2);
    white-space: nowrap;
  }

  .separator {
    font-size: 12px;
    color: var(--text2);
  }
`;
