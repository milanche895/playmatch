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
  Paper,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  NotificationsOff as NotificationsOffIcon,
  Settings as SettingsIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getNotificationStatus,
  requestNotificationPermission
} from '../lib/notifications';

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [status, setStatus] = useState<{
    subscribed: boolean;
    enabled: boolean;
    permission: NotificationPermission;
    endpoint?: string;
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

      const permission = await requestNotificationPermission();
      
      if (permission !== 'granted') {
        if (permission === 'denied') {
          setError('Dozvola za obaveštenja je odbijena. Molimo omogućite je u postavkama pretraživača.');
        } else {
          setError('Dozvola za obaveštenja nije data.');
        }
        return;
      }

      await subscribeToPushNotifications();
      setSuccess('Obaveštenja su uspešno omogućena!');
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

      await unsubscribeFromPushNotifications();
      setSuccess('Obaveštenja su onemogućena.');
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
      case 'granted': return 'Dozvoljeno';
      case 'denied': return 'Odbijeno';
      case 'default': return 'Nije postavljeno';
      default: return 'Nepoznato';
    }
  }

  function getPermissionColor(permission: NotificationPermission): 'success' | 'error' | 'default' {
    switch (permission) {
      case 'granted': return 'success';
      case 'denied': return 'error';
      default: return 'default';
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
    return <Alert severity="error" sx={{ borderRadius: 2 }}>Greška pri učitavanju postavki obaveštenja</Alert>;
  }

  const isSubscribed = status?.subscribed ?? false;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Nazad
        </Button>
        <Typography variant="h4" fontWeight={700}>
          Postavke Obaveštenja
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upravljajte obaveštenjima o mečevima
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Status Card */}
      <Card elevation={0} sx={{ mb: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
            <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
            Trenutno Stanje
          </Typography>
          
          <Stack spacing={3}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: 'action.hover' }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1.5}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={600}>Status pretplate</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isSubscribed ? 'Aktivna pretplata na obaveštenja' : 'Nema aktivne pretplate'}
                  </Typography>
                </Box>
                <Chip
                  label={isSubscribed ? 'Aktivno' : 'Neaktivno'}
                  color={isSubscribed ? 'success' : 'default'}
                  icon={isSubscribed ? <NotificationsActiveIcon /> : <NotificationsOffIcon />}
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: 'action.hover' }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1.5}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={600}>Dozvola pretraživača</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getPermissionLabel(status?.permission || 'default')}
                  </Typography>
                </Box>
                <Chip
                  label={getPermissionLabel(status?.permission || 'default')}
                  color={getPermissionColor(status?.permission || 'default')}
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </Paper>
          </Stack>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
            Akcije
          </Typography>
          
          <Stack spacing={2}>
            {!isSubscribed ? (
              <Button
                variant="contained"
                startIcon={<NotificationsIcon />}
                onClick={handleEnableNotifications}
                disabled={subscribing || status?.permission === 'denied'}
                fullWidth
                size="large"
                sx={{ py: 1.5, borderRadius: 3 }}
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
                  size="large"
                  sx={{ py: 1.5, borderRadius: 3 }}
                >
                  {subscribing ? 'Onemogućavanje...' : 'Onemogući Obaveštenja'}
                </Button>

                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<NotificationsActiveIcon />}
                  onClick={handleTestNotification}
                  fullWidth
                  size="large"
                  sx={{ py: 1.5, borderRadius: 3 }}
                >
                  Pošalji Test Notifikaciju
                </Button>
              </>
            )}

            {status?.permission === 'denied' && (
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                Dozvola za obaveštenja je odbijena. Omogućite je u postavkama pretraživača za ovaj sajt.
              </Alert>
            )}
            {status?.permission === 'default' && !isSubscribed && (
              <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                Kliknite „Omogući obaveštenja“ — pretraživač će tražiti dozvolu za prikaz obaveštenja.
              </Alert>
            )}
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Typography variant="body2" color="text.secondary">
            Obaveštenja će vas obavestiti o novim mečevima u blizini vaše lokacije.
            Postavke radijusa možete izmeniti na stranici profila.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
