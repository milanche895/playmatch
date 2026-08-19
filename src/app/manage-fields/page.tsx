import dynamic from 'next/dynamic';
import { CourtRoute } from '@/components/RouteGuards';

const ManageFields = dynamic(() => import('@/views/ManageFields'), { ssr: false });

export default function Page() {
  return (
    <CourtRoute>
      <ManageFields />
    </CourtRoute>
  );
}
