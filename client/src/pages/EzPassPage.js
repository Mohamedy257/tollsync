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

export default function EzPassPage() {
  const [tolls, setTolls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/ezpass');
      setTolls(res.data.tolls);
    } catch { setError('Failed to load toll transactions'); }
  };

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true); setError(''); setUploadResults([]);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const res = await api.post('/ezpass/upload', formData, {
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

  const removeToll = async (id) => {
    try { await api.delete(`/ezpass/${id}`); load(); }
    catch { setError('Failed to remove transaction'); }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all toll transactions?')) return;
    try { await api.delete('/ezpass'); setTolls([]); setUploadResults([]); }
    catch { setError('Failed to clear tolls'); }
  };

  const totalAmount = tolls.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>EZ-Pass</h2>
          <p>Upload your EZ-Pass statement. Matching uses Exit Date &amp; Time when available.</p>
        </div>
        {tolls.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={clearAll}>Clear all</button>
        )}
      </div>

      <div className="alert alert-info">
        Tolls are matched using <strong>Exit Date and Time</strong> when available, falling back to Entry Date and Time for single-plaza tolls.
      </div>

      <div className="card">
        <label
          className="upload-zone"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <input ref={fileRef} type="file" multiple accept=".csv,.pdf,image/*"
            onChange={e => handleFiles(e.target.files)} />
          <div style={{ fontSize: 28, marginBottom: 8 }}>🛣️</div>
          {uploading
            ? <><span className="spinner" style={{ margin: '0 auto 8px' }} /><p className="upload-label">Parsing with AI...</p></>
            : <><p className="upload-label">Drop EZ-Pass files here or click to browse</p>
               <p className="upload-hint">CSV portal export, PDF statements, screenshots — multiple files OK</p></>
          }
        </label>

        {uploadResults.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {uploadResults.map((r, i) => (
              <span key={i} className="file-pill">
                {r.error
                  ? <><span style={{ color: '#e24b4a' }}>✗</span> {r.file} — {r.error}</>
                  : <><span style={{ color: '#3b6d11' }}>✓</span> {r.file} <span className="badge badge-green" style={{ marginLeft: 4 }}>{r.count} transaction{r.count !== 1 ? 's' : ''}</span></>
                }
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {tolls.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontWeight: 500 }}>Toll transactions</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888' }}>Total: <strong>${totalAmount.toFixed(2)}</strong></span>
              <span className="badge badge-green">{tolls.length} transaction{tolls.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {tolls.map(t => (
            <div className="row-item" key={t.id}>
              <div>
                <p style={{ fontWeight: 500 }}>{t.location || 'Unknown plaza'}</p>
                <p style={{ fontSize: 12, color: '#888' }}>
                  Transponder: {t.transponder_id || '—'}
                  &nbsp;·&nbsp; Match time: {fmtDt(t.exit_datetime || t.entry_datetime)}
                </p>
                {t.exit_datetime && t.entry_datetime && (
                  <p style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                    Entry: {fmtDt(t.entry_datetime)} → Exit: {fmtDt(t.exit_datetime)}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600 }}>${parseFloat(t.amount).toFixed(2)}</span>
                <button className="btn btn-sm btn-danger" onClick={() => removeToll(t.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!tolls.length && !uploading && (
        <div className="empty">No toll transactions yet. Upload your EZ-Pass CSV, PDF, or screenshot.</div>
      )}
    </div>
  );
}
