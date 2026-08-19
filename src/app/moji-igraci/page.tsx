import dynamic from 'next/dynamic';
import { PlayerRoute } from '@/components/RouteGuards';

const MojiIgraci = dynamic(() => import('@/views/MojiIgraci'), { ssr: false });

export default function Page() {
  return (
    <PlayerRoute>
      <MojiIgraci />
    </PlayerRoute>
  );
}
