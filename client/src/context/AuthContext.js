import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => setHost(res.data.host))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setHost(res.data.host);
    return res.data.host;
  };

  const register = async (email, password, name) => {
    const res = await api.post('/auth/register', { email, password, name });
    localStorage.setItem('token', res.data.token);
    setHost(res.data.host);
    return res.data.host;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setHost(null);
  };

  const completeSetup = async () => {
    const res = await api.post('/auth/complete-setup');
    setHost(res.data.host);
  };

  return (
    <AuthContext.Provider value={{ host, loading, login, register, logout, completeSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
