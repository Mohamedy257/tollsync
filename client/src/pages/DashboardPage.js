import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function DashboardPage() {
  const { host } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ vehicles: 0, trips: 0, tolls: 0, totalCharged: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/vehicles'),
      api.get('/trips'),
      api.get('/ezpass'),
      api.get('/results').catch(() => ({ data: { total_matched: 0 } }))
    ]).then(([v, t, e, r]) => {
      setStats({
        vehicles: v.data.vehicles.length,
        trips: t.data.trips.length,
        tolls: e.data.tolls.length,
        totalCharged: parseFloat(r.data.total_matched || 0)
      });
    }).catch(() => {});
  }, []);

  const steps = [
    { icon: '🚗', label: 'Add vehicles', sub: 'Set transponder IDs for each car', done: stats.vehicles > 0, path: '/vehicles' },
    { icon: '📋', label: 'Upload trips', sub: 'Screenshots, PDFs, or CSVs of your rental trips', done: stats.trips > 0, path: '/trips' },
    { icon: '🛣️', label: 'Upload EZ-Pass', sub: 'Your toll statement for the period', done: stats.tolls > 0, path: '/ezpass' },
    { icon: '⚡', label: 'Calculate tolls', sub: 'AI matches tolls to each trip', done: stats.totalCharged > 0, path: '/results' },
  ];

  const ready = stats.vehicles > 0 && stats.trips > 0 && stats.tolls > 0;

  return (
    <div>
      <div className="page-header">
        <h2>Welcome{host?.name ? `, ${host.name}` : ''}</h2>
        <p>Match your EZ-Pass charges to rental trips automatically.</p>
      </div>

      <div className="metrics">
        <div className="metric">
          <p className="metric-label">Vehicles in fleet</p>
          <p className="metric-value">{stats.vehicles}</p>
        </div>
        <div className="metric">
          <p className="metric-label">Trips loaded</p>
          <p className="metric-value">{stats.trips}</p>
        </div>
        <div className="metric">
          <p className="metric-label">Toll transactions</p>
          <p className="metric-value">{stats.tolls}</p>
        </div>
      </div>

      <p className="section-title">Getting started</p>
      <div className="card" style={{ marginBottom: 16 }}>
        {steps.map((s, i) => (
          <div
            key={i}
            className="row-item"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(s.path)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, fontSize: 18,
                background: s.done ? '#eaf3de' : '#f0ede8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {s.done ? '✅' : s.icon}
              </div>
              <div>
                <p style={{ fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 12, color: '#888' }}>{s.sub}</p>
              </div>
            </div>
            <span style={{ color: '#ccc', fontSize: 16 }}>›</span>
          </div>
        ))}
      </div>

      {ready && (
        <div style={{ background: '#eaf3de', border: '0.5px solid #c0dd97', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 600, color: '#3b6d11' }}>Ready to calculate</p>
            <p style={{ fontSize: 13, color: '#639922', marginTop: 2 }}>All data is loaded. Run the toll matcher now.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/results')}>Calculate tolls →</button>
        </div>
      )}
    </div>
  );
}
