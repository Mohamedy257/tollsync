import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { path: '/', icon: '⚡', label: 'Calculator' },
  { path: '/vehicles', icon: '🚗', label: 'Vehicles' },
  { path: '/integrations', icon: '🔗', label: 'Integrations' },
];

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { host, logout } = useAuth();

  const [installPrompt, setInstallPrompt] = useState(null); // Android deferred prompt
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-dismissed') === '1'
  );

  useEffect(() => {
    if (isStandalone || dismissed) return;

    // Android / Chrome: capture the install prompt
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
    } else if (isIOS) {
      setShowIOSHint(h => !h);
    }
  };

  const dismiss = () => {
    localStorage.setItem('pwa-dismissed', '1');
    setDismissed(true);
    setInstallPrompt(null);
    setShowIOSHint(false);
  };

  const showBanner = !isStandalone && !dismissed && (installPrompt || isIOS);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Desktop sidebar */}
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

      <main className="main">
        {/* Install banner */}
        {showBanner && (
          <div style={{
            background: '#185fa5', color: '#fff',
            padding: '10px 14px', display: 'flex', alignItems: 'center',
            gap: 10, flexWrap: 'wrap', marginBottom: 12, borderRadius: 10,
            fontSize: 13,
          }}>
            <span style={{ flex: 1 }}>📲 Add TollSync to your home screen for quick access</span>
            <button
              onClick={handleInstall}
              style={{
                background: '#fff', color: '#185fa5', border: 'none',
                borderRadius: 8, padding: '6px 14px', fontWeight: 600,
                fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {isIOS ? 'How?' : 'Add to Home Screen'}
            </button>
            <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        )}

        {/* iOS step-by-step hint */}
        {showIOSHint && (
          <div style={{
            background: '#f0f7ff', border: '1px solid #b8d4f5', borderRadius: 10,
            padding: '12px 14px', marginBottom: 12, fontSize: 13, color: '#185fa5',
            lineHeight: 1.7,
          }}>
            <strong>Install on iPhone / iPad:</strong><br />
            1. Tap the <strong>Share</strong> button <span style={{ fontSize: 16 }}>⎋</span> at the bottom of Safari<br />
            2. Scroll down and tap <strong>"Add to Home Screen"</strong><br />
            3. Tap <strong>Add</strong> — TollSync will appear on your home screen
          </div>
        )}

        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.path}
            className={`bottom-nav-item ${location.pathname === n.path ? 'active' : ''}`}
            onClick={() => navigate(n.path)}
          >
            <span className="bottom-nav-icon">{n.icon}</span>
            <span className="bottom-nav-label">{n.label}</span>
          </button>
        ))}
        <button className="bottom-nav-item" onClick={handleLogout}>
          <span className="bottom-nav-icon">👤</span>
          <span className="bottom-nav-label">Sign out</span>
        </button>
      </nav>
    </div>
  );
}
