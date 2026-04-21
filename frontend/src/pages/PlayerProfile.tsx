import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Avatar,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Paper,
  Switch,
  FormControlLabel,
  Slider,
  Grid,
  IconButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  SportsSoccer as SportsIcon,
  EmojiEvents as TrophyIcon,
  CancelPresentation as CancelIcon2,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  ArrowBack as ArrowBackIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { User, PlayerAnalytics } from '../types';

export default function PlayerProfile() {
  const { user: currentUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [analytics, setAnalytics] = useState<PlayerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Samo slike su dozvoljene (JPEG, PNG, GIF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Slika je prevelika. Maksimalna veličina je 5MB.');
      return;
    }

    try {
      setUploadingAvatar(true);
      setError(null);

      const formData = new FormData();
      formData.append('avatar', file);

      const res = await api.post('/api/players/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Update local user state
      setUser(prev => prev ? { ...prev, avatarUrl: res.data.avatarUrl } : null);
      // Also update the global auth context
      await refreshUser();

      setSuccess('Slika profila je uspešno ažurirana!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri upload-u slike');
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  async function handleTestNotification() {
    // Check if user has push subscription first
    if (!user?.pushSubscription) {
      setError(
        <span>
          Nema aktivne pretplate na push notifikacije.{' '}
          <Link to="/notification-settings" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
            Otvori Notification Settings
          </Link>{' '}
          da se pretplatiš.
        </span>
      );
      return;
    }

    try {
      setTestingNotification(true);
      setError(null);
      const res = await api.post('/api/players/test-push');
      setSuccess(res.data.message || 'Test notifikacija poslata! Proveri da li si je primio.');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Greška pri slanju test notifikacije';
      // If the error is about missing subscription, provide helpful link
      if (errorMessage.includes('Nema push subscription') || errorMessage.includes('pretplat')) {
        setError(
          <span>
            {errorMessage}.{' '}
            <Link to="/notification-settings" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Klikni ovde da se pretplatiš
            </Link>
          </span>
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setTestingNotification(false);
    }
  }

  async function requestLocationAndSubscribe() {
    if (!currentUser || currentUser.role !== 'player') return;
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await api.post('/api/players/location', {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
            } catch (err) {
              console.log('Location update skipped:', err);
            }
          },
          (error) => {
            // Silently handle geolocation errors - not critical for app function
            if (error.code === error.TIMEOUT) {
              console.log('Location request timed out - using last known position if available');
            } else if (error.code === error.PERMISSION_DENIED) {
              console.log('Location permission denied by user');
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              console.log('Location information unavailable');
            }
          },
          { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
        );
      }
    } catch (error) {
      console.log('Geolocation not supported or error:', error);
    }
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
    return <Alert severity="error">Korisnik nije pronađen</Alert>;
  }

  const experienceLabels: Record<string, string> = {
    beginner: 'Početnik',
    intermediate: 'Srednji',
    advanced: 'Napredni',
    professional: 'Profesionalac'
  };

  const getExperienceColor = (exp: string) => {
    switch (exp) {
      case 'professional': return 'error';
      case 'advanced': return 'warning';
      case 'intermediate': return 'info';
      default: return 'success';
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Nazad
        </Button>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" fontWeight={700}>
            Moj Profil
          </Typography>
          {!editing && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => setEditing(true)}
              sx={{ borderRadius: 3 }}
            >
              Izmeni Profil
            </Button>
          )}
        </Stack>
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

      <Grid container spacing={3}>
        {/* Profile Card */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <Box
              sx={{
                p: 4,
                background: 'linear-gradient(135deg, primary.main 0%, primary.dark 100%)',
                color: 'primary.contrastText',
                textAlign: 'center',
              }}
            >
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  src={editing ? formData.avatarUrl : user.avatarUrl}
                  sx={{
                    width: 120,
                    height: 120,
                    mx: 'auto',
                    mb: 2,
                    border: '4px solid white',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    fontSize: 48,
                    bgcolor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  {user.name?.charAt(0).toUpperCase()}
                </Avatar>

                {/* Hidden file input */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />

                {/* Upload button */}
                <IconButton
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: -8,
                    bgcolor: 'background.paper',
                    boxShadow: 2,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    width: 40,
                    height: 40,
                  }}
                >
                  {uploadingAvatar ? (
                    <CircularProgress size={20} />
                  ) : (
                    <PhotoCameraIcon sx={{ fontSize: 20 }} />
                  )}
                </IconButton>
              </Box>
              <Typography variant="h5" fontWeight={700}>
                {user.name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                {user.email}
              </Typography>
              <Chip
                label={experienceLabels[user.experience || 'beginner']}
                size="small"
                color={getExperienceColor(user.experience || 'beginner') as any}
                sx={{ mt: 2, fontWeight: 600 }}
              />
            </Box>

            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ color: 'text.secondary' }}><SportsIcon /></Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Omiljeni sportovi
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {user.preferredSports?.map((sport) => (
                        <Chip key={sport} label={sport} size="small" sx={{ fontSize: '0.75rem' }} />
                      )) || <Typography variant="body2">-</Typography>}
                    </Box>
                  </Box>
                </Stack>

                {user.phone && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ color: 'text.secondary' }}><PhoneIcon /></Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Telefon
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {user.phone}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                {user.location && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ color: 'text.secondary' }}><LocationIcon /></Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Lokacija
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {user.location}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Analytics Card */}
          <Card elevation={0} sx={{ mt: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                <TrophyIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                Statistika
              </Typography>
              
              {analytics ? (
                <Stack spacing={3}>
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">
                      Prosečna ocena igrača
                    </Typography>
                    <Typography variant="h5" fontWeight={700} color="warning.main">
                      {Number(user.ratingAvg || 0).toFixed(1)} / 5
                    </Typography>
                  </Paper>

                  {/* Reliability Score */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: analytics.reliabilityScore >= 80 ? 'success.light' : analytics.reliabilityScore >= 60 ? 'warning.light' : 'error.light',
                      color: 'white',
                    }}
                  >
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      Pouzdanost igrača
                    </Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {analytics.reliabilityScore}%
                    </Typography>
                  </Paper>

                  {/* Stats Grid */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary">
                        Kreirani mečevi
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="primary.main">
                        {analytics.totalRegistered}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary">
                        Prijavljeni mečevi
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="info.main">
                        {analytics.totalJoinMatch}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary">
                        Odigrano
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="success.main">
                        {analytics.totalReserved}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary">
                        Otkazano
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="error.main">
                        {analytics.totalCancelled}
                      </Typography>
                    </Paper>
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

        {/* Edit Profile Form */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
                Informacije o profilu
              </Typography>

              {editing ? (
                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    label="URL avatara"
                    value={formData.avatarUrl}
                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Ime"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Biografija"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    multiline
                    rows={4}
                    placeholder="Napišite nešto o sebi..."
                  />
                  <TextField
                    fullWidth
                    label="Veštine"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    multiline
                    rows={2}
                    placeholder="Opišite svoje veštine..."
                  />
                  <TextField
                    fullWidth
                    label="Telefon"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Lokacija"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
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

                  {/* Sports */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Omiljeni sportovi</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                      {formData.preferredSports.map((sport) => (
                        <Chip
                          key={sport}
                          label={sport}
                          onDelete={() => handleRemoveSport(sport)}
                          color="primary"
                        />
                      ))}
                    </Box>
                    <Button size="small" variant="outlined" onClick={handleAddSport}>
                      + Dodaj sport
                    </Button>
                  </Box>

                  {/* Notifications */}
                  <Divider />
                  <Typography variant="h6" fontWeight={600}>
                    <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                    Obaveštenja
                  </Typography>
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
                          { value: 25, label: '25 km' },
                          { value: 50, label: '50 km' }
                        ]}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value} km`}
                      />
                    </Box>
                  )}

                  {/* Test Notification Button */}
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<NotificationsActiveIcon />}
                    onClick={handleTestNotification}
                    disabled={testingNotification}
                    sx={{ borderRadius: 3, mt: 1 }}
                  >
                    {testingNotification ? 'Slanje...' : 'Pošalji test notifikaciju'}
                  </Button>

                  {!user?.pushSubscription && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Napomena: Morate biti pretplaćeni na notifikacije da biste mogli testirati.{' '}
                      <Link to="/notification-settings" style={{ color: 'inherit', fontWeight: 600 }}>
                        Pretplati se ovde
                      </Link>
                    </Typography>
                  )}

                  {/* Action Buttons */}
                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancel}
                      disabled={saving}
                      sx={{ borderRadius: 3 }}
                    >
                      Otkaži
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      disabled={saving}
                      sx={{ borderRadius: 3 }}
                    >
                      {saving ? 'Čuvanje...' : 'Sačuvaj'}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Biografija</Typography>
                    <Typography variant="body1">
                      {user.bio || 'Nema biografije'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Veštine</Typography>
                    <Typography variant="body1">
                      {user.skills || 'Nisu navedene veštine'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Obaveštenja</Typography>
                    <Typography variant="body1">
                      {user.notificationEnabled ? `Omogućena (${user.notificationRadius || 10} km radius)` : 'Onemogućena'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Skill level po sportu</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.75, gap: 1 }}>
                      {(user.sportSkillLevels || []).length > 0 ? (
                        user.sportSkillLevels?.map((entry) => (
                          <Chip
                            key={`${entry.sport}-${entry.skillLevel}`}
                            label={`${entry.sport}: ${entry.skillLevel}/5`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))
                      ) : (
                        <Typography variant="body2">Još nema skill ocena</Typography>
                      )}
                    </Stack>
                  </Box>

                  {/* Test Notification Button - View Mode */}
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<NotificationsActiveIcon />}
                    onClick={handleTestNotification}
                    disabled={testingNotification}
                    sx={{ borderRadius: 3, mt: 1, alignSelf: 'flex-start' }}
                  >
                    {testingNotification ? 'Slanje...' : 'Pošalji test notifikaciju'}
                  </Button>

                  {!user?.pushSubscription && (
                    <Typography variant="caption" color="text.secondary">
                      Napomena: Morate biti pretplaćeni na notifikacije da biste mogli testirati.{' '}
                      <Link to="/notification-settings" style={{ color: 'inherit', fontWeight: 600 }}>
                        Pretplati se ovde
                      </Link>
                    </Typography>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
