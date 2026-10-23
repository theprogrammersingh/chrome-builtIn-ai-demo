import { useContext } from 'react';
import { PWAContext, type PWAContextType } from '../context/pwaContextInstance';

export const usePWA = (): PWAContextType => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};
