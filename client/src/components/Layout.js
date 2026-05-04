import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const NAV = [
  { path: '/', icon: '⚡', label: 'Calculator' },
  { path: '/trips', icon: '📋', label: 'Trips' },
  { path: '/tolls', icon: '🛣️', label: 'Toll Records' },
  { path: '/vehicles', icon: '🚗', label: 'Vehicles' },
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
  const { host, logout, impersonating, exitImpersonation } = useAuth();
  const [verifyDismissed, setVerifyDismissed] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const resendVerification = async () => {
    try {
      await api.post('/auth/resend-verification');
      setResendSent(true);
    } catch { /* silent — SMTP may not be configured */ }
  };

  const showVerifyBanner = host?.email_verified === false && !verifyDismissed;

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installed, setInstalled] = useState(
    () => isStandalone || localStorage.getItem('pwa-installed-v2') === '1'
  );
  const [showMore, setShowMore] = useState(false);

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

  const handleExitImpersonation = async () => {
    await exitImpersonation();
    navigate('/admin');
  };

  return (
    <div className="layout">
      {/* Email verification banner */}
      {showVerifyBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1999,
          background: '#185fa5', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '8px 16px', fontSize: 13, flexWrap: 'wrap',
        }}>
          <span>📧 Please verify your email address.</span>
          {resendSent ? (
            <span style={{ fontWeight: 600 }}>✓ Email sent!</span>
          ) : (
            <button onClick={resendVerification} style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 12, cursor: 'pointer',
            }}>
              Resend
            </button>
          )}
          <button onClick={() => setVerifyDismissed(true)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
            fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
          }}>✕</button>
        </div>
      )}

      {/* Free trial countdown banner */}
      {(() => {
        if (!host?.free_trial_ends_at) return null;
        const daysLeft = Math.ceil((new Date(host.free_trial_ends_at) - new Date()) / 86400000);
        if (daysLeft <= 0 || daysLeft > 3) return null;
        return (
          <div style={{
            position: 'fixed', top: showVerifyBanner ? 40 : 0, left: 0, right: 0, zIndex: 1998,
            background: '#f59e0b', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
          }}>
            <span>{daysLeft === 1 ? 'Your free trial ends today!' : `${daysLeft} days left in your free trial`}</span>
            <button onClick={() => navigate('/subscribe')} style={{
              background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.5)',
              color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
            }}>
              Subscribe
            </button>
          </div>
        );
      })()}

      {/* Impersonation banner */}
      {impersonating && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000,
          background: '#c47800', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
          padding: '8px 16px', fontSize: 13, fontWeight: 600,
        }}>
          <span>👤 Viewing as {host?.email} — support mode</span>
          <button
            onClick={handleExitImpersonation}
            style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff', borderRadius: 8, padding: '4px 12px',
              fontSize: 12, cursor: 'pointer', fontWeight: 700,
            }}
          >
            Exit
          </button>
        </div>
      )}
      {/* Desktop sidebar */}
      <aside className="sidebar" style={(impersonating || showVerifyBanner) ? { paddingTop: 'calc(1.5rem + 37px)' } : {}}>
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
          {host?.is_admin && (
            <button className="nav-item" style={{ width: '100%', marginBottom: 4, fontSize: 12 }}
              onClick={() => navigate('/admin')}>
              ⚙️ Admin
            </button>
          )}
          <button className="nav-item" style={{ width: '100%', marginBottom: 4, fontSize: 12 }}
            onClick={() => navigate('/account')}>
            👤 Account
          </button>
          <button className="nav-item" style={{ width: '100%', marginBottom: 4, fontSize: 12 }}
            onClick={() => navigate('/subscribe')}>
            💳 Billing
          </button>
          <div style={{ borderTop: '0.5px solid #f0ede8', marginTop: 8, paddingTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[['About', '/about'], ['Support', '/support'], ['Contact', '/contact']].map(([label, path]) => (
              <button key={path} onClick={() => navigate(path)}
                style={{ background: 'none', border: 'none', fontSize: 11, color: '#aaa', cursor: 'pointer', padding: '2px 4px' }}>
                {label}
              </button>
            ))}
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      <main className="main" style={(impersonating || showVerifyBanner) ? { paddingTop: 'calc(2rem + 37px)' } : {}}>
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

        {/* Disclosure */}
        <div style={{
          marginTop: 32, padding: '12px 16px',
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, fontSize: 12, color: '#92400e',
          lineHeight: 1.6, display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <span>
            <strong>Disclaimer:</strong> TollSync provides toll estimates based on AI-parsed data. Results may contain errors or omissions.
            We are not responsible for calculation inaccuracies. Always verify charges independently before billing renters.
          </span>
        </div>
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
        <button
          className={`bottom-nav-item ${['/subscribe','/support','/contact','/about','/admin'].includes(location.pathname) ? 'active' : ''}`}
          onClick={() => setShowMore(true)}
        >
          <span className="bottom-nav-icon">•••</span>
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>

      {/* More sheet */}
      {showMore && (
        <>
          <div
            onClick={() => setShowMore(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
            background: '#fff', borderRadius: '18px 18px 0 0',
            padding: '0 0 calc(16px + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 99, margin: '12px auto 4px' }} />

            {/* User info */}
            <div style={{ padding: '10px 20px 14px', borderBottom: '0.5px solid #f0ede8' }}>
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{host?.name || host?.email}</p>
              {host?.name && <p style={{ fontSize: 12, color: '#888', margin: '2px 0 0' }}>{host?.email}</p>}
            </div>

            {/* Menu items */}
            {[
              { icon: '👤', label: 'Account Settings', path: '/account' },
              { icon: '💳', label: 'Billing', path: '/subscribe' },
              { icon: '❓', label: 'Help & Support', path: '/support' },
              { icon: '💬', label: 'Chat with us', path: '/contact' },
              { icon: 'ℹ️', label: 'About TollSync', path: '/about' },
              ...(host?.is_admin ? [{ icon: '⚙️', label: 'Admin', path: '/admin' }] : []),
            ].map(item => (
              <button
                key={item.path}
                onClick={() => { setShowMore(false); navigate(item.path); }}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 20px', fontSize: 15, color: '#1a1a1a', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}

            {/* Sign out */}
            <div style={{ borderTop: '0.5px solid #f0ede8', marginTop: 4 }}>
              <button
                onClick={() => { setShowMore(false); handleLogout(); }}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 20px', fontSize: 15, color: '#e24b4a', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>↩</span>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
