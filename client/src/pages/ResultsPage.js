import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

function fmtDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  } catch { return iso; }
}

export default function ResultsPage() {
  const [results, setResults] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [expandedTrips, setExpandedTrips] = useState({});
  const navigate = useNavigate();

  useEffect(() => { loadSaved(); }, []);

  const loadSaved = async () => {
    try {
      const res = await api.get('/results');
      if (res.data.trips && res.data.trips.length) setResults(res.data);
    } catch { /* no saved results yet */ }
  };

  const calculate = async () => {
    setCalculating(true); setError('');
    try {
      const res = await api.post('/results/calculate');
      setResults(res.data);
      setExpandedTrips({});
    } catch (err) {
      setError(err.response?.data?.error || 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const toggleTrip = id => setExpandedTrips(prev => ({ ...prev, [id]: !prev[id] }));

  const exportCSV = () => {
    if (!results?.trips) return;
    const rows = ['Renter,Vehicle,Trip Start,Trip End,Trip ID,Toll Location,Entry DateTime,Exit DateTime,Match DateTime,Transponder,Amount'];
    results.trips.forEach(t => {
      if (t.toll_items && t.toll_items.length) {
        t.toll_items.forEach(ti => {
          rows.push([
            `"${t.renter_name || ''}"`, `"${t.vehicle || ''}"`,
            `"${t.start_datetime || ''}"`, `"${t.end_datetime || ''}"`,
            `"${t.trip_id || ''}"`, `"${ti.location || ''}"`,
            `"${ti.entry_datetime || ''}"`, `"${ti.exit_datetime || ''}"`,
            `"${ti.match_datetime || ''}"`, `"${ti.transponder_id || ''}"`,
            `"${parseFloat(ti.amount).toFixed(2)}"`
          ].join(','));
        });
      } else {
        rows.push([
          `"${t.renter_name || ''}"`, `"${t.vehicle || ''}"`,
          `"${t.start_datetime || ''}"`, `"${t.end_datetime || ''}"`,
          `"${t.trip_id || ''}"`, '""', '""', '""', '""', '""', '"0.00"'
        ].join(','));
      }
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tollsync_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const withTolls = results?.trips?.filter(t => t.toll_items && t.toll_items.length > 0) || [];
  const noTolls = results?.trips?.filter(t => !t.toll_items || t.toll_items.length === 0) || [];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Results</h2>
          <p>Per-trip toll summary matched from your EZ-Pass transactions.</p>
        </div>
        <button className="btn btn-primary" onClick={calculate} disabled={calculating}>
          {calculating ? <><span className="spinner" /> Calculating...</> : '⚡ Calculate tolls'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          {error.includes('No trips') && (
            <> — <button onClick={() => navigate('/trips')} style={{ background: 'none', border: 'none', color: '#185fa5', cursor: 'pointer', fontSize: 13 }}>Upload trips</button></>
          )}
          {error.includes('No toll') && (
            <> — <button onClick={() => navigate('/ezpass')} style={{ background: 'none', border: 'none', color: '#185fa5', cursor: 'pointer', fontSize: 13 }}>Upload EZ-Pass</button></>
          )}
        </div>
      )}

      {calculating && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <span className="spinner spinner-lg" style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: '#888', fontSize: 14 }}>Matching toll transactions to trips with AI...</p>
        </div>
      )}

      {!calculating && results && (
        <>
          <div className="metrics">
            <div className="metric">
              <p className="metric-label">Total toll charges</p>
              <p className="metric-value">${parseFloat(results.total_matched || 0).toFixed(2)}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Trips with tolls</p>
              <p className="metric-value">
                {withTolls.length}
                <span className="metric-sub">/ {results.trips.length}</span>
              </p>
            </div>
            <div className="metric">
              <p className="metric-label">Unmatched tolls</p>
              <p className="metric-value">
                {results.unmatched_tolls?.length || 0}
                {results.total_unmatched > 0 && (
                  <span className="metric-sub">${parseFloat(results.total_unmatched).toFixed(2)}</span>
                )}
              </p>
            </div>
          </div>

          {withTolls.length > 0 && (
            <>
              <p className="section-title">Trips with toll charges</p>
              {withTolls.map(t => (
                <div className="card" key={t.trip_db_id || t.id} style={{ marginBottom: 10 }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
                    onClick={() => toggleTrip(t.trip_db_id || t.id)}
                  >
                    <div>
                      <p style={{ fontWeight: 600 }}>{t.renter_name || 'Unknown renter'}</p>
                      <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {t.vehicle || '—'} &nbsp;·&nbsp; {fmtDt(t.start_datetime)} → {fmtDt(t.end_datetime)}
                        {t.trip_id && <> &nbsp;·&nbsp; #{t.trip_id}</>}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: '#185fa5' }}>${parseFloat(t.total_tolls).toFixed(2)}</p>
                        <p style={{ fontSize: 11, color: '#aaa' }}>{t.toll_count} charge{t.toll_count !== 1 ? 's' : ''}</p>
                      </div>
                      <span style={{ color: '#aaa', fontSize: 12 }}>{expandedTrips[t.trip_db_id || t.id] ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expandedTrips[t.trip_db_id || t.id] && t.toll_items && (
                    <div style={{ borderTop: '0.5px solid #f0ede8', marginTop: 10, paddingTop: 8 }}>
                      {t.toll_items.map((ti, i) => (
                        <div className="toll-line" key={i}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/ezpass?highlight=${ti.toll_db_id}`)}
                        >
                          <span>{(ti.location && !/^[-_\s.]+$/.test(ti.location.trim())) ? ti.location : 'Toll plaza'}</span>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#bbb' }}>{fmtDt(ti.exit_datetime || ti.entry_datetime)}</span>
                            <span style={{ fontWeight: 600, minWidth: 52, textAlign: 'right' }}>${parseFloat(ti.amount).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {noTolls.length > 0 && (
            <>
              <p className="section-title" style={{ marginTop: '1.5rem' }}>Trips with no tolls</p>
              <div className="card">
                {noTolls.map(t => (
                  <div className="row-item" key={t.trip_db_id || t.id}>
                    <div>
                      <p style={{ fontWeight: 500 }}>{t.renter_name || 'Unknown'}</p>
                      <p style={{ fontSize: 12, color: '#888' }}>{t.vehicle || '—'} &nbsp;·&nbsp; {fmtDt(t.start_datetime)} → {fmtDt(t.end_datetime)}</p>
                    </div>
                    <span className="badge badge-gray">$0.00</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {results.unmatched_tolls?.length > 0 && (
            <>
              <p className="section-title" style={{ marginTop: '1.5rem' }}>Unmatched toll transactions</p>
              <div className="alert alert-info">These tolls did not fall within any trip's date range or transponder match.</div>
              <div className="card">
                {results.unmatched_tolls.map((t, i) => (
                  <div className="row-item" key={i}>
                    <div>
                      <p style={{ fontWeight: 500 }}>{(t.location && !/^[-_\s.]+$/.test(t.location.trim())) ? t.location : 'Unknown plaza'}</p>
                      <p style={{ fontSize: 12, color: '#888' }}>Transponder: {t.transponder_id || '—'} &nbsp;·&nbsp; {fmtDt(t.match_datetime)}</p>
                    </div>
                    <span style={{ fontWeight: 600 }}>${parseFloat(t.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="action-bar">
            <button className="btn" onClick={exportCSV}>⬇ Export CSV</button>
          </div>
        </>
      )}

      {!calculating && !results && (
        <div className="empty">
          <p style={{ fontSize: 32, marginBottom: 12 }}>⚡</p>
          <p>Upload your trips and EZ-Pass data, then click <strong>Calculate tolls</strong>.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn" onClick={() => navigate('/trips')}>Go to Trips →</button>
            <button className="btn" onClick={() => navigate('/ezpass')}>Go to EZ-Pass →</button>
          </div>
        </div>
      )}
    </div>
  );
}
