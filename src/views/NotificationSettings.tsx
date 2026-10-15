'use client';

import { useState, useEffect, type ElementType } from 'react';
import {
  Badge,
  Box,
  Button,
  ButtonBase,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  SettingsOutlined as SettingsOutlinedIcon,
  PersonAddAlt1 as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  Groups as GroupsIcon,
  Schedule as ScheduleIcon,
  EventNote as EventNoteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HowToReg as HowToRegIcon,
} from '@mui/icons-material';
import { useNavigate } from '@/lib/router';
import api from '../lib/api';
import { AppNotification, AppNotificationType } from '../types';
import { getGameTypeName } from '../constants/games';
import { getNotificationStatus } from '../lib/notifications';
import { formatCourtApprovedMessage, formatTeamReadyMessage } from '../lib/teamReadyMessage';
import { useAuth } from '../context/AuthContext';

type FeedItem = AppNotification & { unread: boolean };

const TYPE_CONFIG: Record<AppNotificationType, { title: string; Icon: ElementType; color: string; bg: string }> = {
  player_joined: { title: 'Novi igrač se prijavio', Icon: PersonAddIcon, color: '#0877F9', bg: '#E3EEFF' },
  match_full: { title: 'Meč je popunjen', Icon: GroupsIcon, color: '#F97316', bg: '#FFEDE0' },
  time_changed: { title: 'Promena termina', Icon: ScheduleIcon, color: '#16A34A', bg: '#E3F6EA' },
  player_left: { title: 'Neko se odjavio', Icon: PersonRemoveIcon, color: '#E5484D', bg: '#FDE6E6' },
  reminder: { title: 'Podsetnik', Icon: EventNoteIcon, color: '#6B7A99', bg: '#EAEFF7' },
  court_approved: { title: 'Teren je potvrdio termin', Icon: CheckCircleIcon, color: '#16A34A', bg: '#E3F6EA' },
  court_rejected: { title: 'Teren je odbio termin', Icon: CancelIcon, color: '#E5484D', bg: '#FDE6E6' },
  team_ready: { title: 'Ekipa je spremna', Icon: HowToRegIcon, color: '#16A34A', bg: '#E3F6EA' },
};

/** Serbian plural: 1 → one, 2–4 → few, rest → many (11–14 always many). */
function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (last === 1 && lastTwo !== 11) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function formatAgo(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return 'upravo sada';
  if (diffMin < 60) return `pre ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `pre ${hours} ${plural(hours, 'sat', 'sata', 'sati')}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `pre ${days} ${plural(days, 'dan', 'dana', 'dana')}`;
  return new Date(iso).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit' });
}

function reminderText(matchDateTime?: string): string {
  if (!matchDateTime) return 'Tvoj meč uskoro počinje.';
  const diffMin = Math.round((new Date(matchDateTime).getTime() - Date.now()) / 60000);
  if (diffMin <= 0) return 'Tvoj meč je počeo.';
  if (diffMin < 60) return `Tvoj meč počinje za ${diffMin} min.`;
  const hours = Math.round(diffMin / 60);
  return `Tvoj meč počinje za ${hours} ${plural(hours, 'sat', 'sata', 'sati')}.`;
}

function subtitleFor(n: AppNotification): string {
  if (n.type === 'team_ready') {
    return formatTeamReadyMessage({
      playerCount: n.playerCount,
      matchDateTime: n.matchDateTime,
      locationName: n.locationName,
    });
  }
  if (n.type === 'court_approved') {
    return formatCourtApprovedMessage({
      matchDateTime: n.matchDateTime,
      locationName: n.locationName,
    });
  }
  if (n.type === 'reminder') return reminderText(n.matchDateTime);
  const sport = n.sport ? getGameTypeName(n.sport) : 'Meč';
  return n.locationName ? `${sport} · ${n.locationName}` : sport;
}

