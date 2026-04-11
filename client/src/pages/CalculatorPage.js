import React, { useEffect, useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
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

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function TripCard({ t, reportRange }) {
  const gridRef = useRef();
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const exportImage = async (e) => {
    e.stopPropagation();
    if (!gridRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(gridRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `tolls_${(t.renter_name || 'trip').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch {}
    finally { setExporting(false); }
  };

  // Check if trip extends outside EZ-Pass report range
  let coverageWarning = null;
  if (reportRange) {
    const tripStart = new Date(t.start_datetime);
    const tripEnd = new Date(t.end_datetime);
    const reportFrom = reportRange.from ? new Date(reportRange.from) : null;
    const reportTo = reportRange.to ? new Date(reportRange.to) : null;
    const startBefore = reportFrom && tripStart < reportFrom;
    const endAfter = reportTo && tripEnd > reportTo;
    if (startBefore || endAfter) {
      coverageWarning = `Trip (${fmtDate(t.start_datetime)} – ${fmtDate(t.end_datetime)}) extends outside your EZ-Pass report range (${fmtDate(reportRange.from)} – ${fmtDate(reportRange.to)}). Toll charges may be incomplete.`;
    }
  }

  return (
    <div className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
      {coverageWarning && (
        <div style={{ background: '#faeeda', color: '#854f0b', fontSize: 12, padding: '6px 14px' }}>
          ⚠️ {coverageWarning}
        </div>
      )}

      {/* Clickable header — not captured in export */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', padding: '12px 16px', borderBottom: expanded ? '1px solid #f0ede8' : 'none', gap: 8 }}
      >
        <div>
          <p style={{ fontWeight: 600, margin: 0 }}>{t.renter_name || 'Unknown renter'}</p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2, marginBottom: 0 }}>
            {t.vehicle || '—'} &nbsp;·&nbsp; {fmtDt(t.start_datetime)} → {fmtDt(t.end_datetime)}
            {t.trip_id && <> &nbsp;·&nbsp; #{t.trip_id}</>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#185fa5', margin: 0 }}>${parseFloat(t.total_tolls).toFixed(2)}</p>
            <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{t.toll_count} charge{t.toll_count !== 1 ? 's' : ''}</p>
          </div>
          <span style={{ fontSize: 11, color: '#ccc' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expandable report — this is what gets exported */}
      {expanded && (
        <div ref={gridRef} style={{ background: '#fff', padding: '16px 16px 12px' }}>
          {/* Report header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 12, borderBottom: '2px solid #185fa5' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: '#185fa5' }}>Toll Charge Report</p>
              <p style={{ fontSize: 12, color: '#555', margin: '3px 0 0' }}>Renter: <strong>{t.renter_name || 'Unknown'}</strong></p>
              <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0' }}>Vehicle: <strong>{t.vehicle || '—'}</strong></p>
              {t.trip_id && <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0' }}>Trip #: <strong>{t.trip_id}</strong></p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Trip Start: <strong>{fmtDt(t.start_datetime)}</strong></p>
              <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0' }}>Trip End: <strong>{fmtDt(t.end_datetime)}</strong></p>
              <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0' }}>Generated: <strong>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></p>
            </div>
          </div>

          {/* Grid header */}
          {t.toll_items && t.toll_items.length > 0 ? (
            <>
              <div className="scroll-x">
                <div style={{ minWidth: 560 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px 160px 80px', gap: '4px 12px', padding: '4px 0 6px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e8e8e8' }}>
                    <span>Transponder</span><span>Location</span><span>Entry</span><span>Exit</span><span style={{ textAlign: 'right' }}>Amount</span>
                  </div>
                  {t.toll_items.map((ti, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px 160px 80px', gap: '4px 12px', padding: '7px 0', borderBottom: '0.5px solid #f0ede8', fontSize: 12, alignItems: 'start' }}>
                      <span style={{ color: '#444', fontFamily: 'monospace', fontSize: 11 }}>{ti.transponder_id || '—'}</span>
                      <span style={{ color: '#222' }}>{ti.location || '—'}</span>
                      <span style={{ color: '#666' }}>{fmtDt(ti.entry_datetime)}</span>
                      <span style={{ color: '#666' }}>{fmtDt(ti.exit_datetime)}</span>
                      <span style={{ fontWeight: 600, textAlign: 'right', color: '#222' }}>${parseFloat(ti.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, fontSize: 14, fontWeight: 700, color: '#185fa5' }}>
                Total: ${parseFloat(t.total_tolls).toFixed(2)}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>No toll charges for this trip.</p>
          )}
        </div>
      )}

      {expanded && (
        <div style={{ padding: '8px 16px 12px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f0ede8' }}>
          <button className="btn btn-sm" onClick={exportImage} disabled={exporting}>
            {exporting ? <><span className="spinner" /> Exporting...</> : '🖼 Export as image'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CalculatorPage() {
  const [trips, setTrips] = useState([]);
  const [tolls, setTolls] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [results, setResults] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [uploading, setUploading] = useState(0); // 0 = idle, N = number of files being parsed
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressTimerRef = useRef(null);
  const [uploadResults, setUploadResults] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [transponderInputs, setTransponderInputs] = useState({});
  const [plateInputs, setPlateInputs] = useState({});
  const [vehicleNameInputs, setVehicleNameInputs] = useState({}); // for vehicles with no YMM
  const [vehicleSelections, setVehicleSelections] = useState({}); // vehicleId → candidateId or 'new'
  const [tripsExpanded, setTripsExpanded] = useState(true);
  const [editingTrip, setEditingTrip] = useState(null);
  const [editDates, setEditDates] = useState({});
  const fileRef = useRef();
  const autoCalcRef = useRef(false);

  const loadAll = useCallback(async () => {
    const [tr, tl, veh] = await Promise.all([
      api.get('/trips').then(r => r.data.trips).catch(() => []),
      api.get('/ezpass').then(r => r.data.tolls).catch(() => []),
      api.get('/vehicles').then(r => r.data.vehicles).catch(() => []),
    ]);
    setTrips(tr);
    setTolls(tl);
    setVehicles(veh);
    return { trips: tr, tolls: tl, vehicles: veh };
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const calculate = useCallback(async () => {
    setCalculating(true); setCalcError('');
    try {
      const res = await api.post('/results/calculate');
      setResults(res.data);
    } catch (err) {
      setCalcError(err.response?.data?.error || 'Calculation failed');
    } finally { setCalculating(false); }
  }, []);

  const missingTransponders = vehicles.filter(v => !v.transponder_id);
  const canCalculate = trips.length > 0 && tolls.length > 0 && missingTransponders.length === 0;

  // Auto-calc when ready
  useEffect(() => {
    if (autoCalcRef.current && canCalculate && !calculating) {
      autoCalcRef.current = false;
      calculate();
    }
  }, [canCalculate, calculating, calculate]);

  const handleFiles = useCallback(async (files) => {
    if (!files || !files.length) return;
    setUploading(files.length); setUploadError(''); setUploadResults([]);
    setUploadProgress(0);
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setUploadProgress(p => p >= 90 ? 90 : p + (90 - p) * 0.06);
    }, 300);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const res = await api.post('/upload/auto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResults(res.data.results);
      const { trips: tr, tolls: tl, vehicles: veh } = await loadAll();
      const missing = veh.filter(v => !v.transponder_id);
      if (tr.length > 0 && tl.length > 0 && missing.length === 0) {
        autoCalcRef.current = true;
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally {
      clearInterval(progressTimerRef.current);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 600);
      setUploading(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [loadAll]);

  // Paste support
  useEffect(() => {
    const handler = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length) { e.preventDefault(); handleFiles(imageFiles); }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [handleFiles]);

  const clearTrips = async () => {
    if (!window.confirm('Clear all trips?')) return;
    await api.delete('/trips'); setTrips([]); setResults(null);
  };

  const deleteTrip = async (id) => {
    await api.delete(`/trips/${id}`);
    setTrips(t => t.filter(x => x.id !== id));
    setResults(null);
  };

  const saveTripDates = async (id) => {
    const dates = editDates[id];
    if (!dates) return;
    const confirmed = window.confirm(
      'You are manually adjusting trip dates.\n\nThis may cause tolls to overlap with another trip and produce inaccurate results.\n\nAre you sure you want to continue?'
    );
    if (!confirmed) return;
    const body = {};
    if (dates.start) body.start_datetime = new Date(dates.start).toISOString();
    if (dates.end) body.end_datetime = new Date(dates.end).toISOString();
    const res = await api.patch(`/trips/${id}`, body);
    setTrips(t => t.map(x => x.id === id ? { ...x, ...res.data.trip } : x));
    setEditingTrip(null);
    setResults(null);
  };

  const clearTolls = async () => {
    if (!window.confirm('Clear all toll transactions?')) return;
    await api.delete('/ezpass'); setTolls([]); setResults(null);
  };

  const [savingAll, setSavingAll] = useState(false);

  // Resolves a single vehicle — pure API call, no loadAll
  const resolveOneVehicle = async (vehicleId) => {
    const v = vehicles.find(veh => veh.id === vehicleId);
    const hasCandidates = v?.candidates && v.candidates.some(c => c.transponder_id);
    const sel = vehicleSelections[vehicleId] ?? (hasCandidates ? v.candidates.find(c => c.transponder_id)?.id : null);
    const plate = (plateInputs[vehicleId] || '').trim().toUpperCase();
    const transponder = (transponderInputs[vehicleId] || '').trim();

    const name = (vehicleNameInputs[vehicleId] || '').trim();

    if (hasCandidates && sel && sel !== 'new') {
      await api.post('/upload/resolve-vehicle', { vehicleId, targetVehicleId: sel, ...(plate ? { plate } : {}), ...(name ? { name } : {}) });
    } else {
      if (!transponder) throw new Error(`No transponder entered for vehicle ${vehicleId}`);
      await api.post('/upload/resolve-vehicle', { vehicleId, ...(plate ? { plate } : {}), transponder_id: transponder, ...(name ? { name } : {}) });
    }
    return true;
  };

  const saveAllVehicles = async () => {
    setSavingAll(true);
    try {
      // Sequential — avoid race conditions when vehicles share the same YMM
      for (const v of missingTransponders) {
        try {
          await resolveOneVehicle(v.id);
        } catch (err) {
          console.error('resolve failed for vehicle', v.id, err?.response?.data || err.message);
        }
      }
      setTransponderInputs({});
      setPlateInputs({});
      setVehicleNameInputs({});
      setVehicleSelections({});
      const { trips: tr, tolls: tl, vehicles: veh } = await loadAll();
      if (tr.length > 0 && tl.length > 0 && veh.filter(x => !x.transponder_id).length === 0) {
        autoCalcRef.current = true;
      }
    } finally { setSavingAll(false); }
  };


  const exportCSV = () => {
    if (!results?.trips) return;
    const rows = ['Renter,Vehicle,Trip Start,Trip End,Trip ID,Transponder,Location,Entry,Exit,Amount'];
    results.trips.forEach(t => {
      if (t.toll_items?.length) {
        t.toll_items.forEach(ti => rows.push([
          `"${t.renter_name || ''}"`, `"${t.vehicle || ''}"`,
          `"${t.start_datetime || ''}"`, `"${t.end_datetime || ''}"`,
          `"${t.trip_id || ''}"`, `"${ti.transponder_id || ''}"`,
          `"${ti.location || ''}"`, `"${ti.entry_datetime || ''}"`,
          `"${ti.exit_datetime || ''}"`, `"${parseFloat(ti.amount).toFixed(2)}"`,
        ].join(',')));
      } else {
        rows.push([
          `"${t.renter_name || ''}"`, `"${t.vehicle || ''}"`,
          `"${t.start_datetime || ''}"`, `"${t.end_datetime || ''}"`,
          `"${t.trip_id || ''}"`, '""', '""', '""', '""', '"0.00"',
        ].join(','));
      }
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tollsync_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const withTolls = results?.trips?.filter(t => t.toll_items?.length > 0) || [];
  const noTolls = results?.trips?.filter(t => !t.toll_items?.length) || [];
  const totalLoaded = tolls.reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div>
      <div className="page-header">
        <h2>TollSync</h2>
        <p>Upload rental trip screenshots and EZ-Pass statements — files are detected automatically.</p>
      </div>

      {/* Single upload zone */}
      <div className="card">
        <label
          className={`upload-zone${dragging ? ' upload-zone-drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        >
          <input ref={fileRef} type="file" multiple accept=".csv,.pdf,image/*"
            onChange={e => handleFiles(e.target.files)} />
          {uploading > 0
            ? (
              <div style={{ width: '100%', padding: '8px 0' }}>
                <p className="upload-label" style={{ marginBottom: 12 }}>
                  Parsing {uploading} file{uploading !== 1 ? 's' : ''} with AI...
                </p>
                <div style={{ background: '#f0ede8', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: 'linear-gradient(90deg, #185fa5, #3b9be8)',
                    width: `${uploadProgress}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <p style={{ fontSize: 12, color: '#aaa', marginTop: 6, textAlign: 'right' }}>
                  {Math.round(uploadProgress)}%
                </p>
              </div>
            )
            : <>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                <p className="upload-label">Drop files, click to browse, or paste (⌘V)</p>
                <p className="upload-hint">Trip screenshots · EZ-Pass PDF/CSV — AI detects which is which</p>
              </>
          }
        </label>

        {/* Paste button for mobile — clipboard API needed on mobile since paste event doesn't fire */}
        {uploading === 0 && navigator.clipboard?.read && (
          <button
            className="btn btn-sm"
            style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
            onClick={async (e) => {
              e.preventDefault();
              try {
                const items = await navigator.clipboard.read();
                const imageFiles = [];
                for (const item of items) {
                  for (const type of item.types) {
                    if (type.startsWith('image/')) {
                      const blob = await item.getType(type);
                      imageFiles.push(new File([blob], `pasted.${type.split('/')[1]}`, { type }));
                    }
                  }
                }
                if (imageFiles.length) handleFiles(imageFiles);
              } catch {}
            }}
          >
            📋 Paste image from clipboard
          </button>
        )}

        {uploadError && <div className="alert alert-error" style={{ marginTop: 8 }}>{uploadError}</div>}

        {uploadResults.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {uploadResults.map((r, i) => (
              <span key={i} className="file-pill">
                {r.error
                  ? <><span style={{ color: '#e24b4a' }}>✗</span> {r.file} — {r.error}</>
                  : <>
                      <span style={{ color: '#3b6d11' }}>✓</span> {r.file}
                      <span className={`badge ${r.type === 'trips' ? 'badge-blue' : 'badge-green'}`} style={{ marginLeft: 4 }}>
                        {r.type === 'trips' ? '📋' : '🛣️'} {r.count}
                      </span>
                    </>
                }
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Loaded data summary */}
      {(trips.length > 0 || tolls.length > 0) && (
        <div className="data-summary" style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
          {trips.length > 0 && (
            <div className="card" style={{ flex: 1, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tripsExpanded ? 10 : 0 }}>
                <span style={{ fontSize: 13, cursor: 'pointer' }} onClick={() => setTripsExpanded(e => !e)}>
                  <span className="badge badge-blue" style={{ marginRight: 6 }}>{trips.length}</span>
                  trip{trips.length !== 1 ? 's' : ''} <span style={{ color: '#ccc', fontSize: 11 }}>{tripsExpanded ? '▲' : '▼'}</span>
                </span>
                <button className="btn btn-sm btn-danger" onClick={clearTrips}>Clear all</button>
              </div>
              {tripsExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {trips.map(t => (
                    <div key={t.id} style={{ fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8, paddingTop: 6, borderTop: '0.5px solid #f0ede8' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{t.renter_name || 'Unknown'} <span style={{ fontWeight: 400, color: '#888' }}>· {t.vehicle || '—'}</span></div>
                        {editingTrip === t.id ? (
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <input type="datetime-local" className="form-control" style={{ fontSize: 11, padding: '3px 6px', width: 175 }}
                              value={editDates[t.id]?.start || t.start_datetime?.slice(0, 16) || ''}
                              onChange={e => setEditDates(s => ({ ...s, [t.id]: { ...s[t.id], start: e.target.value } }))} />
                            <span style={{ color: '#aaa' }}>→</span>
                            <input type="datetime-local" className="form-control" style={{ fontSize: 11, padding: '3px 6px', width: 175 }}
                              value={editDates[t.id]?.end || t.end_datetime?.slice(0, 16) || ''}
                              onChange={e => setEditDates(s => ({ ...s, [t.id]: { ...s[t.id], end: e.target.value } }))} />
                            <button className="btn btn-sm btn-primary" onClick={() => saveTripDates(t.id)}>Save</button>
                            <button className="btn btn-sm" onClick={() => setEditingTrip(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ color: '#888', marginTop: 2 }}>
                            {fmtDt(t.start_datetime)} → {fmtDt(t.end_datetime)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-sm" onClick={() => { setEditingTrip(t.id); setEditDates(s => ({ ...s, [t.id]: { start: t.start_datetime?.slice(0,16), end: t.end_datetime?.slice(0,16) } })); }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteTrip(t.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tolls.length > 0 && (
            <div className="card" style={{ display: 'inline-flex', alignSelf: 'flex-start', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', gap: 10 }}>
              <span style={{ fontSize: 13 }}>
                <span className="badge badge-green" style={{ marginRight: 6 }}>{tolls.length}</span>
                toll{tolls.length !== 1 ? 's' : ''} · <strong>${totalLoaded.toFixed(2)}</strong>
              </span>
              <button className="btn btn-sm btn-danger" onClick={clearTolls}>Clear</button>
            </div>
          )}
        </div>
      )}

      {/* Vehicle details card — grid layout */}
      {missingTransponders.length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderColor: '#f0c060', background: '#fffdf0', padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0c060', background: '#fdf6e3' }}>
            <p style={{ fontWeight: 600, fontSize: 13, color: '#854f0b', margin: 0 }}>
              ⚠️ Enter vehicle details — calculation will start automatically
            </p>
          </div>

            {/* Grid — scrollable on mobile */}
          <div className="scroll-x">
          <div style={{ minWidth: 560 }}>

          {/* Grid header */}
          {(() => {
            const anyHasCandidates = missingTransponders.some(v => v.candidates && v.candidates.some(c => c.transponder_id));
            return (
              <div style={{ display: 'grid', gridTemplateColumns: anyHasCandidates ? '220px 140px 160px 180px' : '220px 160px 180px', gap: '0 12px', padding: '8px 16px', background: '#faf6e8', borderBottom: '1px solid #f0c060', fontSize: 11, fontWeight: 700, color: '#b8860b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Vehicle (YMM) · Renter · Dates</span>
                {anyHasCandidates && <span>Which car</span>}
                <span>License Plate</span>
                <span>EZ-Pass Transponder</span>
              </div>
            );
          })()}

          {/* Grid rows */}
          {missingTransponders.map((v, idx) => {
            const vehicleTrips = trips.filter(t => t.vehicle_id === v.id);
            const hasCandidates = v.candidates && v.candidates.some(c => c.transponder_id);
            const sel = vehicleSelections[v.id] ?? (hasCandidates ? v.candidates.find(c => c.transponder_id)?.id : null);
            const needsPlate = !v.plate;

            const sameYmmRegistered = vehicles.filter(
              rv => rv.id !== v.id && rv.transponder_id && rv.name.toLowerCase() === v.name.toLowerCase()
            );
            const sessionSuggestions = missingTransponders
              .filter(mv => mv.id !== v.id && mv.name.toLowerCase() === v.name.toLowerCase())
              .map(mv => ({ plate: plateInputs[mv.id] || mv.plate || '', transponder_id: transponderInputs[mv.id] || '' }))
              .filter(s => s.plate || s.transponder_id);
            const allSuggestions = [
              ...sameYmmRegistered.map(rv => ({ plate: rv.plate, transponder_id: rv.transponder_id })),
              ...sessionSuggestions,
            ];

            const anyHasCandidates = missingTransponders.some(mv => mv.candidates && mv.candidates.some(c => c.transponder_id));
            return (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: anyHasCandidates ? '220px 140px 160px 180px' : '220px 160px 180px', gap: '0 12px', padding: '12px 16px', borderBottom: idx < missingTransponders.length - 1 ? '0.5px solid #f0e8c0' : 'none', alignItems: 'start' }}>

                {/* Col 1: YMM (input if missing) + renter + dates */}
                <div>
                  {v.name ? (
                    <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>🚗 {v.name}</p>
                  ) : (
                    <input
                      className="form-control"
                      style={{ fontSize: 12, padding: '5px 8px', marginBottom: 4 }}
                      placeholder="Year Make Model (e.g. Nissan Altima 2020)"
                      value={vehicleNameInputs[v.id] || ''}
                      onChange={e => setVehicleNameInputs(s => ({ ...s, [v.id]: e.target.value }))}
                    />
                  )}
                  {vehicleTrips.map(t => (
                    <p key={t.id} style={{ fontSize: 11, color: '#888', margin: '3px 0 0' }}>
                      {t.renter_name || 'Unknown'} · {t.start_datetime ? new Date(t.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      {' → '}{t.end_datetime ? new Date(t.end_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </p>
                  ))}
                </div>

                {/* Col 2: Candidate selection (only shown when needed) */}
                {anyHasCandidates && <div>
                  {hasCandidates ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {v.candidates.map(c => (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                          <input type="radio" name={`sel-${v.id}`} value={c.id}
                            checked={sel === c.id}
                            onChange={() => setVehicleSelections(s => ({ ...s, [v.id]: c.id }))} />
                          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.plate || 'no plate'}</span>
                        </label>
                      ))}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                        <input type="radio" name={`sel-${v.id}`} value="new"
                          checked={sel === 'new'}
                          onChange={() => setVehicleSelections(s => ({ ...s, [v.id]: 'new' }))} />
                        <span style={{ color: '#185fa5', fontSize: 11 }}>New car</span>
                      </label>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: '#ccc' }}>—</span>
                  )}
                </div>}

                {/* Col 3: License plate */}
                <div>
                  {allSuggestions.length > 0 && (
                    <datalist id={`plates-${v.id}`}>
                      {allSuggestions.filter(s => s.plate).map((s, i) => <option key={i} value={s.plate} />)}
                    </datalist>
                  )}
                  {(!hasCandidates || sel === 'new' || !sel) && needsPlate ? (
                    <input className="form-control" style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontSize: 12, padding: '5px 8px' }}
                      placeholder="ABC1234"
                      list={allSuggestions.length > 0 ? `plates-${v.id}` : undefined}
                      value={plateInputs[v.id] || ''}
                      onChange={e => setPlateInputs(s => ({ ...s, [v.id]: e.target.value.toUpperCase() }))} />
                  ) : (
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#555' }}>{v.plate || '—'}</span>
                  )}
                </div>

                {/* Col 4: Transponder */}
                <div>
                  {allSuggestions.length > 0 && (
                    <datalist id={`transponders-${v.id}`}>
                      {allSuggestions.filter(s => s.transponder_id).map((s, i) => <option key={i} value={s.transponder_id} />)}
                    </datalist>
                  )}
                  {(!hasCandidates || sel === 'new' || !sel) ? (
                    <input className="form-control" style={{ fontFamily: 'monospace', fontSize: 12, padding: '5px 8px' }}
                      placeholder="Transponder ID"
                      list={allSuggestions.length > 0 ? `transponders-${v.id}` : undefined}
                      value={transponderInputs[v.id] || ''}
                      onChange={e => setTransponderInputs(s => ({ ...s, [v.id]: e.target.value }))} />
                  ) : (
                    <span style={{ fontSize: 11, color: '#aaa' }}>Uses selected car's transponder</span>
                  )}
                </div>
              </div>
            );
          })}

          </div>{/* minWidth */}
          </div>{/* scroll-x */}

          {/* Footer with Save All */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f0c060', background: '#faf6e8' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={saveAllVehicles}
              disabled={savingAll || missingTransponders.some(v => {
                if (!v.name && !vehicleNameInputs[v.id]) return true; // YMM required
                const hc = v.candidates && v.candidates.some(c => c.transponder_id);
                const sel = vehicleSelections[v.id] ?? (hc ? v.candidates.find(c => c.transponder_id)?.id : null);
                if (hc && sel && sel !== 'new') return false;
                return !transponderInputs[v.id];
              })}
            >
              {savingAll ? <><span className="spinner" /> Saving...</> : 'Save all'}
            </button>
          </div>
        </div>
      )}

      {/* Calculate button */}
      <div style={{ marginBottom: 20 }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}
          onClick={calculate}
          disabled={calculating || !canCalculate}
        >
          {calculating
            ? <><span className="spinner" /> Calculating...</>
            : missingTransponders.length > 0
              ? '⚡ Calculate tolls — enter transponder IDs above'
              : '⚡ Calculate tolls'
          }
        </button>
        {calcError && <div className="alert alert-error" style={{ marginTop: 8 }}>{calcError}</div>}
      </div>

      {/* Results */}
      {!calculating && results && (
        <div>
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
          </div>

          {withTolls.length > 0 && (
            <>
              <p className="section-title">Trips with toll charges</p>
              {withTolls.map(t => (
                <TripCard key={t.trip_db_id} t={t} reportRange={results.report_range} />
              ))}
            </>
          )}

          {noTolls.length > 0 && (
            <>
              <p className="section-title" style={{ marginTop: '1.5rem' }}>Trips with no tolls</p>
              {noTolls.map(t => (
                <TripCard key={t.trip_db_id} t={t} reportRange={results.report_range} />
              ))}
            </>
          )}


          <div className="action-bar">
            <button className="btn" onClick={exportCSV}>⬇ Export CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}
