import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIosDevice(): boolean {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

async function isInstalledPwa(): Promise<boolean> {
  if (isStandalonePwa()) return true;
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ platform?: string }>>;
  };
  if (typeof nav.getInstalledRelatedApps !== 'function') return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some((app) => app.platform === 'webapp');
  } catch {
    return false;
  }
}

/** Download icon in the header. Stays visible on the phone until Plejko is installed. */
export default function InstallButton() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const standalone = isStandalonePwa();
    setInstalled(standalone);
    if (!standalone) {
      isInstalledPwa().then((value) => {
        if (!cancelled && value) setInstalled(true);
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowSuccessSnackbar(true);
    };

    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const handleDisplayMode = () => {
      if (standaloneMedia.matches) setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneMedia.addEventListener('change', handleDisplayMode);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneMedia.removeEventListener('change', handleDisplayMode);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') setInstalled(true);
      return;
    }

    if (isIosDevice()) {
      setHint('Dodirni dugme Deli u dnu Safari-ja, pa izaberi „Dodaj na početni ekran“.');
      return;
    }

    setHint('Otvori meni pregledača (tri tačke) i izaberi „Instaliraj aplikaciju“ ili „Dodaj na početni ekran“.');
  };

  if (!isMobile) {
    return null;
  }

  return (
    <>
      {installed === false && (
      <IconButton
        onClick={handleInstallClick}
        aria-label="Instaliraj aplikaciju"
        sx={{ color: 'primary.main', p: 0.75 }}
      >
        <GetAppIcon sx={{ fontSize: 28 }} />
      </IconButton>
      )}

      <Dialog
        open={Boolean(hint)}
        onClose={() => setHint(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, mx: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Instaliraj Plejko</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: 15, lineHeight: 1.45 }}>{hint}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setHint(null)} variant="contained" sx={{ borderRadius: 3, fontWeight: 700 }}>
            U redu
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={4000}
        onClose={() => setShowSuccessSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSuccessSnackbar(false)} severity="success" sx={{ width: '100%' }}>
          Plejko je uspešno instaliran!
        </Alert>
      </Snackbar>
    </>
  );
}
