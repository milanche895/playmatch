'use client';

import { Avatar, AvatarGroup } from '@mui/material';

type StackPlayer = { _id: string; name?: string; avatarUrl?: string | null };

const FALLBACK_COLORS = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#0EA5E9', '#EF4444'];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/** Overlapping circular avatars (first three players). */
export default function PlayerAvatarStack({
  players,
  size = 30,
}: {
  players: StackPlayer[];
  size?: number;
}) {
  const visible = players.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <AvatarGroup
      max={3}
      spacing={size * 0.3}
      sx={{
        '& .MuiAvatar-root': {
          width: size,
          height: size,
          fontSize: size * 0.42,
          fontWeight: 700,
          border: '2px solid #FFFFFF',
          boxSizing: 'border-box',
        },
      }}
    >
      {visible.map((p) => (
        <Avatar
          key={p._id}
          src={p.avatarUrl || undefined}
          alt={p.name}
          sx={{ bgcolor: colorFor(p._id || p.name || '?'), color: '#fff' }}
        >
          {(p.name || '?').charAt(0).toUpperCase()}
        </Avatar>
      ))}
    </AvatarGroup>
  );
}
