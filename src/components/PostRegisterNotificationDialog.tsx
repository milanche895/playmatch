import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { useLocation, useNavigate } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import { subscribeToPushNotifications } from '../lib/notifications';
import {
  clearLoginNotificationPrompt,
  clearPromptNotificationsAfterRegister,
  hasLoginPromptFlag,
  hasPromptFlag,
  isPushActivated,
  markPromptNotificationsAfterRegister,
} from '../lib/notificationPrompt';
import {
  ONBOARDING_TOUR_FINISHED_EVENT,
  isOnboardingTourPending,
} from '../lib/onboardingTour';

const SKIP_PROMPT_PATHS = ['/welcome', '/register', '/create', '/login', '/auth/callback'];

export { markPromptNotificationsAfterRegister };

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export default function PostRegisterNotificationDialog() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const navState = location.state as { promptNotifications?: boolean } | null;

  useEffect(() => {
    if (!user?._id || user.role !== 'player') return;
    if (SKIP_PROMPT_PATHS.includes(location.pathname)) return;
    if (isOnboardingTourPending()) return;

    const fromNav = Boolean(navState?.promptNotifications);
    if (!fromNav && !hasPromptFlag() && !hasLoginPromptFlag()) return;

    let cancelled = false;
    isPushActivated()
      .then((activated) => {
        if (cancelled) return;
        if (activated) {
          clearPromptNotificationsAfterRegister();
          clearLoginNotificationPrompt();
          return;
        }
        setOpen(true);
        if (fromNav) {
          navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
        }
      })
      .catch(() => {
        if (!cancelled) setOpen(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.role, navState?.promptNotifications, location.pathname, location.search, navigate]);

  useEffect(() => {
    const onTourFinished = () => {
      if (!user?._id || user.role !== 'player') return;
      if (!hasPromptFlag() && !hasLoginPromptFlag()) return;
      if (SKIP_PROMPT_PATHS.includes(location.pathname)) return;
      isPushActivated()
        .then((activated) => {
          if (activated) {
            clearPromptNotificationsAfterRegister();
            clearLoginNotificationPrompt();
            return;
          }
          setOpen(true);
        })
        .catch(() => setOpen(true));
    };
    window.addEventListener(ONBOARDING_TOUR_FINISHED_EVENT, onTourFinished);
    return () => window.removeEventListener(ONBOARDING_TOUR_FINISHED_EVENT, onTourFinished);
  }, [user?._id, user?.role, location.pathname]);

  function handleLater() {
    clearPromptNotificationsAfterRegister();
    clearLoginNotificationPrompt();
    setOpen(false);
    setError(null);
  }

  async function handleEnable() {
    setSubscribing(true);
    setError(null);
    try {
      await subscribeToPushNotifications();
      await refreshUser();
      clearPromptNotificationsAfterRegister();
      clearLoginNotificationPrompt();
      setSuccess(true);
      setTimeout(() => setOpen(false), 1400);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Greška pri omogućavanju obaveštenja';
      setError(message);
    } finally {
      setSubscribing(false);
    }
  }

  // Browser-only checks: compute after mount so SSR/hydration don't touch `navigator`/`window`.
  const [iosNeedsHomeScreen, setIosNeedsHomeScreen] = useState(false);
  useEffect(() => {
    setIosNeedsHomeScreen(isIosDevice() && !isStandalonePwa());
  }, []);

  return (
    <Dialog
      open={open}
      onClose={handleLater}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pt: 2 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 3,
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <NotificationsActiveIcon sx={{ color: 'white', fontSize: 28 }} />
        </Box>
        <Typography variant="h5" fontWeight={700}>
          Aktiviraj obaveštenja
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography
          variant="body2"
          sx={{
            mb: 2,
            color: 'text.secondary',
            textAlign: 'center',
          }}
        >
          Uključi obaveštenja da dobiješ poruku čim se u blizini otvori novi meč.
        </Typography>

        {iosNeedsHomeScreen && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            Na iPhone-u obaveštenja rade samo iz ikone na početnom ekranu: Deli → Dodaj na početni ekran, pa otvori Plejko odatle.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
            Obaveštenja su uključena.
          </Alert>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 1,
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          alignItems: 'stretch',
          gap: 1.5,
          '& > :not(:first-of-type)': { ml: { xs: 0, sm: 1 } },
        }}
      >
        <Button
          onClick={handleLater}
          variant="outlined"
          fullWidth
          size="large"
          disabled={subscribing}
          sx={{ borderRadius: 3 }}
        >
          Kasnije
        </Button>
        <Button
          onClick={handleEnable}
          variant="contained"
          fullWidth
          size="large"
          disabled={subscribing || success || iosNeedsHomeScreen}
          sx={{ borderRadius: 3 }}
        >
          {subscribing ? 'Aktiviranje...' : 'Aktiviraj obaveštenja'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
