import StyledButton from './StyleButton';
import { Play, Pause } from 'lucide-react';

interface Props {
  isPlaying: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const PlayPauseButton = ({ isPlaying, onClick, disabled }: Props) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled}>
      <span className="icon-wrap" key={isPlaying ? 'pause' : 'play'}>
        {isPlaying ? (
          <Pause size={24} strokeWidth={2.5} />
        ) : (
          <Play size={24} strokeWidth={2.5} />
        )}
      </span>
    </StyledButton>
  );
};

export default PlayPauseButton;
