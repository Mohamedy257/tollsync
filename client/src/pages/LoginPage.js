import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function TermsModal({ onClose }) {
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
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}>
          <p><strong>1. Acceptance</strong><br />By creating an account, you agree to these Terms. If you do not agree, do not use TollSync.</p>
          <p><strong>2. Service</strong><br />TollSync helps rental car hosts calculate and track toll charges. We are not affiliated with any toll authority or rental platform.</p>
          <p><strong>3. Subscription & Billing</strong><br />Access requires an active paid subscription. Subscriptions renew monthly. You may cancel at any time through the billing portal. No refunds are provided for partial billing periods.</p>
          <p><strong>4. Data</strong><br />You are responsible for the accuracy of data you upload. TollSync uses AI to parse documents and may make errors. Always verify results before billing customers.</p>
          <p><strong>5. Privacy</strong><br />We store your account data and uploaded files to provide the service. We do not sell your data to third parties.</p>
          <p><strong>6. Liability</strong><br />TollSync is provided "as is." We are not liable for any errors in toll calculations or decisions made based on the service output.</p>
          <p><strong>7. Changes</strong><br />We may update these Terms at any time. Continued use of the service constitutes acceptance of the updated Terms.</p>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (mode === 'register' && !agreed) {
      setError('You must agree to the Terms & Conditions to create an account.');
      return;
    }
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.email, form.password, form.name);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError('');
    setAgreed(false);
  };

  return (
    <div className="auth-page">
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <div className="auth-card">
        <h1 className="auth-title">⚡ TollSync</h1>
        <p className="auth-sub">{mode === 'login' ? 'Sign in to your host account' : 'Create a host account'}</p>

        {error && <div className="alert alert-error">{error}</div>}

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
            <input className="form-control" name="password" type="password" placeholder="••••••••" value={form.password} onChange={handle} required minLength={6} />
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
          <button onClick={switchMode}
            style={{ background: 'none', border: 'none', color: '#185fa5', cursor: 'pointer', fontSize: 13 }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
