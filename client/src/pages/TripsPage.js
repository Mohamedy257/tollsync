import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api/client';

function fmtDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingId, setSavingId] = useState(null);
  const fileRef = useRef();

  const load = useCallback(async () => {
    try {
      const [trRes, vehRes] = await Promise.all([
        api.get('/trips'),
        api.get('/vehicles'),
      ]);
      setTrips(trRes.data.trips);
      setVehicles(vehRes.data.vehicles);
    } catch { setError('Failed to load data'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true); setError(''); setUploadResults([]);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const res = await api.post('/upload/auto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
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
    try { await api.delete(`/trips/${id}`); setTrips(t => t.filter(x => x.id !== id)); }
    catch { setError('Failed to remove trip'); }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all trips?')) return;
    try { await api.delete('/trips'); setTrips([]); setUploadResults([]); }
    catch { setError('Failed to clear trips'); }
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({
      start_datetime: t.start_datetime ? t.start_datetime.slice(0, 16) : '',
      end_datetime: t.end_datetime ? t.end_datetime.slice(0, 16) : '',
      vehicle_id: t.vehicle_id || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (id) => {
    setSavingId(id);
    try {
      const body = {
        start_datetime: editForm.start_datetime ? new Date(editForm.start_datetime).toISOString() : undefined,
        end_datetime: editForm.end_datetime ? new Date(editForm.end_datetime).toISOString() : undefined,
        vehicle_id: editForm.vehicle_id || null,
      };
      const res = await api.patch(`/trips/${id}`, body);
      const updated = res.data.trip;
      // Find the matching vehicle name for display
      const veh = vehicles.find(v => v.id === (editForm.vehicle_id || null));
      setTrips(t => t.map(x => x.id === id ? {
        ...x,
        start_datetime: updated.start_datetime,
        end_datetime: updated.end_datetime,
        vehicle_id: updated.vehicle_id,
        vehicle: veh ? veh.name : x.vehicle,
      } : x));
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSavingId(null); }
  };

  // Sort trips by end date descending
  const sortedTrips = [...trips].sort((a, b) => new Date(b.end_datetime) - new Date(a.end_datetime));

  const registeredVehicles = vehicles.filter(v => v.transponder_id);

  const lbl = { fontSize: 12, color: '#666', marginBottom: 3, display: 'block', fontWeight: 500 };

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

      {/* Upload zone */}
      <div className="card" style={{ marginBottom: 16 }}>
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

      {sortedTrips.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontWeight: 500, margin: 0 }}>Trips</p>
            <span className="badge badge-blue">{trips.length} trip{trips.length !== 1 ? 's' : ''}</span>
          </div>

          {sortedTrips.map(t => {
            if (editingId === t.id) {
              return (
                <div key={t.id} style={{ padding: '14px 0', borderBottom: '0.5px solid #f0ede8' }}>
                  <p style={{ fontWeight: 600, margin: '0 0 10px' }}>{t.renter_name || 'Unknown renter'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 12px', marginBottom: 10 }}>
                    <div>
                      <label style={lbl}>Vehicle</label>
                      <select className="form-control" value={editForm.vehicle_id}
                        onChange={e => setEditForm(f => ({ ...f, vehicle_id: e.target.value }))}>
                        <option value="">— Unassigned —</option>
                        {registeredVehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.nickname || v.name}{v.plate ? ` · ${v.plate}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Start</label>
                      <input type="datetime-local" className="form-control"
                        value={editForm.start_datetime}
                        onChange={e => setEditForm(f => ({ ...f, start_datetime: e.target.value }))} />
                    </div>
                    <div>
                      <label style={lbl}>End</label>
                      <input type="datetime-local" className="form-control"
                        value={editForm.end_datetime}
                        onChange={e => setEditForm(f => ({ ...f, end_datetime: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => saveEdit(t.id)} disabled={savingId === t.id}>
                      {savingId === t.id ? <><span className="spinner" /> Saving...</> : 'Save'}
                    </button>
                    <button className="btn btn-sm" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              );
            }

            // Look up the vehicle by vehicle_id for display
            const linkedVehicle = t.vehicle_id ? vehicles.find(v => v.id === t.vehicle_id) : null;
            const vehicleDisplay = linkedVehicle ? (linkedVehicle.nickname || linkedVehicle.name) : (t.vehicle || '—');

            return (
              <div className="row-item" key={t.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, margin: 0 }}>{t.renter_name || 'Unknown renter'}</p>
                  <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0' }}>
                    {vehicleDisplay}
                    {!t.vehicle_id && <span style={{ color: '#f0a500', marginLeft: 6, fontSize: 11 }}>No vehicle linked</span>}
                  </p>
                  <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0' }}>
                    {fmtDt(t.start_datetime)} → {fmtDt(t.end_datetime)}
                    {t.trip_id && <> · #{t.trip_id}</>}
                  </p>
                  {t.source_file && <p style={{ fontSize: 10, color: '#ccc', margin: '2px 0 0' }}>from {t.source_file}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-sm" onClick={() => startEdit(t)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeTrip(t.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!trips.length && !uploading && (
        <div className="empty">No trips yet. Upload a screenshot, PDF, or CSV of your rental trips.</div>
      )}
    </div>
  );
}
