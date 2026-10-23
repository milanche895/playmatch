'use client';

import type { ReactNode } from 'react';
import { Badge } from '@mui/material';

/** Red numeric badge for unseen in-app notifications. Hidden when the count is zero. */
export default function UnreadCountBadge({
  count,
  children,
  borderColor = '#F4F7FC',
}: {
  count: number;
  children: ReactNode;
  borderColor?: string;
}) {
  return (
    <Badge
      badgeContent={count}
      invisible={count <= 0}
      max={99}
      overlap="circular"
      sx={{
        '& .MuiBadge-badge': {
          bgcolor: '#EF4444',
          color: '#fff',
          fontWeight: 700,
          fontSize: 10,
          height: 16,
          minWidth: 16,
          px: '4px',
          border: `1.5px solid ${borderColor}`,
          boxSizing: 'content-box',
        },
      }}
    >
      {children}
    </Badge>
  );
}
