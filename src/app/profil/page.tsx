'use client';

import dynamic from 'next/dynamic';
import { AuthRoute } from '@/components/RouteGuards';
import { useAuth } from '@/context/AuthContext';

const PlayerProfile = dynamic(() => import('@/views/PlayerProfile'), { ssr: false });
const CourtAccount = dynamic(() => import('@/views/CourtAccount'), { ssr: false });

function ProfileBody() {
  const { user } = useAuth();
  if (user?.role === 'court') return <CourtAccount />;
  return <PlayerProfile />;
}

export default function Page() {
  return (
    <AuthRoute>
      <ProfileBody />
    </AuthRoute>
  );
}
