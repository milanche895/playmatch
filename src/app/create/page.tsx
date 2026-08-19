import dynamic from 'next/dynamic';
import { PlayerRoute } from '@/components/RouteGuards';

const CreateMatch = dynamic(() => import('@/views/CreateMatch'), { ssr: false });

export default function Page() {
  return (
    <PlayerRoute>
      <CreateMatch />
    </PlayerRoute>
  );
}
