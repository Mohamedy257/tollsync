import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { path: '/', icon: '⚡', label: 'Calculator' },
  { path: '/vehicles', icon: '🚗', label: 'Vehicles' },
  { path: '/integrations', icon: '🔗', label: 'Integrations' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { host, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>⚡ TollSync</h1>
          <p>Rental toll calculator</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.path}
              className={`nav-item ${location.pathname === n.path ? 'active' : ''}`}
              onClick={() => navigate(n.path)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="host-name">{host?.name || 'Host'}</p>
          <p className="host-email">{host?.email}</p>
          <button className="logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
