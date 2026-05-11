import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import storage from '../services/storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Bootstrap: re-hydrate token from AsyncStorage ─────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getItem('sahyatri_token');
        if (stored) {
          setToken(stored);
          const res = await authAPI.me();
          setUser(res.data);
          connectSocket(stored);
        } else {
          // If bypassed, connect socket unconditionally as anonymous
          connectSocket(null);
        }
      } catch {
        await storage.removeItem('sahyatri_token');
        connectSocket(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token: newToken, ...userData } = res.data;
    await storage.setItem('sahyatri_token', newToken);
    setToken(newToken);
    setUser(userData);
    connectSocket(newToken);
    return userData;
  }, []);

  const verifyOtp = useCallback(async (email, otp) => {
    const res = await authAPI.verifyOtp({ email, otp });
    const { token: newToken, ...userData } = res.data;
    await storage.setItem('sahyatri_token', newToken);
    setToken(newToken);
    setUser(userData);
    connectSocket(newToken);
    return userData;
  }, []);

  const register = useCallback(async (formData) => {
    const res = await authAPI.register(formData);
    // User needs to verify email before logging in
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    await storage.removeItem('sahyatri_token');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  const updatePreferences = useCallback(async (prefs) => {
    const res = await authAPI.updatePreferences(prefs);
    setUser(prev => ({ ...prev, preferences: res.data.preferences }));
    return res.data.preferences;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout, verifyOtp, updatePreferences,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
