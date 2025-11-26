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
      // Save token to localStorage if provided
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
      }
      // Remove token from response before setting user
      const { token, ...userData } = res.data;
      setUser(userData);
    } catch (error) {
      // Re-throw error so Login component can handle it
      throw error;
    }
  }

  async function register(name: string, email: string, password: string, role?: 'player' | 'court') {
    try {
      const res = await api.post('/api/auth/register', { name, email, password, role });
      // Save token to localStorage if provided
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
      }
      // Remove token from response before setting user
      const { token, ...userData } = res.data;
      setUser(userData);
      // Verify that cookie was set by checking if we can get user info
      // This ensures cookie is properly set before proceeding
      try {
        const meRes = await api.get('/api/auth/me');
        if (meRes.data) {
          setUser(meRes.data);
        }
      } catch (meErr) {
        console.warn('Could not verify authentication after registration:', meErr);
        // Don't throw - registration was successful, cookie might just need a moment
      }
    } catch (error) {
      // Re-throw error so Register component can handle it
      throw error;
    }
  }

  async function logout() {
    await api.post('/api/auth/logout');
    // Remove token from localStorage
    localStorage.removeItem('token');
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


