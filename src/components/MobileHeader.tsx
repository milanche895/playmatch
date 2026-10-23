'use client';

import type { ReactNode } from 'react';
import { AppBar, Badge, Box, IconButton, Toolbar } from '@mui/material';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { Link as RouterLink } from '@/lib/router';
import { unreadAriaLabel, useUnreadCount } from '../lib/unreadNotifications';
import PlejkoLogo from './PlejkoLogo';
import InstallButton from './InstallButton';
import UnreadCountBadge from './UnreadCountBadge';

/** Mobile top bar: Plejko logo (mark + wordmark) on the left, install + notification bell (or a custom `action`) on the right. */
export default function MobileHeader({ showBellDot = false, action }: { showBellDot?: boolean; action?: ReactNode }) {
  const unread = useUnreadCount();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.default',
        color: 'text.primary',
        borderBottom: 'none',
        boxShadow: 'none',
      }}
    >
      <Toolbar disableGutters sx={{ minHeight: 56, px: '16px', justifyContent: 'space-between' }}>
        <Box
          component={RouterLink}
          to="/"
          aria-label="Plejko — početna"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <PlejkoLogo size="sm" />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: '-8px' }}>
          <InstallButton />
          {action ?? (
          <IconButton
            component={RouterLink}
            to="/notification-settings"
            aria-label={unreadAriaLabel(unread)}
            sx={{ color: 'primary.main' }}
          >
            {unread > 0 ? (
              <UnreadCountBadge count={unread}>
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 28 }} />
              </UnreadCountBadge>
            ) : (
              <Badge
                variant="dot"
                invisible={!showBellDot}
                sx={{
                  '& .MuiBadge-badge': {
                    bgcolor: '#EF4444',
                    width: 9,
                    height: 9,
                    minWidth: 9,
                    borderRadius: '50%',
                    top: 3,
                    right: 3,
                    border: '1.5px solid #F4F7FC',
                    boxSizing: 'content-box',
                  },
                }}
              >
                <NotificationsNoneOutlinedIcon sx={{ fontSize: 28 }} />
              </Badge>
            )}
          </IconButton>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
