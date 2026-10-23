'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import api from '../lib/api';
import { User } from '../types';
import { mergeAuthUser } from '../lib/emailVerified';
import { beginLoginLocationCapture, clearPlayerLocationSession } from '../lib/location';
import { markPromptNotificationsOnLogin } from '../lib/notificationPrompt';

type AuthContextValue = {
  user: User | null;
  /** Server HTML snapshot. Nav uses this until the shell has hydrated. */
  initialUser: User | null;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loadSession: (signal?: AbortSignal) => Promise<void>;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role?: 'player' | 'court',
    preferredSports?: string[],
    referredBy?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: (role?: 'player' | 'court', preferredSports?: string[]) => void;
  loginWithFacebook: (role?: 'player' | 'court', preferredSports?: string[]) => void;
  completeOAuthRegistration: (role: 'player' | 'court', preferredSports: string[]) => Promise<void>;
  resendVerification: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(true);

  // Must run from inside the suspended app shell (see AppShell). Starting it
  // here lets /api/auth/me resolve before that tree hydrates, so the client
  // nav (logged in) no longer matches the server HTML.
  const loadSession = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get('/api/auth/me', { signal });
      if (signal?.aborted) return;
      if (res.data) setUser((prev) => mergeAuthUser(prev, res.data));
      else setUser(null);
    } catch (err: unknown) {
      const canceled =
        signal?.aborted ||
        (err as { name?: string; code?: string })?.name === 'CanceledError' ||
        (err as { code?: string })?.code === 'ERR_CANCELED';
      if (canceled) return;
      setUser(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    beginLoginLocationCapture();
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token: _token, ...userData } = res.data;
      if (userData.role === 'player') markPromptNotificationsOnLogin();
      else clearPlayerLocationSession();
      setUser(userData);
    } catch (error) {
      throw error;
    }
  }

  async function register(
    name: string,
    email: string,
    password: string,
    role?: 'player' | 'court',
    preferredSports?: string[],
    referredBy?: string
  ) {
    if (role !== 'court') beginLoginLocationCapture();
    try {
      const res = await api.post('/api/auth/register', {
        name,
        email,
        password,
        role,
        preferredSports: preferredSports || [],
        ...(referredBy ? { referredBy } : {}),
      });
      const { token: _token, ...userData } = res.data;
      if (userData.role !== 'player') clearPlayerLocationSession();
      setUser(userData);
    } catch (error) {
      throw error;
    }
  }

  async function logout() {
    clearPlayerLocationSession();
    await api.post('/api/auth/logout');
    setUser(null);
  }

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me');
      if (res.data) {
        setUser((prev) => mergeAuthUser(prev, res.data));
      }
    } catch (err) {
      console.log('Error refreshing user:', err);
    }
  }, []);

  function buildOAuthState(role?: 'player' | 'court', preferredSports?: string[]) {
    if (!role && !preferredSports?.length) return undefined;
    return encodeURIComponent(
      JSON.stringify({
        ...(role ? { role } : {}),
        ...(preferredSports?.length ? { preferredSports } : {}),
      })
    );
  }

  function loginWithGoogle(role?: 'player' | 'court', preferredSports?: string[]) {
    if (role !== 'court') beginLoginLocationCapture();
    const state = buildOAuthState(role, preferredSports);
    const url = state
      ? `/api/auth/google?state=${state}`
      : '/api/auth/google';
    window.location.href = url;
  }

  function loginWithFacebook(role?: 'player' | 'court', preferredSports?: string[]) {
    if (role !== 'court') beginLoginLocationCapture();
    const state = buildOAuthState(role, preferredSports);
    const url = state
      ? `/api/auth/facebook?state=${state}`
      : '/api/auth/facebook';
    window.location.href = url;
  }

  async function completeOAuthRegistration(role: 'player' | 'court', preferredSports: string[]) {
    if (role !== 'court') beginLoginLocationCapture();
    const res = await api.post('/api/auth/oauth/complete', { role, preferredSports });
    if (res.data?.role !== 'player') clearPlayerLocationSession();
    setUser(res.data);
  }

  async function resendVerification() {
    await api.post('/api/auth/resend-verification');
  }

  return (
    <AuthContext.Provider value={{ user, initialUser, loading, setUser, loadSession, refreshUser, login, register, logout, loginWithGoogle, loginWithFacebook, completeOAuthRegistration, resendVerification }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


