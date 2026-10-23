import { createContext } from 'react';

export interface PWAContextType {
  // Install
  isInstallable: boolean;
  isInstalled: boolean;
  installApp: () => Promise<boolean>;

  // Updates & Offline
  offlineReady: boolean;
  needRefresh: boolean;
  isCheckingForUpdates: boolean;
  updateStatus: 'idle' | 'checking' | 'latest' | 'update-available' | 'error';
  updateStatusMessage: string | null;
  updateApp: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
}

export const PWAContext = createContext<PWAContextType | null>(null);
