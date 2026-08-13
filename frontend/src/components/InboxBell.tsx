import { useEffect, useState } from 'react';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
  Button,
  Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { socket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';

type InboxItem = {
  _id: string;
  title: string;
  body?: string;
  url?: string;
  read?: boolean;
  createdAt?: string;
};

export default function InboxBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const unread = items.filter((n) => !n.read).length;

  async function loadInbox() {
    try {
      const res = await api.get('/api/players/inbox');
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      console.warn('[PushDebug] inbox load failed', err);
    }
  }

  useEffect(() => {
    if (!user?._id) {
      setItems([]);
      return;
    }
    loadInbox();

    const onNotify = (payload: { title?: string; body?: string; url?: string }) => {
      console.log('[PushDebug] inbox received socket', payload);
      setItems((prev) => [
        {
          _id: `local-${Date.now()}`,
          title: payload.title || 'Plejko',
          body: payload.body,
          url: payload.url,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    };
    socket.on('player_notification', onNotify);
    return () => {
      socket.off('player_notification', onNotify);
    };
  }, [user?._id]);

  if (!user) return null;

  return (
    <>
      <Tooltip title="Obaveštenja">
        <IconButton
          color="inherit"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ color: 'text.secondary' }}
        >
          <Badge badgeContent={unread} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: 320, maxHeight: 420, borderRadius: 2 } }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" fontWeight={700}>Obaveštenja</Typography>
          {unread > 0 && (
            <Button
              size="small"
              onClick={async () => {
                await api.post('/api/players/inbox/read-all');
                setItems((prev) => prev.map((n) => ({ ...n, read: true })));
              }}
            >
              Pročitaj sve
            </Button>
          )}
        </Box>
        {items.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">Nema obaveštenja.</Typography>
          </MenuItem>
        ) : (
          items.slice(0, 20).map((item) => (
            <MenuItem
              key={item._id}
              onClick={async () => {
                if (item._id && !item._id.startsWith('local-')) {
                  api.post(`/api/players/inbox/${item._id}/read`).catch(() => {});
                }
                setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
                setAnchorEl(null);
                if (item.url) navigate(item.url);
              }}
              sx={{
                alignItems: 'flex-start',
                whiteSpace: 'normal',
                bgcolor: item.read ? 'transparent' : 'action.hover',
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={item.read ? 500 : 700}>
                  {item.title}
                </Typography>
                {item.body && (
                  <Typography variant="caption" color="text.secondary">
                    {item.body}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
