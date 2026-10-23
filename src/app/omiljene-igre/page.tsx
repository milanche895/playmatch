'use client';

import dynamic from 'next/dynamic';
import { PlayerRoute } from '@/components/RouteGuards';

const FavoriteGames = dynamic(() => import('@/views/FavoriteGames'), { ssr: false });

export default function Page() {
  return (
    <PlayerRoute>
      <FavoriteGames />
    </PlayerRoute>
  );
}
