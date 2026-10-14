'use client';

import type { ElementType } from 'react';
import { Box, ButtonBase } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HomeIcon from '@mui/icons-material/Home';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PersonIcon from '@mui/icons-material/Person';
import { Link as RouterLink, useLocation, useNavigate } from '@/lib/router';

export const BOTTOM_NAV_HEIGHT = 64;

type Item = { label: string; path: string; Icon: ElementType; ActiveIcon: ElementType };

const ITEMS: Item[] = [
  { label: 'Početna', path: '/', Icon: HomeOutlinedIcon, ActiveIcon: HomeIcon },
  { label: 'Moji mečevi', path: '/moji-mecevi', Icon: EventAvailableOutlinedIcon, ActiveIcon: EventAvailableIcon },
  { label: 'Obaveštenja', path: '/notification-settings', Icon: NotificationsNoneOutlinedIcon, ActiveIcon: NotificationsIcon },
  { label: 'Profil', path: '/profil', Icon: PersonOutlineOutlinedIcon, ActiveIcon: PersonIcon },
];

export const BOTTOM_NAV_PATHS = ITEMS.map((i) => i.path);

/** Sub-pages that keep the bottom navigation and highlight their parent tab. */
const PARENT_TAB: Record<string, string> = { '/moji-igraci': '/profil' };

/** Every path on which the bottom navigation is shown (tabs + their sub-pages). */
export const BOTTOM_NAV_VISIBLE_PATHS = [...BOTTOM_NAV_PATHS, ...Object.keys(PARENT_TAB)];

/** Fixed bottom navigation (mobile, players): 2 items, raised create button, 2 items. */
export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Box
      component="nav"
      aria-label="Glavna navigacija"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1100,
        display: 'flex',
        height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
        pb: 'env(safe-area-inset-bottom)',
        bgcolor: '#FFFFFF',
        borderTop: '1px solid #E3E9F3',
      }}
    >
      {ITEMS.flatMap(({ label, path, Icon, ActiveIcon }, index) => {
        const active = (PARENT_TAB[pathname] ?? pathname) === path;
        const Glyph = active ? ActiveIcon : Icon;
        const link = (
          <Box
            key={path}
            component={RouterLink}
            to={path}
            aria-current={active ? 'page' : undefined}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              textDecoration: 'none',
              color: active ? 'primary.main' : '#6B7A99',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              lineHeight: 1.2,
            }}
          >
            <Glyph sx={{ fontSize: 26 }} />
            {label}
          </Box>
        );
        if (index !== 1) return [link];
        return [
          link,
          <Box key="create" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ButtonBase
              onClick={() => navigate('/create')}
              aria-label="Napravi meč"
              data-tour="tour-fab-create"
              sx={{
                width: 56,
                height: 56,
                mt: '-26px',
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: '#fff',
                border: '4px solid #FFFFFF',
                boxShadow: '0 8px 20px rgba(8, 119, 249, 0.30)',
              }}
            >
              <AddIcon sx={{ fontSize: 30 }} />
            </ButtonBase>
          </Box>,
        ];
      })}
    </Box>
  );
}
