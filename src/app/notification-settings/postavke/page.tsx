'use client';

import dynamic from 'next/dynamic';
import { PlayerRoute } from '@/components/RouteGuards';

const NotificationPreferences = dynamic(() => import('@/views/NotificationPreferences'), { ssr: false });

export default function Page() {
  return (
    <PlayerRoute>
      <NotificationPreferences />
    </PlayerRoute>
  );
}
