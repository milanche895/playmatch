'use client';

import { useEffect, useState } from 'react';
import { useLocation } from '@/lib/router';
import api from './api';
import { useAuth } from '../context/AuthContext';

let count = 0;
let requestId = 0;
let inflight: Promise<number> | null = null;
let watchedUserId: string | null = null;
let watchedPath = '';
let visibilityBound = false;
const listeners = new Set<(n: number) => void>();

function emit(n: number) {
  count = n;
  listeners.forEach((listener) => listener(n));
}

export function unreadAriaLabel(count: number): string {
  if (count <= 0) return 'Obaveštenja';
  if (count === 1) return 'Obaveštenja, 1 nepročitano';
  return `Obaveštenja, ${count} nepročitanih`;
}

/** Ignore in-flight fetches so a newer read/refresh wins. */
export function setUnreadCount(n: number) {
  requestId += 1;
  inflight = null;
  emit(Math.max(0, n));
}

export function refreshUnreadCount(): Promise<number> {
  if (inflight) return inflight;
  const id = ++requestId;
  inflight = api
    .get<{ unreadCount?: number }>('/api/notifications/unread-count')
    .then((res) => {
      if (id !== requestId) return count;
      emit(res.data?.unreadCount ?? 0);
      return count;
    })
    .catch(() => count)
    .finally(() => {
      if (id === requestId) inflight = null;
    });
  return inflight;
}

function bindVisibilityRefresh() {
  if (visibilityBound || typeof window === 'undefined') return;
  visibilityBound = true;
  const onVisible = () => {
    if (document.visibilityState === 'visible' && watchedUserId) refreshUnreadCount();
  };
  window.addEventListener('focus', onVisible);
  document.addEventListener('visibilitychange', onVisible);
}

export function useUnreadCount(): number {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [n, setN] = useState(count);

  useEffect(() => {
    listeners.add(setN);
    setN(count);
    return () => {
      listeners.delete(setN);
    };
  }, []);

  useEffect(() => {
    const id = user?._id ?? null;
    if (!id) {
      if (watchedUserId) {
        watchedUserId = null;
        watchedPath = '';
        setUnreadCount(0);
      }
      return;
    }
    bindVisibilityRefresh();
    if (watchedUserId === id && watchedPath === pathname) return;
    watchedUserId = id;
    watchedPath = pathname;
    refreshUnreadCount();
  }, [user?._id, pathname]);

  return user ? n : 0;
}
