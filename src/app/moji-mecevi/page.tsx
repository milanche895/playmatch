import dynamic from 'next/dynamic';
import { PlayerRoute } from '@/components/RouteGuards';

const MojiMecevi = dynamic(() => import('@/views/MojiMecevi'), { ssr: false });

export default function Page() {
  return (
    <PlayerRoute>
      <MojiMecevi />
    </PlayerRoute>
  );
}
