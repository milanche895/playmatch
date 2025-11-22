import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: 'player' | 'court') => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load current user on mount
    api.get('/api/auth/me')
      .then((res) => {
        if (res.data) {
          setUser(res.data);
        } else {
          setUser(null);
        }
      })
      .catch((err) => {
        // Silently fail if not authenticated - this is expected
        console.log('Not authenticated or error loading user:', err);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    try {
      const res = await api.post('/api/auth/login', { email, password });
      setUser(res.data);
    } catch (error) {
      // Re-throw error so Login component can handle it
      throw error;
    }
  }

  async function register(name: string, email: string, password: string, role?: 'player' | 'court') {
    const res = await api.post('/api/auth/register', { name, email, password, role });
    setUser(res.data);
  }

  async function logout() {
    await api.post('/api/auth/logout');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


