import React from 'react';
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
import AboutPage from './pages/AboutPage';
import SupportPage from './pages/SupportPage';
import ContactPage from './pages/ContactPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountPage from './pages/AccountPage';
import NotFoundPage from './pages/NotFoundPage';
import './index.css';

function ProtectedRoute({ children, requireAdmin }) {
  const { host, loading, isSubscribed } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <span className="spinner spinner-lg" />
    </div>
  );
  if (!host) return <Navigate to="/login" replace />;
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
