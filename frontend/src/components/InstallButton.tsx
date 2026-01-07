import { useState, useEffect } from 'react';
import { Button, Snackbar, Alert, useMediaQuery, useTheme } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      // Already installed, don't show button
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the install button
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      // Hide the install button
      setShowInstallButton(false);
      setDeferredPrompt(null);
      setShowSuccessSnackbar(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt - it can only be used once
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  // Only show on mobile devices
  if (!showInstallButton || !isMobile) {
    return null;
  }

  return (
    <>
      <Button
        variant="contained"
        color="warning"
        size="small"
        startIcon={<GetAppIcon />}
        onClick={handleInstallClick}
        sx={{
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 2,
          px: 2,
          py: 0.5,
          bgcolor: '#ff9800',
          '&:hover': {
            bgcolor: '#f57c00',
          },
          boxShadow: '0 2px 8px rgba(255, 152, 0, 0.4)',
        }}
      >
        Instaliraj
      </Button>
      
      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={4000}
        onClose={() => setShowSuccessSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowSuccessSnackbar(false)} 
          severity="success"
          sx={{ width: '100%' }}
        >
          PlayMatch je uspešno instaliran!
        </Alert>
      </Snackbar>
    </>
  );
}
