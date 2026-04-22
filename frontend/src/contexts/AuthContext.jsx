import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('sahyatri_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authAPI.me()
        .then(res => { setUser(res.data); connectSocket(token); })
        .catch(() => { logout(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token: newToken, ...userData } = res.data;
    localStorage.setItem('sahyatri_token', newToken);
    setToken(newToken);
    setUser(userData);
    connectSocket(newToken);
    return userData;
  }, []);

  const register = useCallback(async (formData) => {
    const res = await authAPI.register(formData);
    const { token: newToken, ...userData } = res.data;
    localStorage.setItem('sahyatri_token', newToken);
    setToken(newToken);
    setUser(userData);
    connectSocket(newToken);
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sahyatri_token');
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
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updatePreferences, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
