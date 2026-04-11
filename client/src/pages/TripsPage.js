import React, { useEffect, useState, useRef } from 'react';
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

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/trips');
      setTrips(res.data.trips);
    } catch { setError('Failed to load trips'); }
  };

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true); setError(''); setUploadResults([]);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const res = await api.post('/trips/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResults(res.data.results);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeTrip = async (id) => {
    try { await api.delete(`/trips/${id}`); load(); }
    catch { setError('Failed to remove trip'); }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all trips?')) return;
    try { await api.delete('/trips'); setTrips([]); setUploadResults([]); }
    catch { setError('Failed to clear trips'); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Trips</h2>
          <p>Upload trip screenshots, PDFs, or CSV exports.</p>
        </div>
        {trips.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={clearAll}>Clear all</button>
        )}
      </div>

      <div className="card">
        <label
          className="upload-zone"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <input ref={fileRef} type="file" multiple accept=".csv,.pdf,image/*"
            onChange={e => handleFiles(e.target.files)} />
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          {uploading
            ? <><span className="spinner" style={{ margin: '0 auto 8px' }} /><p className="upload-label">Parsing with AI...</p></>
            : <><p className="upload-label">Drop trip files here or click to browse</p>
               <p className="upload-hint">Screenshots (PNG/JPG), PDF statements, CSV exports</p></>
          }
        </label>

        {uploadResults.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {uploadResults.map((r, i) => (
              <span key={i} className="file-pill">
                {r.error
                  ? <><span style={{ color: '#e24b4a' }}>✗</span> {r.file} — {r.error}</>
                  : <><span style={{ color: '#3b6d11' }}>✓</span> {r.file} <span className="badge badge-blue" style={{ marginLeft: 4 }}>{r.count} trip{r.count !== 1 ? 's' : ''}</span></>
                }
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {trips.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontWeight: 500 }}>Parsed trips</p>
            <span className="badge badge-blue">{trips.length} trip{trips.length !== 1 ? 's' : ''}</span>
          </div>
          {trips.map(t => (
            <div className="row-item" key={t.id}>
              <div>
                <p style={{ fontWeight: 500 }}>{t.renter_name || 'Unknown renter'}</p>
                <p style={{ fontSize: 12, color: '#888' }}>
                  {t.vehicle || '—'} &nbsp;·&nbsp; {fmtDt(t.start_datetime)} → {fmtDt(t.end_datetime)}
                  {t.trip_id && <> &nbsp;·&nbsp; #{t.trip_id}</>}
                </p>
                {t.source_file && <p style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>from {t.source_file}</p>}
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => removeTrip(t.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {!trips.length && !uploading && (
        <div className="empty">No trips yet. Upload a screenshot, PDF, or CSV of your rental trips.</div>
      )}
    </div>
  );
}
