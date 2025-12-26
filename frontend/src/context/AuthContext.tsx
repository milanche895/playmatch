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
  loginWithGoogle: (role?: 'player' | 'court') => void;
  loginWithFacebook: (role?: 'player' | 'court') => void;
  loginWithInstagram: (accessToken: string, role?: 'player' | 'court') => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load current user on mount only if token exists
    const token = localStorage.getItem('token');
    if (!token) {
      // No token, user is not logged in
      setUser(null);
      setLoading(false);
      return;
    }

    // Token exists, check if it's valid
    api.get('/api/auth/me')
      .then((res) => {
        if (res.data) {
          setUser(res.data);
        } else {
          setUser(null);
          localStorage.removeItem('token'); // Remove invalid token
        }
      })
      .catch((err) => {
        // Token is invalid or expired
        console.log('Not authenticated or error loading user:', err);
        setUser(null);
        localStorage.removeItem('token'); // Remove invalid token
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

  function loginWithGoogle(role?: 'player' | 'court') {
    // Redirect to backend Google OAuth endpoint
    const envApiUrl = import.meta.env.VITE_API_URL;
    const backendUrl = envApiUrl && envApiUrl.trim() !== '' 
      ? envApiUrl 
      : 'http://localhost:5050';
    // Pass role as state parameter (Google OAuth supports state parameter)
    const state = role ? encodeURIComponent(JSON.stringify({ role })) : undefined;
    const url = state 
      ? `${backendUrl}/api/auth/google?state=${state}`
      : `${backendUrl}/api/auth/google`;
    window.location.href = url;
  }

  function loginWithFacebook(role?: 'player' | 'court') {
    // Redirect to backend Facebook OAuth endpoint (redirect flow, works with HTTP in development)
    const envApiUrl = import.meta.env.VITE_API_URL;
    const backendUrl = envApiUrl && envApiUrl.trim() !== '' 
      ? envApiUrl 
      : 'http://localhost:5050';
    // Pass role as state parameter
    const state = role ? encodeURIComponent(JSON.stringify({ role })) : undefined;
    const url = state 
      ? `${backendUrl}/api/auth/facebook?state=${state}`
      : `${backendUrl}/api/auth/facebook`;
    window.location.href = url;
  }

  async function loginWithInstagram(accessToken: string, role?: 'player' | 'court') {
    try {
      const res = await api.post('/api/auth/instagram', { accessToken, role });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
      }
      const { token, ...userData } = res.data;
      setUser(userData);
    } catch (error) {
      throw error;
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, login, register, logout, loginWithGoogle, loginWithFacebook, loginWithInstagram }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


