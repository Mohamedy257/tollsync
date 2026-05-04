import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price_cents: '', trial_days: 0, free_trial_days: 7 });
  const [stripeForm, setStripeForm] = useState({ stripe_secret_key: '', stripe_publishable_key: '', stripe_webhook_secret: '', stripe_tax_rate_id: '' });
  const [stripeStatus, setStripeStatus] = useState({ secret_set: false, webhook_set: false });
  const [oauthForm, setOauthForm] = useState({
    google_oauth_enabled: false, google_client_id: '', google_client_secret: '',
    facebook_oauth_enabled: false, facebook_app_id: '', facebook_app_secret: '',
  });
  const [oauthStatus, setOauthStatus] = useState({ google_secret_set: false, facebook_secret_set: false });
  const [savingOauth, setSavingOauth] = useState(false);
  const [oauthMsg, setOauthMsg] = useState('');
  const [contactForm, setContactForm] = useState({ whatsapp_number: '', support_email: '' });
  const [savingContact, setSavingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [termsText, setTermsText] = useState('');
  const [savingTerms, setSavingTerms] = useState(false);
  const [termsMsg, setTermsMsg] = useState('');
  const [subscribers, setSubscribers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);
  const [creatingPrice, setCreatingPrice] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [stripeMsg, setStripeMsg] = useState('');
  const [error, setError] = useState('');
  const [grantingId, setGrantingId] = useState(null);
  const [impersonatingId, setImpersonatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteAllTolls, setConfirmDeleteAllTolls] = useState(false);
  const [deletingAllTolls, setDeletingAllTolls] = useState(false);
  const [emailModal, setEmailModal] = useState(null); // { id, email }
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [expandedMsg, setExpandedMsg] = useState(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState('');
  const [trialModal, setTrialModal] = useState(null); // { id, email, name }
  const [trialDaysInput, setTrialDaysInput] = useState('7');
  const [grantingTrial, setGrantingTrial] = useState(false);

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
        free_trial_days: cfgRes.data.free_trial_days ?? 7,
      });
      setStripeForm(f => ({ ...f, stripe_publishable_key: cfgRes.data.stripe_publishable_key || '', stripe_tax_rate_id: cfgRes.data.stripe_tax_rate_id || '' }));
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
      setContactForm({
        whatsapp_number: cfgRes.data.whatsapp_number || '16673598525',
        support_email: cfgRes.data.support_email || '',
      });
      setTermsText(cfgRes.data.terms_text || '');
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
        free_trial_days: parseInt(form.free_trial_days, 10) || 0,
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
        stripe_tax_rate_id: stripeForm.stripe_tax_rate_id,
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

  const saveContact = async e => {
    e.preventDefault();
    setSavingContact(true); setContactMsg(''); setError('');
    try {
      await api.put('/admin/config', {
        whatsapp_number: contactForm.whatsapp_number,
        support_email: contactForm.support_email,
      });
      setContactMsg('Contact settings saved');
      setTimeout(() => setContactMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save contact settings');
    } finally { setSavingContact(false); }
  };

  const saveTerms = async e => {
    e.preventDefault();
    setSavingTerms(true); setTermsMsg(''); setError('');
    try {
      await api.put('/admin/config', { terms_text: termsText });
      setTermsMsg('Terms saved');
      setTimeout(() => setTermsMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save terms');
    } finally { setSavingTerms(false); }
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

  const deleteUser = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/admin/users/${id}`);
      setSubscribers(s => s.filter(x => (x.id || x._id) !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    } finally { setDeletingId(null); }
  };

  const deleteAllTolls = async () => {
    setDeletingAllTolls(true);
    try {
      const res = await api.delete('/admin/tolls');
      setConfirmDeleteAllTolls(false);
      alert(`Deleted ${res.data.deleted} toll transaction(s).`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete tolls');
    } finally { setDeletingAllTolls(false); }
  };

  const backfillTrials = async () => {
    setBackfilling(true); setBackfillMsg('');
    try {
      const res = await api.post('/admin/backfill-trials');
      setBackfillMsg(`Done — applied trial to ${res.data.updated} user(s) (${res.data.trial_days} days each)`);
    } catch (err) {
      setBackfillMsg(err.response?.data?.error || 'Failed');
    } finally { setBackfilling(false); }
  };

  const grantTrialToUser = async () => {
    const days = parseInt(trialDaysInput, 10);
    if (!days || days < 1) return;
    setGrantingTrial(true);
    try {
      const res = await api.post(`/admin/grant-trial/${trialModal.id}`, { days });
      setSubscribers(prev => prev.map(s =>
        (s.id || s._id) === trialModal.id
          ? { ...s, free_trial_ends_at: res.data.free_trial_ends_at }
          : s
      ));
      setTrialModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to grant trial');
    } finally { setGrantingTrial(false); }
  };

  const notifyTrialUsers = async () => {
    setNotifying(true); setNotifyMsg('');
    try {
      const res = await api.post('/admin/notify-trial-users');
      setNotifyMsg(`Sent ${res.data.sent} email(s)${res.data.failed > 0 ? `, ${res.data.failed} failed` : ''}`);
    } catch (err) {
      setNotifyMsg(err.response?.data?.error || 'Failed');
    } finally { setNotifying(false); }
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    setSendingEmail(true); setEmailMsg('');
    try {
      await api.post(`/admin/email/${emailModal.id}`, emailForm);
      setEmailMsg('Email sent successfully');
      setTimeout(() => { setEmailModal(null); setEmailMsg(''); setEmailForm({ subject: '', body: '' }); }, 1500);
    } catch (err) {
      setEmailMsg(err.response?.data?.error || 'Failed to send email');
    } finally { setSendingEmail(false); }
  };

  const lbl = { fontSize: 12, color: '#666', marginBottom: 3, display: 'block', fontWeight: 500 };
  const activeCount = subscribers.filter(s => s.subscription_status === 'active' || s.subscription_status === 'trialing').length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Admin</h2>
          <p>Manage plans, pricing, and subscribers.</p>
        </div>
        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteAllTolls(true)}>
          🗑 Delete all tolls
        </button>
      </div>

      {/* Send Email Modal */}
      {emailModal && (
        <>
          <div onClick={() => { setEmailModal(null); setEmailMsg(''); setEmailForm({ subject: '', body: '' }); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1001, background: '#fff', borderRadius: 16, padding: 28,
            width: '90%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>Send email to {emailModal.email}</p>
              <button onClick={() => { setEmailModal(null); setEmailMsg(''); setEmailForm({ subject: '', body: '' }); }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            <form onSubmit={sendEmail}>
              <div className="form-group">
                <label style={lbl}>Subject</label>
                <input className="form-control" placeholder="Subject" required
                  value={emailForm.subject}
                  onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="form-group">
                <label style={lbl}>Message</label>
                <textarea className="form-control" rows={6} placeholder="Write your message..." required
                  value={emailForm.body}
                  onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
              </div>
              {emailMsg && (
                <p style={{ fontSize: 13, color: emailMsg.includes('success') ? '#3b6d11' : '#e24b4a', marginBottom: 10 }}>
                  {emailMsg}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn"
                  onClick={() => { setEmailModal(null); setEmailMsg(''); setEmailForm({ subject: '', body: '' }); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={sendingEmail}>
                  {sendingEmail ? <><span className="spinner" /> Sending...</> : 'Send email'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Grant Trial Modal */}
      {trialModal && (
        <>
          <div onClick={() => setTrialModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1001, background: '#fff', borderRadius: 16, padding: 28,
            width: '90%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>Grant trial access</p>
              <button onClick={() => setTrialModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#555', margin: '0 0 16px' }}>
              {trialModal.name || trialModal.email}
            </p>
            <div className="form-group">
              <label style={lbl}>Number of days</label>
              <input
                className="form-control"
                type="number" min="1" max="365"
                value={trialDaysInput}
                onChange={e => setTrialDaysInput(e.target.value)}
                autoFocus
              />
              {trialDaysInput > 0 && (
                <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Access until {new Date(Date.now() + trialDaysInput * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setTrialModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={grantingTrial || !trialDaysInput || trialDaysInput < 1} onClick={grantTrialToUser}>
                {grantingTrial ? <><span className="spinner" /> Granting...</> : `Grant ${trialDaysInput || '?'} days`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete All Tolls Confirmation Modal */}
      {confirmDeleteAllTolls && (
        <>
          <div onClick={() => setConfirmDeleteAllTolls(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1001, background: '#fff', borderRadius: 16, padding: 28,
            width: '90%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>⚠️</p>
            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>Delete ALL toll transactions?</p>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
              This permanently deletes every toll record across all users. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn" onClick={() => setConfirmDeleteAllTolls(false)}>Cancel</button>
              <button className="btn btn-danger" disabled={deletingAllTolls} onClick={deleteAllTolls}>
                {deletingAllTolls ? <><span className="spinner" /> Deleting...</> : 'Yes, delete all'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <>
          <div onClick={() => setConfirmDeleteId(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1001, background: '#fff', borderRadius: 16, padding: 28,
            width: '90%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>⚠️</p>
            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 8px' }}>Delete this user?</p>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
              This permanently deletes the account and all their vehicles, trips, and toll data. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={deletingId === confirmDeleteId}
                onClick={() => deleteUser(confirmDeleteId)}
              >
                {deletingId === confirmDeleteId ? <><span className="spinner" /> Deleting...</> : 'Yes, delete'}
              </button>
            </div>
          </div>
        </>
      )}

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
              <label style={lbl}>Stripe trial days — 0 = no Stripe trial</label>
              <input className="form-control" type="number" min="0" value={form.trial_days}
                onChange={e => setForm(f => ({ ...f, trial_days: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Free trial days (no CC) — 0 = disabled</label>
              <input className="form-control" type="number" min="0" value={form.free_trial_days}
                onChange={e => setForm(f => ({ ...f, free_trial_days: e.target.value }))} />
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

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : 'Save plan'}
            </button>
            <button type="button" className="btn btn-sm" onClick={backfillTrials} disabled={backfilling}>
              {backfilling ? <><span className="spinner" /> Backfilling...</> : 'Apply trial to existing users'}
            </button>
            <button type="button" className="btn btn-sm" onClick={notifyTrialUsers} disabled={notifying}>
              {notifying ? <><span className="spinner" /> Sending...</> : 'Email trial users'}
            </button>
            {saveMsg && <span style={{ fontSize: 13, color: '#3b6d11' }}>{saveMsg}</span>}
            {backfillMsg && <span style={{ fontSize: 13, color: backfillMsg.startsWith('Done') ? '#3b6d11' : '#e24b4a' }}>{backfillMsg}</span>}
            {notifyMsg && <span style={{ fontSize: 13, color: notifyMsg.startsWith('Sent') ? '#3b6d11' : '#e24b4a' }}>{notifyMsg}</span>}
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
            <div>
              <label style={lbl}>Tax Rate ID (optional)</label>
              <input
                className="form-control"
                placeholder={config?.stripe_tax_rate_id || 'txr_... (leave blank for no tax)'}
                value={stripeForm.stripe_tax_rate_id || ''}
                onChange={e => setStripeForm(f => ({ ...f, stripe_tax_rate_id: e.target.value }))}
              />
              <p style={{ fontSize: 11, color: '#aaa', margin: '3px 0 0' }}>Create in Stripe → Billing → Tax Rates. Leave blank to disable tax.</p>
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

      {/* Terms & Conditions */}
      <p className="section-title">Terms &amp; Conditions</p>
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={saveTerms}>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Terms text shown to users during sign-up</label>
            <textarea
              className="form-control"
              rows={12}
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              placeholder="Enter your Terms & Conditions here. Plain text or simple paragraphs. Leave blank to use the built-in default terms."
              value={termsText}
              onChange={e => setTermsText(e.target.value)}
            />
            <p style={{ fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>
              Plain text. Use blank lines between paragraphs. Leave empty to show the built-in default terms.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={savingTerms}>
              {savingTerms ? <><span className="spinner" /> Saving...</> : 'Save terms'}
            </button>
            {termsMsg && <span style={{ fontSize: 13, color: '#3b6d11' }}>{termsMsg}</span>}
          </div>
        </form>
      </div>

      {/* Contact / support channels */}
<p className="section-title">Contact channels</p>
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={saveContact}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
            <div>
              <label style={lbl}>WhatsApp number (digits only, incl. country code)</label>
              <input className="form-control" placeholder="16673598525"
                value={contactForm.whatsapp_number}
                onChange={e => setContactForm(f => ({ ...f, whatsapp_number: e.target.value.replace(/\D/g, '') }))} />
              <p style={{ fontSize: 11, color: '#aaa', margin: '3px 0 0' }}>No + sign — e.g. 16673598525 for +1 (667) 359-8525</p>
            </div>
            <div>
              <label style={lbl}>Support email <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
              <input className="form-control" type="email" placeholder="support@yourapp.com"
                value={contactForm.support_email}
                onChange={e => setContactForm(f => ({ ...f, support_email: e.target.value }))} />
              <p style={{ fontSize: 11, color: '#aaa', margin: '3px 0 0' }}>Shown as an "Email us" option on the Contact page</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={savingContact}>
              {savingContact ? <><span className="spinner" /> Saving...</> : 'Save contact settings'}
            </button>
            {contactMsg && <span style={{ fontSize: 13, color: '#3b6d11' }}>{contactMsg}</span>}
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

      {/* Dashboard link */}
      <p className="section-title">Dashboard</p>
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>KPIs & Analytics</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Users, subscriptions, funnel, and daily signups</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/dashboard')}>View Dashboard →</button>
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
                  {s.free_trial_ends_at && (() => {
                    const left = Math.ceil((new Date(s.free_trial_ends_at) - new Date()) / 86400000);
                    return left > 0
                      ? <span style={{ color: '#f59e0b', marginLeft: 4 }}>· trial: {left}d left</span>
                      : <span style={{ color: '#e24b4a', marginLeft: 4 }}>· trial expired</span>;
                  })()}
                </p>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                color: STATUS_COLORS[s.subscription_status] || '#aaa',
              }}>
                {s.subscription_status || 'none'}
              </span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 11, background: '#185fa5', color: '#fff', borderColor: 'transparent' }}
                  disabled={impersonatingId === (s.id || s._id)}
                  onClick={() => impersonateUser(s.id || s._id)}
                  title="Log in as this user for support"
                >
                  {impersonatingId === (s.id || s._id) ? <span className="spinner" /> : '👤 View as'}
                </button>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 11 }}
                  onClick={() => { setEmailModal({ id: s.id || s._id, email: s.email }); setEmailForm({ subject: '', body: '' }); setEmailMsg(''); }}
                  title="Send email to this user"
                >
                  ✉️ Email
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
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 11 }}
                  onClick={() => { setTrialModal({ id: s.id || s._id, email: s.email, name: s.name }); setTrialDaysInput('7'); }}
                  title="Grant free trial access"
                >
                  ⏱ Trial
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  style={{ fontSize: 11 }}
                  onClick={() => setConfirmDeleteId(s.id || s._id)}
                  title="Permanently delete this user"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