function notificationHref(n: AppNotification): string {
  if (n.type !== 'team_ready') return `/matches/${n.matchId}`;
  const params = new URLSearchParams();
  if (n.fieldId) params.set('field', n.fieldId);
  if (n.matchId) params.set('match', n.matchId);
  const query = params.toString();
  return query ? `/moji-termini?${query}` : '/moji-termini';
}

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCourt = user?.role === 'court';
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    loadStatus();
    loadFeed();
  }, []);

  async function loadFeed() {
    try {
      const res = await api.get<{ items: AppNotification[]; unreadCount: number }>('/api/notifications');
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setFeed(items.map((n) => ({ ...n, unread: !n.readAt })));
      if (res.data?.unreadCount > 0) {
        // Entries stay highlighted for this visit; server-side they are now read
        api.post('/api/notifications/read-all').catch(() => undefined);
      }
    } catch (err: any) {
      setFeedError(err.response?.data?.message || 'Greška pri učitavanju obaveštenja');
      setFeed([]);
    }
  }

  async function loadStatus() {
    try {
      const notificationStatus = await getNotificationStatus();
      setSubscribed(notificationStatus.subscribed);
    } catch (err) {
      console.error('Error loading notification status:', err);
    } finally {
      setStatusLoading(false);
    }
  }

  const openPreferences = () => navigate('/notification-settings/postavke');
  // Red dot on the gear: push notifications are not set up on this device yet
  const needsSetup = !statusLoading && subscribed === false;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: '10px', md: 0 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: '16px' }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#0B1B3F' }}>
          Obaveštenja
        </Typography>
        {!isCourt && <IconButton
          aria-label="Postavke obaveštenja"
          onClick={openPreferences}
          edge="end"
          sx={{ color: '#6B7A99' }}
        >
          <Badge
            variant="dot"
            invisible={!needsSetup}
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#EF4444',
                width: 9,
                height: 9,
                minWidth: 9,
                borderRadius: '50%',
                border: '1.5px solid #F4F7FC',
                boxSizing: 'content-box',
              },
            }}
          >
            <SettingsOutlinedIcon sx={{ fontSize: 26 }} />
          </Badge>
        </IconButton>}
      </Stack>

      {feedError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setFeedError(null)}>
          {feedError}
        </Alert>
      )}

      {feed === null ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : feed.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
          <NotificationsIcon sx={{ fontSize: 40, color: '#C3D0E6', mb: 1 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#0B1B3F' }}>Još nema obaveštenja</Typography>
          <Typography sx={{ fontSize: 14, color: '#6B7A99', mt: 0.5 }}>
            {isCourt
              ? 'Ovde ćeš videti kada je ekipa spremna i čeka tvoju potvrdu.'
              : 'Ovde ćeš videti prijave igrača, popunjene mečeve i podsetnike.'}
          </Typography>
          {needsSetup && !isCourt && (
            <Button sx={{ mt: 1.5, fontWeight: 700, borderRadius: '12px' }} onClick={openPreferences}>
              Uključi obaveštenja
            </Button>
          )}
        </Box>
      ) : (
        <Stack spacing="10px">
          {feed.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.reminder;
            const Icon = cfg.Icon;
            return (
              <ButtonBase
                key={n._id}
                onClick={() => navigate(notificationHref(n))}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  gap: '14px',
                  p: '14px',
                  bgcolor: '#FFFFFF',
                  border: '1px solid',
                  borderColor: n.unread ? '#B9D4FB' : '#E3E9F3',
                  borderRadius: '16px',
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '14px',
                    bgcolor: cfg.bg,
                    color: cfg.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon sx={{ fontSize: 26 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing="8px">
                    <Typography noWrap sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: '#0B1B3F' }}>
                      {cfg.title}
                    </Typography>
                    {n.unread && (
                      <Box
                        aria-label="Nepročitano"
                        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }}
                      />
                    )}
                  </Stack>
                  <Typography
                    sx={{
                      fontSize: 14,
                      lineHeight: 1.4,
                      color: '#4A5878',
                      display: '-webkit-box',
                      WebkitLineClamp: n.type === 'team_ready' || n.type === 'court_approved' ? 3 : 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {subtitleFor(n)}
                  </Typography>
                  <Typography sx={{ fontSize: 13, lineHeight: 1.4, color: '#8A94A6' }}>
                    {formatAgo(n.createdAt)}
                  </Typography>
                </Box>
              </ButtonBase>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
