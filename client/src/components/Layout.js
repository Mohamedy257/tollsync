import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { path: '/', icon: '⚡', label: 'Calculator' },
  { path: '/tolls', icon: '🛣️', label: 'Toll Records' },
  { path: '/vehicles', icon: '🚗', label: 'Vehicles' },
  { path: '/integrations', icon: '🔗', label: 'Integrations' },
];

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

// Migrate old dismissed flag → treat as installed so banner doesn't resurface
if (localStorage.getItem('pwa-dismissed') === '1') {
  localStorage.removeItem('pwa-dismissed');
  localStorage.setItem('pwa-installed-v2', '1');
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { host, logout } = useAuth();

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installed, setInstalled] = useState(
    () => isStandalone || localStorage.getItem('pwa-installed-v2') === '1'
  );

  useEffect(() => {
    if (installed) return;

    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const onInstalled = () => {
      localStorage.setItem('pwa-installed-v2', '1');
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-installed-v2', '1');
        setInstalled(true);
        setInstallPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSHint(h => !h);
    }
  };

  const dismiss = () => {
    localStorage.setItem('pwa-installed-v2', '1'); // treat dismiss as "don't show again"
    setInstalled(true);
    setInstallPrompt(null);
    setShowIOSHint(false);
  };

  const showBanner = !installed && (installPrompt || isIOS);

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
            background: 'linear-gradient(135deg, #1a6ec0 0%, #185fa5 100%)',
            borderRadius: 14, marginBottom: 16, overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(24,95,165,0.18)',
          }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* App icon */}
              <img src="/icon-192.png" alt="TollSync"
                style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }} />

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#fff', margin: 0 }}>TollSync</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '2px 0 0', lineHeight: 1.4 }}>
                  Add to your home screen for quick access
                </p>
              </div>

              {/* Dismiss */}
              <button onClick={dismiss}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 99, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                ✕
              </button>
            </div>

            {/* Action row */}
            <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
              <button onClick={handleInstall} style={{
                flex: 1, background: '#fff', color: '#185fa5', border: 'none',
                borderRadius: 10, padding: '10px 0', fontWeight: 700, fontSize: 14,
                cursor: 'pointer', letterSpacing: 0.1,
              }}>
                {isIOS ? 'How to install' : 'Add to Home Screen'}
              </button>
            </div>

            {/* iOS instructions */}
            {showIOSHint && (
              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '12px 16px 14px', fontSize: 13, color: '#fff', lineHeight: 1.7 }}>
                1. Tap the <strong>Share</strong> button <span style={{ fontSize: 15 }}>⎋</span> at the bottom of Safari<br />
                2. Scroll and tap <strong>"Add to Home Screen"</strong><br />
                3. Tap <strong>Add</strong> — TollSync appears on your home screen
              </div>
            )}
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
