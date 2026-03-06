import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Stack,
  Typography,
  Button,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Divider,
  Card,
  CardContent,
  Avatar,
  IconButton,
  Skeleton,
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleIcon from '@mui/icons-material/People';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/api';
import { Match } from '../types';
import { socket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';

// Fix default Leaflet icon URLs
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Helper function to format players count display
function formatPlayersCount(match: Match): string {
  const current = match.players.length;
  const min = match.minPlayers ?? match.playersNeeded;
  const max = match.maxPlayers;

  if (max) {
    return `${current}/${min}-${max}`;
  }
  return `${current}/${min}`;
}

export default function MatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelComment, setCancelComment] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/matches/${id}`).then((res) => {
      setMatch(res.data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    socket.connect();
    socket.emit('join_match_room', id);
    const handler = (updated: Match) => { if (updated._id === id) setMatch(updated); };
    socket.on('match_updated', handler);
    return () => {
      socket.emit('leave_match_room', id);
      socket.off('match_updated', handler);
      socket.disconnect();
    };
  }, [id]);

  const canJoin = useMemo(() => {
    if (!match || !user) return false;
    const deadlinePassed = new Date() > new Date(match.registrationDeadline);
    const isAlreadyJoined = match.players.some(p => p._id === user._id);
    const maxPlayersReached = match.players.length >= (match.maxPlayers || match.playersNeeded || 100);
    return !isAlreadyJoined && match.status !== 'failed' && !deadlinePassed && !maxPlayersReached;
  }, [match, user]);

  const canLeave = useMemo(() => {
    if (!match || !user) return false;
    const isJoined = match.players.some(p => p._id === user._id);
    const isCreator = match.createdBy._id === user._id;
    const deadlinePassed = new Date() > new Date(match.registrationDeadline);
    return isJoined && (!isCreator || (match.status !== 'full' && match.status !== 'completed')) && !deadlinePassed;
  }, [match, user]);

  async function join() {
    if (!id) return;
    try {
      const res = await api.post(`/api/matches/${id}/join`);
      setMatch(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno pridruživanje meču');
      if (id) {
        api.get(`/api/matches/${id}`).then((res) => setMatch(res.data));
      }
    }
  }

  function handleOpenCancelDialog() {
    setCancelDialogOpen(true);
    setCancelComment('');
  }

  function handleCloseCancelDialog() {
    setCancelDialogOpen(false);
    setCancelComment('');
  }

  async function handleCancelAttendance() {
    if (!id) return;
    try {
      setCancelling(true);
      const res = await api.post(`/api/matches/${id}/cancel-attendance`, {
        comment: cancelComment.trim()
      });
      setMatch(res.data);
      handleCloseCancelDialog();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno otkazivanje dolaska');
      if (id) {
        api.get(`/api/matches/${id}`).then((res) => setMatch(res.data));
      }
    } finally {
      setCancelling(false);
    }
  }

  function formatDateTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
    return date.toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Skeleton variant="text" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={300} sx={{ mb: 2, borderRadius: 4 }} />
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 4 }} />
      </Box>
    );
  }

  if (!match) return <Typography>Učitavanje...</Typography>;

  const { fieldId } = match;
  const center: [number, number] = [fieldId.lat, fieldId.lng];

  const getStatusConfig = () => {
    switch (match.status) {
      case 'failed':
        return { color: 'error' as const, icon: <ErrorIcon />, label: 'Neuspešan' };
      case 'full':
        return { color: 'warning' as const, icon: <PeopleIcon />, label: 'Pun' };
      case 'completed':
        return { color: 'success' as const, icon: <CheckCircleIcon />, label: 'Završen' };
      default:
        return { color: 'primary' as const, icon: <SportsSoccerIcon />, label: 'Otvoren' };
    }
  };

  const statusConfig = getStatusConfig();
  const isDeadlinePassed = new Date() > new Date(match.registrationDeadline);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Nazad
      </Button>

      {/* Header Card */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            p: 3,
            background: 'linear-gradient(135deg, primary.main 0%, primary.dark 100%)',
            color: 'primary.contrastText',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
            }}
          />
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={statusConfig.icon}
                label={statusConfig.label}
                size="small"
                color={statusConfig.color}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.9)',
                  fontWeight: 600,
                }}
              />
            </Stack>
            <Typography variant="h4" fontWeight={700}>
              {match.sport}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <LocationOnIcon sx={{ fontSize: 20 }} />
              <Typography variant="h6" fontWeight={500}>
                {fieldId.name}
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <CardContent sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* Info Grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 3,
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarTodayIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                  <Typography variant="body2" color="text.secondary">
                    Datum meča
                  </Typography>
                </Stack>
                <Typography variant="body1" fontWeight={600}>
                  {formatDateTime(match.dateTime)}
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeIcon sx={{ color: isDeadlinePassed ? 'error.main' : 'text.secondary', fontSize: 18 }} />
                  <Typography variant="body2" color={isDeadlinePassed ? 'error.main' : 'text.secondary'}>
                    Rok za prijavu
                  </Typography>
                </Stack>
                <Typography variant="body1" fontWeight={600} color={isDeadlinePassed ? 'error.main' : 'text.primary'}>
                  {formatDateTime(match.registrationDeadline)}
                  {isDeadlinePassed && ' (ISTEKAO)'}
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PeopleIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                  <Typography variant="body2" color="text.secondary">
                    Igrači
                  </Typography>
                </Stack>
                <Typography variant="body1" fontWeight={600}>
                  {formatPlayersCount(match)}
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PersonIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                  <Typography variant="body2" color="text.secondary">
                    Organizator
                  </Typography>
                </Stack>
                <Typography variant="body1" fontWeight={600}>
                  {match.createdBy.name}
                </Typography>
              </Stack>
            </Box>

            <Divider />

            {/* Players Section */}
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                Prijavljeni igrači ({match.players.length})
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                {match.players.map((p) => (
                  <Chip
                    key={p._id}
                    avatar={
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {p.name.charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    label={p.name}
                    sx={{
                      borderRadius: 2,
                      '& .MuiChip-avatar': {
                        width: 28,
                        height: 28,
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Cancellations Section */}
            {match.playerCancellations && match.playerCancellations.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: 'error.main' }}>
                    <WarningIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
                    Otkazani dolasci ({match.playerCancellations.length})
                  </Typography>
                  <Stack spacing={1.5}>
                    {match.playerCancellations.map((cancellation, index) => (
                      <Paper
                        key={index}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'error.light',
                          bgcolor: 'error.light',
                          opacity: 0.8,
                        }}
                      >
                        <Stack spacing={0.5}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" fontWeight={600}>
                              {typeof cancellation.playerId === 'object' ? cancellation.playerId.name : 'Nepoznat korisnik'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDateTime(cancellation.cancelledAt)}
                            </Typography>
                          </Stack>
                          {cancellation.comment && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              "{cancellation.comment}"
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Map Section */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          mb: 3,
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LocationOnIcon sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Lokacija terena
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ height: 300 }}>
          <MapContainer
            center={center}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={center}>
              <Popup>{fieldId.name} — {fieldId.sports?.join(', ') || fieldId.sport || 'Nepoznat sport'}</Popup>
            </Marker>
          </MapContainer>
        </Box>
      </Paper>

      {/* Action Buttons */}
      {match.status === 'failed' ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'error.light',
            bgcolor: 'error.light',
            textAlign: 'center',
          }}
        >
          <ErrorIcon sx={{ color: 'error.main', fontSize: 40, mb: 1 }} />
          <Typography variant="h6" color="error.main" fontWeight={600}>
            Meč nije uspeo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nije bilo dovoljno igrača do roka za prijavu.
          </Typography>
        </Paper>
      ) : isDeadlinePassed ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'warning.light',
            bgcolor: 'warning.light',
            textAlign: 'center',
          }}
        >
          <AccessTimeIcon sx={{ color: 'warning.main', fontSize: 40, mb: 1 }} />
          <Typography variant="h6" color="warning.main" fontWeight={600}>
            Rok za prijavu je istekao
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ne možete se pridružiti ovom meču.
          </Typography>
        </Paper>
      ) : canLeave ? (
        <Button
          variant="outlined"
          color="error"
          onClick={handleOpenCancelDialog}
          fullWidth
          size="large"
          startIcon={<CancelIcon />}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 3,
            borderWidth: 2,
          }}
        >
          Otkaži dolazak
        </Button>
      ) : canJoin ? (
        <Button
          variant="contained"
          onClick={join}
          fullWidth
          size="large"
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 3,
          }}
        >
          Pridruži se meču
        </Button>
      ) : null}

      {/* Cancel Attendance Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={handleCloseCancelDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CancelIcon color="error" />
            <Typography variant="h6" fontWeight={700}>
              Otkaži dolazak
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Da li ste sigurni da želite da otkažete dolazak na ovaj meč? Ako želite, možete dodati razlog:
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Razlog otkazivanja (opciono)"
              value={cancelComment}
              onChange={(e) => setCancelComment(e.target.value)}
              placeholder="Npr. Ne mogu da dođem zbog obaveza..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleCloseCancelDialog}
            disabled={cancelling}
            variant="outlined"
            sx={{ borderRadius: 3, px: 3 }}
          >
            Odustani
          </Button>
          <Button
            onClick={handleCancelAttendance}
            variant="contained"
            color="error"
            disabled={cancelling}
            sx={{ borderRadius: 3, px: 3 }}
          >
            {cancelling ? 'Otkazivanje...' : 'Otkaži dolazak'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
