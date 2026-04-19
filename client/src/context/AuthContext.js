import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setHost(res.data.host);
          setImpersonating(!!res.data.impersonatedBy);
        })
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
    setImpersonating(false);
    return res.data.host;
  };

  const loginWithToken = async (token) => {
    localStorage.setItem('token', token);
    const res = await api.get('/auth/me');
    setHost(res.data.host);
    setImpersonating(!!res.data.impersonatedBy);
    return res.data.host;
  };

  const register = async (email, password, name) => {
    const res = await api.post('/auth/register', { email, password, name });
    localStorage.setItem('token', res.data.token);
    setHost(res.data.host);
    setImpersonating(false);
    return res.data.host;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_token');
    setHost(null);
    setImpersonating(false);
  };

  const completeSetup = async () => {
    const res = await api.post('/auth/complete-setup');
    setHost(res.data.host);
  };

  const refreshHost = async () => {
    try {
      const res = await api.get('/auth/me');
      setHost(res.data.host);
      setImpersonating(!!res.data.impersonatedBy);
      return res.data.host;
    } catch { return null; }
  };

  // Admin: start impersonating a user
  const impersonate = async (userId) => {
    const res = await api.post(`/admin/impersonate/${userId}`);
    // Save original admin token so we can restore it
    localStorage.setItem('admin_token', localStorage.getItem('token'));
    localStorage.setItem('token', res.data.token);
    setHost(res.data.host);
    setImpersonating(true);
    return res.data.host;
  };

  // Exit impersonation and restore admin session
  const exitImpersonation = async () => {
    const adminToken = localStorage.getItem('admin_token');
    if (adminToken) {
      localStorage.setItem('token', adminToken);
      localStorage.removeItem('admin_token');
    }
    const res = await api.get('/auth/me');
    setHost(res.data.host);
    setImpersonating(false);
  };

  const resendVerification = async () => {
    await api.post('/auth/resend-verification');
  };

  const verifyEmail = async (token) => {
    await api.get(`/auth/verify-email?token=${token}`);
    await refreshHost();
  };

  const isSubscribed = host && (
    host.is_admin || host.subscription_status === 'active' || host.subscription_status === 'trialing'
  );

  return (
    <AuthContext.Provider value={{
      host, loading, impersonating,
      login, loginWithToken, register, logout,
      completeSetup, refreshHost, isSubscribed,
      resendVerification, verifyEmail,
      impersonate, exitImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
