import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, clearToken, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

const GUEST_FLAG_KEY = 'finearc_guest_mode';

function extractErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (Array.isArray(data.detail)) {
    // FastAPI/pydantic validation errors come back as a list of {msg, loc, ...}
    return data.detail.map((item) => item.msg).join(' ');
  }
  return data.detail || fallback;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' | 'authenticated' | 'unauthenticated' | 'guest'
  const [status, setStatus] = useState('loading');

  const loadCurrentUser = useCallback(async () => {
    if (!getToken()) {
      setStatus(localStorage.getItem(GUEST_FLAG_KEY) === 'true' ? 'guest' : 'unauthenticated');
      return;
    }
    try {
      const res = await apiFetch('/auth/me');
      if (!res.ok) throw new Error('Session invalid');
      const data = await res.json();
      setUser(data);
      setStatus('authenticated');
    } catch {
      clearToken();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();

    const handleUnauthorized = () => {
      setUser(null);
      setStatus('unauthenticated');
    };
    window.addEventListener('finearc:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('finearc:unauthorized', handleUnauthorized);
  }, [loadCurrentUser]);

  const login = useCallback(async (email, password) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, 'Could not sign in.'));
    }
    localStorage.removeItem(GUEST_FLAG_KEY);
    setToken(data.access_token);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (email, password) => {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractErrorMessage(data, 'Could not create account.'));
    localStorage.removeItem(GUEST_FLAG_KEY);
    setToken(data.access_token);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await apiFetch('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, 'Could not sign in with Google.'));
    }
    localStorage.removeItem(GUEST_FLAG_KEY);
    setToken(data.access_token);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const continueAsGuest = useCallback(() => {
    localStorage.setItem(GUEST_FLAG_KEY, 'true');
    setUser(null);
    setStatus('guest');
  }, []);

  const exitGuest = useCallback(() => {
    localStorage.removeItem(GUEST_FLAG_KEY);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(GUEST_FLAG_KEY);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, status, login, register, loginWithGoogle, continueAsGuest, exitGuest, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}