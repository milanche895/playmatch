import { useEffect, useRef, useState, FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SendIcon from '@mui/icons-material/Send';
import api from '../lib/api';
import { socket } from '../lib/socket';
import { MatchQuickMessage } from '../types';

export const QUICK_MESSAGE_PRESETS = [
  'Donosim loptu',
  'Zakasniću 5 minuta',
  'Koju boju majica?',
  'Ja bela',
  'Ja crvena',
] as const;

const MAX_LENGTH = 200;

type Props = {
  matchId: string;
  currentUserId: string;
  canSend: boolean;
};

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MatchQuickChat({ matchId, currentUserId, canSend }: Props) {
  const [messages, setMessages] = useState<MatchQuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendMessage = async (body: { text?: string; preset?: string }) => {
    if (sending || !canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.post<MatchQuickMessage>(`/api/matches/${matchId}/messages`, body);
      appendMessage(res.data);
      setText('');
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

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ChatBubbleOutlineIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700}>
          Brze poruke
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Dogovorite sitnice sa saigračima — bez Vibera.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        ref={listRef}
        sx={{
          maxHeight: 260,
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 1.5,
          mb: 1.5,
          bgcolor: 'background.default',
        }}
      >
        {loading ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={28} />
          </Stack>
        ) : messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
            Još nema poruka. Pošaljite prvu!
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {messages.map((msg) => {
              const mine = msg.userId?._id === currentUserId;
              return (
                <Box
                  key={msg._id}
                  sx={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.25, textAlign: mine ? 'right' : 'left' }}
                  >
                    {mine ? 'Vi' : msg.userId?.name || 'Igrač'} · {formatMessageTime(msg.createdAt)}
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      px: 1.25,
                      py: 0.75,
                      borderRadius: 2,
                      bgcolor: mine ? 'primary.main' : 'background.paper',
                      color: mine ? 'primary.contrastText' : 'text.primary',
                      border: '1px solid',
                      borderColor: mine ? 'primary.main' : 'divider',
                    }}
                  >
                    <Typography variant="body2">{msg.text}</Typography>
                  </Paper>
                </Box>
              );
            })}
          </Stack>
        )}
      </Paper>

      {canSend ? (
        <>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center" sx={{ mb: 1.5 }}>
            {QUICK_MESSAGE_PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={preset}
                clickable
                disabled={sending}
                onClick={() => void sendMessage({ preset })}
                sx={{ borderRadius: 2, minHeight: 40, px: 0.5 }}
              />
            ))}
          </Stack>

          <Box component="form" onSubmit={handleSubmit}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Napiši poruku…"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
                disabled={sending}
                inputProps={{ maxLength: MAX_LENGTH }}
                helperText={`${text.length}/${MAX_LENGTH}`}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={sending || !text.trim()}
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                sx={{
                  borderRadius: 2,
                  fontWeight: 600,
                  flexShrink: 0,
                  width: { xs: '100%', sm: 'auto' },
                  minHeight: 40,
                }}
              >
                Pošalji
              </Button>
            </Stack>
          </Box>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Slanje poruka je dostupno dok je meč otvoren ili popunjen.
        </Typography>
      )}
    </Box>
  );
}
