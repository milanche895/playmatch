import { useEffect, useState } from 'react';
import { Button, Chip, Tooltip } from '@mui/material';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { useLocation, useNavigate } from '@/lib/router';
import { useAuth } from '../context/AuthContext';
import { getNotificationStatus } from '../lib/notifications';

type Variant = 'chip' | 'button';

export default function NotificationSetupAlert({ variant = 'chip' }: { variant?: Variant }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!user?._id || user.role !== 'player') {
      setNeedsSetup(false);
      return;
    }

    let cancelled = false;
    getNotificationStatus()
      .then((status) => {
        if (cancelled) return;
        const permissionOff = status.permission !== 'granted';
        const subscriptionOff = !status.subscribed;
        setNeedsSetup(permissionOff || subscriptionOff);
      })
      .catch(() => {
        if (!cancelled) setNeedsSetup(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.role, location.pathname]);

  if (!needsSetup || user?.role !== 'player') return null;

  const goToSettings = () => navigate('/notification-settings');
  const tooltip =
    'Obaveštenja ne rade dok nisu uključena oba: dozvola pretraživača i slanje na ovaj uređaj. Klikni da ih uključiš.';

  const label = (
    <span style={{ display: 'block', lineHeight: 1.15, textAlign: 'center' }}>
      Aktiviraj
      <br />
      obaveštenja
    </span>
  );

  if (variant === 'button') {
    return (
      <Button
        onClick={goToSettings}
        startIcon={<NotificationsOffIcon />}
        color="warning"
        variant="outlined"
        size="small"
        sx={{
          fontWeight: 700,
          borderRadius: 2,
          textTransform: 'none',
          lineHeight: 1.15,
          py: 0.75,
          justifyContent: 'center',
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <Tooltip title={tooltip}>
      <Chip
        icon={<NotificationsOffIcon />}
        label={label}
        color="warning"
        clickable
        onClick={goToSettings}
        sx={{
          fontWeight: 700,
          height: 'auto',
          py: 0.5,
          '& .MuiChip-label': {
            display: 'block',
            whiteSpace: 'normal',
            textAlign: 'center',
            py: 0.25,
          },
        }}
      />
    </Tooltip>
  );
}
