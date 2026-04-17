import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';


export default function SubscribePage() {
  const { host, isSubscribed, refreshHost, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.get('/billing/plan').then(r => setPlan(r.data)).catch(() => {});
  }, []);

  // Handle return from Stripe (?subscribed=1)
  useEffect(() => {
    if (searchParams.get('subscribed') === '1') {
      setRefreshing(true);
      // Poll for subscription status to become active (webhook may take a moment)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const updated = await refreshHost();
        if (updated?.subscription_status === 'active' || updated?.subscription_status === 'trialing') {
          clearInterval(poll);
          setRefreshing(false);
          navigate('/');
        } else if (attempts >= 10) {
          clearInterval(poll);
          setRefreshing(false);
        }
      }, 2000);
      return () => clearInterval(poll);
    }
  }, []); // eslint-disable-line

  const subscribe = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/billing/checkout');
      window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start checkout');
      setLoading(false);
    }
  };

  const manage = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/billing/portal');
      window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open billing portal');
      setLoading(false);
    }
  };

  if (refreshing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#faf9f7' }}>
        <span className="spinner spinner-lg" style={{ marginBottom: 16 }} />
        <p style={{ color: '#555', fontSize: 15 }}>Activating your subscription...</p>
      </div>
    );
  }

  const price = plan ? `$${(plan.price_cents / 100).toFixed(2)}/mo` : '$10.00/mo';
  const trialDays = plan?.trial_days || 0;
  const alreadySubscribed = isSubscribed && !host?.is_admin;

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#185fa5', margin: 0 }}>⚡ TollSync</p>
          <p style={{ color: '#888', margin: '4px 0 0', fontSize: 14 }}>Rental toll calculator</p>
        </div>

        {alreadySubscribed ? (
          /* Already subscribed — manage billing */
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 6px' }}>You're subscribed</p>
            <p style={{ color: '#555', fontSize: 14, margin: '0 0 20px' }}>
              Status: <strong style={{ color: '#3b6d11', textTransform: 'capitalize' }}>{host.subscription_status}</strong>
              {host.subscription_current_period_end && (
                <> · renews {new Date(host.subscription_current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
              )}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/')}>Go to app</button>
              <button className="btn" onClick={manage} disabled={loading}>{loading ? 'Loading...' : 'Manage billing'}</button>
            </div>
          </div>
        ) : (
          /* Paywall */
          <div className="card" style={{ padding: 28 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <p style={{ fontWeight: 700, fontSize: 20, margin: '0 0 6px' }}>{plan?.name || 'TollSync Pro'}</p>
              <p style={{ color: '#888', fontSize: 14, margin: '0 0 16px' }}>{plan?.description || 'Unlimited toll calculations for rental hosts'}</p>
              <p style={{ fontSize: 36, fontWeight: 800, color: '#185fa5', margin: 0 }}>{price}</p>
              {trialDays > 0 && (
                <p style={{ fontSize: 13, color: '#3b6d11', fontWeight: 600, margin: '6px 0 0' }}>
                  {trialDays}-day free trial included
                </p>
              )}
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Unlimited trip calculations',
                'AI-powered file parsing',
                'Multi-vehicle support',
                'EZ-Pass matching',
                'Exportable toll reports',
              ].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#333' }}>
                  <span style={{ color: '#3b6d11', fontWeight: 700 }}>✓</span> {f}
                </li>
              ))}
            </ul>

            {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15 }}
              onClick={subscribe}
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Loading...</> : trialDays > 0 ? `Start ${trialDays}-day free trial` : `Subscribe for ${price}`}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 12 }}>
              Secure payment via Stripe · Cancel anytime
            </p>
          </div>
        )}

        {host && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 10px' }}>
              Signed in as {host.email}
            </p>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
