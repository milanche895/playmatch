'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
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
  loginWithGoogle: (role?: 'player' | 'court') => void;
  loginWithFacebook: (role?: 'player' | 'court') => void;
  loginWithInstagram: (accessToken: string, role?: 'player' | 'court') => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    api.get('/api/auth/me', { signal: controller.signal })
      .then((res) => {
        if (res.data) setUser(res.data);
        else setUser(null);
      })
      .catch((err) => {
        if (err.name !== 'CanceledError') setUser(null);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  async function login(email: string, password: string) {
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token: _token, ...userData } = res.data;
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
      setUser(userData);
    } catch (error) {
      throw error;
    }
  }

  async function logout() {
    await api.post('/api/auth/logout');
    setUser(null);
  }

  async function refreshUser() {
    try {
      const res = await api.get('/api/auth/me');
      if (res.data) {
        setUser(res.data);
      }
    } catch (err) {
      console.log('Error refreshing user:', err);
    }
  }

  function loginWithGoogle(role?: 'player' | 'court') {
    const state = role ? encodeURIComponent(JSON.stringify({ role })) : undefined;
    const url = state
      ? `/api/auth/google?state=${state}`
      : '/api/auth/google';
    window.location.href = url;
  }

  function loginWithFacebook(role?: 'player' | 'court') {
    const state = role ? encodeURIComponent(JSON.stringify({ role })) : undefined;
    const url = state
      ? `/api/auth/facebook?state=${state}`
      : '/api/auth/facebook';
    window.location.href = url;
  }

  async function loginWithInstagram(accessToken: string, role?: 'player' | 'court') {
    try {
      const res = await api.post('/api/auth/instagram', { accessToken, role });
      const { token: _token, ...userData } = res.data;
      setUser(userData);
    } catch (error) {
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refreshUser, login, register, logout, loginWithGoogle, loginWithFacebook, loginWithInstagram }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


