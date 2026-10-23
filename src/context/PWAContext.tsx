import React, { useEffect, useState, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import { PWAContext } from './pwaContextInstance';

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Install state
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(
    typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true)
  );

  // 2. Service Worker registration & updates
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'update-available' | 'error'>('idle');
  const [updateStatusMessage, setUpdateStatusMessage] = useState<string | null>(null);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('PWA Service Worker registered:', registration);
      if (registration) {
        swRegistrationRef.current = registration;

        // Auto-check for updates periodically every hour
        setInterval(() => {
          registration.update().catch((err) => console.warn('Periodic SW update check failed:', err));
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('PWA Service Worker registration error:', error);
    },
  });

  // Listen to beforeinstallprompt and appinstalled
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed successfully');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setIsInstallable(false);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    const mql = window.matchMedia('(display-mode: standalone)');
    mql.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mql.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  // Update check effect when needRefresh becomes true
  useEffect(() => {
    if (needRefresh) {
      setUpdateStatus('update-available');
      setUpdateStatusMessage('A new version of Built-in AI Demo is ready to install.');
    }
  }, [needRefresh]);

  // Trigger app install
  const installApp = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error during PWA installation:', err);
      return false;
    }
  };

  // Trigger app update
  const updateApp = async () => {
    try {
      await updateServiceWorker(true);
    } catch (err) {
      console.error('Failed to update service worker:', err);
    }
  };

  // Manual check for updates
  const checkForUpdates = async () => {
    setIsCheckingForUpdates(true);
    setUpdateStatus('checking');
    setUpdateStatusMessage('Checking for new app version...');

    try {
      let registration = swRegistrationRef.current;
      if (!registration && 'serviceWorker' in navigator) {
        registration = (await navigator.serviceWorker.getRegistration()) || null;
        if (registration) swRegistrationRef.current = registration;
      }

      if (!registration) {
        setUpdateStatus('error');
        setUpdateStatusMessage('Service worker is not active yet. Try reloading the page.');
        setIsCheckingForUpdates(false);
        return;
      }

      // Check if there is already a waiting worker
      if (registration.waiting) {
        setNeedRefresh(true);
        setUpdateStatus('update-available');
        setUpdateStatusMessage('A new update is available!');
        setIsCheckingForUpdates(false);
        return;
      }

      // Explicitly trigger SW update check
      await registration.update();

      // Wait 1.5s for any updatefound event to propagate
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (registration.waiting || needRefresh) {
        setNeedRefresh(true);
        setUpdateStatus('update-available');
        setUpdateStatusMessage('A new update is available!');
      } else {
        setUpdateStatus('latest');
        setUpdateStatusMessage('You are running the latest version of the app.');
        // Reset to idle after 4 seconds
        setTimeout(() => {
          setUpdateStatus('idle');
          setUpdateStatusMessage(null);
        }, 4000);
      }
    } catch (err) {
      console.error('Error checking for updates:', err);
      setUpdateStatus('error');
      setUpdateStatusMessage('Could not check for updates. Check your internet connection.');
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        installApp,
        offlineReady,
        needRefresh,
        isCheckingForUpdates,
        updateStatus,
        updateStatusMessage,
        updateApp,
        checkForUpdates,
      }}
    >
      {children}

      {/* Persistent Update Notification Snackbar */}
      <Snackbar
        open={needRefresh}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ maxWidth: 500 }}
      >
        <Alert
          severity="info"
          icon={<SystemUpdateIcon />}
          sx={{
            width: '100%',
            alignItems: 'center',
            boxShadow: 6,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'primary.main',
          }}
          action={
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                color="primary"
                variant="contained"
                size="small"
                onClick={() => updateApp()}
                sx={{ fontWeight: 'bold' }}
              >
                Reload & Update
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => setNeedRefresh(false)}
              >
                Dismiss
              </Button>
            </Box>
          }
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              New version available!
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              An update has been downloaded and is ready to apply.
            </Typography>
          </Box>
        </Alert>
      </Snackbar>

      {/* Offline Ready Snackbar */}
      <Snackbar
        open={offlineReady}
        autoHideDuration={4000}
        onClose={() => setOfflineReady(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          severity="success"
          onClose={() => setOfflineReady(false)}
          sx={{ width: '100%', boxShadow: 3 }}
        >
          App is cached and ready to work offline!
        </Alert>
      </Snackbar>
    </PWAContext.Provider>
  );
};
