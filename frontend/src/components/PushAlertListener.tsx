import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Snackbar, Alert, Button } from '@mui/material';
import { socket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';

type PlayerNotification = {
  title: string;
  body: string;
  url?: string;
  matchId?: string;
};

function showBrowserNotification(payload: PlayerNotification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      tag: payload.matchId ? `inapp-${payload.matchId}-${Date.now()}` : `inapp-${Date.now()}`,
    });
    n.onclick = () => {
      window.focus();
      if (payload.url) window.location.href = payload.url;
      n.close();
    };
  } catch (err) {
    console.warn('[PushDebug] page Notification failed', err);
  }
}

export default function PushAlertListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<PlayerNotification | null>(null);

  useEffect(() => {
    if (!user?._id) {
      if (socket.connected) socket.disconnect();
      return;
    }

    socket.connect();

    const joinRoom = () => {
      socket.emit('join_user_room', user._id);
      console.log('[PushDebug] joined user room', user._id);
    };
    joinRoom();
    socket.on('connect', joinRoom);

    const onNotify = (payload: PlayerNotification) => {
      console.log('[PushDebug] socket player_notification', payload);
      setNotice(payload);
      showBrowserNotification(payload);
    };

    socket.on('player_notification', onNotify);

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_RECEIVED') return;
      console.log('[PushDebug] SW message', event.data);
      const payload = event.data.payload as PlayerNotification;
      if (payload?.title) {
        setNotice(payload);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('player_notification', onNotify);
      socket.emit('leave_user_room', user._id);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [user?._id]);

  return (
    <Snackbar
      open={Boolean(notice)}
      autoHideDuration={12000}
      onClose={() => setNotice(null)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        variant="filled"
        onClose={() => setNotice(null)}
        action={
          notice?.url ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                const url = notice.url || '/';
                setNotice(null);
                navigate(url);
              }}
            >
              Otvori
            </Button>
          ) : undefined
        }
        sx={{ width: '100%' }}
      >
        <strong>{notice?.title}</strong>
        {notice?.body ? ` — ${notice.body}` : ''}
      </Alert>
    </Snackbar>
  );
}
