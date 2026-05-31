import StyledButton from './StyleButton';
import { ArrowBigRight, ArrowBigLeft } from 'lucide-react';

interface Props {
  type: 'next' | 'prev';
  onClick: () => void;
  disabled?: boolean;
}

const NextPrevButton = ({ type, onClick, disabled }: Props) => {
  return (
    <StyledButton onClick={onClick} disabled={disabled}>
      <span className="icon-wrap" key={type ? 'next' : 'prev'}>
        {type === 'next' ? (
          <ArrowBigRight size={24} strokeWidth={2.5} />
        ) : (
          <ArrowBigLeft size={24} strokeWidth={2.5} />
        )}
      </span>
    </StyledButton>
  );
};

export default NextPrevButton;
