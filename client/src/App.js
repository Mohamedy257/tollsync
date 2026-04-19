import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CalculatorPage from './pages/CalculatorPage';
import VehiclesPage from './pages/VehiclesPage';
import IntegrationsPage from './pages/IntegrationsPage';
import EzPassPage from './pages/EzPassPage';
import TripsPage from './pages/TripsPage';
import SubscribePage from './pages/SubscribePage';
import AdminPage from './pages/AdminPage';
import SetupWizard from './pages/SetupWizard';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import AboutPage from './pages/AboutPage';
import SupportPage from './pages/SupportPage';
import ContactPage from './pages/ContactPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountPage from './pages/AccountPage';
import NotFoundPage from './pages/NotFoundPage';
import './index.css';

function EmailVerificationGate() {
  const { host, logout, resendVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const resend = async () => {
    setSending(true); setErr('');
    try {
      await resendVerification();
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to resend. Try again.');
    } finally { setSending(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: '#185fa5', textAlign: 'center', marginBottom: 24 }}>⚡ TollSync</p>
        <div className="card" style={{ padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
          <p style={{ fontWeight: 700, fontSize: 20, margin: '0 0 10px' }}>Check your inbox</p>
          <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: '0 0 8px' }}>
            We sent a verification link to
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#185fa5', margin: '0 0 24px', wordBreak: 'break-all' }}>
            {host?.email}
          </p>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px', lineHeight: 1.5 }}>
            Click the link in the email to activate your account. Check your spam folder if you don't see it.
          </p>

          {err && <p style={{ fontSize: 13, color: '#e24b4a', marginBottom: 12 }}>{err}</p>}
          {sent && <p style={{ fontSize: 13, color: '#3b6d11', marginBottom: 12 }}>✓ Verification email sent!</p>}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
            onClick={resend} disabled={sending}>
            {sending ? <><span className="spinner" /> Sending...</> : 'Resend verification email'}
          </button>
          <button
            onClick={() => logout()}
            style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, requireAdmin }) {
  const { host, loading, isSubscribed } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <span className="spinner spinner-lg" />
    </div>
  );
  if (!host) return <Navigate to="/login" replace />;

  // Email verification gate — only blocks new accounts (email_verified === false)
  if (host.email_verified === false) return <EmailVerificationGate />;

  if (host.setup_complete === false) return <SetupWizard />;

  // Admin-only routes
  if (requireAdmin && !host.is_admin) return <Navigate to="/" replace />;

  // Subscription gate — admin always bypasses
  if (!isSubscribed) return <Navigate to="/subscribe" replace />;

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { host } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={host ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/subscribe" element={<SubscribePage />} />
      <Route path="/" element={<ProtectedRoute><CalculatorPage /></ProtectedRoute>} />
      <Route path="/trips" element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
      <Route path="/tolls" element={<ProtectedRoute><EzPassPage /></ProtectedRoute>} />
      <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
      <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
      <Route path="/contact" element={<ProtectedRoute><ContactPage /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
