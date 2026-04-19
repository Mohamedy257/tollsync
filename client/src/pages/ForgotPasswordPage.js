import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">⚡ TollSync</h1>
        <p className="auth-sub">Reset your password</p>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Check your email</p>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
              If an account exists for <strong>{email}</strong>, we've sent a password reset link. It expires in 1 hour.
            </p>
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/login')}>
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={submit}>
              <div className="form-group">
                <label>Email address</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              >
                {loading ? <span className="spinner" /> : 'Send reset link'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' }}>
              <button
                onClick={() => navigate('/login')}
                style={{ background: 'none', border: 'none', color: '#185fa5', cursor: 'pointer', fontSize: 13 }}
              >
                Back to sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
