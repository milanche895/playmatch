import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Grid,
  Avatar,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Switch,
  FormControlLabel,
  Slider
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  SportsSoccer as SportsIcon,
  EmojiEvents as TrophyIcon,
  EventAvailable as EventIcon,
  CancelPresentation as CancelIcon2,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { User, PlayerAnalytics } from '../types';

export default function PlayerProfile() {
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [analytics, setAnalytics] = useState<PlayerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    skills: '',
    phone: '',
    location: '',
    preferredSports: [] as string[],
    experience: 'beginner' as 'beginner' | 'intermediate' | 'advanced' | 'professional',
    avatarUrl: '',
    notificationEnabled: true,
    notificationRadius: 10
  });

  useEffect(() => {
    loadProfile();
    loadAnalytics();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await api.get('/api/players/profile');
      setUser(res.data);
      setFormData({
        name: res.data.name || '',
        bio: res.data.bio || '',
        skills: res.data.skills || '',
        phone: res.data.phone || '',
        location: res.data.location || '',
        preferredSports: res.data.preferredSports || [],
        experience: res.data.experience || 'beginner',
        avatarUrl: res.data.avatarUrl || '',
        notificationEnabled: res.data.notificationEnabled !== undefined ? res.data.notificationEnabled : true,
        notificationRadius: res.data.notificationRadius || 10
      });
      
      // Request location and update on backend
      requestLocationAndSubscribe();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju profila');
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const res = await api.get('/api/players/analytics');
      setAnalytics(res.data);
    } catch (err: any) {
      console.error('Analytics error:', err);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const res = await api.put('/api/players/profile', formData);
      setUser(res.data);
      setEditing(false);
      setSuccess('Profil je uspešno ažuriran!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri čuvanju profila');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (user) {
      setFormData({
        name: user.name || '',
        bio: user.bio || '',
        skills: user.skills || '',
        phone: user.phone || '',
        location: user.location || '',
        preferredSports: user.preferredSports || [],
        experience: user.experience || 'beginner',
        avatarUrl: user.avatarUrl || '',
        notificationEnabled: user.notificationEnabled !== undefined ? user.notificationEnabled : true,
        notificationRadius: user.notificationRadius || 10
      });
    }
    setEditing(false);
    setError(null);
  }

  // Request geolocation and update on backend, also subscribe to push notifications
  async function requestLocationAndSubscribe() {
    if (!currentUser || currentUser.role !== 'player') return;

    try {
      // Request geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              // Update location on backend
              await api.post('/api/players/location', {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
            } catch (err) {
              console.error('Error updating location:', err);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }

      // Subscribe to push notifications
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          // Check current permission status first
          let permission = Notification.permission;
          
          // If permission is default, request it
          if (permission === 'default') {
            permission = await Notification.requestPermission();
          }
          
          // If permission is denied, show message and return
          if (permission !== 'granted') {
            if (permission === 'denied') {
              console.warn('⚠️ Notification permission denied. Please enable notifications in browser settings.');
              // Could show a user-friendly message here
            } else {
              console.warn('Notification permission not granted:', permission);
            }
            return;
          }
          
          console.log('✅ Notification permission granted');

          // Get VAPID public key
          const vapidRes = await api.get('/api/players/vapid-public-key');
          const vapidPublicKey = vapidRes.data.publicKey;

          if (!vapidPublicKey) {
            console.warn('VAPID public key not available');
            return;
          }

          // Register service worker
          const registration = await navigator.serviceWorker.ready;

          // Check if already subscribed
          let subscription = await registration.pushManager.getSubscription();
          
          // Subscribe to push notifications if not already subscribed
          if (!subscription) {
            const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: applicationServerKey as ArrayBuffer
            });
          }

          // Send subscription to backend
          await api.post('/api/players/push-subscription', subscription);
          console.log('Push subscription successful');
        } catch (err: any) {
          // User denied notification permission or subscription failed
          if (err.name !== 'NotAllowedError') {
            console.error('Error subscribing to push notifications:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error in requestLocationAndSubscribe:', error);
    }
  }

  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
  }

  function handleAddSport() {
    const sport = prompt('Unesite naziv sporta:');
    if (sport && sport.trim() && !formData.preferredSports.includes(sport.trim())) {
      setFormData({
        ...formData,
        preferredSports: [...formData.preferredSports, sport.trim()]
      });
    }
  }

  function handleRemoveSport(sport: string) {
    setFormData({
      ...formData,
      preferredSports: formData.preferredSports.filter(s => s !== sport)
    });
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Alert severity="error">Korisnik nije pronađen</Alert>
    );
  }

  const experienceLabels: Record<string, string> = {
    beginner: 'Početnik',
    intermediate: 'Srednji',
    advanced: 'Napredni',
    professional: 'Profesionalac'
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" component="h1">
          Moj Profil
        </Typography>
        {!editing && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => setEditing(true)}
          >
            Izmeni Profil
          </Button>
        )}
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

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                {/* Avatar and Basic Info */}
                <Box display="flex" gap={3} alignItems="flex-start">
                  <Avatar
                    src={editing ? formData.avatarUrl : user.avatarUrl}
                    sx={{ width: 100, height: 100 }}
                  >
                    {user.name?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box flex={1}>
                    {editing ? (
                      <TextField
                        fullWidth
                        label="URL avatara"
                        value={formData.avatarUrl}
                        onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                    ) : null}
                  </Box>
                </Box>

                {/* Name */}
                {editing ? (
                  <TextField
                    fullWidth
                    label="Ime"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                ) : (
                  <Typography variant="h5">{user.name}</Typography>
                )}

                {/* Email (read-only) */}
                <TextField
                  fullWidth
                  label="Email"
                  value={user.email}
                  disabled
                  variant="outlined"
                />

                {/* Bio */}
                {editing ? (
                  <TextField
                    fullWidth
                    label="Biografija"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    multiline
                    rows={4}
                    placeholder="Napišite nešto o sebi..."
                  />
                ) : (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Biografija
                    </Typography>
                    <Typography variant="body1">
                      {user.bio || 'Nema biografije'}
                    </Typography>
                  </Box>
                )}

                {/* Skills */}
                {editing ? (
                  <TextField
                    fullWidth
                    label="Veštine"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    multiline
                    rows={2}
                    placeholder="Opisite svoje veštine..."
                  />
                ) : (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Veštine
                    </Typography>
                    <Typography variant="body1">
                      {user.skills || 'Nisu navedene veštine'}
                    </Typography>
                  </Box>
                )}

                {/* Phone */}
                {editing ? (
                  <TextField
                    fullWidth
                    label="Telefon"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                ) : (
                  user.phone && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Telefon
                      </Typography>
                      <Typography variant="body1">{user.phone}</Typography>
                    </Box>
                  )
                )}

                {/* Location */}
                {editing ? (
                  <TextField
                    fullWidth
                    label="Lokacija"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                ) : (
                  user.location && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Lokacija
                      </Typography>
                      <Typography variant="body1">{user.location}</Typography>
                    </Box>
                  )
                )}

                {/* Experience */}
                {editing ? (
                  <TextField
                    fullWidth
                    select
                    label="Nivo iskustva"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value as any })}
                    SelectProps={{ native: true }}
                  >
                    <option value="beginner">Početnik</option>
                    <option value="intermediate">Srednji</option>
                    <option value="advanced">Napredni</option>
                    <option value="professional">Profesionalac</option>
                  </TextField>
                ) : (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Nivo iskustva
                    </Typography>
                    <Chip
                      label={experienceLabels[user.experience || 'beginner']}
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                )}

                {/* Notification Settings */}
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <NotificationsIcon color="primary" />
                    <Typography variant="h6">
                      Postavke Obaveštenja
                    </Typography>
                  </Box>
                  
                  {editing ? (
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.notificationEnabled}
                            onChange={(e) => setFormData({ ...formData, notificationEnabled: e.target.checked })}
                          />
                        }
                        label="Omogući obaveštenja o mečevima u blizini"
                      />
                      {formData.notificationEnabled && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Radius obaveštenja: {formData.notificationRadius} km
                          </Typography>
                          <Slider
                            value={formData.notificationRadius}
                            onChange={(e, value) => setFormData({ ...formData, notificationRadius: value as number })}
                            min={1}
                            max={50}
                            step={1}
                            marks={[
                              { value: 1, label: '1 km' },
                              { value: 10, label: '10 km' },
                              { value: 25, label: '25 km' },
                              { value: 50, label: '50 km' }
                            ]}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${value} km`}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Obavestićemo vas kada se kreira novi meč u okviru izabranog radiusa
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        <strong>Obaveštenja:</strong>{' '}
                        {user.notificationEnabled ? 'Omogućena' : 'Onemogućena'}
                      </Typography>
                      {user.notificationEnabled && (
                        <Typography variant="body2">
                          <strong>Radius:</strong> {user.notificationRadius || 10} km
                        </Typography>
                      )}
                      {user.lastKnownLocation && (
                        <Typography variant="caption" color="text.secondary">
                          Poslednja lokacija: {user.lastKnownLocation.lat?.toFixed(4)}, {user.lastKnownLocation.lng?.toFixed(4)}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Box>

                {/* Preferred Sports */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Omiljeni sportovi
                  </Typography>
                  {editing ? (
                    <Stack spacing={1}>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {formData.preferredSports.map((sport) => (
                          <Chip
                            key={sport}
                            label={sport}
                            onDelete={() => handleRemoveSport(sport)}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleAddSport}
                      >
                        + Dodaj sport
                      </Button>
                    </Stack>
                  ) : (
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {user.preferredSports && user.preferredSports.length > 0 ? (
                        user.preferredSports.map((sport) => (
                          <Chip key={sport} label={sport} color="primary" variant="outlined" />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Nisu navedeni omiljeni sportovi
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Edit Actions */}
                {editing && (
                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      Otkaži
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Čuvanje...' : 'Sačuvaj'}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Analytics */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistika
              </Typography>
              <Divider sx={{ my: 2 }} />
              {analytics ? (
                <Stack spacing={2}>
                  {/* Reliability Score */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: analytics.reliabilityScore >= 80 ? 'success.light' : analytics.reliabilityScore >= 60 ? 'warning.light' : 'error.light',
                      color: 'white'
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <TrendingUpIcon />
                      <Typography variant="subtitle2" fontWeight="bold">
                        Pouzdanost
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold">
                      {analytics.reliabilityScore}%
                    </Typography>
                    <Typography variant="caption">
                      {analytics.reliabilityScore >= 80
                        ? 'Odličan igrač'
                        : analytics.reliabilityScore >= 60
                        ? 'Dobar igrač'
                        : 'Treba poboljšanje'}
                    </Typography>
                  </Paper>

                  {/* Show-up Rate */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: 'primary.light',
                      color: 'white'
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <PersonIcon />
                      <Typography variant="subtitle2" fontWeight="bold">
                        Stopa odaziva
                      </Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold">
                      {analytics.showUpRate}%
                    </Typography>
                    <Typography variant="caption">
                      Prijavljeni mečevi / Odigrani mečevi
                    </Typography>
                  </Paper>

                  <Divider />

                  {/* Statistics */}
                  <Box>
                    <Stack spacing={1.5}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <EventIcon color="primary" />
                          <Typography variant="body2">Ukupno prijavljeno</Typography>
                        </Box>
                        <Typography variant="h6" fontWeight="bold">
                          {analytics.totalRegistered}
                        </Typography>
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <TrophyIcon color="success" />
                          <Typography variant="body2">Odigrano</Typography>
                        </Box>
                        <Typography variant="h6" fontWeight="bold" color="success.main">
                          {analytics.totalCompleted}
                        </Typography>
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <SportsIcon color="info" />
                          <Typography variant="body2">Rezervisano</Typography>
                        </Box>
                        <Typography variant="h6" fontWeight="bold" color="info.main">
                          {analytics.totalReserved}
                        </Typography>
                      </Box>

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <CancelIcon2 color="error" />
                          <Typography variant="body2">Otkazano</Typography>
                        </Box>
                        <Typography variant="h6" fontWeight="bold" color="error.main">
                          {analytics.totalCancelled}
                        </Typography>
                      </Box>

                      {analytics.totalCancelledWithComment > 0 && (
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box display="flex" alignItems="center" gap={1}>
                            <CancelIcon2 color="warning" />
                            <Typography variant="body2">Otkazano sa komentarom</Typography>
                          </Box>
                          <Typography variant="h6" fontWeight="bold" color="warning.main">
                            {analytics.totalCancelledWithComment}
                          </Typography>
                        </Box>
                      )}

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                          <SportsIcon color="secondary" />
                          <Typography variant="body2">Kreirano</Typography>
                        </Box>
                        <Typography variant="h6" fontWeight="bold" color="secondary.main">
                          {analytics.totalCreated}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Stack>
              ) : (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
