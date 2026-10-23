'use client';

import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useNavigate, usePathname } from '@/lib/router';
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
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(`/login?from=${encodeURIComponent(safeFrom(pathname ?? '/'))}`, { replace: true });
      return;
    }
    if (user.role !== 'player') {
      navigate('/', { replace: true });
    }
  }, [loading, user, pathname, navigate]);

  if (loading) return <Loader />;
  if (!user || user.role !== 'player') return <Loader />;
  return <>{children}</>;
}

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(`/login?from=${encodeURIComponent(safeFrom(pathname ?? '/'))}`, { replace: true });
    }
  }, [loading, user, pathname, navigate]);

  if (loading || !user) return <Loader />;
  return <>{children}</>;
}

export function CourtRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(`/login?from=${encodeURIComponent(safeFrom(pathname ?? '/'))}`, { replace: true });
      return;
    }
    if (user.role !== 'court') {
      navigate('/', { replace: true });
    }
  }, [loading, user, pathname, navigate]);

  if (loading) return <Loader />;
  if (!user || user.role !== 'court') return <Loader />;
  return <>{children}</>;
}
