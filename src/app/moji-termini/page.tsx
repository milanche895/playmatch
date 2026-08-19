import dynamic from 'next/dynamic';
import { CourtRoute } from '@/components/RouteGuards';

const MojTermine = dynamic(() => import('@/views/MojTermine'), { ssr: false });

export default function Page() {
  return (
    <CourtRoute>
      <MojTermine />
    </CourtRoute>
  );
}
