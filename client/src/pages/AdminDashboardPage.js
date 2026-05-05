import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  const kpis = stats ? [
    { label: 'Total Users',       value: stats.users.total,                        color: '#185fa5' },
    { label: 'New Today',         value: stats.users.today,                        color: '#7c3aed' },
    { label: 'New (7 days)',       value: stats.users.last7,                       color: '#0891b2' },
    { label: 'New (30 days)',      value: stats.users.last30,                      color: '#0891b2' },
    { label: 'Has Access',         value: stats.subscriptions.hasAccess,           color: '#16a34a' },
    { label: 'Active Subs',        value: stats.subscriptions.active,              color: '#15803d' },
    { label: 'MRR',                value: `$${stats.subscriptions.mrr}`,           color: '#15803d', big: true },
    { label: 'Free Trial',         value: stats.subscriptions.freeTrial,           color: '#f59e0b' },
    { label: 'Stripe Trial',       value: stats.subscriptions.stripeTrialing,      color: '#d97706' },
    { label: 'Past Due',           value: stats.subscriptions.pastDue,             color: stats.subscriptions.pastDue > 0 ? '#dc2626' : '#64748b' },
    { label: 'Cancelled',          value: stats.subscriptions.cancelled,           color: '#e24b4a' },
    { label: 'Total Trips',        value: stats.content.trips,                     color: '#64748b' },
    { label: 'Total Toll Records', value: stats.content.tolls,                     color: '#64748b' },
    { label: 'Unread Messages',    value: stats.unreadMessages,                    color: stats.unreadMessages > 0 ? '#e24b4a' : '#64748b' },
  ] : [];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Dashboard</h2>
          <p>Site KPIs and registration funnel.</p>
        </div>
        <button className="btn btn-sm" onClick={() => navigate('/admin')}>← Admin settings</button>
      </div>

      {loading && <p style={{ color: '#aaa', fontSize: 14 }}>Loading…</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {kpis.map(k => (
              <div key={k.label} style={{ background: '#fff', border: '1px solid #f0ede8', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color: '#999', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</p>
                <p style={{ fontSize: 26, fontWeight: 700, color: k.color, margin: 0, lineHeight: 1 }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Daily signups sparkline */}
          {stats.dailySignups?.length > 0 && (() => {
            const max = Math.max(...stats.dailySignups.map(d => d.count), 1);
            const H = 56;
            return (
              <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#888', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily signups — last 30 days</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: H + 20 }}>
                  {stats.dailySignups.map(d => (
                    <div key={d._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div title={`${d._id}: ${d.count}`} style={{
                        width: 8, height: Math.max(4, Math.round((d.count / max) * H)),
                        background: '#185fa5', borderRadius: 3, cursor: 'default',
                      }} />
                      <span style={{ fontSize: 8, color: '#ccc', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        {d._id.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Registration funnel */}
          {stats.funnel && (() => {
            const { starts, submits, completed } = stats.funnel;
            const steps = [
              { label: 'Clicked Register', value: starts,    color: '#185fa5' },
              { label: 'Submitted Form',   value: submits,   color: '#7c3aed' },
              { label: 'Completed Signup', value: completed, color: '#16a34a' },
            ];
            const max = Math.max(...steps.map(s => s.value), 1);
            return (
              <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#888', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registration funnel — last 30 days</p>
                {steps.map((s, i) => (
                  <div key={s.label} style={{ marginBottom: i < steps.length - 1 ? 14 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                      <span style={{ color: '#555' }}>{s.label}</span>
                      <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
                    </div>
                    <div style={{ height: 10, background: '#f0ede8', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((s.value / max) * 100)}%`, background: s.color, borderRadius: 99, transition: 'width 0.4s' }} />
                    </div>
                    {i < steps.length - 1 && steps[i + 1].value < s.value && (
                      <p style={{ fontSize: 11, color: '#e24b4a', margin: '4px 0 0', textAlign: 'right' }}>
                        {s.value - steps[i + 1].value} dropped off ({s.value > 0 ? Math.round(((s.value - steps[i + 1].value) / s.value) * 100) : 0}%)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Recent signups */}
          {stats.recentSignups?.length > 0 && (
            <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#888', margin: 0, padding: '12px 16px', borderBottom: '1px solid #f0ede8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent signups</p>
              {stats.recentSignups.map(u => (
                <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '0.5px solid #f5f3f0', fontSize: 13 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{u.name || u.email}</p>
                    {u.name && <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{u.email}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {(() => {
                      const onFreeTrial = u.free_trial_ends_at && new Date(u.free_trial_ends_at) > new Date() && !['active','trialing'].includes(u.subscription_status);
                      const label = onFreeTrial ? 'free trial' : (u.subscription_status || 'none');
                      const bg = label === 'active' ? '#dcfce7' : label === 'trialing' ? '#fef9c3' : label === 'free trial' ? '#fff7ed' : '#f3f4f6';
                      const color = label === 'active' ? '#16a34a' : label === 'trialing' ? '#b45309' : label === 'free trial' ? '#c2410c' : '#6b7280';
                      return (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: bg, color }}>{label}</span>
                      );
                    })()}
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: '#aaa' }}>{fmtDate(u.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
