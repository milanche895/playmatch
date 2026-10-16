'use client';

import { useState, useEffect, type SyntheticEvent } from 'react';
import { Alert, Box, Button, CircularProgress, IconButton, Slider, Stack, Switch, Typography } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  InfoOutlined as InfoIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useNavigate } from '@/lib/router';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { syncPlayerLocation } from '../lib/location';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getNotificationStatus,
  requestNotificationPermission,
  pushBlockMessage,
  type PushBlockReason,
} from '../lib/notifications';

type PushStatus = {
  subscribed: boolean;
  enabled: boolean;
  permission: NotificationPermission;
  blockReason: PushBlockReason;
  endpoint?: string;
};

const DENIED_HINT =
  'Dozvola je blokirana. Klikni katanac pored adrese → Obaveštenja → Dozvoli, pa osveži stranicu. Na telefonu: podešavanja sajta → Obaveštenja → Dozvoli.';

const PERMISSION_UI: Record<
  NotificationPermission,
  { label: string; hint: string; color: string; Icon: typeof CheckCircleIcon }
> = {
  granted: { label: 'Dozvoljeno', hint: 'Primaš push obaveštenja.', color: '#16A34A', Icon: CheckCircleIcon },
  denied: {
    label: 'Odbijeno',
    hint: 'Klikni katanac pored adrese → Obaveštenja → Dozvoli, pa osveži stranicu.',
    color: '#E5484D',
    Icon: CancelIcon,
  },
  default: {
    label: 'Nije postavljeno',
    hint: 'Uključi „Mečevi u blizini“ da bi pretraživač tražio dozvolu.',
    color: '#8A94A6',
    Icon: InfoIcon,
  },
};

