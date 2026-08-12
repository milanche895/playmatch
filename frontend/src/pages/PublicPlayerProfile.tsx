import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Grid,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  EmojiEvents as TrophyIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import api from '../lib/api';
import { User, PlayerAnalytics } from '../types';
import { getTrustBadge } from '../lib/reliability';
import { getGameTypeName } from '../constants/games';

const experienceLabels: Record<string, string> = {
  beginner: 'Početnik',
  intermediate: 'Srednji',
  advanced: 'Napredni',
  professional: 'Profesionalac',
};

const getExperienceColor = (exp?: string) => {
  switch (exp) {
    case 'professional': return 'error';
    case 'advanced': return 'warning';
    case 'intermediate': return 'info';
    default: return 'success';
  }
};

export default function PublicPlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [analytics, setAnalytics] = useState<PlayerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadProfile(id);
  }, [id]);

  async function loadProfile(playerId: string) {
    try {
      setLoading(true);
      setError(null);
      const [profileRes, analyticsRes] = await Promise.all([
        api.get(`/api/players/profile/${playerId}`),
        api.get(`/api/players/analytics/${playerId}`),
      ]);
      setUser(profileRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Greška pri učitavanju profila');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error || 'Korisnik nije pronađen'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Nazad
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Nazad
      </Button>

      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Profil igrača
      </Typography>

      <Grid container spacing={3}>
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
              <Avatar
                src={user.avatarUrl}
                sx={{
                  width: 96,
                  height: 96,
                  mx: 'auto',
                  mb: 2,
                  border: '3px solid white',
                  fontSize: 40,
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="h5" fontWeight={700}>
                {user.name}
              </Typography>
              {user.experience && (
                <Chip
                  label={experienceLabels[user.experience]}
                  size="small"
                  color={getExperienceColor(user.experience) as 'success' | 'warning' | 'info' | 'error'}
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2}>
                {user.bio && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Biografija</Typography>
                    <Typography variant="body2">{user.bio}</Typography>
                  </Box>
                )}
                {user.skills && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Veštine</Typography>
                    <Typography variant="body2">{user.skills}</Typography>
                  </Box>
                )}
                {user.preferredSports && user.preferredSports.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Omiljene igre</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5, mt: 0.5 }}>
                      {user.preferredSports.map((sport) => (
                        <Chip key={sport} label={getGameTypeName(sport)} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
                {user.phone && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">{user.phone}</Typography>
                  </Stack>
                )}
                {user.location && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LocationIcon fontSize="small" color="action" />
                    <Typography variant="body2">{user.location}</Typography>
                  </Stack>
                )}
                {(user.sportSkillLevels || []).length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Nivo po sportu</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5, mt: 0.5 }}>
                      {user.sportSkillLevels?.map((entry) => (
                        <Chip
                          key={`${entry.sport}-${entry.skillLevel}`}
                          label={`${getGameTypeName(entry.sport)}: ${entry.skillLevel}/5`}
                          size="small"
                          color="primary"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
                <TrophyIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                Statistika
              </Typography>

              {analytics ? (
                <Stack spacing={3}>
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" color="text.secondary">Prosečna ocena</Typography>
                    <Typography variant="h5" fontWeight={700} color="warning.main">
                      {Number(user.ratingAvg || 0).toFixed(1)} / 5
                    </Typography>
                  </Paper>

                  {(() => {
                    const badge = getTrustBadge(analytics.reliabilityScore);
                    return (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: badge.bgColor,
                      color: 'white',
                    }}
                  >
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Pouzdanost</Typography>
                    <Typography variant="h3" fontWeight={700}>{analytics.reliabilityScore}%</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.95 }}>
                      {badge.emoji} {badge.label}
                    </Typography>
                  </Paper>
                    );
                  })()}

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                    {[
                      { label: 'Kreirani mečevi', value: analytics.totalRegistered, color: 'primary.main' },
                      { label: 'Prijavljeni mečevi', value: analytics.totalJoinMatch, color: 'info.main' },
                      { label: 'Odigrano', value: analytics.totalReserved, color: 'success.main' },
                      { label: 'Otkazano', value: analytics.totalCancelled, color: 'error.main' },
                    ].map((stat) => (
                      <Paper key={stat.label} elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
                        <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ color: stat.color }}>
                          {stat.value}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">Statistika nije dostupna.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
