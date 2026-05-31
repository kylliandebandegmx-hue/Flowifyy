import styled from 'styled-components';

const StyledButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 45px;
  height: 45px;
  border-radius: 12px;
  background: var(--bg3);
  border: none;
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--surface);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

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

  @keyframes pop-in {
    0% {
      transform: scale(0.7);
      opacity: 0;
    }
    60% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

export default StyledButton;
