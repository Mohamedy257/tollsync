import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const DEFAULT_TERMS = `1. Acceptance
By creating an account, you agree to these Terms. If you do not agree, do not use TollSync.

2. Service
TollSync helps rental car hosts calculate and track toll charges. We are not affiliated with any toll authority or rental platform.

3. Subscription & Billing
Access requires an active paid subscription. Subscriptions renew monthly. You may cancel at any time through the billing portal. No refunds are provided for partial billing periods.

4. Data & Accuracy
You are responsible for the accuracy of data you upload. TollSync uses AI to parse documents and may make errors. Always verify results before billing customers. TollSync is not liable for any errors in toll calculations or decisions made based on the service output.

5. Privacy
We store your account data and uploaded files to provide the service. We do not sell your data to third parties.

6. Changes
We may update these Terms at any time. Continued use of the service constitutes acceptance of the updated Terms.`;

function TermsModal({ onClose }) {
  const [termsText, setTermsText] = useState('');
  useEffect(() => {
    fetch('/api/billing/plan').then(r => r.json()).then(d => {
      if (d.terms_text) setTermsText(d.terms_text);
    }).catch(() => {});
  }, []);

  const text = termsText || DEFAULT_TERMS;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%',
        maxHeight: '80vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>Terms & Conditions</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function passwordRules(pw) {
  return [
    { label: '8+ characters',         ok: pw.length >= 8 },
    { label: 'Uppercase letter',       ok: /[A-Z]/.test(pw) },
    { label: 'Lowercase letter',       ok: /[a-z]/.test(pw) },
    { label: 'Number',                 ok: /[0-9]/.test(pw) },
    { label: 'Special character',      ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState({ google: false, facebook: false });
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Show any OAuth error passed back via query string
    const err = searchParams.get('error');
    if (err) setError(decodeURIComponent(err));

    // Load which OAuth providers are enabled
    api.get('/auth/oauth-providers').then(r => setOauthProviders(r.data)).catch(() => {});
  }, []); // eslint-disable-line

  const apiBase = '/api';

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (mode === 'register' && !agreed) {
      setError('You must agree to the Terms & Conditions to create an account.');
      return;
    }
    if (mode === 'register' && !passwordRules(form.password).every(r => r.ok)) {
      setError('Password does not meet the requirements.');
      return;
    }
    if (mode === 'register') {
      api.post('/auth/funnel', { event: 'register_submit', email: form.email }).catch(() => {});
    }
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.email, form.password, form.name);
      navigate('/');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_NOT_FOUND') {
        setError('');
        setNotFound(true);
      } else {
        setNotFound(false);
        setError(err.response?.data?.error || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (forceTo) => {
    const next = forceTo || (mode === 'login' ? 'register' : 'login');
    if (next === 'register') {
      api.post('/auth/funnel', { event: 'register_start' }).catch(() => {});
    }
    setMode(next);
    setError('');
    setNotFound(false);
    setAgreed(false);
  };

  return (
    <div className="auth-page">
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <div className="auth-card">
        <h1 className="auth-title">⚡ TollSync</h1>
        <p className="auth-sub">{mode === 'login' ? 'Sign in to your host account' : 'Create a host account'}</p>

        {error && <div className="alert alert-error">{error}</div>}
        {notFound && (
          <div style={{ background: '#fff8e6', border: '1px solid #f5d97a', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: '#7a5c00', margin: '0 0 8px', fontWeight: 600 }}>No account found with that email.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ fontSize: 13 }}
              onClick={() => switchMode('register')}
            >
              Create an account →
            </button>
          </div>
        )}

        {/* OAuth buttons */}
        {(oauthProviders.google || oauthProviders.facebook) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {oauthProviders.google && (
              <a
                href={`${apiBase}/auth/google`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e3de',
                  background: '#fff', color: '#333', fontWeight: 600, fontSize: 14,
                  textDecoration: 'none', cursor: 'pointer',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.8 0 7 5.8 3.3 14.2l7.8 6.1C12.9 13.8 18 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.5 37.4 46.5 31.4 46.5 24.5z"/>
                  <path fill="#FBBC05" d="M11.1 28.3A14.7 14.7 0 0 1 9.5 24c0-1.5.3-2.9.7-4.3l-7.8-6C.9 16.6 0 20.2 0 24s.9 7.4 2.4 10.3l8.7-6z"/>
                  <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.7 2.2-7.7 2.2-6 0-11.1-4.1-12.9-9.6l-8.7 6C7 42.2 14.8 48 24 48z"/>
                </svg>
                Continue with Google
              </a>
            )}
            {oauthProviders.facebook && (
              <a
                href={`${apiBase}/auth/facebook`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e3de',
                  background: '#1877F2', color: '#fff', fontWeight: 600, fontSize: 14,
                  textDecoration: 'none', cursor: 'pointer',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
                Continue with Facebook
              </a>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e5e3de' }} />
              <span style={{ fontSize: 12, color: '#aaa' }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#e5e3de' }} />
            </div>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-group">
              <label>Name</label>
              <input className="form-control" name="name" placeholder="Your name" value={form.name} onChange={handle} />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handle} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" name="password" type="password" placeholder="••••••••" value={form.password} onChange={handle} required minLength={mode === 'register' ? 8 : 6} />
            {mode === 'register' && form.password.length > 0 && (() => {
              const rules = passwordRules(form.password);
              const passed = rules.filter(r => r.ok).length;
              const colors = ['#e24b4a', '#e24b4a', '#f59e0b', '#f59e0b', '#22c55e'];
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {rules.map((r, i) => (
                      <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i < passed ? colors[passed - 1] : '#e5e3de', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }}>
                    {rules.map((r, i) => (
                      <span key={i} style={{ fontSize: 11, color: r.ok ? '#16a34a' : '#999', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {r.ok ? '✓' : '○'} {r.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {mode === 'register' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '12px 0 16px' }}>
              <input
                type="checkbox" id="terms" checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
              />
              <label htmlFor="terms" style={{ fontSize: 13, color: '#555', cursor: 'pointer', lineHeight: 1.5 }}>
                I agree to the{' '}
                <button type="button" onClick={() => setShowTerms(true)}
                  style={{ background: 'none', border: 'none', color: '#185fa5', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
                  Terms & Conditions
                </button>
              </label>
            </div>
          )}

          <button className="btn btn-primary" type="submit"
            disabled={loading || (mode === 'register' && !agreed)}
            style={{ width: '100%', justifyContent: 'center', marginTop: mode === 'register' ? 0 : 8 }}>
            {loading ? <span className="spinner" /> : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => switchMode()}
            style={{ background: 'none', border: 'none', color: '#185fa5', cursor: 'pointer', fontSize: 13 }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
        {mode === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 4, fontSize: 13 }}>
            <button
              onClick={() => navigate('/forgot-password')}
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13 }}
            >
              Forgot password?
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
