import dynamic from 'next/dynamic';
import { PlayerRoute } from '@/components/RouteGuards';

const PlayerProfile = dynamic(() => import('@/views/PlayerProfile'), { ssr: false });

export default function Page() {
  return (
    <PlayerRoute>
      <PlayerProfile />
    </PlayerRoute>
  );
}
