import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import api from '../api/client';
import { CAR_YEARS, CAR_MAKES, CAR_MODELS } from '../data/carData';

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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const exportImage = async (e) => {
    e.stopPropagation();
    if (!gridRef.current) return;
    setExporting(true);

    const isMobile = window.innerWidth < 768;
    // Open window synchronously inside the user-gesture handler so mobile browsers allow it
    const win = isMobile ? window.open('', '_blank') : null;

    try {
      const canvas = await html2canvas(gridRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');

      if (isMobile && win) {
        win.document.write(
          `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<title>Toll summary</title>` +
          `<style>
            *{box-sizing:border-box;margin:0;padding:0}
            body{background:#111;min-height:100vh;display:flex;flex-direction:column;}
            .bar{position:sticky;top:0;z-index:10;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
              display:flex;align-items:center;gap:12px;padding:12px 16px;}
            .back{background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:99px;
              padding:7px 16px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;}
            .hint{color:rgba(255,255,255,0.55);font-size:12px;}
            .img-wrap{display:flex;justify-content:center;padding:12px;}
            img{max-width:100%;height:auto;border-radius:4px;}
          </style></head>` +
          `<body>` +
          `<div class="bar">` +
          `<button class="back" onclick="window.close()">&#8592; Back</button>` +
          `<span class="hint">Long-press image to save</span>` +
          `</div>` +
          `<div class="img-wrap"><img src="${dataUrl}" /></div>` +
          `</body></html>`
        );
        win.document.close();
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `tolls_${(t.renter_name || 'trip').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
      }
    } catch {
      if (win) win.close();
    }
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, margin: 0 }}>{t.renter_name || 'Unknown renter'}</p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2, marginBottom: 0 }}>
            {t.vehicle || '—'}
          </p>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 1, marginBottom: 0 }}>
            {fmtDt(t.start_datetime)} → {fmtDt(t.end_datetime)}
            {t.trip_id && <> · #{t.trip_id}</>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '2px solid #185fa5' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: isMobile ? 6 : 0, marginBottom: 10 }}>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0, color: '#185fa5' }}>Toll Charge Report</p>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Generated: <strong>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '3px 0' : '3px 16px' }}>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Renter: <strong>{t.renter_name || 'Unknown'}</strong></p>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Trip Start: <strong>{fmtDt(t.start_datetime)}</strong></p>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Vehicle: <strong>{t.vehicle || '—'}</strong></p>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Trip End: <strong>{fmtDt(t.end_datetime)}</strong></p>
              {t.plate && <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Plate: <strong style={{ fontFamily: 'monospace' }}>{t.plate}</strong></p>}
              {t.trip_id && <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Trip #: <strong>{t.trip_id}</strong></p>}
            </div>
          </div>

          {/* Toll items */}
          {t.toll_items && t.toll_items.length > 0 ? (
            <>
              {isMobile ? (
                /* Mobile: one card per toll charge */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {t.toll_items.map((ti, i) => (
                    <div key={i} style={{ background: '#f8f7f4', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ color: '#222', fontWeight: 600 }}>{ti.location || '—'}</span>
                        <span style={{ fontWeight: 700, color: '#185fa5', fontSize: 14 }}>${parseFloat(ti.amount).toFixed(2)}</span>
                      </div>
                      <div style={{ color: '#666', marginBottom: 2 }}>In: {fmtDt(ti.entry_datetime)}</div>
                      <div style={{ color: '#666', marginBottom: 2 }}>Out: {fmtDt(ti.exit_datetime)}</div>
                      <div style={{ color: '#aaa', fontFamily: 'monospace', fontSize: 11 }}>{ti.transponder_id || '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
              /* Desktop: grid */
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
              )}
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
  const [vehicleNameInputs, setVehicleNameInputs] = useState({}); // legacy / fallback
  const [ymmDraft, setYmmDraft] = useState({}); // vehicleId → { year, make, model, freeformMake, freeformModel }
  const [vehicleSelections, setVehicleSelections] = useState({}); // vehicleId → candidateId or 'new'
  const [tripsExpanded, setTripsExpanded] = useState(true);
  const [editingTrip, setEditingTrip] = useState(null);
  const [editDates, setEditDates] = useState({});
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const navigate = useNavigate();
  const fileRef = useRef();
  const cameraRef = useRef();
  const autoCalcRef = useRef(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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

  // Convert HEIC/HEIF (iPhone camera format) to JPEG via canvas.
  // iOS Safari can decode HEIC natively via createImageBitmap even though
  // the Claude API doesn't accept it.
  const normalizeFile = async (file) => {
    const unsupported = ['image/heic', 'image/heif'];
    const needsConvert = unsupported.includes(file.type) || (file.type === '' && /\.(heic|heif)$/i.test(file.name));
    if (!needsConvert) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    } catch {
      return file; // fallback: upload as-is, server will surface the error
    }
  };

  const handleFiles = useCallback(async (files) => {
    if (!files || !files.length) return;
    setUploading(files.length); setUploadError(''); setUploadResults([]);
    setUploadProgress(0);
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setUploadProgress(p => p >= 90 ? 90 : p + (90 - p) * 0.06);
    }, 300);

    // Normalize HEIC → JPEG before upload
    const normalized = await Promise.all(Array.from(files).map(normalizeFile));

    const formData = new FormData();
    normalized.forEach(f => formData.append('files', f));
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
    await api.delete('/trips');
    await api.delete('/vehicles/auto-unresolved');
    setTrips([]); setResults(null);
    setVehicleSelections({}); setTransponderInputs({}); setPlateInputs({});
    setVehicleNameInputs({}); setYmmDraft({}); setSaveError('');
    setVehicles(v => v.filter(x => !x.auto_added || x.transponder_id));
    setUploadResults([]); setUploadError('');
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

  const [savingAll, setSavingAll] = useState(false);
  const [savingOne, setSavingOne] = useState({}); // vehicleId → true
  const [saveError, setSaveError] = useState('');

  // Resolves a single vehicle — pure API call, no loadAll
  const resolveOneVehicle = async (vehicleId) => {
    const v = vehicles.find(veh => veh.id === vehicleId);
    const hasCandidates = v?.candidates && v.candidates.some(c => c.transponder_id);
    const registered = vehicles.filter(rv => rv.transponder_id);
    const defaultSel = hasCandidates
      ? v.candidates.find(c => c.transponder_id)?.id
      : (!v?.name && registered.length > 0 ? registered[0].id : null);
    const sel = vehicleSelections[vehicleId] ?? defaultSel;
    const plate = (plateInputs[vehicleId] || '').trim().toUpperCase();
    const transponder = (transponderInputs[vehicleId] || '').trim();

    // Build YMM name from structured dropdowns or legacy free-form
    const draft = ymmDraft[vehicleId] || {};
    const makeName = draft.make === 'Other' ? (draft.freeformMake || '').trim() : (draft.make || '');
    const modelName = draft.model === 'Other' ? (draft.freeformModel || '').trim() : (draft.model || '');
    const ymmName = [draft.year, makeName, modelName].filter(Boolean).join(' ').trim();
    const name = ymmName || (vehicleNameInputs[vehicleId] || '').trim();

    // Use existing vehicle if one was selected from the radio list (regardless of candidates)
    if (sel && sel !== 'new') {
      await api.post('/upload/resolve-vehicle', { vehicleId, targetVehicleId: sel, ...(plate ? { plate } : {}), ...(name ? { name } : {}) });
    } else {
      if (!transponder) throw new Error(`No transponder entered for vehicle ${vehicleId}`);
      await api.post('/upload/resolve-vehicle', { vehicleId, ...(plate ? { plate } : {}), transponder_id: transponder, ...(name ? { name } : {}) });
    }
    return true;
  };

  const saveAllVehicles = async () => {
    setSavingAll(true);
    setSaveError('');
    const errors = [];
    try {
      for (const v of missingTransponders) {
        try {
          await resolveOneVehicle(v.id);
        } catch (err) {
          const msg = err?.response?.data?.error || err.message || 'Unknown error';
          errors.push(`${v.name || 'Vehicle'}: ${msg}`);
        }
      }
      if (errors.length) {
        setSaveError(errors.join(' · '));
      }
      setTransponderInputs({});
      setPlateInputs({});
      setVehicleNameInputs({});
      setVehicleSelections({});
      setYmmDraft({});
      const { trips: tr, tolls: tl, vehicles: veh } = await loadAll();
      if (tr.length > 0 && tl.length > 0 && veh.filter(x => !x.transponder_id).length === 0) {
        autoCalcRef.current = true;
      }
    } finally { setSavingAll(false); }
  };

  const saveOneVehicle = async (vehicleId) => {
    setSavingOne(s => ({ ...s, [vehicleId]: true }));
    setSaveError('');
    try {
      await resolveOneVehicle(vehicleId);
      setTransponderInputs(s => { const n = { ...s }; delete n[vehicleId]; return n; });
      setPlateInputs(s => { const n = { ...s }; delete n[vehicleId]; return n; });
      setVehicleSelections(s => { const n = { ...s }; delete n[vehicleId]; return n; });
      setYmmDraft(s => { const n = { ...s }; delete n[vehicleId]; return n; });
      const { trips: tr, tolls: tl, vehicles: veh } = await loadAll();
      if (tr.length > 0 && tl.length > 0 && veh.filter(x => !x.transponder_id).length === 0) {
        autoCalcRef.current = true;
      }
    } catch (err) {
      setSaveError(err?.response?.data?.error || err.message || 'Failed to save vehicle');
    } finally {
      setSavingOne(s => { const n = { ...s }; delete n[vehicleId]; return n; });
    }
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

  const byDateDesc = (a, b) => new Date(b.start_datetime) - new Date(a.start_datetime);
  const withTolls = (results?.trips?.filter(t => t.toll_items?.length > 0) || []).sort(byDateDesc);
  const noTolls = (results?.trips?.filter(t => !t.toll_items?.length) || []).sort(byDateDesc);
  const totalLoaded = tolls.reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div>
      {/* Hero banner */}
      <div style={{
        background: 'linear-gradient(135deg, #185fa5 0%, #1577d4 100%)',
        borderRadius: 14,
        padding: '14px 18px',
        marginBottom: 20,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        {/* Row 1: icon + title + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>TollSync</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginLeft: 2 }}>Rental toll calculator</span>
        </div>
        {/* Row 2: feature chips */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {['📸 Trip screenshots', '📄 EZ-Pass PDFs & CSVs', '⚡ Auto-matched tolls'].map(label => (
            <span key={label} style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{label}</span>
          ))}
        </div>
      </div>

      {/* Mobile action sheet */}
      {showActionSheet && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowActionSheet(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
              zIndex: 1000, touchAction: 'none',
            }}
          />
          {/* Sheet */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
            background: '#fff', borderRadius: '16px 16px 0 0',
            padding: '12px 16px 32px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 99, margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, textAlign: 'center' }}>Add files</p>

            {/* Browse library — label wraps input so tap is a direct user gesture (iOS-safe).
                Do NOT call setShowActionSheet(false) on click — that unmounts the input before
                the user finishes picking, causing onChange to fire on a dead element. */}
            <label
              className="btn"
              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8, fontSize: 15, padding: '12px 16px', borderRadius: 12, cursor: 'pointer' }}
            >
              <input type="file" multiple accept=".csv,.pdf,image/*" style={{ display: 'none' }}
                onChange={e => { setShowActionSheet(false); handleFiles(e.target.files); }} />
              📁 &nbsp; Choose from library
            </label>

            {/* Take photo — same pattern with capture */}
            <label
              className="btn"
              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8, fontSize: 15, padding: '12px 16px', borderRadius: 12, cursor: 'pointer' }}
            >
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => { setShowActionSheet(false); handleFiles(e.target.files); }} />
              📷 &nbsp; Take photo
            </label>

            {/* Paste from clipboard */}
            {navigator.clipboard?.read && (
              <button
                className="btn"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8, fontSize: 15, padding: '12px 16px', borderRadius: 12 }}
                onClick={async () => {
                  setShowActionSheet(false);
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
                📋 &nbsp; Paste from clipboard
              </button>
            )}

            <button
              className="btn btn-sm"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4, color: '#888' }}
              onClick={() => setShowActionSheet(false)}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Single upload zone */}
      <div className="card">
        {/* Hidden camera input (mobile only) */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />

        <label
          className={`upload-zone${dragging ? ' upload-zone-drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={isMobile && uploading === 0 ? e => { e.preventDefault(); setShowActionSheet(true); } : undefined}
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
                {isMobile
                  ? <>
                      <p className="upload-label">Tap to add files</p>
                      <p className="upload-hint">Choose from library, take photo, or paste</p>
                    </>
                  : <>
                      <p className="upload-label">Drop files, click to browse, or paste (⌘V)</p>
                      <p className="upload-hint">Trip screenshots · EZ-Pass PDF/CSV — AI detects which is which</p>
                    </>
                }
              </>
          }
        </label>

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

      {/* ── Onboarding steps (shown only when no trips yet) ── */}
      {trips.length === 0 && !results && (() => {
        const steps = [
          {
            n: 1, icon: '📸', title: 'Upload trip screenshots',
            desc: 'Take a screenshot of your Turo trip list and upload it above.',
            done: false, active: true, action: null,
          },
          {
            n: 2, icon: '🛣️', title: 'Upload your EZ-Pass statement',
            desc: tolls.length > 0
              ? `${tolls.length} toll record${tolls.length !== 1 ? 's' : ''} already loaded.`
              : 'Go to Toll Records and upload your EZ-Pass PDF, CSV, or screenshots.',
            done: tolls.length > 0, active: false,
            action: { label: tolls.length > 0 ? 'View records' : 'Go to Toll Records', path: '/tolls' },
          },
          {
            n: 3, icon: '⚡', title: 'Calculate tolls',
            desc: 'Once trips and toll records are loaded, hit Calculate.',
            done: false, active: false, action: null,
          },
        ];
        return (
          <div style={{ marginBottom: 20 }}>
            {steps.map((s, i) => (
              <div key={s.n} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 0',
                borderBottom: i < steps.length - 1 ? '0.5px solid #f0ede8' : 'none',
                opacity: s.active || s.done ? 1 : 0.38,
              }}>
                {/* Step circle */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  background: s.done ? '#eaf3de' : s.active ? '#185fa5' : '#f0ede8',
                  color: s.done ? '#3b6d11' : s.active ? '#fff' : '#aaa',
                  fontWeight: 700,
                }}>
                  {s.done ? '✓' : s.n}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: '2px 0 3px', color: s.active || s.done ? '#1a1a1a' : '#aaa' }}>
                    {s.icon} {s.title}
                  </p>
                  <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{s.desc}</p>
                </div>

                {/* Action */}
                {s.action && (
                  <button
                    className="btn btn-sm"
                    style={{ flexShrink: 0, ...(s.done ? {} : { background: '#185fa5', color: '#fff', borderColor: 'transparent' }) }}
                    onClick={() => navigate(s.action.path)}
                  >
                    {s.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })()}

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
            <div className="card" style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '8px 12px' }}>
              <span style={{ fontSize: 13 }}>
                <span className="badge badge-green" style={{ marginRight: 6 }}>{tolls.length}</span>
                toll{tolls.length !== 1 ? 's' : ''} · <strong>${totalLoaded.toFixed(2)}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Vehicle details card */}
      {missingTransponders.length > 0 && (() => {
        const anyHasCandidates = missingTransponders.some(v => v.candidates && v.candidates.some(c => c.transponder_id));
        const cols = anyHasCandidates ? '220px 140px 160px 180px 80px' : '220px 160px 180px 80px';

        const saveDisabled = savingAll || missingTransponders.some(v => {
          const sel = getEffectiveSel(v);
          if (sel && sel !== 'new') return false; // user picked an existing vehicle — no transponder needed
          if (!v.name) {
            const draft = ymmDraft[v.id] || {};
            const makeName = draft.make === 'Other' ? (draft.freeformMake || '').trim() : (draft.make || '');
            const modelName = draft.model === 'Other' ? (draft.freeformModel || '').trim() : (draft.model || '');
            if (!draft.year || !makeName || !modelName) return true;
          }
          return !transponderInputs[v.id];
        });

        // All registered vehicles for the blank-name picker
        const registeredVehicles = vehicles.filter(rv => rv.transponder_id);

        // Compute the effective default selection for a vehicle —
        // mirrors the same logic used in renderYMM / renderWhichCar
        const getEffectiveSel = (v) => {
          const hc = v.candidates && v.candidates.some(c => c.transponder_id);
          const defaultSel = hc
            ? v.candidates.find(c => c.transponder_id)?.id
            : (!v.name && registeredVehicles.length > 0 ? registeredVehicles[0].id : null);
          return vehicleSelections[v.id] ?? defaultSel;
        };

        // Returns true when an existing registered vehicle is selected (or defaulted to)
        const isExistingSelected = (v) => {
          const sel = getEffectiveSel(v);
          return !!(sel && sel !== 'new');
        };

        // Shared field renderers
        const renderYMM = (v) => {
          if (v.name) return <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>🚗 {v.name}</p>;

          // No name detected — let user pick existing registered vehicle or add new via dropdowns
          const sel = getEffectiveSel(v);
          const showDropdowns = !registeredVehicles.length || sel === 'new';

          const draft = ymmDraft[v.id] || {};
          const setDraft = (patch) => setYmmDraft(s => ({ ...s, [v.id]: { ...(s[v.id] || {}), ...patch } }));
          const availableModels = draft.make && draft.make !== 'Other' ? (CAR_MODELS[draft.make] || []) : [];

          // Renter names for this unidentified vehicle
          const vehicleTrips = trips.filter(t => t.vehicle_id === v.id);
          const renterNames = [...new Set(vehicleTrips.map(t => t.renter_name).filter(Boolean))];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {/* Guest name badge — shown prominently so user knows who they're assigning */}
              {renterNames.length > 0 && (
                <div style={{ background: '#185fa5', borderRadius: 8, padding: '8px 12px', marginBottom: 2 }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Guest</p>
                  {renterNames.map(n => <p key={n} style={{ fontSize: 14, color: '#fff', fontWeight: 700, margin: 0 }}>{n}</p>)}
                </div>
              )}
              <p style={{ fontSize: 11, color: '#888', margin: 0 }}>Which vehicle did this guest use?</p>
              {registeredVehicles.map(rv => (
                <label key={rv.id} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12 }}>
                  <input type="radio" name={`vymm-${v.id}`} value={rv.id}
                    checked={sel === rv.id}
                    onChange={() => setVehicleSelections(s => ({ ...s, [v.id]: rv.id }))} />
                  <span style={{ fontWeight: 500 }}>{rv.nickname || rv.name}</span>
                  {rv.nickname && <span style={{ fontSize: 11, color: '#888' }}>{rv.name}</span>}
                  {rv.plate && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{rv.plate}</span>}
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12 }}>
                <input type="radio" name={`vymm-${v.id}`} value="new"
                  checked={sel === 'new' || (!sel && !registeredVehicles.length)}
                  onChange={() => setVehicleSelections(s => ({ ...s, [v.id]: 'new' }))} />
                <span style={{ color: '#185fa5' }}>+ New vehicle</span>
              </label>

              {showDropdowns && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
                  {/* Year */}
                  <select className="form-control" style={{ fontSize: 12 }}
                    value={draft.year || ''}
                    onChange={e => setDraft({ year: e.target.value })}>
                    <option value="">Year</option>
                    {CAR_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>

                  {/* Make */}
                  <select className="form-control" style={{ fontSize: 12 }}
                    value={draft.make || ''}
                    onChange={e => setDraft({ make: e.target.value, model: '', freeformMake: '', freeformModel: '' })}>
                    <option value="">Make</option>
                    {CAR_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>

                  {/* Free-form make (when Other selected) */}
                  {draft.make === 'Other' && (
                    <input className="form-control" style={{ fontSize: 12 }}
                      placeholder="Enter make"
                      value={draft.freeformMake || ''}
                      onChange={e => setDraft({ freeformMake: e.target.value })} />
                  )}

                  {/* Model — only show once make is chosen */}
                  {draft.make && draft.make !== 'Other' && (
                    <select className="form-control" style={{ fontSize: 12 }}
                      value={draft.model || ''}
                      onChange={e => setDraft({ model: e.target.value, freeformModel: '' })}>
                      <option value="">Model</option>
                      {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}

                  {/* Free-form make (Other make) → free-form model too */}
                  {draft.make === 'Other' && (
                    <input className="form-control" style={{ fontSize: 12 }}
                      placeholder="Enter model"
                      value={draft.freeformModel || ''}
                      onChange={e => setDraft({ freeformModel: e.target.value })} />
                  )}

                  {/* Free-form model (known make but Other model) */}
                  {draft.make && draft.make !== 'Other' && draft.model === 'Other' && (
                    <input className="form-control" style={{ fontSize: 12 }}
                      placeholder="Enter model"
                      value={draft.freeformModel || ''}
                      onChange={e => setDraft({ freeformModel: e.target.value })} />
                  )}
                </div>
              )}
            </div>
          );
        };

        const renderRenterDates = (v) => {
          const vehicleTrips = trips.filter(t => t.vehicle_id === v.id);
          return vehicleTrips.map(t => (
            <p key={t.id} style={{ fontSize: 11, color: '#888', margin: '3px 0 0' }}>
              {t.renter_name || 'Unknown'} · {t.start_datetime ? new Date(t.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              {' → '}{t.end_datetime ? new Date(t.end_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
            </p>
          ));
        };

        const renderWhichCar = (v) => {
          const hasCandidates = v.candidates && v.candidates.some(c => c.transponder_id);
          if (!hasCandidates) return null;
          const sel = getEffectiveSel(v);
          const whichCarTrips = trips.filter(t => t.vehicle_id === v.id);
          const whichCarRenters = [...new Set(whichCarTrips.map(t => t.renter_name).filter(Boolean))];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {whichCarRenters.length > 0 && (
                <div style={{ background: '#185fa5', borderRadius: 6, padding: '6px 10px', marginBottom: 4 }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: '0 0 1px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Guest</p>
                  {whichCarRenters.map(n => <p key={n} style={{ fontSize: 13, color: '#fff', fontWeight: 700, margin: 0 }}>{n}</p>)}
                </div>
              )}
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
          );
        };

        const renderPlate = (v) => {
          const sel = getEffectiveSel(v);
          const selectedExisting = sel && sel !== 'new' ? vehicles.find(rv => rv.id === sel) : null;
          if (selectedExisting) return <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#555' }}>{selectedExisting.plate || '—'}</span>;
          const needsPlate = !v.plate;
          const sameYmmRegistered = vehicles.filter(rv => rv.id !== v.id && rv.transponder_id && v.name && rv.name.toLowerCase() === v.name.toLowerCase());
          const sessionSuggestions = missingTransponders.filter(mv => mv.id !== v.id && v.name && mv.name.toLowerCase() === v.name.toLowerCase()).map(mv => ({ plate: plateInputs[mv.id] || mv.plate || '', transponder_id: transponderInputs[mv.id] || '' })).filter(s => s.plate || s.transponder_id);
          const allSuggestions = [...sameYmmRegistered.map(rv => ({ plate: rv.plate, transponder_id: rv.transponder_id })), ...sessionSuggestions];
          if (needsPlate) return (
            <>
              {allSuggestions.length > 0 && <datalist id={`plates-${v.id}`}>{allSuggestions.filter(s => s.plate).map((s, i) => <option key={i} value={s.plate} />)}</datalist>}
              <input className="form-control" style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontSize: 13 }}
                placeholder="ABC1234"
                list={allSuggestions.length > 0 ? `plates-${v.id}` : undefined}
                value={plateInputs[v.id] || ''}
                onChange={e => setPlateInputs(s => ({ ...s, [v.id]: e.target.value.toUpperCase() }))} />
            </>
          );
          return <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#555' }}>{v.plate || '—'}</span>;
        };

        const renderTransponder = (v) => {
          const sel = getEffectiveSel(v);
          const selectedExisting = sel && sel !== 'new' ? vehicles.find(rv => rv.id === sel) : null;
          if (selectedExisting) return <span style={{ fontSize: 11, color: '#aaa' }}>Uses {selectedExisting.name}'s transponder</span>;
          const sameYmmRegistered = vehicles.filter(rv => rv.id !== v.id && rv.transponder_id && v.name && rv.name.toLowerCase() === v.name.toLowerCase());
          const sessionSuggestions = missingTransponders.filter(mv => mv.id !== v.id && v.name && mv.name.toLowerCase() === v.name.toLowerCase()).map(mv => ({ plate: plateInputs[mv.id] || mv.plate || '', transponder_id: transponderInputs[mv.id] || '' })).filter(s => s.plate || s.transponder_id);
          const allSuggestions = [...sameYmmRegistered.map(rv => ({ plate: rv.plate, transponder_id: rv.transponder_id })), ...sessionSuggestions];
          return (
            <>
              {allSuggestions.length > 0 && <datalist id={`transponders-${v.id}`}>{allSuggestions.filter(s => s.transponder_id).map((s, i) => <option key={i} value={s.transponder_id} />)}</datalist>}
              <input className="form-control" style={{ fontFamily: 'monospace', fontSize: 13 }}
                placeholder="Transponder ID"
                list={allSuggestions.length > 0 ? `transponders-${v.id}` : undefined}
                value={transponderInputs[v.id] || ''}
                onChange={e => setTransponderInputs(s => ({ ...s, [v.id]: e.target.value }))} />
            </>
          );
        };

        return (
          <div className="card" style={{ marginBottom: 12, borderColor: '#f0c060', background: '#fffdf0', padding: 0, overflow: 'hidden' }}
            onBlur={(e) => {
              if (!isMobile) return;
              // After keyboard closes, scroll the card back into view
              setTimeout(() => {
                if (!e.currentTarget.contains(document.activeElement)) {
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              }, 300);
            }}
          >
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0c060', background: '#fdf6e3' }}>
              <p style={{ fontWeight: 600, fontSize: 13, color: '#854f0b', margin: 0 }}>
                ⚠️ Enter vehicle details — calculation will start automatically
              </p>
            </div>

            {isMobile ? (
              /* ── Mobile: stacked cards per vehicle ── */
              <div>
                {missingTransponders.map((v, idx) => (
                  <div key={v.id} style={{ padding: '14px 16px', borderBottom: idx < missingTransponders.length - 1 ? '0.5px solid #f0e8c0' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      {renderYMM(v)}
                      {renderRenterDates(v)}
                    </div>
                    {anyHasCandidates && renderWhichCar(v) && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#b8860b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Which car</p>
                        {renderWhichCar(v)}
                      </div>
                    )}
                    {!isExistingSelected(v) && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#b8860b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>License plate</p>
                        {renderPlate(v)}
                      </div>
                    )}
                    {!isExistingSelected(v) && (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#b8860b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>EZ-Pass transponder</p>
                        {renderTransponder(v)}
                      </div>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                      disabled={savingOne[v.id] || savingAll}
                      onClick={() => saveOneVehicle(v.id)}
                    >
                      {savingOne[v.id] ? <><span className="spinner" /> Saving...</> : 'Save'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Desktop: grid layout ── */
              <>
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 12px', padding: '8px 16px', background: '#faf6e8', borderBottom: '1px solid #f0c060', fontSize: 11, fontWeight: 700, color: '#b8860b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Vehicle (YMM) · Renter · Dates</span>
                  {anyHasCandidates && <span>Which car</span>}
                  <span>License Plate</span>
                  <span>EZ-Pass Transponder</span>
                  <span />
                </div>
                {missingTransponders.map((v, idx) => (
                  <div key={v.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 12px', padding: '12px 16px', borderBottom: idx < missingTransponders.length - 1 ? '0.5px solid #f0e8c0' : 'none', alignItems: 'start' }}>
                    <div>{renderYMM(v)}{renderRenterDates(v)}</div>
                    {anyHasCandidates && <div>{renderWhichCar(v) || <span style={{ fontSize: 11, color: '#ccc' }}>—</span>}</div>}
                    <div>{!isExistingSelected(v) && renderPlate(v)}</div>
                    <div>{!isExistingSelected(v) && renderTransponder(v)}</div>
                    <div style={{ paddingTop: 2 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={savingOne[v.id] || savingAll}
                        onClick={() => saveOneVehicle(v.id)}
                      >
                        {savingOne[v.id] ? <span className="spinner" /> : 'Save'}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div style={{ padding: '10px 16px', borderTop: '1px solid #f0c060', background: '#faf6e8' }}>
              <button className="btn btn-primary btn-sm" onClick={saveAllVehicles} disabled={saveDisabled}
                style={isMobile ? { width: '100%', justifyContent: 'center' } : {}}>
                {savingAll ? <><span className="spinner" /> Saving...</> : 'Save all'}
              </button>
              {saveError && (
                <div className="alert alert-error" style={{ marginTop: 8, fontSize: 12 }}>
                  {saveError}
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
