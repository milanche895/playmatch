'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '@/context/AuthContext';

function Loader() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
      <CircularProgress />
    </Box>
  );
}

function safeFrom(pathname: string) {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/';
  return pathname;
}

export function PlayerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?from=${encodeURIComponent(safeFrom(pathname))}`);
      return;
    }
    if (user.role !== 'player') {
      router.replace('/');
    }
  }, [loading, user, pathname, router]);

  if (loading) return <Loader />;
  if (!user || user.role !== 'player') return <Loader />;
  return <>{children}</>;
}

export function CourtRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'court') {
      router.replace('/');
    }
  }, [loading, user, router]);

  if (loading) return <Loader />;
  if (!user || user.role !== 'court') return <Loader />;
  return <>{children}</>;
}
