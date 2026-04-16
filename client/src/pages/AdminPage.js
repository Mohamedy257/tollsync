import React, { useEffect, useState } from 'react';
import api from '../api/client';

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
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price_cents: '' });
  const [subscribers, setSubscribers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');
  const [grantingId, setGrantingId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [cfgRes, subRes] = await Promise.all([
        api.get('/admin/config'),
        api.get('/admin/subscribers'),
      ]);
      setConfig(cfgRes.data);
      setForm({
        name: cfgRes.data.name || '',
        description: cfgRes.data.description || '',
        price_cents: cfgRes.data.price_cents || 1000,
      });
      setSubscribers(subRes.data.subscribers);
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
      });
      setConfig(res.data.plan || res.data.config);
      setSaveMsg('Saved successfully');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
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
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Description</label>
              <input className="form-control" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          {config?.stripe_price_id && (
            <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
              Active Stripe price: <code style={{ fontFamily: 'monospace' }}>{config.stripe_price_id}</code>
              {' '}— changing the price will create a new Stripe price and archive the old one.
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : 'Save plan'}
            </button>
            {saveMsg && <span style={{ fontSize: 13, color: '#3b6d11' }}>{saveMsg}</span>}
          </div>
        </form>
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
