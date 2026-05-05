import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_COLORS = {
  active: '#3b6d11', trialing: '#185fa5', past_due: '#c47800',
  canceled: '#e24b4a', none: '#aaa',
};

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const { impersonate } = useAuth();
  const navigate = useNavigate();

  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [trialFilter, setTrialFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);

  // Modals
  const [emailModal, setEmailModal] = useState(null);
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [trialModal, setTrialModal] = useState(null);
  const [trialDaysInput, setTrialDaysInput] = useState('7');
  const [grantingTrial, setGrantingTrial] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Per-row state
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [impersonatingId, setImpersonatingId] = useState(null);
  const [grantingId, setGrantingId] = useState(null);
  const [notifyingTrialId, setNotifyingTrialId] = useState(null);

  const lbl = { fontSize: 12, color: '#666', marginBottom: 3, display: 'block', fontWeight: 500 };

  useEffect(() => {
    api.get('/admin/subscribers')
      .then(r => setSubscribers(r.data.subscribers))
      .catch(e => setError(e.response?.data?.error || 'Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, trialFilter]);

  const filtered = subscribers.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!(s.email?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q))) return false;
    }
    if (statusFilter !== 'all' && (s.subscription_status || 'none') !== statusFilter) return false;
    if (trialFilter !== 'all') {
      const now = new Date();
      const hasTrialDate = !!s.free_trial_ends_at;
      const trialActive = hasTrialDate && new Date(s.free_trial_ends_at) > now;
      const trialExpired = hasTrialDate && new Date(s.free_trial_ends_at) <= now;
      if (trialFilter === 'active' && !trialActive) return false;
      if (trialFilter === 'expired' && !trialExpired) return false;
      if (trialFilter === 'none' && hasTrialDate) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const impersonateUser = async (id) => {
    setImpersonatingId(id);
    try { await impersonate(id); window.location.href = '/'; }
    catch (err) { setError(err.response?.data?.error || 'Failed'); setImpersonatingId(null); }
  };

  const grant = async (id) => {
    setGrantingId(id);
    try {
      await api.post(`/admin/grant/${id}`);
      setSubscribers(s => s.map(x => (x.id || x._id) === id ? { ...x, subscription_status: 'active' } : x));
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setGrantingId(null); }
  };

  const revoke = async (id) => {
    setGrantingId(id);
    try {
      await api.post(`/admin/revoke/${id}`);
      setSubscribers(s => s.map(x => (x.id || x._id) === id ? { ...x, subscription_status: 'none' } : x));
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setGrantingId(null); }
  };

  const expireTrial = async (id) => {
    try {
      await api.post(`/admin/expire-trial/${id}`);
      setSubscribers(prev => prev.map(s =>
        (s.id || s._id) === id ? { ...s, free_trial_ends_at: new Date(0).toISOString() } : s
      ));
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const notifyTrialUser = async (id) => {
    setNotifyingTrialId(id);
    try { await api.post(`/admin/notify-trial/${id}`); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setNotifyingTrialId(null); }
  };

  const grantTrialToUser = async () => {
    const days = parseInt(trialDaysInput, 10);
    if (!days || days < 1) return;
    setGrantingTrial(true);
    try {
      const res = await api.post(`/admin/grant-trial/${trialModal.id}`, { days });
      setSubscribers(prev => prev.map(s =>
        (s.id || s._id) === trialModal.id ? { ...s, free_trial_ends_at: res.data.free_trial_ends_at } : s
      ));
      setTrialModal(null);
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setGrantingTrial(false); }
  };

  const deleteUser = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/admin/users/${id}`);
      setSubscribers(s => s.filter(x => (x.id || x._id) !== id));
      setConfirmDeleteId(null);
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setDeletingId(null); }
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    setSendingEmail(true); setEmailMsg('');
    try {
      await api.post(`/admin/email/${emailModal.id}`, emailForm);
      setEmailMsg('Email sent successfully');
      setTimeout(() => { setEmailModal(null); setEmailMsg(''); setEmailForm({ subject: '', body: '' }); }, 1500);
    } catch (err) { setEmailMsg(err.response?.data?.error || 'Failed'); }
    finally { setSendingEmail(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Users</h2>
        <p>Manage all registered users.</p>
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
                  value={emailForm.subject} onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="form-group">
                <label style={lbl}>Message</label>
                <textarea className="form-control" rows={6} placeholder="Write your message..." required
                  value={emailForm.body} onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
              </div>
              {emailMsg && <p style={{ fontSize: 13, color: emailMsg.includes('success') ? '#3b6d11' : '#e24b4a', marginBottom: 10 }}>{emailMsg}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => { setEmailModal(null); setEmailMsg(''); setEmailForm({ subject: '', body: '' }); }}>Cancel</button>
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
              <button onClick={() => setTrialModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#555', margin: '0 0 16px' }}>{trialModal.name || trialModal.email}</p>
            <div className="form-group">
              <label style={lbl}>Number of days</label>
              <input className="form-control" type="number" min="1" max="365"
                value={trialDaysInput} onChange={e => setTrialDaysInput(e.target.value)} autoFocus />
              {trialDaysInput > 0 && (
                <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Access until {new Date(Date.now() + trialDaysInput * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn" onClick={() => setTrialModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={grantingTrial || !trialDaysInput || trialDaysInput < 1} onClick={grantTrialToUser}>
                {grantingTrial ? <><span className="spinner" /> Granting...</> : `Grant ${trialDaysInput || '?'} days`}
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
              This permanently deletes the account and all their data. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deletingId === confirmDeleteId} onClick={() => deleteUser(confirmDeleteId)}>
                {deletingId === confirmDeleteId ? <><span className="spinner" /> Deleting...</> : 'Yes, delete'}
              </button>
            </div>
          </div>
        </>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input
          className="form-control"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 260, fontSize: 13 }}
        />
        <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ width: 'auto', fontSize: 13 }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="none">None</option>
          <option value="past_due">Past due</option>
          <option value="canceled">Canceled</option>
        </select>
        <select className="form-control" value={trialFilter} onChange={e => setTrialFilter(e.target.value)}
          style={{ width: 'auto', fontSize: 13 }}>
          <option value="all">All trials</option>
          <option value="active">Trial active</option>
          <option value="expired">Trial expired</option>
          <option value="none">No trial</option>
        </select>
        {(search || statusFilter !== 'all' || trialFilter !== 'all') && (
          <button className="btn btn-sm" style={{ color: '#e24b4a', borderColor: '#e24b4a' }}
            onClick={() => { setSearch(''); setStatusFilter('all'); setTrialFilter('all'); }}>
            Clear filters
          </button>
        )}
        <span style={{ fontSize: 12, color: '#aaa', marginLeft: 'auto' }}>
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Users list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        {loading ? (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
            <span className="spinner spinner-lg" />
          </div>
        ) : paginated.length === 0 ? (
          <p style={{ padding: 16, color: '#aaa', fontSize: 13 }}>No users match your filters.</p>
        ) : paginated.map((s, i) => (
          <div key={s.id || s._id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderBottom: i < paginated.length - 1 ? '0.5px solid #f0ede8' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{s.name || s.email}</p>
              {s.name && <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{s.email}</p>}
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                Joined {fmtDate(s.createdAt)}
                {s.subscription_current_period_end && <> · renews {fmtDate(s.subscription_current_period_end)}</>}
                {s.free_trial_ends_at && (() => {
                  const left = Math.ceil((new Date(s.free_trial_ends_at) - new Date()) / 86400000);
                  return left > 0
                    ? <span style={{ color: '#f59e0b', marginLeft: 4 }}>· trial: {left}d left</span>
                    : <span style={{ color: '#e24b4a', marginLeft: 4 }}>· trial expired</span>;
                })()}
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', color: STATUS_COLORS[s.subscription_status] || '#aaa' }}>
              {s.subscription_status || 'none'}
            </span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              <button
                className="btn btn-sm"
                style={{ fontSize: 11, background: '#185fa5', color: '#fff', borderColor: 'transparent' }}
                disabled={impersonatingId === (s.id || s._id)}
                onClick={() => impersonateUser(s.id || s._id)}
              >
                {impersonatingId === (s.id || s._id) ? <span className="spinner" /> : '👤 View as'}
              </button>
              <div style={{ position: 'relative' }}>
                <button className="btn btn-sm" style={{ fontSize: 11 }}
                  onClick={() => setOpenDropdownId(openDropdownId === (s.id || s._id) ? null : (s.id || s._id))}>
                  Actions ▾
                </button>
                {openDropdownId === (s.id || s._id) && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenDropdownId(null)} />
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100,
                      background: '#fff', border: '1px solid #e5e3de', borderRadius: 10,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden',
                    }}>
                      {[
                        { label: '📊 View data', action: () => { navigate(`/admin/users/${s.id || s._id}`); setOpenDropdownId(null); } },
                        { label: '✉️ Send email', action: () => { setEmailModal({ id: s.id || s._id, email: s.email }); setEmailForm({ subject: '', body: '' }); setEmailMsg(''); setOpenDropdownId(null); } },
                        { label: s.subscription_status === 'active' ? '🚫 Revoke access' : '✅ Grant access', action: () => { s.subscription_status === 'active' ? revoke(s.id || s._id) : grant(s.id || s._id); setOpenDropdownId(null); } },
                        { label: '⏱ Grant trial', action: () => { setTrialModal({ id: s.id || s._id, email: s.email, name: s.name }); setTrialDaysInput('7'); setOpenDropdownId(null); } },
                        ...(s.free_trial_ends_at ? [{ label: notifyingTrialId === (s.id || s._id) ? 'Sending...' : '📧 Send trial email', action: () => { notifyTrialUser(s.id || s._id); setOpenDropdownId(null); } }] : []),
                        ...(s.free_trial_ends_at && new Date(s.free_trial_ends_at) > new Date() ? [{ label: '⏹ Expire trial', danger: true, action: () => { expireTrial(s.id || s._id); setOpenDropdownId(null); } }] : []),
                        { label: '🗑️ Delete user', danger: true, action: () => { setConfirmDeleteId(s.id || s._id); setOpenDropdownId(null); } },
                      ].map(item => (
                        <button key={item.label} onClick={item.action} style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 14px', fontSize: 13, background: 'none', border: 'none',
                          cursor: 'pointer', color: item.danger ? '#e24b4a' : '#333',
                          borderBottom: '0.5px solid #f5f3f0',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = item.danger ? '#fff5f5' : '#f8f7f4'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              className="btn btn-sm"
              style={{ minWidth: 32, fontWeight: page === p ? 700 : 400, background: page === p ? '#185fa5' : undefined, color: page === p ? '#fff' : undefined, borderColor: page === p ? 'transparent' : undefined }}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
          <button className="btn btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
