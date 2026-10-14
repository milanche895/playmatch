import { useEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from 'react';
import {
  Alert,
  Avatar,
  Box,
  ButtonBase,
  CircularProgress,
  Dialog,
  IconButton,
  Popover,
  Stack,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SendIcon from '@mui/icons-material/Send';
import api from '../lib/api';
import { socket } from '../lib/socket';
import { MatchQuickMessage } from '../types';
import QUICK_MESSAGE_PRESETS from '../constants/quickMessagePresets.json';
import SportIcon from './SportIcon';

const MAX_LENGTH = 200;
const BORDER = '#E3E9F3';
const PAGE_BG = '#F4F7FC';

type ChatPlayer = { _id: string; name: string; avatarUrl?: string | null };

type Props = {
  matchId: string;
  currentUserId: string;
  canSend: boolean;
  players: ChatPlayer[];
  sport: string;
};

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('sr-RS', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return 'Danas';
  if (isSameDay(d, yesterday)) return 'Juče';
  return d.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long' });
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || 'Igrač';
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export default function MatchQuickChat({ matchId, currentUserId, canSend, players, sport }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MatchQuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const playerById = useMemo(() => {
    const map = new Map<string, ChatPlayer>();
    players.forEach((p) => map.set(p._id, p));
    return map;
  }, [players]);

  const appendMessage = (msg: MatchQuickMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m._id === msg._id)) return prev;
      return [...prev, msg];
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<MatchQuickMessage[]>(`/api/matches/${matchId}/messages`)
      .then((res) => {
        if (!cancelled) setMessages(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Neuspešno učitavanje poruka');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    const handler = (payload: { matchId?: string; message?: MatchQuickMessage }) => {
      if (!payload?.message || payload.matchId !== matchId) return;
      appendMessage(payload.message);
    };
    socket.on('match_message', handler);
    return () => {
      socket.off('match_message', handler);
    };
  }, [matchId]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
    return () => window.clearTimeout(t);
  }, [messages, open, loading]);

  const sendMessage = async (body: { text?: string; preset?: string }) => {
    if (sending || !canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.post<MatchQuickMessage>(`/api/matches/${matchId}/messages`, body);
      appendMessage(res.data);
      setText('');
      setShowPresets(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Neuspešno slanje poruke');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    void sendMessage({ text: trimmed });
  };

  const lastMessage = messages[messages.length - 1];
  const previewText = lastMessage
    ? `${lastMessage.userId?._id === currentUserId ? 'Vi' : shortName(lastMessage.userId?.name || 'Igrač')}: ${lastMessage.text}`
    : 'Dogovorite sitnice sa saigračima';
  const participantsLabel = `${players.length} ${players.length === 1 ? 'učesnik' : 'učesnika'}`;

  return (
    <>
      {/* Entry row inside match details */}
      <ButtonBase
        onClick={() => setOpen(true)}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          textAlign: 'left',
          gap: '14px',
          borderRadius: '14px',
          py: 0.5,
        }}
      >
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            bgcolor: alpha('#0877F9', 0.1),
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ChatBubbleOutlineIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary' }}>Dogovor</Typography>
          <Typography noWrap sx={{ fontSize: 13.5, color: 'text.secondary' }}>
            {previewText}
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: 'text.secondary' }} />
      </ButtonBase>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            // "&&" beats the global MuiDialog paper overrides (margin / radius) from the theme
            sx: {
              '&&': {
                height: fullScreen ? '100dvh' : 'min(760px, 90vh)',
                maxHeight: fullScreen ? '100dvh' : 'calc(100% - 32px)',
                margin: fullScreen ? 0 : '16px',
                width: fullScreen ? '100%' : 'calc(100% - 32px)',
                bgcolor: PAGE_BG,
                borderRadius: fullScreen ? 0 : '20px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              },
            },
          },
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          spacing="12px"
          sx={{ px: 1, py: 1, bgcolor: '#fff', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}
        >
          <IconButton aria-label="Nazad" onClick={() => setOpen(false)}>
            {fullScreen ? <ArrowBackIcon /> : <CloseIcon />}
          </IconButton>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              bgcolor: alpha('#0877F9', 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SportIcon sport={sport} size={22} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>Dogovor</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{participantsLabel}</Typography>
          </Box>
          <IconButton aria-label="Učesnici" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon />
          </IconButton>
        </Stack>

        <Popover
          open={Boolean(infoAnchor)}
          anchorEl={infoAnchor}
          onClose={() => setInfoAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { borderRadius: '14px', p: 1.5, minWidth: 220, maxHeight: 320 } } }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary', mb: 1 }}>
            Učesnici ({players.length})
          </Typography>
          <Stack spacing={1}>
            {players.map((p) => (
              <Stack key={p._id} direction="row" alignItems="center" spacing={1.25}>
                <Avatar src={p.avatarUrl || undefined} sx={{ width: 30, height: 30, fontSize: 13, bgcolor: 'primary.main' }}>
                  {p.name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography sx={{ fontSize: 14.5, fontWeight: 600 }}>
                  {p._id === currentUserId ? `${shortName(p.name)} (Vi)` : shortName(p.name)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Popover>

        {/* Messages */}
        <Box
          ref={listRef}
          sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2, display: 'flex', flexDirection: 'column' }}
        >
          {loading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress size={28} />
            </Stack>
          ) : messages.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4, fontSize: 14.5 }}>
              Još nema poruka. Pošaljite prvu!
            </Typography>
          ) : (
            messages.map((msg, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const senderId = msg.userId?._id;
              const mine = senderId === currentUserId;
              const firstOfRun = !prev || prev.userId?._id !== senderId || !isSameDay(new Date(prev.createdAt), new Date(msg.createdAt));
              const lastOfRun = !next || next.userId?._id !== senderId || !isSameDay(new Date(next.createdAt), new Date(msg.createdAt));
              const newDay = !prev || !isSameDay(new Date(prev.createdAt), new Date(msg.createdAt));
              const sender = senderId ? playerById.get(senderId) : undefined;
              const senderName = msg.userId?.name || sender?.name || 'Igrač';

              return (
                <Box key={msg._id}>
                  {newDay && (
                    <Typography
                      sx={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: 'text.secondary', my: 1.5 }}
                    >
                      {formatDayLabel(msg.createdAt)}
                    </Typography>
                  )}
                  {mine ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mt: firstOfRun ? 1.5 : 0.5 }}>
                      <Box
                        sx={{
                          maxWidth: '80%',
                          px: 1.75,
                          py: 1.1,
                          bgcolor: 'primary.main',
                          color: '#fff',
                          borderRadius: '16px 16px 4px 16px',
                          fontSize: 15,
                          lineHeight: 1.4,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {msg.text}
                      </Box>
                      {lastOfRun && (
                        <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5 }}>
                          {formatClock(msg.createdAt)}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Stack direction="row" spacing="10px" alignItems="flex-end" sx={{ mt: firstOfRun ? 1.5 : 0.5 }}>
                      <Box sx={{ width: 36, flexShrink: 0 }}>
                        {lastOfRun && (
                          <Avatar
                            src={sender?.avatarUrl || undefined}
                            alt={senderName}
                            sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 15, fontWeight: 700 }}
                          >
                            {senderName.charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                      </Box>
                      <Box sx={{ maxWidth: '80%', minWidth: 0 }}>
                        {firstOfRun && (
                          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.4, ml: 0.5 }}>
                            {shortName(senderName)}
                          </Typography>
                        )}
                        <Box
                          sx={{
                            px: 1.75,
                            py: 1.1,
                            bgcolor: '#fff',
                            border: `1px solid ${BORDER}`,
                            borderRadius: '16px 16px 16px 4px',
                            fontSize: 15,
                            lineHeight: 1.4,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {msg.text}
                        </Box>
                        {lastOfRun && (
                          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5, ml: 0.5 }}>
                            {formatClock(msg.createdAt)}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  )}
                </Box>
              );
            })
          )}
        </Box>

        {/* Composer */}
        <Box sx={{ bgcolor: '#fff', borderTop: `1px solid ${BORDER}`, px: 1.5, py: 1.25, flexShrink: 0 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {canSend ? (
            <>
              {showPresets && (
                <Stack direction="row" spacing={1} sx={{ mb: 1.25, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                  {QUICK_MESSAGE_PRESETS.map((preset) => (
                    <ButtonBase
                      key={preset}
                      disabled={sending}
                      onClick={() => void sendMessage({ preset })}
                      sx={{
                        flexShrink: 0,
                        px: 1.75,
                        height: 36,
                        borderRadius: '18px',
                        border: `1px solid ${BORDER}`,
                        bgcolor: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'primary.main',
                      }}
                    >
                      {preset}
                    </ButtonBase>
                  ))}
                </Stack>
              )}
              <Box component="form" onSubmit={handleSubmit}>
                <Stack direction="row" alignItems="center" spacing="10px">
                  <IconButton
                    aria-label="Brze poruke"
                    onClick={() => setShowPresets((v) => !v)}
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: showPresets ? alpha('#0877F9', 0.12) : '#EEF2F8',
                      color: showPresets ? 'primary.main' : 'text.secondary',
                      '&:hover': { bgcolor: alpha('#0877F9', 0.12) },
                    }}
                  >
                    <AddIcon sx={{ transform: showPresets ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }} />
                  </IconButton>
                  <Box
                    component="input"
                    value={text}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.target.value.slice(0, MAX_LENGTH))}
                    placeholder="Napiši poruku…"
                    disabled={sending}
                    maxLength={MAX_LENGTH}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      height: 44,
                      px: 2,
                      border: 'none',
                      outline: 'none',
                      borderRadius: '22px',
                      bgcolor: '#EEF2F8',
                      fontFamily: 'inherit',
                      fontSize: 15,
                      color: 'text.primary',
                      '&::placeholder': { color: '#8A94A6', opacity: 1 },
                    }}
                  />
                  <IconButton
                    type="submit"
                    aria-label="Pošalji"
                    disabled={sending || !text.trim()}
                    sx={{ color: 'primary.main', '&.Mui-disabled': { color: alpha('#0877F9', 0.35) } }}
                  >
                    {sending ? <CircularProgress size={22} color="inherit" /> : <SendIcon />}
                  </IconButton>
                </Stack>
              </Box>
            </>
          ) : (
            <Typography sx={{ fontSize: 14, color: 'text.secondary', textAlign: 'center', py: 0.5 }}>
              Slanje poruka je dostupno dok je meč otvoren ili popunjen.
            </Typography>
          )}
        </Box>
      </Dialog>
    </>
  );
}
