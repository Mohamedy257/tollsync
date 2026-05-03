import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function VerifyPendingPage() {
  const { host, logout, resendVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  if (!host) return <Navigate to="/login" replace />;
  if (host.email_verified !== false) return <Navigate to="/" replace />;

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
            {host.email}
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
