import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS = {
  active: '#3b6d11',
  trialing: '#185fa5',
  past_due: '#c47800',
  canceled: '#e24b4a',
  none: '#aaa',
};

export default function AdminPage() {
  const { impersonate } = useAuth();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price_cents: '', trial_days: 0 });
  const [stripeForm, setStripeForm] = useState({ stripe_secret_key: '', stripe_publishable_key: '', stripe_webhook_secret: '' });
  const [stripeStatus, setStripeStatus] = useState({ secret_set: false, webhook_set: false });
  const [oauthForm, setOauthForm] = useState({
    google_oauth_enabled: false, google_client_id: '', google_client_secret: '',
    facebook_oauth_enabled: false, facebook_app_id: '', facebook_app_secret: '',
  });
  const [oauthStatus, setOauthStatus] = useState({ google_secret_set: false, facebook_secret_set: false });
  const [savingOauth, setSavingOauth] = useState(false);
  const [oauthMsg, setOauthMsg] = useState('');
  const [subscribers, setSubscribers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);
  const [creatingPrice, setCreatingPrice] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [stripeMsg, setStripeMsg] = useState('');
  const [error, setError] = useState('');
  const [grantingId, setGrantingId] = useState(null);
  const [impersonatingId, setImpersonatingId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [expandedMsg, setExpandedMsg] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [cfgRes, subRes, msgRes] = await Promise.all([
        api.get('/admin/config'),
        api.get('/admin/subscribers'),
        api.get('/admin/messages'),
      ]);
      setConfig(cfgRes.data);
      setForm({
        name: cfgRes.data.name || '',
        description: cfgRes.data.description || '',
        price_cents: cfgRes.data.price_cents || 1000,
        trial_days: cfgRes.data.trial_days ?? 0,
      });
      setStripeForm(f => ({ ...f, stripe_publishable_key: cfgRes.data.stripe_publishable_key || '' }));
      setStripeStatus({
        secret_set: cfgRes.data.stripe_secret_key_set || false,
        webhook_set: cfgRes.data.stripe_webhook_secret_set || false,
      });
      setOauthForm(f => ({
        ...f,
        google_oauth_enabled: !!cfgRes.data.google_oauth_enabled,
        google_client_id: cfgRes.data.google_client_id || '',
        facebook_oauth_enabled: !!cfgRes.data.facebook_oauth_enabled,
        facebook_app_id: cfgRes.data.facebook_app_id || '',
      }));
      setOauthStatus({
        google_secret_set: !!cfgRes.data.google_client_secret_set,
        facebook_secret_set: !!cfgRes.data.facebook_app_secret_set,
      });
      setSubscribers(subRes.data.subscribers);
      setMessages(msgRes.data.messages || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load admin data');
    }
  };

  const save = async e => {
    e.preventDefault();
    setSaving(true); setSaveMsg(''); setError('');
    try {
      const res = await api.put('/admin/config', {
        name: form.name,
        description: form.description,
        price_cents: parseInt(form.price_cents, 10),
        trial_days: parseInt(form.trial_days, 10) || 0,
      });
      setConfig(res.data.plan || res.data.config);
      setSaveMsg('Saved successfully');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const saveStripe = async e => {
    e.preventDefault();
    setSavingStripe(true); setStripeMsg(''); setError('');
    try {
      const res = await api.put('/admin/config', {
        stripe_secret_key: stripeForm.stripe_secret_key || undefined,
        stripe_publishable_key: stripeForm.stripe_publishable_key,
        stripe_webhook_secret: stripeForm.stripe_webhook_secret || undefined,
        stripe_price_id: stripeForm.stripe_price_id || undefined,
      });
      const updated = res.data.plan || res.data.config;
      setStripeStatus({
        secret_set: !!(updated?.stripe_secret_key || stripeForm.stripe_secret_key),
        webhook_set: !!(updated?.stripe_webhook_secret || stripeForm.stripe_webhook_secret),
      });
      if (stripeForm.stripe_price_id) setConfig(c => ({ ...c, stripe_price_id: stripeForm.stripe_price_id }));
      setStripeForm(f => ({ ...f, stripe_secret_key: '', stripe_webhook_secret: '', stripe_price_id: '' }));
      setStripeMsg('Stripe keys saved');
      setTimeout(() => setStripeMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save Stripe keys');
    } finally { setSavingStripe(false); }
  };

  const createPrice = async () => {
    setCreatingPrice(true); setError(''); setSaveMsg('');
    try {
      const res = await api.post('/admin/create-price');
      setConfig(c => ({ ...c, stripe_price_id: res.data.stripe_price_id }));
      setSaveMsg('Stripe price created successfully');
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create Stripe price');
    } finally { setCreatingPrice(false); }
  };

  const saveOauth = async e => {
    e.preventDefault();
    setSavingOauth(true); setOauthMsg(''); setError('');
    try {
      await api.put('/admin/config', {
        google_oauth_enabled: oauthForm.google_oauth_enabled,
        google_client_id: oauthForm.google_client_id,
        google_client_secret: oauthForm.google_client_secret || undefined,
        facebook_oauth_enabled: oauthForm.facebook_oauth_enabled,
        facebook_app_id: oauthForm.facebook_app_id,
        facebook_app_secret: oauthForm.facebook_app_secret || undefined,
      });
      if (oauthForm.google_client_secret) setOauthStatus(s => ({ ...s, google_secret_set: true }));
      if (oauthForm.facebook_app_secret) setOauthStatus(s => ({ ...s, facebook_secret_set: true }));
      setOauthForm(f => ({ ...f, google_client_secret: '', facebook_app_secret: '' }));
      setOauthMsg('OAuth settings saved');
      setTimeout(() => setOauthMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save OAuth settings');
    } finally { setSavingOauth(false); }
  };

  const impersonateUser = async (id) => {
    setImpersonatingId(id);
    try {
      await impersonate(id);
      window.location.href = '/'; // full reload so all state resets to impersonated user
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to impersonate');
      setImpersonatingId(null);
    }
  };

  const grant = async (id) => {
    setGrantingId(id);
    try {
      await api.post(`/admin/grant/${id}`);
      setSubscribers(s => s.map(x => x.id === id ? { ...x, subscription_status: 'active' } : x));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to grant');
    } finally { setGrantingId(null); }
  };

  const revoke = async (id) => {
    setGrantingId(id);
    try {
      await api.post(`/admin/revoke/${id}`);
      setSubscribers(s => s.map(x => x.id === id ? { ...x, subscription_status: 'none' } : x));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke');
    } finally { setGrantingId(null); }
  };

  const lbl = { fontSize: 12, color: '#666', marginBottom: 3, display: 'block', fontWeight: 500 };
  const activeCount = subscribers.filter(s => s.subscription_status === 'active' || s.subscription_status === 'trialing').length;

  return (
    <div>
      <div className="page-header">
        <h2>Admin</h2>
        <p>Manage plans, pricing, and subscribers.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats */}
      <div className="metrics" style={{ marginBottom: 20 }}>
        <div className="metric">
          <p className="metric-label">Total users</p>
          <p className="metric-value">{subscribers.length}</p>
        </div>
        <div className="metric">
          <p className="metric-label">Active subscribers</p>
          <p className="metric-value">{activeCount}</p>
        </div>
        <div className="metric">
          <p className="metric-label">Monthly revenue</p>
          <p className="metric-value">${((config?.price_cents || 1000) / 100 * activeCount).toFixed(2)}</p>
        </div>
      </div>

      {/* Plan config */}
      <p className="section-title">Plan configuration</p>
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
            <div>
              <label style={lbl}>Plan name</label>
              <input className="form-control" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Price (cents) — e.g. 1000 = $10.00</label>
              <input className="form-control" type="number" min="1" value={form.price_cents}
                onChange={e => setForm(f => ({ ...f, price_cents: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Free trial days — 0 = no trial</label>
              <input className="form-control" type="number" min="0" value={form.trial_days}
                onChange={e => setForm(f => ({ ...f, trial_days: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Description</label>
              <input className="form-control" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            {config?.stripe_price_id ? (
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                Active Stripe price: <code style={{ fontFamily: 'monospace' }}>{config.stripe_price_id}</code>
                {' '}— changing the price will create a new Stripe price and archive the old one.
              </p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff8e6', borderRadius: 8, border: '1px solid #f5d97a' }}>
                <span style={{ fontSize: 12, color: '#7a5c00' }}>No Stripe price configured.</span>
                <button type="button" className="btn btn-sm" onClick={createPrice} disabled={creatingPrice}>
                  {creatingPrice ? <><span className="spinner" /> Creating...</> : 'Create price in Stripe'}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : 'Save plan'}
            </button>
            {saveMsg && <span style={{ fontSize: 13, color: '#3b6d11' }}>{saveMsg}</span>}
          </div>
        </form>
      </div>

      {/* Stripe configuration */}
      <p className="section-title">Stripe configuration</p>
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={saveStripe}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
            <div>
              <label style={lbl}>
                Secret key{' '}
                {stripeStatus.secret_set && <span style={{ color: '#3b6d11', fontWeight: 600 }}>✓ configured</span>}
              </label>
              <input
                className="form-control" type="password"
                placeholder={stripeStatus.secret_set ? 'Leave blank to keep existing' : 'sk_live_...'}
                value={stripeForm.stripe_secret_key}
                onChange={e => setStripeForm(f => ({ ...f, stripe_secret_key: e.target.value }))}
              />
            </div>
            <div>
              <label style={lbl}>Publishable key</label>
              <input
                className="form-control"
                placeholder="pk_live_..."
                value={stripeForm.stripe_publishable_key}
                onChange={e => setStripeForm(f => ({ ...f, stripe_publishable_key: e.target.value }))}
              />
            </div>
            <div>
              <label style={lbl}>
                Price ID{' '}
                {config?.stripe_price_id && <span style={{ color: '#3b6d11', fontWeight: 600 }}>✓ configured</span>}
              </label>
              <input
                className="form-control"
                placeholder={config?.stripe_price_id || 'price_...'}
                value={stripeForm.stripe_price_id || ''}
                onChange={e => setStripeForm(f => ({ ...f, stripe_price_id: e.target.value }))}
              />
              <p style={{ fontSize: 11, color: '#aaa', margin: '3px 0 0' }}>Paste from Stripe dashboard, or use "Create price" below.</p>
            </div>
            <div>
              <label style={lbl}>
                Webhook secret{' '}
                {stripeStatus.webhook_set && <span style={{ color: '#3b6d11', fontWeight: 600 }}>✓ configured</span>}
              </label>
              <input
                className="form-control" type="password"
                placeholder={stripeStatus.webhook_set ? 'Leave blank to keep existing' : 'whsec_...'}
                value={stripeForm.stripe_webhook_secret}
                onChange={e => setStripeForm(f => ({ ...f, stripe_webhook_secret: e.target.value }))}
              />
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Keys are stored securely and never exposed in the UI. Leave a key field blank to keep the existing value.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={savingStripe}>
              {savingStripe ? <><span className="spinner" /> Saving...</> : 'Save Stripe keys'}
            </button>
            {stripeMsg && <span style={{ fontSize: 13, color: '#3b6d11' }}>{stripeMsg}</span>}
          </div>
        </form>
      </div>

      {/* OAuth configuration */}
      <p className="section-title">OAuth / Social Login</p>
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={saveOauth}>
          {/* Google */}
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '0.5px solid #f0ede8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <input type="checkbox" checked={oauthForm.google_oauth_enabled}
                  onChange={e => setOauthForm(f => ({ ...f, google_oauth_enabled: e.target.checked }))} />
                Enable Google Login
              </label>
            </div>
            {oauthForm.google_oauth_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 12px' }}>
                <div>
                  <label style={lbl}>Client ID</label>
                  <input className="form-control" placeholder="...apps.googleusercontent.com"
                    value={oauthForm.google_client_id}
                    onChange={e => setOauthForm(f => ({ ...f, google_client_id: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>
                    Client Secret{' '}
                    {oauthStatus.google_secret_set && <span style={{ color: '#3b6d11', fontWeight: 600 }}>✓ configured</span>}
                  </label>
                  <input className="form-control" type="password"
                    placeholder={oauthStatus.google_secret_set ? 'Leave blank to keep existing' : 'GOCSPX-...'}
                    value={oauthForm.google_client_secret}
                    onChange={e => setOauthForm(f => ({ ...f, google_client_secret: e.target.value }))} />
                </div>
              </div>
            )}
          </div>

          {/* Facebook */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <input type="checkbox" checked={oauthForm.facebook_oauth_enabled}
                  onChange={e => setOauthForm(f => ({ ...f, facebook_oauth_enabled: e.target.checked }))} />
                Enable Facebook Login
              </label>
            </div>
            {oauthForm.facebook_oauth_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 12px' }}>
                <div>
                  <label style={lbl}>App ID</label>
                  <input className="form-control" placeholder="1234567890"
                    value={oauthForm.facebook_app_id}
                    onChange={e => setOauthForm(f => ({ ...f, facebook_app_id: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>
                    App Secret{' '}
                    {oauthStatus.facebook_secret_set && <span style={{ color: '#3b6d11', fontWeight: 600 }}>✓ configured</span>}
                  </label>
                  <input className="form-control" type="password"
                    placeholder={oauthStatus.facebook_secret_set ? 'Leave blank to keep existing' : 'App secret'}
                    value={oauthForm.facebook_app_secret}
                    onChange={e => setOauthForm(f => ({ ...f, facebook_app_secret: e.target.value }))} />
                </div>
              </div>
            )}
          </div>

          <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Secrets are stored securely and never exposed in the UI. Redirect URI to register in each provider:
            {' '}<code style={{ fontFamily: 'monospace', fontSize: 11 }}>{window.location.origin.replace('3000', '3001')}/api/auth/[google|facebook]/callback</code>
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={savingOauth}>
              {savingOauth ? <><span className="spinner" /> Saving...</> : 'Save OAuth settings'}
            </button>
            {oauthMsg && <span style={{ fontSize: 13, color: '#3b6d11' }}>{oauthMsg}</span>}
          </div>
        </form>
      </div>

      {/* Contact messages */}
      <p className="section-title">
        Support messages
        {messages.filter(m => !m.read).length > 0 && (
          <span style={{ marginLeft: 8, background: '#e24b4a', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>
            {messages.filter(m => !m.read).length} new
          </span>
        )}
      </p>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        {messages.length === 0 ? (
          <p style={{ padding: 16, color: '#aaa', fontSize: 13 }}>No messages yet.</p>
        ) : messages.map((m, i) => (
          <div key={m._id || i} style={{
            borderBottom: i < messages.length - 1 ? '0.5px solid #f0ede8' : 'none',
            background: m.read ? '#fff' : '#f8f0ff',
          }}>
            <button
              onClick={async () => {
                setExpandedMsg(expandedMsg === m._id ? null : m._id);
                if (!m.read) {
                  await api.post(`/admin/messages/${m._id}/read`).catch(() => {});
                  setMessages(ms => ms.map(x => x._id === m._id ? { ...x, read: true } : x));
                }
              }}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', textAlign: 'left' }}
            >
              {!m.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#185fa5', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{m.name} <span style={{ color: '#aaa', fontWeight: 400 }}>— {m.subject}</span></p>
                  <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{fmtDate(m.createdAt)}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{m.email}</p>
              </div>
              <span style={{ fontSize: 11, color: '#ccc' }}>{expandedMsg === m._id ? '▲' : '▼'}</span>
            </button>
            {expandedMsg === m._id && (
              <div style={{ padding: '0 16px 14px 16px', borderTop: '0.5px solid #f0ede8' }}>
                <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7, margin: '12px 0 0', whiteSpace: 'pre-wrap' }}>{m.message}</p>
                <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}
                  style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#185fa5', fontWeight: 600 }}>
                  Reply via email →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Subscribers */}
      <p className="section-title">Users</p>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {subscribers.length === 0 ? (
          <p style={{ padding: 16, color: '#aaa', fontSize: 13 }}>No users yet.</p>
        ) : (
          subscribers.map((s, i) => (
            <div key={s.id || s._id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: i < subscribers.length - 1 ? '0.5px solid #f0ede8' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{s.name || s.email}</p>
                {s.name && <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{s.email}</p>}
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                  Joined {fmtDate(s.createdAt)}
                  {s.subscription_current_period_end && (
                    <> · renews {fmtDate(s.subscription_current_period_end)}</>
                  )}
                </p>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                color: STATUS_COLORS[s.subscription_status] || '#aaa',
              }}>
                {s.subscription_status || 'none'}
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 11, background: '#185fa5', color: '#fff', borderColor: 'transparent' }}
                  disabled={impersonatingId === (s.id || s._id)}
                  onClick={() => impersonateUser(s.id || s._id)}
                  title="Log in as this user for support"
                >
                  {impersonatingId === (s.id || s._id) ? <span className="spinner" /> : '👤 View as'}
                </button>
                {s.subscription_status !== 'active' ? (
                  <button className="btn btn-sm" style={{ fontSize: 11 }}
                    disabled={grantingId === (s.id || s._id)}
                    onClick={() => grant(s.id || s._id)}>
                    Grant
                  </button>
                ) : (
                  <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }}
                    disabled={grantingId === (s.id || s._id)}
                    onClick={() => revoke(s.id || s._id)}>
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