export default function NotificationPreferences() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingRadius, setSavingRadius] = useState(false);
  const [testing, setTesting] = useState(false);
  const [radius, setRadius] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setRadius(user?.notificationRadius || 10);
  }, [user?.notificationRadius]);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      setStatus(await getNotificationStatus());
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju statusa');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(_event: SyntheticEvent, checked: boolean) {
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      if (checked) {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') {
          setError(
            permission === 'denied'
              ? 'Dozvola za obaveštenja je odbijena. Molimo omogućite je u postavkama pretraživača.'
              : 'Dozvola za obaveštenja nije data.'
          );
          return;
        }
        await subscribeToPushNotifications();
        syncPlayerLocation();
        let locationNote = '';
        try {
          const geo = await navigator.permissions.query({ name: 'geolocation' });
          if (geo.state === 'denied') {
            locationNote =
              ' Dozvoli lokaciju za ovaj sajt, inače ne možemo da nađemo mečeve u tvom kraju.';
          }
        } catch {
          // Safari does not support querying geolocation permission.
        }
        await refreshUser();
        setSuccess('Obaveštenja su uspešno omogućena!' + locationNote);
      } else {
        await unsubscribeFromPushNotifications();
        await refreshUser();
        setSuccess('Obaveštenja su onemogućena.');
      }
      await loadStatus();
    } catch (err: any) {
      console.error('Error toggling notifications:', err);
      setError(err.message || (checked ? 'Greška pri omogućavanju obaveštenja' : 'Greška pri onemogućavanju obaveštenja'));
    } finally {
      setBusy(false);
    }
  }

  function handleRadiusChange(_event: Event, value: number | number[]) {
    setRadius(Array.isArray(value) ? value[0] : value);
  }

  async function handleRadiusCommit(_event: Event | SyntheticEvent, value: number | number[]) {
    const next = Array.isArray(value) ? value[0] : value;
    setRadius(next);
    try {
      setSavingRadius(true);
      setError(null);
      await api.put('/api/players/profile', { notificationRadius: next });
      await refreshUser();
      setSuccess(`Radijus obaveštenja je sačuvan: ${next} km`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri čuvanju radijusa');
    } finally {
      setSavingRadius(false);
    }
  }

  async function handleTestNotification() {
    try {
      setTesting(true);
      setError(null);
      setSuccess(null);
      await api.post('/api/players/test-push');
      setSuccess('Test notifikacija je poslata! Proverite vaše obaveštenja.');
    } catch (err: any) {
      console.error('Error sending test notification:', err);
      setError(err.response?.data?.message || 'Greška pri slanju test notifikacije');
    } finally {
      setTesting(false);
    }
  }

  const isSubscribed = status?.subscribed ?? false;
  const blockMessage = pushBlockMessage(status?.blockReason ?? null);
  const permissionDenied = status?.permission === 'denied';
  const permission = PERMISSION_UI[status?.permission || 'default'] ?? PERMISSION_UI.default;
  const PermissionIcon = permission.Icon;

  const sectionTitleSx = { fontSize: 20, fontWeight: 800, color: '#0B1B3F', letterSpacing: '-0.01em' };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', px: { xs: '10px', md: 0 } }}>
      <Stack direction="row" alignItems="center" spacing="6px" sx={{ mb: '14px' }}>
        <IconButton
          aria-label="Nazad"
          onClick={() => navigate('/notification-settings')}
          edge="start"
          sx={{ color: '#0B1B3F' }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography component="h1" sx={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: '#0B1B3F' }}>
          Obaveštenja
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : !status ? (
        <Alert severity="error" sx={{ borderRadius: '12px' }}>
          Greška pri učitavanju postavki obaveštenja
        </Alert>
      ) : (
        <>
          {/* Nearby matches toggle */}
          <Stack direction="row" alignItems="center" spacing="12px" sx={{ mt: '8px' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={sectionTitleSx}>Mečevi u blizini</Typography>
              <Typography sx={{ fontSize: 15, color: '#6B7A99', mt: '2px', lineHeight: 1.4 }}>
                Primaj obaveštenja o novim mečevima u tvom kraju.
              </Typography>
            </Box>
            {busy ? (
              <CircularProgress size={26} />
            ) : (
              <Switch
                checked={isSubscribed}
                onChange={handleToggle}
                disabled={Boolean(blockMessage)}
                inputProps={{ 'aria-label': 'Mečevi u blizini' }}
                sx={{
                  width: 58,
                  height: 34,
                  p: 0,
                  overflow: 'visible',
                  '& .MuiSwitch-switchBase': {
                    p: '3px',
                    color: '#FFFFFF',
                    '&.Mui-checked': { transform: 'translateX(24px)', color: '#FFFFFF' },
                    '&.Mui-checked + .MuiSwitch-track': { bgcolor: 'primary.main', opacity: 1 },
                  },
                  // Default input sits left of the thumb (left: -100%), so taps on the track do nothing.
                  '& .MuiSwitch-switchBase .MuiSwitch-input': {
                    left: 0,
                    width: 58,
                    height: 34,
                  },
                  '& .MuiSwitch-thumb': { width: 28, height: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' },
                  '& .MuiSwitch-track': { borderRadius: 17, opacity: 1, bgcolor: '#C9D3E5' },
                }}
              />
            )}
          </Stack>

          {blockMessage && (
            <Alert severity="warning" sx={{ mt: '14px', borderRadius: '12px' }}>
              {blockMessage}
            </Alert>
          )}
          {!blockMessage && permissionDenied && !isSubscribed && (
            <Alert severity="warning" sx={{ mt: '14px', borderRadius: '12px' }}>
              {DENIED_HINT}
            </Alert>
          )}

          {/* Distance */}
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mt: '28px' }}>
            <Typography sx={sectionTitleSx}>Udaljenost</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: 'primary.main' }}>
              {radius} km{savingRadius ? '…' : ''}
            </Typography>
          </Stack>
          <Box sx={{ px: '10px', mt: '6px' }}>
            <Slider
              value={radius}
              onChange={handleRadiusChange}
              onChangeCommitted={handleRadiusCommit}
              min={1}
              max={50}
              step={1}
              disabled={savingRadius}
              aria-label="Udaljenost"
              marks={[
                { value: 1, label: '1 km' },
                { value: 10, label: '10 km' },
                { value: 50, label: '50 km' },
              ]}
              sx={{
                height: 5,
                '& .MuiSlider-rail': { bgcolor: '#D5DEEE', opacity: 1 },
                '& .MuiSlider-thumb': { width: 22, height: 22, boxShadow: 'none' },
                '& .MuiSlider-mark': { display: 'none' },
                '& .MuiSlider-markLabel': { fontSize: 14, color: '#6B7A99', top: 30 },
                '& .MuiSlider-markLabel[data-index="0"]': { transform: 'translateX(-10px)' },
                '& .MuiSlider-markLabel[data-index="2"]': { transform: 'translateX(-85%)' },
              }}
            />
          </Box>

          {/* Permission */}
          <Typography sx={{ ...sectionTitleSx, mt: '28px' }}>Dozvola za obaveštenja</Typography>
          <Stack direction="row" alignItems="center" spacing="12px" sx={{ mt: '12px' }}>
            <PermissionIcon sx={{ fontSize: 32, color: permission.color }} />
            <Box>
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: permission.color, lineHeight: 1.2 }}>
                {permission.label}
              </Typography>
              <Typography sx={{ fontSize: 14.5, color: '#6B7A99' }}>{permission.hint}</Typography>
            </Box>
          </Stack>

          {/* Test push */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<SendIcon />}
            onClick={handleTestNotification}
            disabled={!isSubscribed || testing}
            sx={{
              mt: '20px',
              height: 52,
              borderRadius: '12px',
              fontSize: 16,
              fontWeight: 700,
              bgcolor: '#EEF5FF',
              borderColor: '#B9D4FB',
              '&:hover': { bgcolor: '#E2EEFF', borderColor: '#9CC4FA' },
            }}
          >
            {testing ? 'Slanje...' : 'Pošalji probnu poruku'}
          </Button>
          {!isSubscribed && (
            <Typography sx={{ fontSize: 13.5, color: '#6B7A99', mt: '8px', textAlign: 'center' }}>
              Za probnu poruku prvo uključi obaveštenja.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
