import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CalculatorPage from './pages/CalculatorPage';
import VehiclesPage from './pages/VehiclesPage';
import IntegrationsPage from './pages/IntegrationsPage';
import EzPassPage from './pages/EzPassPage';
import SetupWizard from './pages/SetupWizard';
import './index.css';

function ProtectedRoute({ children }) {
  const { host, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <span className="spinner spinner-lg" />
    </div>
  );
  if (!host) return <Navigate to="/login" replace />;
  // New users (setup_complete === false) must complete the wizard first
  if (host.setup_complete === false) return <SetupWizard />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { host } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={host ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><CalculatorPage /></ProtectedRoute>} />
      <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
      <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage /></ProtectedRoute>} />
      <Route path="/tolls" element={<ProtectedRoute><EzPassPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
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
