'use client';

import dynamic from 'next/dynamic';
import { AuthRoute } from '@/components/RouteGuards';

const NotificationSettings = dynamic(() => import('@/views/NotificationSettings'), { ssr: false });

export default function Page() {
  return (
    <AuthRoute>
      <NotificationSettings />
    </AuthRoute>
  );
}
