import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function IntegrationsPage() {
  const { host, planFeatures } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [config, setConfig] = useState({ query: '', subjectRegex: '', maxResults: 50, afterDate: '' });
  const [configDirty, setConfigDirty] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  // Private rental Stripe config
  const [rentalStripe, setRentalStripe] = useState({ publishable_key: '', secret_key: '', publishable_key_set: false, secret_key_set: false });
  const [savingRentalStripe, setSavingRentalStripe] = useState(false);
  const [rentalStripeMsg, setRentalStripeMsg] = useState('');
  const [rentalStripeError, setRentalStripeError] = useState('');

  const showRentalStripe = planFeatures?.private_rental_enabled && host?.private_rental;

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get('/integrations/gmail/status');
      setStatus(res.data);
      setConfig(res.data.config);
    } catch {}
  }, []);

  useEffect(() => {
    loadStatus();
    const gmail = searchParams.get('gmail');
    if (gmail === 'connected') {
      setSearchParams({});
      loadStatus();
    } else if (gmail === 'error') {
      setSyncError(`Gmail connection failed: ${searchParams.get('reason') || 'unknown error'}`);
      setSearchParams({});
    }
  }, [loadStatus, searchParams, setSearchParams]);

  useEffect(() => {
    if (!showRentalStripe) return;
    api.get('/auth/rental-stripe')
      .then(res => setRentalStripe(s => ({ ...s, publishable_key: res.data.publishable_key || '', publishable_key_set: res.data.publishable_key_set, secret_key_set: res.data.secret_key_set })))
      .catch(() => {});
  }, [showRentalStripe]);

  const saveRentalStripe = async e => {
    e.preventDefault();
    setSavingRentalStripe(true); setRentalStripeMsg(''); setRentalStripeError('');
    try {
      await api.put('/auth/rental-stripe', { publishable_key: rentalStripe.publishable_key, secret_key: rentalStripe.secret_key || undefined });
      setRentalStripe(s => ({ ...s, secret_key: '', publishable_key_set: !!s.publishable_key, secret_key_set: s.secret_key ? true : s.secret_key_set }));
      setRentalStripeMsg('Stripe keys saved');
      setTimeout(() => setRentalStripeMsg(''), 3000);
    } catch (err) {
      setRentalStripeError(err.response?.data?.error || 'Failed to save');
    } finally { setSavingRentalStripe(false); }
  };

  const connectGmail = async () => {
    setConnecting(true);
    try {
      const res = await api.get('/integrations/gmail/auth');
      window.location.href = res.data.url;
    } catch (err) {
      if (err.response?.status === 503) setNotConfigured(true);
      else setSyncError(err.response?.data?.error || 'Failed to start connection');
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Gmail? Synced trips will remain.')) return;
    await api.delete('/integrations/gmail/disconnect');
    setStatus(s => ({ ...s, connected: false }));
    setSyncResult(null);
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await api.put('/integrations/gmail/config', config);
      setConfig(res.data.config);
      setConfigDirty(false);
    } catch {}
    finally { setSavingConfig(false); }
  };

  const sync = async () => {
    setSyncing(true); setSyncError(''); setSyncResult(null);
    try {
      const res = await api.post('/integrations/gmail/sync');
      setSyncResult(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setStatus(s => ({ ...s, connected: false }));
        setSyncError('Gmail session expired. Please reconnect.');
      } else {
        setSyncError(err.response?.data?.error || 'Sync failed');
      }
    } finally { setSyncing(false); }
  };

  const updateConfig = (key, value) => {
    setConfig(c => ({ ...c, [key]: value }));
    setConfigDirty(true);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Integrations</h2>
        <p>Connect external services to import trip data automatically.</p>
      </div>

      {/* Gmail card */}
      <div className="card" style={{ marginBottom: 16 }}>

        {/* Card header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, background: '#fce8e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              📧
            </div>
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>Gmail</p>
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Sync rental trip emails directly from your inbox</p>
            </div>
          </div>
          <div>
            {status?.connected && (
              <span style={{ fontSize: 12, color: '#3b6d11', background: '#eaf3de', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                ● Connected
              </span>
            )}
            {status && !status.connected && (
              <span style={{ fontSize: 12, color: '#888', background: '#f0ede8', padding: '3px 10px', borderRadius: 20 }}>
                Not connected
              </span>
            )}
          </div>
        </div>

        {notConfigured && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            Gmail integration is not configured on the server. Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to your <code>server/.env</code> file. See setup instructions below.
          </div>
        )}

        {syncError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{syncError}</div>}

        {syncResult && (
          <div style={{ background: '#eaf3de', border: '0.5px solid #c0dd97', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
            ✅ Sync complete — <strong>{syncResult.synced}</strong> email{syncResult.synced !== 1 ? 's' : ''} with trips imported,{' '}
            <strong>{syncResult.skipped}</strong> skipped out of <strong>{syncResult.total}</strong> found.
            {syncResult.errors?.length > 0 && (
              <span style={{ color: '#854f0b', marginLeft: 6 }}>{syncResult.errors.length} error{syncResult.errors.length !== 1 ? 's' : ''}.</span>
            )}
          </div>
        )}

        {/* Search settings */}
        {status && (
          <div style={{ borderTop: '0.5px solid #f0ede8', paddingTop: 16, marginTop: 4 }}>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Search settings</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>
                  Gmail search query
                  <span style={{ color: '#aaa', fontWeight: 400, marginLeft: 6 }}>— same syntax as Gmail search bar</span>
                </label>
                <input
                  className="form-control"
                  value={config.query}
                  onChange={e => updateConfig('query', e.target.value)}
                  placeholder="from:noreply@mail.turo.com"
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>
                  Subject filter <span style={{ color: '#aaa', fontWeight: 400 }}>— regex (e.g. <code>is booked</code>)</span>
                </label>
                <input
                  className="form-control"
                  value={config.subjectRegex}
                  onChange={e => updateConfig('subjectRegex', e.target.value)}
                  placeholder="is booked"
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ margin: 0, flex: '1 1 140px' }}>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Max emails to fetch</label>
                  <input
                    className="form-control"
                    type="number"
                    min={1} max={10000}
                    value={config.maxResults}
                    onChange={e => updateConfig('maxResults', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, flex: '1 1 140px' }}>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Only emails after date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={config.afterDate}
                    onChange={e => updateConfig('afterDate', e.target.value)}
                  />
                </div>
              </div>
              {configDirty && (
                <div>
                  <button className="btn btn-primary btn-sm" onClick={saveConfig} disabled={savingConfig}>
                    {savingConfig ? <><span className="spinner" /> Saving...</> : 'Save settings'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, borderTop: '0.5px solid #f0ede8', paddingTop: 16 }}>
          {status?.connected ? (
            <>
              <button className="btn btn-primary" style={{ flex: '1 1 auto' }} onClick={sync} disabled={syncing}>
                {syncing ? <><span className="spinner" /> Syncing...</> : '🔄 Sync trips now'}
              </button>
              <button className="btn btn-sm btn-danger" onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <button className="btn btn-primary" style={{ flex: '1 1 auto', justifyContent: 'center' }} onClick={connectGmail} disabled={connecting}>
              {connecting ? <><span className="spinner" /> Connecting...</> : '📧 Connect Gmail'}
            </button>
          )}
        </div>
      </div>

      {/* Private Rental — Stripe configuration */}
      {showRentalStripe && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              💳
            </div>
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>Stripe — Private Rental</p>
              <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Charge renters directly via your own Stripe account</p>
            </div>
          </div>

          <form onSubmit={saveRentalStripe}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>
                  Publishable Key
                  {rentalStripe.publishable_key_set && <span style={{ color: '#3b6d11', marginLeft: 6, fontWeight: 600 }}>✓ set</span>}
                </label>
                <input
                  className="form-control"
                  placeholder="pk_live_... or pk_test_..."
                  value={rentalStripe.publishable_key}
                  onChange={e => setRentalStripe(s => ({ ...s, publishable_key: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>
                  Secret Key
                  {rentalStripe.secret_key_set && <span style={{ color: '#3b6d11', marginLeft: 6, fontWeight: 600 }}>✓ set</span>}
                </label>
                <input
                  className="form-control"
                  type="password"
                  placeholder={rentalStripe.secret_key_set ? 'Leave blank to keep existing' : 'sk_live_... or sk_test_...'}
                  value={rentalStripe.secret_key}
                  onChange={e => setRentalStripe(s => ({ ...s, secret_key: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
            </div>
            {rentalStripeError && <p style={{ fontSize: 13, color: '#e24b4a', marginBottom: 8 }}>{rentalStripeError}</p>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" type="submit" disabled={savingRentalStripe}>
                {savingRentalStripe ? <><span className="spinner" /> Saving...</> : 'Save Stripe keys'}
              </button>
              {rentalStripeMsg && <span style={{ fontSize: 13, color: '#3b6d11' }}>{rentalStripeMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Setup instructions */}
      <div className="card" style={{ background: '#fafafa' }}>
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Gmail setup instructions</p>
        <ol style={{ fontSize: 13, color: '#555', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
          <li>Go to <strong>console.cloud.google.com</strong> and create a new project</li>
          <li>Enable the <strong>Gmail API</strong> under APIs &amp; Services → Library</li>
          <li>Go to <strong>APIs &amp; Services → Credentials</strong> → Create OAuth 2.0 Client ID</li>
          <li>Application type: <strong>Web application</strong></li>
          <li>Add authorized redirect URI: <code style={{ background: '#f0ede8', padding: '1px 6px', borderRadius: 4, wordBreak: 'break-all' }}>http://localhost:3001/api/integrations/gmail/callback</code></li>
          <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into <code>server/.env</code>:</li>
        </ol>
        <pre style={{ background: '#f0ede8', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginTop: 10, overflowX: 'auto', whiteSpace: 'pre', wordBreak: 'normal' }}>
{`GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/integrations/gmail/callback
CLIENT_URL=http://localhost:3000`}
        </pre>
        <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>Restart the server after updating .env. For production, update the redirect URI to your domain.</p>
      </div>
    </div>
  );
}
