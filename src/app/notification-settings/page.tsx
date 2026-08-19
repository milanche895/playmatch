import dynamic from 'next/dynamic';
import { PlayerRoute } from '@/components/RouteGuards';

const NotificationSettings = dynamic(() => import('@/views/NotificationSettings'), { ssr: false });

export default function Page() {
  return (
    <PlayerRoute>
      <NotificationSettings />
    </PlayerRoute>
  );
}
