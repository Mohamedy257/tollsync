import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtAmount(cents) {
  if (!cents && cents !== 0) return '—';
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const STATUS_COLORS = { active: '#16a34a', trialing: '#b45309', none: '#aaa', canceled: '#e24b4a', past_due: '#e24b4a' };

export default function AdminUserPage() {
  const { hostId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('trips');

  useEffect(() => {
    api.get(`/admin/users/${hostId}/overview`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [hostId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <span className="spinner spinner-lg" />
    </div>
  );
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const { host, stats, vehicles, trips, tolls } = data;
  const trialLeft = host.free_trial_ends_at
    ? Math.ceil((new Date(host.free_trial_ends_at) - new Date()) / 86400000)
    : null;

  const tabs = ['trips', 'tolls', 'vehicles'];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>{host.name || host.email}</h2>
          <p>{host.email} · joined {fmtDate(host.createdAt)}</p>
        </div>
        <button className="btn btn-sm" onClick={() => navigate('/admin')}>← Users</button>
      </div>

      {/* User info card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Subscription', value: host.subscription_status || 'none', color: STATUS_COLORS[host.subscription_status] || '#aaa' },
          { label: 'Trial', value: trialLeft === null ? 'none' : trialLeft > 0 ? `${trialLeft}d left` : 'expired', color: trialLeft > 0 ? '#f59e0b' : '#aaa' },
          { label: 'Vehicles', value: stats.vehicles, color: '#185fa5' },
          { label: 'Trips', value: stats.trips, color: '#7c3aed' },
          { label: 'Toll records', value: stats.tolls, color: '#0891b2' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #f0ede8', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 11, color: '#999', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: k.color, margin: 0, lineHeight: 1, textTransform: 'capitalize' }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #f0ede8' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 14px', fontSize: 13, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#185fa5' : '#888',
            borderBottom: tab === t ? '2px solid #185fa5' : '2px solid transparent',
            marginBottom: -1, textTransform: 'capitalize',
          }}>
            {t} ({t === 'trips' ? trips.length : t === 'tolls' ? tolls.length : vehicles.length})
          </button>
        ))}
      </div>

      {/* Trips tab */}
      {tab === 'trips' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {trips.length === 0 ? (
            <p style={{ padding: 16, color: '#aaa', fontSize: 13 }}>No trips yet.</p>
          ) : trips.map((t, i) => (
            <div key={t._id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: i < trips.length - 1 ? '0.5px solid #f5f3f0' : 'none',
              fontSize: 13,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{t.renter_name || 'Unknown renter'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                  {fmtDate(t.start_date)} → {fmtDate(t.end_date)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#185fa5' }}>{fmtAmount(t.toll_total_cents)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>{t.vehicle_name || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tolls tab */}
      {tab === 'tolls' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {tolls.length === 0 ? (
            <p style={{ padding: 16, color: '#aaa', fontSize: 13 }}>No toll records yet.</p>
          ) : tolls.map((t, i) => (
            <div key={t._id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: i < tolls.length - 1 ? '0.5px solid #f5f3f0' : 'none',
              fontSize: 13,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{t.plaza_name || t.location || 'Unknown plaza'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                  {fmtDate(t.transaction_date)}{t.transponder_id ? ` · ${t.transponder_id}` : ''}
                </p>
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: '#185fa5' }}>{fmtAmount(t.amount_cents)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Vehicles tab */}
      {tab === 'vehicles' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {vehicles.length === 0 ? (
            <p style={{ padding: 16, color: '#aaa', fontSize: 13 }}>No vehicles yet.</p>
          ) : vehicles.map((v, i) => (
            <div key={v._id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: i < vehicles.length - 1 ? '0.5px solid #f5f3f0' : 'none',
              fontSize: 13,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{v.name || `${v.year} ${v.make} ${v.model}`}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                  {v.nickname && <>{v.nickname} · </>}
                  Plate: {v.plate || '—'}{v.transponder_id ? ` · Transponder: ${v.transponder_id}` : ''}
                </p>
              </div>
              {v.year && <span style={{ fontSize: 11, color: '#aaa' }}>{v.year}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
