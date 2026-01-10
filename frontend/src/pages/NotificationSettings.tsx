import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  NotificationsOff as NotificationsOffIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getNotificationStatus,
  requestNotificationPermission,
  PUSH_PROVIDER
} from '../lib/notifications';

export default function NotificationSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [status, setStatus] = useState<{
    provider: string | null;
    activeProvider: string;
    enabled: boolean;
    permission: NotificationPermission;
    fcmTokenCount?: number;
    oneSignalUserId?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      const notificationStatus = await getNotificationStatus();
      setStatus(notificationStatus);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju statusa');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableNotifications() {
    try {
      setSubscribing(true);
      setError(null);
      setSuccess(null);

      // Request permission first
      const permission = await requestNotificationPermission();
      
      if (permission !== 'granted') {
        if (permission === 'denied') {
          setError('Dozvola za obaveštenja je odbijena. Molimo omogućite je u postavkama pretraživača.');
        } else {
          setError('Dozvola za obaveštenja nije data.');
        }
        return;
      }

      // Subscribe to push notifications
      await subscribeToPushNotifications();
      setSuccess('Obaveštenja su uspešno omogućena!');
      
      // Reload status
      await loadStatus();
    } catch (err: any) {
      console.error('Error enabling notifications:', err);
      setError(err.message || 'Greška pri omogućavanju obaveštenja');
    } finally {
      setSubscribing(false);
    }
  }

  async function handleDisableNotifications() {
    try {
      setSubscribing(true);
      setError(null);
      setSuccess(null);

      await unsubscribeFromPushNotifications(status?.provider || undefined);
      setSuccess('Obaveštenja su onemogućena.');

      // Reload status
      await loadStatus();
    } catch (err: any) {
      console.error('Error disabling notifications:', err);
      setError(err.message || 'Greška pri onemogućavanju obaveštenja');
    } finally {
      setSubscribing(false);
    }
  }

  async function handleTestNotification() {
    try {
      setError(null);
      setSuccess(null);

      const res = await api.post('/api/players/test-push');
      setSuccess('Test notifikacija je poslata! Proverite vaše obaveštenja.');
    } catch (err: any) {
      console.error('Error sending test notification:', err);
      setError(err.response?.data?.message || 'Greška pri slanju test notifikacije');
    }
  }

  function getPermissionLabel(permission: NotificationPermission) {
    switch (permission) {
      case 'granted':
        return 'Dozvoljeno';
      case 'denied':
        return 'Odbijeno';
      case 'default':
        return 'Nije postavljeno';
      default:
        return 'Nepoznato';
    }
  }

  function getPermissionColor(permission: NotificationPermission) {
    switch (permission) {
      case 'granted':
        return 'success';
      case 'denied':
        return 'error';
      case 'default':
        return 'default';
      default:
        return 'default';
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!status) {
    return (
      <Alert severity="error">Greška pri učitavanju postavki obaveštenja</Alert>
    );
  }

  const isSubscribed = status.provider !== null;
  const permissionGranted = status.permission === 'granted';

  return (
    <Stack spacing={3} sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
      <Box display="flex" alignItems="center" gap={2}>
        <SettingsIcon fontSize="large" color="primary" />
        <Typography variant="h4" component="h1">
          Postavke Obaveštenja
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack spacing={3}>
            {/* Status Overview */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Trenutno Stanje
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1">Status pretplate:</Typography>
                  <Chip
                    label={isSubscribed ? 'Omogućeno' : 'Onemogućeno'}
                    color={isSubscribed ? 'success' : 'default'}
                    icon={isSubscribed ? <NotificationsActiveIcon /> : <NotificationsOffIcon />}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1">Dozvola pretraživača:</Typography>
                  <Chip
                    label={getPermissionLabel(status.permission)}
                    color={getPermissionColor(status.permission) as any}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body1">Provider:</Typography>
                  <Chip
                    label={status.activeProvider.toUpperCase()}
                    color="primary"
                    variant="outlined"
                  />
                </Box>

                {status.provider && (
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1">Aktivni provider:</Typography>
                    <Chip
                      label={status.provider.toUpperCase()}
                      color="secondary"
                      variant="outlined"
                    />
                  </Box>
                )}

                {status.fcmTokenCount && status.fcmTokenCount > 0 && (
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1">Broj uređaja:</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {status.fcmTokenCount}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            <Divider />

            {/* Actions */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Akcije
              </Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                {!isSubscribed ? (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<NotificationsIcon />}
                    onClick={handleEnableNotifications}
                    disabled={subscribing || !permissionGranted}
                    fullWidth
                  >
                    {subscribing ? 'Omogućavanje...' : 'Omogući Obaveštenja'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<NotificationsOffIcon />}
                      onClick={handleDisableNotifications}
                      disabled={subscribing}
                      fullWidth
                    >
                      {subscribing ? 'Onemogućavanje...' : 'Onemogući Obaveštenja'}
                    </Button>

                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<NotificationsActiveIcon />}
                      onClick={handleTestNotification}
                      fullWidth
                    >
                      Pošalji Test Notifikaciju
                    </Button>
                  </>
                )}

                {!permissionGranted && (
                  <Alert severity="warning">
                    {status.permission === 'denied' 
                      ? 'Dozvola za obaveštenja je odbijena. Molimo omogućite je u postavkama pretraživača.'
                      : 'Prvo morate dozvoliti obaveštenja u vašem pretraživaču.'}
                  </Alert>
                )}
              </Stack>
            </Box>

            {/* Info */}
            <Box>
              <Typography variant="body2" color="text.secondary">
                Obaveštenja će vas obavestiti o novim mečevima u blizini vaše lokacije.
                Postavke radijusa možete izmeniti na stranici profila.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
