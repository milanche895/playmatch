import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  Alert,
  Checkbox,
  CircularProgress,
  MenuItem,
  FormControlLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
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
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import PaymentsIcon from '@mui/icons-material/Payments';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import CampaignIcon from '@mui/icons-material/Campaign';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../lib/api';
import { Match, MatchRatingStatus, NearbyPlayer } from '../types';
import { socket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { getTrustBadge } from '../lib/reliability';
import MatchQuickChat from '../components/MatchQuickChat';
import { getGameTypeName } from '../constants/games';
import { getCreditsDisplay } from '../lib/gamification';

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

function paymentPlayerId(playerId: { _id: string } | string): string {
  return typeof playerId === 'object' ? playerId._id : playerId;
}

function isPlayerPaid(match: Match, playerId: string): boolean {
  return (match.playerPayments || []).some(
    (p) => paymentPlayerId(p.playerId) === playerId && p.paid
  );
}

function formatRsd(amount: number): string {
  return `${amount.toLocaleString('sr-RS')} RSD`;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Gotovina',
  transfer: 'Prenos / IPS',
  other: 'Ostalo',
};

export default function MatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelComment, setCancelComment] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [pendingRatingUsers, setPendingRatingUsers] = useState<MatchRatingStatus['pendingUsers']>([]);
  const [ratingValues, setRatingValues] = useState<Record<string, { stars: number; fairPlay: boolean; skillLevel: number }>>({});
  const [submittingRatings, setSubmittingRatings] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [noShowIds, setNoShowIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [loadingRatingStatus, setLoadingRatingStatus] = useState(false);
  const [didAutoOpenCompleteDialog, setDidAutoOpenCompleteDialog] = useState(false);
  const [priceDraft, setPriceDraft] = useState<number | ''>('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [paymentMethodDraft, setPaymentMethodDraft] = useState<'cash' | 'transfer' | 'other'>('cash');
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationRating, setCelebrationRating] = useState<number | null>(null);
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [selectedInviteIds, setSelectedInviteIds] = useState<Set<string>>(new Set());
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoHighlight, setPromoHighlight] = useState(false);
  const promoteSectionRef = useRef<HTMLDivElement | null>(null);

  const shouldAutoOpenCompleteDialog = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('confirmMatch') === '1';
  }, [location.search]);

  const shouldFocusPromote = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('promote') === '1';
  }, [location.search]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/matches/${id}`).then((res) => {
      setMatch(res.data);
      setPriceDraft(res.data.pricePerPlayer ?? '');
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!id || !user || !match || match.status !== 'completed') return;
    const userIsParticipant = match.players.some((p) => p._id === user._id);
    if (!userIsParticipant) return;

    api.get(`/api/matches/${id}/rating-status`)
      .then((res) => {
        if (res.data?.shouldPrompt && Array.isArray(res.data.pendingUsers)) {
          setPendingRatingUsers(res.data.pendingUsers);
          const initial: Record<string, { stars: number; fairPlay: boolean; skillLevel: number }> = {};
          res.data.pendingUsers.forEach((p: any) => {
            initial[p._id] = { stars: 5, fairPlay: true, skillLevel: 3 };
          });
          setRatingValues(initial);
          setRatingDialogOpen(true);
        }
      })
      .catch(() => {
        // Non-blocking: if rating status fails we keep page usable.
      });
  }, [id, user, match]);

  useEffect(() => {
    if (!id) return;
    socket.connect();
    socket.emit('join_match_room', id);
    const handler = (updated: Match) => {
      if (updated._id === id) {
        setMatch(updated);
        setPriceDraft(updated.pricePerPlayer ?? '');
      }
    };
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
    const maxPlayersReached = match.players.length >= (match.maxPlayers || 100);
    return !isAlreadyJoined && match.status !== 'failed' && match.status !== 'otkazano' && match.status !== 'completed' && !deadlinePassed && !maxPlayersReached;
  }, [match, user]);

  const isOnWaitlist = useMemo(() => {
    if (!match || !user) return false;
    return (match.waitlist || []).some((p) => p._id === user._id);
  }, [match, user]);

  const waitlistPosition = useMemo(() => {
    if (!match || !user || !isOnWaitlist) return null;
    const idx = (match.waitlist || []).findIndex((p) => p._id === user._id);
    return idx >= 0 ? idx + 1 : null;
  }, [match, user, isOnWaitlist]);

  const canJoinWaitlist = useMemo(() => {
    if (!match || !user) return false;
    if (user.role === 'court') return false;
    const deadlinePassed = new Date() > new Date(match.registrationDeadline);
    const isAlreadyJoined = match.players.some((p) => p._id === user._id);
    const maxPlayersReached = match.players.length >= (match.maxPlayers || 100);
    return (
      !isAlreadyJoined &&
      !isOnWaitlist &&
      maxPlayersReached &&
      !deadlinePassed &&
      (match.status === 'open' || match.status === 'full')
    );
  }, [match, user, isOnWaitlist]);

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

  async function joinWaitlist() {
    if (!id) return;
    try {
      const res = await api.post(`/api/matches/${id}/waitlist`);
      setMatch(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno stajanje u red');
      if (id) {
        api.get(`/api/matches/${id}`).then((res) => setMatch(res.data));
      }
    }
  }

  async function leaveWaitlist() {
    if (!id) return;
    try {
      const res = await api.post(`/api/matches/${id}/waitlist/leave`);
      setMatch(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno napuštanje liste čekanja');
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

  async function handleShare() {
    if (!match || !id) return;
    const freeSlots = (match.maxPlayers || match.playersNeeded || 100) - match.players.length;
    const shareUrl = `${window.location.origin}/matches/${id}`;
    const locationName = match.isInformal
      ? (match.informalLocation?.name || 'Privatni teren')
      : match.fieldId?.name || 'Nepoznata lokacija';
    const shareText = [
      'Fali nam igrač!',
      `Sport: ${getGameTypeName(match.sport)}`,
      `Vreme: ${formatDateTime(match.dateTime)}`,
      `Lokacija: ${locationName}`,
      `Slobodna mesta: ${Math.max(freeSlots, 0)}`,
      ...(match.pricePerPlayer != null ? [`Cena po igraču: ${formatRsd(match.pricePerPlayer)}`] : []),
      `Link: ${shareUrl}`
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Plejko - ${getGameTypeName(match.sport)}`,
          text: shareText,
          url: shareUrl
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      alert('Link i detalji su kopirani.');
    } catch {
      alert('Deljenje nije uspelo. Probajte ponovo.');
    }
  }

  async function openRatingDialog() {
    if (!id || !user || !match) return;
    const userIsParticipant = match.players.some((p) => p._id === user._id);
    if (!userIsParticipant) {
      alert('Samo učesnici mogu oceniti saigrače');
      return;
    }
    try {
      setLoadingRatingStatus(true);
      const res = await api.get(`/api/matches/${id}/rating-status`);
      const pending = Array.isArray(res.data?.pendingUsers) ? res.data.pendingUsers : [];
      if (pending.length === 0) {
        alert('Nema saigrača za ocenjivanje (ili ste već ocenili sve).');
        return;
      }
      setPendingRatingUsers(pending);
      const initial: Record<string, { stars: number; fairPlay: boolean; skillLevel: number }> = {};
      pending.forEach((p: any) => {
        initial[p._id] = { stars: 5, fairPlay: true, skillLevel: 3 };
      });
      setRatingValues(initial);
      setRatingDialogOpen(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno učitavanje liste za ocenjivanje');
    } finally {
      setLoadingRatingStatus(false);
    }
  }

  function toggleNoShow(playerId: string) {
    setNoShowIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function handleCompleteMatch() {
    if (!id) return;
    try {
      setCompleting(true);
      const res = await api.post(`/api/matches/${id}/complete`, {
        noShows: Array.from(noShowIds)
      });
      setMatch(res.data);
      setCompleteDialogOpen(false);
      setNoShowIds(new Set());
    } catch (err: any) {
      alert(err.response?.data?.message || 'Greška pri potvrdi termina');
    } finally {
      setCompleting(false);
    }
  }

  async function handleSavePricePerPlayer() {
    if (!id) return;
    try {
      setSavingPrice(true);
      const payload = {
        pricePerPlayer: priceDraft === '' ? null : Number(priceDraft)
      };
      const res = await api.put(`/api/matches/${id}/price-per-player`, payload);
      setMatch(res.data);
      setPriceDraft(res.data.pricePerPlayer ?? '');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno čuvanje cene');
    } finally {
      setSavingPrice(false);
    }
  }

  async function handleTogglePaid(playerId: string, paid: boolean) {
    if (!id) return;
    try {
      setMarkingPaidId(playerId);
      const res = await api.post(`/api/matches/${id}/mark-paid`, {
        playerId,
        paid,
        method: paid ? paymentMethodDraft : undefined
      });
      setMatch(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno ažuriranje plaćanja');
    } finally {
      setMarkingPaidId(null);
    }
  }

  async function handleSubmitRatings() {
    if (!id) return;
    try {
      setSubmittingRatings(true);
      const ratings = pendingRatingUsers.map((p) => ({
        ratedUserId: p._id,
        stars: ratingValues[p._id]?.stars ?? 5,
        fairPlay: ratingValues[p._id]?.fairPlay ?? true,
        skillLevel: ratingValues[p._id]?.skillLevel ?? 3
      }));

      await api.post(`/api/matches/${id}/rate`, { ratings });
      setRatingDialogOpen(false);
      setPendingRatingUsers([]);

      await refreshUser();
      const me = await api.get('/api/auth/me');
      const avg = typeof me.data?.ratingAvg === 'number' ? me.data.ratingAvg : user?.ratingAvg ?? null;
      setCelebrationRating(avg);
      setCelebrationOpen(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Neuspešno slanje ocena');
    } finally {
      setSubmittingRatings(false);
    }
  }

  const canCompleteMatch = useMemo(() => {
    if (!match || !user) return false;
    return (
      match.isInformal &&
      match.createdBy._id === user._id &&
      (match.status === 'open' || match.status === 'full') &&
      new Date() > new Date(match.dateTime)
    );
  }, [match, user]);

  const canPromoteMatch = useMemo(() => {
    if (!match || !user) return false;
    const deadlinePassed = new Date() > new Date(match.registrationDeadline);
    return (
      match.createdBy._id === user._id &&
      (match.status === 'open' || match.status === 'full') &&
      !deadlinePassed
    );
  }, [match, user]);

  async function handleBoostConfirm() {
    if (!id) return;
    try {
      setBoosting(true);
      setPromoError(null);
      const res = await api.post(`/api/matches/${id}/boost`);
      setBoostDialogOpen(false);
      setPromoMessage(
        `Hitan signal poslat (${res.data?.sent ?? 0}). Preostalo kredita: ${res.data?.creditsRemaining ?? 0}.`
      );
      await refreshUser();
    } catch (err: any) {
      setPromoError(err.response?.data?.message || 'Neuspešan boost');
    } finally {
      setBoosting(false);
    }
  }

  async function openInviteModal() {
    if (!id) return;
    try {
      setInviteModalOpen(true);
      setLoadingNearby(true);
      setPromoError(null);
      setSelectedInviteIds(new Set());
      const res = await api.get(`/api/matches/${id}/nearby-players`);
      setNearbyPlayers(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setNearbyPlayers([]);
      setPromoError(err.response?.data?.message || 'Neuspešno učitavanje igrača u blizini');
    } finally {
      setLoadingNearby(false);
    }
  }

  function toggleInviteSelection(playerId: string) {
    setSelectedInviteIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function handleSendInvites() {
    if (!id || selectedInviteIds.size === 0) return;
    if (getCreditsDisplay(user?.credits) < 1) {
      setPromoError('Nemate dovoljno kredita za pozivnice');
      return;
    }
    try {
      setSendingInvites(true);
      setPromoError(null);
      const res = await api.post(`/api/matches/${id}/invite-players`, {
        playerIds: [...selectedInviteIds],
      });
      setInviteModalOpen(false);
      setPromoMessage(
        `Pozivnice poslate: ${res.data?.sent ?? 0}. Preostalo kredita: ${res.data?.creditsRemaining ?? 0}.`
      );
      await refreshUser();
    } catch (err: any) {
      setPromoError(err.response?.data?.message || 'Neuspešno slanje pozivnica');
    } finally {
      setSendingInvites(false);
    }
  }

  useEffect(() => {
    if (!shouldAutoOpenCompleteDialog || didAutoOpenCompleteDialog || !canCompleteMatch) return;
    setNoShowIds(new Set());
    setCompleteDialogOpen(true);
    setDidAutoOpenCompleteDialog(true);
  }, [shouldAutoOpenCompleteDialog, didAutoOpenCompleteDialog, canCompleteMatch]);

  useEffect(() => {
    if (!shouldFocusPromote || !canPromoteMatch || loading) return;
    const timer = window.setTimeout(() => {
      promoteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPromoHighlight(true);
    }, 150);
    const clearHighlight = window.setTimeout(() => setPromoHighlight(false), 2500);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearHighlight);
    };
  }, [shouldFocusPromote, canPromoteMatch, loading, match?._id]);

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

  const { fieldId, isInformal, informalLocation } = match;
  const center: [number, number] = isInformal
    ? [informalLocation!.lat, informalLocation!.lng]
    : [fieldId!.lat, fieldId!.lng];

  const getStatusConfig = () => {
    switch (match.status) {
      case 'failed':
        return { color: 'error' as const, icon: <ErrorIcon />, label: 'Neuspešan' };
      case 'otkazano':
        return { color: 'error' as const, icon: <CancelIcon />, label: 'Otkazan' };
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
              {getGameTypeName(match.sport)}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
              <LocationOnIcon sx={{ fontSize: 20, flexShrink: 0 }} />
              <Typography variant="h6" fontWeight={500} sx={{ minWidth: 0, wordBreak: 'break-word', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {isInformal ? (informalLocation?.name || 'Privatni teren') : fieldId?.name}
              </Typography>
              {isInformal && (
                <Chip
                  label="Privatni teren"
                  size="small"
                  sx={{ bgcolor: 'rgba(249,115,22,0.9)', color: 'white', fontWeight: 600 }}
                />
              )}
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

              {match.pricePerPlayer != null && (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PaymentsIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                    <Typography variant="body2" color="text.secondary">
                      Cena po igraču
                    </Typography>
                  </Stack>
                  <Typography variant="body1" fontWeight={600}>
                    {formatRsd(match.pricePerPlayer)}
                  </Typography>
                </Stack>
              )}
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
                {match.players.map((p) => {
                  const badge = getTrustBadge(p.reliabilityScore);
                  const paid = match.pricePerPlayer != null && isPlayerPaid(match, p._id);
                  return (
                  <Chip
                    key={p._id}
                    avatar={
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {p.name.charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    label={
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <span>{p.name}</span>
                        <Box
                          component="span"
                          sx={{ fontSize: '0.75rem', lineHeight: 1 }}
                          title={`${badge.label} (${p.reliabilityScore ?? 100}%)`}
                        >
                          {badge.emoji}
                        </Box>
                        {match.pricePerPlayer != null && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ fontWeight: 700, color: paid ? 'success.main' : 'text.secondary' }}
                          >
                            · {paid ? 'plaćeno' : 'duguje'}
                          </Typography>
                        )}
                      </Stack>
                    }
                    sx={{
                      borderRadius: 2,
                      '& .MuiChip-avatar': {
                        width: 28,
                        height: 28,
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                  );
                })}
              </Box>
            </Box>

            {/* Instant chat — samo prijavljeni igrači */}
            {user && match.players.some((p) => p._id === user._id) && (
              <>
                <Divider />
                <MatchQuickChat
                  matchId={match._id}
                  currentUserId={user._id}
                  canSend={match.status === 'open' || match.status === 'full'}
                />
              </>
            )}

            {/* Cost splitter — organizer tracks who paid */}
            {user && match.createdBy._id === user._id && (
              <>
                <Divider />
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <PaymentsIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Podela troškova
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Označite ko vam je platio udeo (gotovina na terenu, prenos na račun ili IPS).
                  </Typography>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
                    <TextField
                      type="number"
                      label="Cena po igraču (RSD)"
                      size="small"
                      value={priceDraft}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') { setPriceDraft(''); return; }
                        const n = Number(raw);
                        if (!Number.isNaN(n) && n >= 0) setPriceDraft(n);
                      }}
                      inputProps={{ min: 0, step: 50 }}
                      sx={{ maxWidth: 220 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleSavePricePerPlayer}
                      disabled={savingPrice}
                      startIcon={savingPrice ? <CircularProgress size={16} color="inherit" /> : null}
                      sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                      Sačuvaj cenu
                    </Button>
                  </Stack>

                  {match.pricePerPlayer != null && (
                    <>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        sx={{ mb: 2 }}
                      >
                        <Typography variant="body2" fontWeight={600}>
                          Naplaćeno:{' '}
                          {match.players.filter((p) => isPlayerPaid(match, p._id)).length}/{match.players.length}
                          {' · '}
                          {formatRsd(
                            match.players.filter((p) => isPlayerPaid(match, p._id)).length * match.pricePerPlayer
                          )}
                          {' / '}
                          {formatRsd(match.players.length * match.pricePerPlayer)}
                        </Typography>
                        <TextField
                          select
                          size="small"
                          label="Način plaćanja"
                          value={paymentMethodDraft}
                          onChange={(e) => setPaymentMethodDraft(e.target.value as 'cash' | 'transfer' | 'other')}
                          sx={{ minWidth: 160, mt: { xs: 0.5, sm: 0 } }}
                        >
                          <MenuItem value="cash">Gotovina</MenuItem>
                          <MenuItem value="transfer">Prenos / IPS</MenuItem>
                          <MenuItem value="other">Ostalo</MenuItem>
                        </TextField>
                      </Stack>
                      <Stack spacing={0.5}>
                        {match.players.map((p) => {
                          const paid = isPlayerPaid(match, p._id);
                          const payment = (match.playerPayments || []).find(
                            (entry) => paymentPlayerId(entry.playerId) === p._id && entry.paid
                          );
                          const isOrganizerRow = p._id === match.createdBy._id;
                          return (
                            <Paper
                              key={p._id}
                              elevation={0}
                              sx={{
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: paid ? 'success.light' : 'divider',
                                bgcolor: paid ? 'success.light' : 'background.paper',
                              }}
                            >
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={paid}
                                      disabled={markingPaidId === p._id}
                                      onChange={(e) => handleTogglePaid(p._id, e.target.checked)}
                                      color="success"
                                    />
                                  }
                                  label={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Typography variant="body2" fontWeight={600}>
                                        {p.name}
                                        {isOrganizerRow ? ' (organizator)' : ''}
                                      </Typography>
                                      {paid && payment?.method && (
                                        <Typography variant="caption" color="text.secondary">
                                          {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                                        </Typography>
                                      )}
                                    </Stack>
                                  }
                                />
                                <Typography variant="body2" fontWeight={600} color={paid ? 'success.dark' : 'text.secondary'}>
                                  {formatRsd(match.pricePerPlayer!)}
                                </Typography>
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </>
                  )}
                </Box>
              </>
            )}

            {user && match.createdBy._id !== user._id && match.pricePerPlayer != null && match.players.some((p) => p._id === user._id) && (
              <>
                <Divider />
                <Alert
                  severity={isPlayerPaid(match, user._id) ? 'success' : 'info'}
                  icon={<PaymentsIcon />}
                  sx={{ borderRadius: 2 }}
                >
                  {isPlayerPaid(match, user._id)
                    ? `Organizator je označio da ste platili svoj udeo (${formatRsd(match.pricePerPlayer)}).`
                    : `Cena po igraču: ${formatRsd(match.pricePerPlayer)}. Platite organizatoru gotovinom, prenosom ili IPS-om.`}
                </Alert>
              </>
            )}

            {/* Waitlist Section */}
            {(match.waitlist?.length ?? 0) > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    <HourglassTopIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'middle' }} />
                    Lista čekanja ({match.waitlist!.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {match.waitlist!.map((p, index) => (
                      <Chip
                        key={p._id}
                        avatar={
                          <Avatar sx={{ bgcolor: 'warning.main' }}>
                            {index + 1}
                          </Avatar>
                        }
                        label={p.name}
                        variant={user?._id === p._id ? 'filled' : 'outlined'}
                        color={user?._id === p._id ? 'warning' : 'default'}
                        sx={{ borderRadius: 2 }}
                      />
                    ))}
                  </Box>
                </Box>
              </>
            )}

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
              {isInformal ? 'Lokacija meča' : 'Lokacija terena'}
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ height: { xs: 220, sm: 300 } }}>
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
              <Popup>
                {isInformal
                  ? (informalLocation?.name || 'Privatni teren')
                  : `${fieldId?.name} — ${fieldId?.sports?.join(', ') || fieldId?.sport || 'Nepoznat sport'}`}
              </Popup>
            </Marker>
          </MapContainer>
        </Box>
      </Paper>

      {/* Match promotion — organizer only */}
      {canPromoteMatch && (
        <Paper
          ref={promoteSectionRef}
          elevation={0}
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: 3,
            border: '2px solid',
            borderColor: promoHighlight ? 'primary.main' : 'divider',
            bgcolor: promoHighlight ? 'action.selected' : 'action.hover',
            boxShadow: promoHighlight ? 4 : 0,
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <CampaignIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Promoviši meč
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Boost i pozivnice troše po 1 kredit. Trenutno: {getCreditsDisplay(user?.credits)}
          </Typography>
          {promoMessage && (
            <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setPromoMessage(null)}>
              {promoMessage}
            </Alert>
          )}
          {promoError && !inviteModalOpen && !boostDialogOpen && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setPromoError(null)}>
              {promoError}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              color="warning"
              startIcon={<RocketLaunchIcon />}
              onClick={() => {
                setPromoError(null);
                setBoostDialogOpen(true);
              }}
              fullWidth
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              🚀 Pošalji Hitan Signal (Boost)
            </Button>
            <Button
              variant="outlined"
              startIcon={<GroupAddIcon />}
              onClick={openInviteModal}
              fullWidth
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              👥 Pozovi Igrače u Blizini
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Action Buttons */}
      <Stack spacing={2}>
        <Button
          variant="outlined"
          onClick={handleShare}
          startIcon={<ShareIcon />}
          fullWidth
          sx={{ borderRadius: 3, fontWeight: 600 }}
        >
          Podeli meč
        </Button>
        {match.status === 'completed' && user && match.players.some((p) => p._id === user._id) && (
          <Button
            variant="contained"
            color="warning"
            onClick={openRatingDialog}
            fullWidth
            startIcon={<StarIcon />}
            disabled={loadingRatingStatus}
            sx={{ borderRadius: 3, fontWeight: 700 }}
          >
            {loadingRatingStatus ? 'Učitavanje...' : 'Oceni saigrače'}
          </Button>
        )}
      {canCompleteMatch && (
        <Button
          variant="contained"
          color="success"
          onClick={() => { setNoShowIds(new Set()); setCompleteDialogOpen(true); }}
          fullWidth
          size="large"
          startIcon={<CheckCircleIcon />}
          sx={{ py: 1.5, fontSize: '1rem', fontWeight: 600, borderRadius: 3 }}
        >
          Potvrdite odigrani termin
        </Button>
      )}
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
      ) : isOnWaitlist ? (
        <Stack spacing={1.5}>
          <Alert severity="info" icon={<HourglassTopIcon />}>
            Na listi čekanja — pozicija #{waitlistPosition}
            {(match.waitlist?.length ?? 0) > 1 ? ` od ${match.waitlist!.length}` : ''}.
            Kada se mesto oslobodi, automatski ćete biti prijavljeni.
          </Alert>
          <Button
            variant="outlined"
            color="warning"
            onClick={leaveWaitlist}
            fullWidth
            size="large"
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 3,
              borderWidth: 2,
            }}
          >
            Napusti listu čekanja
          </Button>
        </Stack>
      ) : canJoinWaitlist ? (
        <Button
          variant="contained"
          color="warning"
          onClick={joinWaitlist}
          fullWidth
          size="large"
          startIcon={<HourglassTopIcon />}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 3,
          }}
        >
          Stani u red
        </Button>
      ) : null}
      </Stack>

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
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            alignItems: 'stretch',
            gap: 1,
            '& > :not(:first-of-type)': { ml: { xs: 0, sm: 1 } },
          }}
        >
          <Button
            onClick={handleCloseCancelDialog}
            disabled={cancelling}
            variant="outlined"
            sx={{ borderRadius: 3, px: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            Odustani
          </Button>
          <Button
            onClick={handleCancelAttendance}
            variant="contained"
            color="error"
            disabled={cancelling}
            sx={{ borderRadius: 3, px: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            {cancelling ? 'Otkazivanje...' : 'Otkaži dolazak'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Complete informal match dialog */}
      <Dialog
        open={completeDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon color="success" />
            <Typography variant="h6" fontWeight={700}>Potvrdi odigrani termin</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Kliknite na igrača da ga označite kao <strong>nije došao</strong>. Igrači koji nisu došli dobijaju penalizaciju pouzdanosti (-15 poena).
            </Alert>
            {match.players.filter(p => p._id !== user?._id).length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                Nema prijavljenih igrača osim vas.
              </Typography>
            ) : (
              match.players
                .filter(p => p._id !== user?._id)
                .map(p => {
                  const isNoShow = noShowIds.has(p._id);
                  return (
                    <Paper
                      key={p._id}
                      elevation={0}
                      onClick={() => toggleNoShow(p._id)}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '2px solid',
                        borderColor: isNoShow ? 'error.main' : 'success.main',
                        bgcolor: isNoShow ? 'error.light' : 'success.light',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        userSelect: 'none',
                        '&:hover': { opacity: 0.85 },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: isNoShow ? 'error.main' : 'success.main',
                              width: 36,
                              height: 36,
                              fontSize: '0.9rem',
                            }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography fontWeight={600}>{p.name}</Typography>
                        </Stack>
                        <Chip
                          label={isNoShow ? 'Nije došao' : 'Prisustvovao'}
                          size="small"
                          color={isNoShow ? 'error' : 'success'}
                          sx={{ fontWeight: 600 }}
                        />
                      </Stack>
                    </Paper>
                  );
                })
            )}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            alignItems: 'stretch',
            gap: 1,
            '& > :not(:first-of-type)': { ml: { xs: 0, sm: 1 } },
          }}
        >
          <Button
            onClick={() => setCompleteDialogOpen(false)}
            disabled={completing}
            variant="outlined"
            sx={{ borderRadius: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            Odustani
          </Button>
          <Button
            onClick={handleCompleteMatch}
            variant="contained"
            color="success"
            disabled={completing}
            sx={{ borderRadius: 3, px: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            {completing ? 'Potvrđivanje...' : 'Potvrdi termin'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Post-match rating dialog */}
      <Dialog open={ratingDialogOpen} onClose={() => setRatingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Oceni saigrače</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {pendingRatingUsers.map((p) => (
              <Paper key={p._id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={1.5}>
                  <Typography fontWeight={600}>{p.name}</Typography>
                  <TextField
                    type="number"
                    label="Zvezdice (1-5)"
                    value={ratingValues[p._id]?.stars ?? 5}
                    inputProps={{ min: 1, max: 5 }}
                    onChange={(e) =>
                      setRatingValues((prev) => ({
                        ...prev,
                        [p._id]: {
                          ...(prev[p._id] || { stars: 5, fairPlay: true, skillLevel: 3 }),
                          stars: Math.min(5, Math.max(1, Number(e.target.value || 5)))
                        }
                      }))
                    }
                    InputProps={{ startAdornment: <StarIcon sx={{ color: 'warning.main', mr: 1 }} /> }}
                  />
                  <TextField
                    type="number"
                    label={`Veština (${getGameTypeName(match.sport)}) 1-5`}
                    value={ratingValues[p._id]?.skillLevel ?? 3}
                    inputProps={{ min: 1, max: 5 }}
                    onChange={(e) =>
                      setRatingValues((prev) => ({
                        ...prev,
                        [p._id]: {
                          ...(prev[p._id] || { stars: 5, fairPlay: true, skillLevel: 3 }),
                          skillLevel: Math.min(5, Math.max(1, Number(e.target.value || 3)))
                        }
                      }))
                    }
                  />
                  <Button
                    size="small"
                    variant={ratingValues[p._id]?.fairPlay !== false ? 'contained' : 'outlined'}
                    color="success"
                    onClick={() =>
                      setRatingValues((prev) => ({
                        ...prev,
                        [p._id]: {
                          ...(prev[p._id] || { stars: 5, fairPlay: true, skillLevel: 3 }),
                          fairPlay: !(prev[p._id]?.fairPlay !== false)
                        }
                      }))
                    }
                  >
                    Fer-plej: {ratingValues[p._id]?.fairPlay !== false ? 'Da' : 'Ne'}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRatingDialogOpen(false)} disabled={submittingRatings}>Kasnije</Button>
          <Button variant="contained" onClick={handleSubmitRatings} disabled={submittingRatings}>
            {submittingRatings ? 'Slanje...' : 'Sačuvaj ocene'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Achievement celebration after rating */}
      <Dialog
        open={celebrationOpen}
        onClose={() => setCelebrationOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            textAlign: 'center',
            background: (t) =>
              `linear-gradient(160deg, ${t.palette.success.dark} 0%, ${t.palette.primary.main} 100%)`,
            color: 'common.white',
          },
        }}
      >
        <DialogContent sx={{ py: 5, px: 3 }}>
          <Box
            sx={{
              '@keyframes celebratePop': {
                '0%': { transform: 'scale(0.4)', opacity: 0 },
                '60%': { transform: 'scale(1.12)', opacity: 1 },
                '100%': { transform: 'scale(1)' },
              },
              '@keyframes starPulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.15)' },
              },
              animation: 'celebratePop 0.55s ease-out',
            }}
          >
            <StarIcon
              sx={{
                fontSize: 72,
                color: '#fbbf24',
                mb: 1,
                animation: 'starPulse 1.4s ease-in-out infinite',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
              }}
            />
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
              Meč završen!
            </Typography>
            <Typography variant="h6" fontWeight={600} sx={{ opacity: 0.95, mb: 2 }}>
              {celebrationRating != null && celebrationRating > 0
                ? `Tvoj rating je ${celebrationRating.toFixed(1)} ⭐`
                : 'Hvala što si ocenio saigrače!'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, mb: 3 }}>
              Svaka ocena pomaže zajednici da nađe pouzdane igrače.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
              <Button
                variant="contained"
                onClick={() => {
                  setCelebrationOpen(false);
                  navigate('/profil');
                }}
                sx={{
                  bgcolor: 'common.white',
                  color: 'success.dark',
                  fontWeight: 700,
                  borderRadius: 3,
                  '&:hover': { bgcolor: 'grey.100' },
                }}
              >
                Pogledaj profil
              </Button>
              <Button
                variant="outlined"
                onClick={() => setCelebrationOpen(false)}
                sx={{
                  borderColor: 'rgba(255,255,255,0.7)',
                  color: 'common.white',
                  fontWeight: 700,
                  borderRadius: 3,
                  '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                Ostani ovde
              </Button>
            </Stack>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Boost confirmation */}
      <Dialog
        open={boostDialogOpen}
        onClose={() => !boosting && setBoostDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle fontWeight={700}>Hitan signal (Boost)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pošalji prioritetno obaveštenje igračima u blizini koji igraju istu kategoriju/igru.
            Ova akcija troši 1 kredit.
          </Typography>
          <Alert severity="info">
            Preostalo kredita: <strong>{getCreditsDisplay(user?.credits)}</strong>
          </Alert>
          {promoError && boostDialogOpen && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {promoError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBoostDialogOpen(false)} disabled={boosting}>
            Otkaži
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleBoostConfirm}
            disabled={boosting || getCreditsDisplay(user?.credits) < 1}
            startIcon={boosting ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
          >
            {boosting ? 'Slanje...' : 'Pošalji signal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Nearby players invite modal */}
      <Dialog
        open={inviteModalOpen}
        onClose={() => !sendingInvites && setInviteModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle fontWeight={700}>Pozovi igrače u blizini</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Slanje pozivnica troši 1 kredit. Preostalo: <strong>{getCreditsDisplay(user?.credits)}</strong>
          </Alert>
          {promoError && inviteModalOpen && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {promoError}
            </Alert>
          )}
          {loadingNearby ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : nearbyPlayers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Nema dostupnih igrača u blizini.
            </Typography>
          ) : (
            <List dense disablePadding>
              {nearbyPlayers.map((p) => {
                const selected = selectedInviteIds.has(p._id);
                const badge = getTrustBadge(p.reliabilityScore);
                return (
                  <ListItem key={p._id} disablePadding secondaryAction={
                    <Checkbox
                      edge="end"
                      checked={selected}
                      onChange={() => toggleInviteSelection(p._id)}
                    />
                  }>
                    <ListItemButton onClick={() => toggleInviteSelection(p._id)} sx={{ borderRadius: 2 }}>
                      <ListItemAvatar>
                        <Avatar src={p.avatarUrl || undefined}>
                          {p.name?.charAt(0)?.toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={p.name}
                        secondary={`${p.distance.toFixed(1)} km · ${badge.emoji} ${badge.label}`}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInviteModalOpen(false)} disabled={sendingInvites}>
            Zatvori
          </Button>
          <Button
            variant="contained"
            onClick={handleSendInvites}
            disabled={
              sendingInvites ||
              selectedInviteIds.size === 0 ||
              getCreditsDisplay(user?.credits) < 1
            }
            startIcon={sendingInvites ? <CircularProgress size={16} color="inherit" /> : <GroupAddIcon />}
          >
            {sendingInvites ? 'Slanje...' : `Pošalji pozivnice (${selectedInviteIds.size})`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
