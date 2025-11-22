import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Stack, Typography, Button, Chip, Paper } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/api';
import { Match } from '../types';
import { socket } from '../lib/socket';

// Fix default Leaflet icon URLs
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

export default function MatchDetails() {
  const { id } = useParams();
  const [match, setMatch] = useState<Match | null>(null);

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
    if (!match) return false;
    const deadlinePassed = new Date() > new Date(match.registrationDeadline);
    return match.status !== 'full' && match.status !== 'failed' && !deadlinePassed;
  }, [match]);

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
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={600}>{match.sport} na {fieldId.name}</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip 
          label={`Status: ${match.status}`} 
          color={
            match.status === 'failed' ? 'error' :
            match.status === 'full' ? 'warning' :
            'success'
          }
        />
        <Chip color="primary" label={`Igrači: ${match.players.length}/${match.playersNeeded}`} />
      </Stack>
      <Typography variant="body1">
        <strong>Datum meča:</strong> {formatDateTime(match.dateTime)}
      </Typography>
      <Typography variant="body1" color={new Date() > new Date(match.registrationDeadline) ? 'error.main' : 'text.primary'}>
        <strong>Rok za prijavu:</strong> {formatDateTime(match.registrationDeadline)}
        {new Date() > new Date(match.registrationDeadline) && ' (ISTEKAO)'}
      </Typography>
      <Paper elevation={1} sx={{ p: 0, overflow: 'hidden', height: 360 }}>
        <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={center}>
            <Popup>{fieldId.name} — {fieldId.sport}</Popup>
          </Marker>
        </MapContainer>
      </Paper>
      <Typography variant="h6">Igrači</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {match.players.map((p) => (
          <Chip key={p._id} label={p.name} />
        ))}
      </Stack>
      {match.status === 'failed' ? (
        <Typography variant="body1" color="error">
          Ovaj meč nije uspeo - nije bilo dovoljno igrača do roka za prijavu.
        </Typography>
      ) : new Date() > new Date(match.registrationDeadline) ? (
        <Typography variant="body1" color="warning.main">
          Rok za prijavu je istekao. Ne možete se pridružiti ovom meču.
        </Typography>
      ) : (
        <Button variant="contained" disabled={!canJoin} onClick={join}>
          Pridruži se meču
        </Button>
      )}
    </Stack>
  );
}


