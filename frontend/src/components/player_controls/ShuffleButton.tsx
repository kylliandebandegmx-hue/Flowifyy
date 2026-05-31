import StyledButton from './StyleButton';
import { Shuffle } from 'lucide-react';

interface Props {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const ShuffleButton = ({ active, onClick, disabled }: Props) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled}>
      <span className="icon-wrap">
        {active ? (
          <Shuffle size={24} strokeWidth={2.5} style={{ color: '#3f6ef1' }} />
        ) : (
          <Shuffle size={24} strokeWidth={2.5} />
        )}
      </span>
    </StyledButton>
  );
};

export default ShuffleButton;
