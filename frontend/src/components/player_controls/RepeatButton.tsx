import { Repeat, Repeat1, RepeatOff } from 'lucide-react';
import StyledButton from './StyleButton';

interface Props {
  mode: 'none' | 'all' | 'one';
  onClick: () => void;
  disabled?: boolean;
}

const RepeatButton = ({ mode, onClick, disabled }: Props) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled}>
      <span className="icon-wrap">
        {mode === 'none' ? (
          <RepeatOff size={24} strokeWidth={2.5} />
        ) : mode === 'all' ? (
          <Repeat size={24} strokeWidth={2.5} style={{ color: '#3f6ef1' }} />
        ) : (
          <Repeat1 size={24} strokeWidth={2.5} style={{ color: '#3f6ef1' }} />
        )}
      </span>
    </StyledButton>
  );
};

export default RepeatButton;
