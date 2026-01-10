import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  Divider
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import CancelIcon from '@mui/icons-material/Cancel';
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
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelComment, setCancelComment] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/api/matches/${id}`).then((res) => setMatch(res.data));
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
    return !isAlreadyJoined && match.status !== 'full' && match.status !== 'failed' && !deadlinePassed;
  }, [match, user]);

  const canLeave = useMemo(() => {
    if (!match || !user) return false;
    const isJoined = match.players.some(p => p._id === user._id);
    const isCreator = match.createdBy._id === user._id;
    const deadlinePassed = new Date() > new Date(match.registrationDeadline);
    // Can leave if joined, not the creator (or creator but match not full/completed), and deadline hasn't passed
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
        // Reload match to get updated status
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
        // Reload match to get updated status
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

  if (!match) return <Typography>Učitavanje...</Typography>;

  const { fieldId } = match;
  const center: [number, number] = [fieldId.lat, fieldId.lng];

  return (
    <Stack spacing={{ xs: 1.5, sm: 2 }}>
      <Typography variant="h5" fontWeight={600} sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
        {match.sport} na {fieldId.name}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
        <Chip 
          label={`Status: ${match.status === 'full' ? 'Pun' : match.status === 'open' ? 'Otvoren' : match.status === 'completed' ? 'Završen' : match.status}`} 
          color={
            match.status === 'failed' ? 'error' :
            match.status === 'full' ? 'warning' :
            match.status === 'completed' ? 'success' :
            'primary'
          }
          sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, height: { xs: 24, sm: 32 } }}
        />
        <Chip 
          color="primary" 
          label={`Igrači: ${formatPlayersCount(match)}`}
          sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, height: { xs: 24, sm: 32 } }}
        />
      </Stack>
      <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
        <strong>Datum meča:</strong> {formatDateTime(match.dateTime)}
      </Typography>
      <Typography 
        variant="body1" 
        color={new Date() > new Date(match.registrationDeadline) ? 'error.main' : 'text.primary'}
        sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
      >
        <strong>Rok za prijavu:</strong> {formatDateTime(match.registrationDeadline)}
        {new Date() > new Date(match.registrationDeadline) && ' (ISTEKAO)'}
      </Typography>
      <Paper 
        elevation={1} 
        sx={{ 
          p: 0, 
          overflow: 'hidden', 
          height: { xs: 280, sm: 360 },
          borderRadius: { xs: 2, sm: 3 }
        }}
      >
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
            <Popup>{fieldId.name} — {fieldId.sport}</Popup>
          </Marker>
        </MapContainer>
      </Paper>
      <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 600 }}>
        Igrači
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: { xs: 0.5, sm: 1 } }}>
        {match.players.map((p) => (
          <Chip 
            key={p._id} 
            label={p.name}
            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, height: { xs: 24, sm: 32 } }}
          />
        ))}
      </Stack>
      
      {/* Show cancellations if any */}
      {match.playerCancellations && match.playerCancellations.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, fontWeight: 600, mt: 2 }}>
            Otkazani dolasci
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {match.playerCancellations.map((cancellation, index) => (
              <Paper key={index} elevation={1} sx={{ p: 2 }}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" fontWeight="bold">
                    {typeof cancellation.playerId === 'object' ? cancellation.playerId.name : 'Nepoznat korisnik'}
                  </Typography>
                  {cancellation.comment && (
                    <Typography variant="body2" color="text.secondary">
                      {cancellation.comment}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(cancellation.cancelledAt)}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}
      {match.status === 'failed' ? (
        <Typography variant="body1" color="error" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          Ovaj meč nije uspeo - nije bilo dovoljno igrača do roka za prijavu.
        </Typography>
      ) : new Date() > new Date(match.registrationDeadline) ? (
        <Typography variant="body1" color="warning.main" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          Rok za prijavu je istekao. Ne možete se pridružiti ovom meču.
        </Typography>
      ) : canLeave ? (
        <Button 
          variant="outlined" 
          color="error"
          onClick={handleOpenCancelDialog}
          fullWidth
          size="large"
          startIcon={<CancelIcon />}
          sx={{ 
            fontSize: { xs: '1rem', sm: '1.125rem' },
            py: { xs: 1.25, sm: 1.5 },
            fontWeight: 600
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
            fontSize: { xs: '1rem', sm: '1.125rem' },
            py: { xs: 1.25, sm: 1.5 },
            fontWeight: 600
          }}
        >
          Pridruži se meču
        </Button>
      ) : null}

      {/* Cancel Attendance Dialog */}
      <Dialog open={cancelDialogOpen} onClose={handleCloseCancelDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Otkaži dolazak na meč</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Da li ste sigurni da želite da otkažete dolazak na ovaj meč? (Opcionalno) dodajte komentar:
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Razlog otkazivanja (opciono)"
              value={cancelComment}
              onChange={(e) => setCancelComment(e.target.value)}
              placeholder="Npr. Ne mogu da dođem zbog obaveza..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancelDialog} disabled={cancelling}>
            Odustani
          </Button>
          <Button
            onClick={handleCancelAttendance}
            variant="contained"
            color="error"
            disabled={cancelling}
          >
            {cancelling ? 'Otkazivanje...' : 'Otkaži dolazak'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}


