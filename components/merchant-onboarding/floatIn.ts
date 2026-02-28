import React from 'react';

export const floatIn = (delay: number, visible: boolean): React.CSSProperties => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateY(0)' : 'translateY(20px)',
  transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
});
