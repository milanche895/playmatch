import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

type User = { _id: string; name: string; email: string; avatarUrl?: string } | null;

type AuthContextValue = {
  user: User;
  setUser: (u: User) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    // no dedicated me endpoint; rely on cookie presence on actions
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post('/api/auth/login', { email, password });
    setUser(res.data);
  }

  async function register(name: string, email: string, password: string) {
    const res = await api.post('/api/auth/register', { name, email, password });
    setUser(res.data);
  }

  async function logout() {
    await api.post('/api/auth/logout');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


