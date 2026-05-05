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

function TripCard({ t, reportRange, vehicles }) {
  const gridRef = useRef();
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
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

    const filename = `tolls_${(t.renter_name || 'trip').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;

    try {
      const isDesktop = !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

      let canvas;
      if (isDesktop) {
        // Force a wide render so the output is large enough for Turo / evidence uploads
        const el = gridRef.current;
        const saved = { width: el.style.width, minWidth: el.style.minWidth, maxWidth: el.style.maxWidth };
        el.style.width = '900px';
        el.style.minWidth = '900px';
        el.style.maxWidth = '900px';
        canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 3, width: 900 });
        el.style.width = saved.width;
        el.style.minWidth = saved.minWidth;
        el.style.maxWidth = saved.maxWidth;
      } else {
        canvas = await html2canvas(gridRef.current, { backgroundColor: '#ffffff', scale: 2 });
      }

      const dataUrl = canvas.toDataURL('image/png');

      // Desktop: trigger download
      if (isDesktop) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Mobile: try native share sheet (Save to Photos), fall back to overlay
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Toll charges' });
          return;
        }
      } catch (e) { /* user cancelled or share not supported — fall through */ }
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error('Export failed:', err);
    } finally { setExporting(false); }
  };

  // Resolve vehicle display name: prefer linked vehicle's YMM, fall back to trip.vehicle
  const linkedVehicle = t.vehicle_id && vehicles ? vehicles.find(v => v.id === t.vehicle_id) : null;
  const vehicleName = linkedVehicle ? linkedVehicle.name : (t.vehicle || '—');

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
      {/* Mobile image preview overlay */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <img
            src={previewUrl} alt="Toll charges"
            style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 8 }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }} onClick={e => e.stopPropagation()}>
            <a
              href={previewUrl}
              download={`tollsync_${new Date().toISOString().slice(0, 10)}.png`}
              style={{
                background: '#185fa5', color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px 28px', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              Save Image
            </a>
            <button
              onClick={() => setPreviewUrl(null)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 10, padding: '12px 20px', fontWeight: 600, fontSize: 15 }}
            >
              Close
            </button>
          </div>
        </div>
      )}

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
          <p style={{ fontWeight: 600, margin: 0 }}>
            {t.renter_name || 'Unknown renter'}
            {(() => {
              const now = new Date();
              const end = t.end_datetime ? new Date(t.end_datetime) : null;
              const start = t.start_datetime ? new Date(t.start_datetime) : null;
              if (end && end > now) {
                return (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 600,
                    background: '#e6f4ea', color: '#2d7a3a',
                    border: '1px solid #b6dfbe', borderRadius: 6,
                    padding: '1px 6px', verticalAlign: 'middle',
                  }}>Ongoing</span>
                );
              }
              if (end && end <= now) {
                return (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 600,
                    background: '#f3f4f6', color: '#6b7280',
                    border: '1px solid #d1d5db', borderRadius: 6,
                    padding: '1px 6px', verticalAlign: 'middle',
                  }}>Ended</span>
                );
              }
              return null;
            })()}
          </p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2, marginBottom: 0 }}>
            {vehicleName}
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
          <button
            className="btn btn-sm"
            style={{ flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); exportImage(e); }}
            disabled={exporting}
          >
            {exporting ? <><span className="spinner" /> Saving...</> : '⬇️ Save'}
          </button>
          <span style={{ fontSize: 11, color: '#ccc' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expandable report — this is what gets exported */}
      {expanded && (
        <div ref={gridRef} style={{ background: '#fff', fontFamily: 'system-ui, sans-serif' }}>

          {/* ── Trip info block ── */}
          <div style={{ background: '#f0f4fa', borderBottom: '1px solid #d0daea', padding: '10px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '4px 0' : '4px 16px' }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Renter</p>
                <p style={{ margin: '1px 0 0', fontSize: 13, fontWeight: 600, color: '#111' }}>{t.renter_name || 'Unknown'}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Vehicle</p>
                <p style={{ margin: '1px 0 0', fontSize: 13, fontWeight: 600, color: '#111' }}>{vehicleName}{t.plate ? <span style={{ fontFamily: 'monospace', fontWeight: 400, color: '#555', marginLeft: 6 }}>· {t.plate}</span> : ''}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Trip Period</p>
                <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 500, color: '#111' }}>{fmtDt(t.start_datetime)}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#555' }}>{fmtDt(t.end_datetime)}</p>
              </div>
              {t.trip_id && (
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Trip #</p>
                  <p style={{ margin: '1px 0 0', fontSize: 13, fontWeight: 600, color: '#111' }}>{t.trip_id}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Transaction table ── */}
          {t.toll_items && t.toll_items.length > 0 ? (
            <div style={{ padding: '0 0 4px' }}>
              {isMobile ? (
                /* Mobile: stacked rows */
                <div>
                  {t.toll_items.map((ti, i) => (
                    <div key={i} style={{ padding: '10px 18px', borderBottom: '0.5px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111', flex: 1, paddingRight: 8 }}>{(ti.location && !/^[-_\s.]+$/.test(ti.location.trim())) ? ti.location : '—'}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0d3b6e', flexShrink: 0 }}>${parseFloat(ti.amount).toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        <span>In: {fmtDt(ti.entry_datetime)}</span>
                        <span style={{ margin: '0 6px' }}>·</span>
                        <span>Out: {fmtDt(ti.exit_datetime)}</span>
                      </div>
                      {ti.transponder_id && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 2 }}>{ti.transponder_id}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop: full table */
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#1e4d8c' }}>
                      {['Transponder ID', 'Entry Date & Time', 'Exit Date & Time', 'Location', 'Amount'].map(h => (
                        <th key={h} style={{
                          padding: '7px 14px', textAlign: h === 'Amount' ? 'right' : 'left',
                          fontSize: 10, fontWeight: 700, color: '#fff',
                          textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.toll_items.map((ti, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f0f4fa', borderBottom: '0.5px solid #d0daea' }}>
                        <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11, color: '#374151', whiteSpace: 'nowrap' }}>{ti.transponder_id || '—'}</td>
                        <td style={{ padding: '8px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDt(ti.entry_datetime)}</td>
                        <td style={{ padding: '8px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDt(ti.exit_datetime)}</td>
                        <td style={{ padding: '8px 14px', color: '#111' }}>{(ti.location && !/^[-_\s.]+$/.test(ti.location.trim())) ? ti.location : '—'}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#0d3b6e', whiteSpace: 'nowrap' }}>${parseFloat(ti.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#0d3b6e' }}>
                      <td colSpan={4} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total Charges — {t.toll_count} transaction{t.toll_count !== 1 ? 's' : ''}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 15, fontWeight: 800, color: '#fff' }}>
                        ${parseFloat(t.total_tolls).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
              {isMobile && (
                <div style={{ background: '#0d3b6e', padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total — {t.toll_count} transaction{t.toll_count !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>${parseFloat(t.total_tolls).toFixed(2)}</span>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '20px 0' }}>No toll charges for this trip.</p>
          )}
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
  const pollRef = useRef(null);
  const tripsRef = useRef([]);
  const [uploadResults, setUploadResults] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [transponderInputs, setTransponderInputs] = useState({});
  const [plateInputs, setPlateInputs] = useState({});
  const [vehicleNameInputs, setVehicleNameInputs] = useState({}); // legacy / fallback
  const [ymmDraft, setYmmDraft] = useState({}); // vehicleId → { year, make, model, freeformMake, freeformModel }
  const [vehicleSelections, setVehicleSelections] = useState({}); // vehicleId → candidateId or 'new'
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [dragging, setDragging] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const tripFileRef = useRef();
  const tollFileRef = useRef();
  const [calcNeeded, setCalcNeeded] = useState(false);
  const navigate = useNavigate();
  const fileRef = useRef();

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

  useEffect(() => { tripsRef.current = trips; }, [trips]);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    loadAll();
    api.get('/results').then(r => { if (r.data.trips?.length) setResults(r.data); }).catch(() => {});
  }, [loadAll]);

  // Poll for background upload job completion
  const startPolling = useCallback((jobId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    // Keep progress bar slowly crawling while AI processes on the server
    clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setUploadProgress(p => p >= 90 ? 90 : p + (90 - p) * 0.03);
    }, 500);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/upload/status/${jobId}`);
        const job = res.data;
        if (job.status === 'done') {
          clearInterval(pollRef.current); pollRef.current = null;
          localStorage.removeItem('upload_pending_job');
          setUploadResults(job.results || []);
          clearInterval(progressTimerRef.current);
          setUploadProgress(100);
          setTimeout(() => setUploadProgress(0), 600);
          setUploading(0);
          const hasTripFiles = (job.results || []).some(r => r.type === 'trips' && !r.error);
          // Snapshot trip IDs before loading fresh data so we can find genuinely new trips
          const oldTripIds = new Set(tripsRef.current.map(t => (t._id || t.id || '').toString()));
          const { trips: freshTrips } = await loadAll();
          if (hasTripFiles) {
            const newIds = new Set(
              freshTrips
                .filter(t => !oldTripIds.has((t._id || t.id || '').toString()))
                .map(t => (t._id || t.id || '').toString())
            );
            if (newIds.size > 0) {
              setRecentTripIds(newIds);
              setViewMode('uploaded');
            }
          }
          setCalcNeeded(true);
          if (fileRef.current) fileRef.current.value = '';
        } else if (job.status === 'error') {
          clearInterval(pollRef.current); pollRef.current = null;
          localStorage.removeItem('upload_pending_job');
          setUploadError(job.error || 'Upload failed');
          clearInterval(progressTimerRef.current);
          setUploadProgress(0);
          setUploading(0);
          if (fileRef.current) fileRef.current.value = '';
        }
        // status === 'processing' → keep polling
      } catch { /* network error — keep polling */ }
    }, 3000);
  }, [loadAll]);

  // On mount: resume any upload job that was in-flight when the user left
  useEffect(() => {
    const pending = localStorage.getItem('upload_pending_job');
    if (pending) {
      try {
        const { jobId, fileCount } = JSON.parse(pending);
        setUploading(fileCount || 1);
        setUploadProgress(30);
        startPolling(jobId);
      } catch { localStorage.removeItem('upload_pending_job'); }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [startPolling]);

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

  // Auto-calc whenever data changes and conditions are met
  useEffect(() => {
    if (calcNeeded && canCalculate && !calculating) {
      setCalcNeeded(false);
      calculate();
    }
  }, [calcNeeded, canCalculate, calculating, calculate]);

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
      setUploadProgress(p => p >= 85 ? 85 : p + (85 - p) * 0.06);
    }, 300);

    // Normalize HEIC → JPEG before upload
    const normalized = await Promise.all(Array.from(files).map(normalizeFile));

    const formData = new FormData();
    normalized.forEach(f => formData.append('files', f));
    try {
      const res = await api.post('/upload/auto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { jobId } = res.data;
      // Persist jobId so we can resume if the user navigates away
      localStorage.setItem('upload_pending_job', JSON.stringify({ jobId, fileCount: files.length }));
      // File is on the server — jump to 40% and let polling crawl the rest
      clearInterval(progressTimerRef.current);
      setUploadProgress(40);
      startPolling(jobId);
    } catch (err) {
      clearInterval(progressTimerRef.current);
      setUploadProgress(0);
      setUploading(0);
      setUploadError(err.response?.data?.error || 'Upload failed');
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [startPolling]);

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
      await loadAll();
      setCalcNeeded(true);
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
      await loadAll();
      setCalcNeeded(true);
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

  const [filterGuests, setFilterGuests] = useState([]);
  const [filterVehicles, setFilterVehicles] = useState([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'ongoing' | 'ended'
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const [guestDropOpen, setGuestDropOpen] = useState(false);
  const [vehicleDropOpen, setVehicleDropOpen] = useState(false);
  // 'all' = normal view sorted by end date; 'uploaded' = show only the just-uploaded trip(s)
  const [viewMode, setViewMode] = useState('all');
  const [recentTripIds, setRecentTripIds] = useState(new Set());

  const byEndDateDesc = (a, b) => new Date(b.end_datetime) - new Date(a.end_datetime);

  const allTrips = results?.trips || [];
  const allGuests = [...new Set(allTrips.map(t => t.renter_name).filter(Boolean))].sort();
  const allVehicles = [...new Set(allTrips.map(t => t.vehicle).filter(Boolean))].sort();

  const filteredTrips = allTrips.filter(t => {
    if (filterGuests.length && !filterGuests.includes(t.renter_name)) return false;
    if (filterVehicles.length && !filterVehicles.includes(t.vehicle)) return false;
    if (filterDateFrom && t.end_datetime && new Date(t.end_datetime) < new Date(filterDateFrom)) return false;
    if (filterDateTo && t.start_datetime && new Date(t.start_datetime) > new Date(filterDateTo + 'T23:59:59')) return false;
    if (filterStatus !== 'all') {
      const now = new Date();
      const end = t.end_datetime ? new Date(t.end_datetime) : null;
      const isOngoing = end && end > now;
      if (filterStatus === 'ongoing' && !isOngoing) return false;
      if (filterStatus === 'ended' && isOngoing) return false;
    }
    const amount = parseFloat(t.total_tolls) || 0;
    if (filterAmountMin !== '' && amount < parseFloat(filterAmountMin)) return false;
    if (filterAmountMax !== '' && amount > parseFloat(filterAmountMax)) return false;
    return true;
  });

  // Trips from the most recent upload — matched by exact trip ID (not filename,
  // which repeats when pasting from clipboard) so only truly new trips appear.
  const recentTrips = viewMode === 'uploaded' && recentTripIds.size > 0
    ? trips
        .filter(t => recentTripIds.has((t._id || t.id || '').toString()))
        .map(t => {
          const tid = (t._id || t.id || '').toString();
          const withData = (results?.trips || []).find(r => r.trip_db_id === tid);
          return withData ?? { ...t, trip_db_id: tid, toll_items: [], total_tolls: 0, toll_count: 0 };
        })
        .sort((a, b) => new Date(b.end_datetime || 0) - new Date(a.end_datetime || 0))
    : [];

  const sortedTrips = [...filteredTrips].sort(byEndDateDesc);
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
              <input type="file" multiple accept=".csv,.xlsx,.xls,.pdf,image/*" style={{ display: 'none' }}
                onChange={e => { setShowActionSheet(false); handleFiles(e.target.files); }} />
              📁 &nbsp; Choose from library
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
                          const ext = type.split('/')[1] || 'png';
                          imageFiles.push(new File([blob], `pasted.${ext}`, { type }));
                        }
                      }
                    }
                    if (imageFiles.length) {
                      handleFiles(imageFiles);
                    } else {
                      setUploadError('No image found in clipboard. Copy a screenshot first, then tap Paste.');
                    }
                  } catch (err) {
                    if (err?.name === 'NotAllowedError') {
                      setUploadError('Clipboard access was denied. Allow clipboard access in your browser settings, or use "Choose from library" instead.');
                    } else {
                      setUploadError('Could not read clipboard. Try "Choose from library" instead.');
                    }
                  }
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

      {/* Hidden inputs for step upload buttons */}
      <input ref={tripFileRef} type="file" multiple accept=".csv,.xlsx,.xls,.pdf,image/*"
        style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      <input ref={tollFileRef} type="file" multiple accept=".csv,.xlsx,.xls,.pdf,image/*"
        style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

      {/* Single upload zone */}
      <div className="card">
        <label
          className={`upload-zone${dragging ? ' upload-zone-drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={isMobile && uploading === 0 ? e => { e.preventDefault(); setShowActionSheet(true); } : undefined}
        >
          <input ref={fileRef} type="file" multiple accept=".csv,.xlsx,.xls,.pdf,image/*"
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
                      <p className="upload-label">Tap to upload trips or tolls</p>
                      <p className="upload-hint">Screenshots · PDF · CSV — we'll detect which is which</p>
                    </>
                  : <>
                      <p className="upload-label">Drop files, click to browse, or paste (⌘V)</p>
                      <p className="upload-hint">Screenshots · PDF · CSV · Excel — we'll detect which is which</p>
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
            n: 1, icon: '📸', title: 'Upload trip data',
            desc: 'Upload screenshots, CSVs, or PDFs of your trip list.',
            done: false, active: true, action: { label: 'Upload trips', upload: true },
          },
          {
            n: 2, icon: '🛣️', title: 'Upload your EZ-Pass statement',
            desc: tolls.length > 0
              ? `${tolls.length} toll record${tolls.length !== 1 ? 's' : ''} already loaded.`
              : 'Upload your EZ-Pass PDF, CSV, or screenshots.',
            done: tolls.length > 0, active: !tolls.length,
            action: tolls.length > 0
              ? { label: 'View records', path: '/tolls' }
              : { label: 'Upload tolls', upload: true },
          },
          {
            n: 3, icon: '⚡', title: 'Results load automatically',
            desc: 'Once trips and toll records are loaded, results calculate automatically.',
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
                  s.action.upload ? (
                    <button
                      className="btn btn-sm"
                      style={{ flexShrink: 0, background: '#185fa5', color: '#fff', borderColor: 'transparent' }}
                      onClick={() => isMobile ? setShowActionSheet(true) : (s.n === 1 ? tripFileRef : tollFileRef).current?.click()}
                    >
                      {s.action.label}
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm"
                      style={{ flexShrink: 0, ...(s.done ? {} : { background: '#185fa5', color: '#fff', borderColor: 'transparent' }) }}
                      onClick={() => navigate(s.action.path)}
                    >
                      {s.action.label}
                    </button>
                  )
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
            <div className="card" style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '8px 12px', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>
                <span className="badge badge-blue" style={{ marginRight: 6 }}>{trips.length}</span>
                trip{trips.length !== 1 ? 's' : ''}
              </span>
              <button className="btn btn-sm" onClick={() => navigate('/trips')}>View</button>
            </div>
          )}
          {tolls.length > 0 && (
            <div className="card" style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '8px 12px', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>
                <span className="badge badge-green" style={{ marginRight: 6 }}>{tolls.length}</span>
                toll{tolls.length !== 1 ? 's' : ''} · <strong>${totalLoaded.toFixed(2)}</strong>
              </span>
              <button className="btn btn-sm" onClick={() => navigate('/tolls')}>View</button>
            </div>
          )}
        </div>
      )}

      {/* Vehicle details card */}
      {missingTransponders.length > 0 && (() => {
        const anyHasCandidates = missingTransponders.some(v => v.candidates && v.candidates.some(c => c.transponder_id));
        const cols = anyHasCandidates ? '220px 140px 160px 180px 80px' : '220px 160px 180px 80px';

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

      {calculating && viewMode === 'all' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#888', fontSize: 13 }}>
          <span className="spinner" /> Calculating...
        </div>
      )}
      {calcError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{calcError}</div>}

      {/* ── Uploaded view — shown right after upload, works even without results ── */}
      {viewMode === 'uploaded' && (
        <div>
          <button
            onClick={() => { setViewMode('all'); setRecentTripIds(new Set()); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, background: '#185fa5', color: '#fff', border: 'none', borderRadius: 12,
              padding: '14px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              marginBottom: 16,
            }}
          >
            ← View all trips
          </button>
          {calculating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#888', fontSize: 13 }}>
              <span className="spinner" /> Matching tolls to trip…
            </div>
          )}
          {recentTrips.length > 0
            ? recentTrips.map(t => (
                <TripCard key={t.trip_db_id} t={t} reportRange={results?.report_range} vehicles={vehicles} />
              ))
            : !calculating && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: 13 }}>
                  Processing trip data…
                </div>
              )
          }
        </div>
      )}

      {/* ── Normal all-trips results ── */}
      {viewMode === 'all' && !calculating && results && (
        <div>
          <div className="metrics">
            <div className="metric">
              <p className="metric-label">Total toll charges</p>
              <p className="metric-value">${filteredTrips.reduce((s, t) => s + (t.total_tolls || 0), 0).toFixed(2)}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Trips with tolls</p>
              <p className="metric-value">
                {sortedTrips.filter(t => t.toll_items?.length > 0).length}
                <span className="metric-sub">/ {results.trips.length}</span>
              </p>
            </div>
          </div>

          {/* ── Filters ── */}
          {allTrips.length > 0 && (() => {
            const hasFilters = filterGuests.length || filterVehicles.length || filterDateFrom || filterDateTo || filterStatus !== 'all' || filterAmountMin !== '' || filterAmountMax !== '';
            const chipStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e8f0fb', color: '#185fa5', borderRadius: 99, fontSize: 12, fontWeight: 600, padding: '3px 10px' };

            const MultiSelect = ({ label, options, selected, setSelected, open, setOpen, icon }) => {
              if (!options.length) return null;
              return (
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn btn-sm"
                    style={{ gap: 5, background: selected.length ? '#e8f0fb' : undefined, color: selected.length ? '#185fa5' : undefined, borderColor: selected.length ? '#185fa5' : undefined }}
                    onClick={() => { setOpen(o => !o); }}
                  >
                    {icon} {label}{selected.length ? ` (${selected.length})` : ''}
                    <span style={{ fontSize: 9, color: '#aaa' }}>▼</span>
                  </button>
                  {open && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
                        background: '#fff', border: '1px solid #e5e3de', borderRadius: 10,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 200, maxHeight: 240, overflowY: 'auto',
                        padding: '6px 0',
                      }}>
                        {options.map(opt => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}
                            onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.includes(opt)}
                              onChange={() => setSelected(s => s.includes(opt) ? s.filter(x => x !== opt) : [...s, opt])} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            };

            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <MultiSelect label="Guest" icon="👤" options={allGuests} selected={filterGuests} setSelected={setFilterGuests} open={guestDropOpen} setOpen={setGuestDropOpen} />
                  <MultiSelect label="Vehicle" icon="🚗" options={allVehicles} selected={filterVehicles} setSelected={setFilterVehicles} open={vehicleDropOpen} setOpen={setVehicleDropOpen} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>From</label>
                    <input type="date" className="form-control" style={{ fontSize: 12, padding: '5px 8px', width: 140 }}
                      value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                      title="Trip end date from" />
                    <label style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>To</label>
                    <input type="date" className="form-control" style={{ fontSize: 12, padding: '5px 8px', width: 140 }}
                      value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                      title="Trip start date to" />
                  </div>
                  {/* Amount range */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>💰</span>
                    <input
                      type="number" min="0" step="0.01" placeholder="Min $"
                      className="form-control"
                      style={{ fontSize: 12, padding: '5px 8px', width: 80 }}
                      value={filterAmountMin}
                      onChange={e => setFilterAmountMin(e.target.value)}
                    />
                    <span style={{ fontSize: 12, color: '#aaa' }}>–</span>
                    <input
                      type="number" min="0" step="0.01" placeholder="Max $"
                      className="form-control"
                      style={{ fontSize: 12, padding: '5px 8px', width: 80 }}
                      value={filterAmountMax}
                      onChange={e => setFilterAmountMax(e.target.value)}
                    />
                  </div>
                  {/* Status toggle */}
                  <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e3de' }}>
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'ongoing', label: '🟢 Ongoing' },
                      { value: 'ended', label: 'Ended' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFilterStatus(opt.value)}
                        style={{
                          padding: '4px 11px',
                          fontSize: 12,
                          fontWeight: filterStatus === opt.value ? 700 : 500,
                          background: filterStatus === opt.value
                            ? (opt.value === 'ongoing' ? '#e6f4ea' : opt.value === 'ended' ? '#f3f4f6' : '#185fa5')
                            : '#fff',
                          color: filterStatus === opt.value
                            ? (opt.value === 'ongoing' ? '#2d7a3a' : opt.value === 'ended' ? '#6b7280' : '#fff')
                            : '#555',
                          border: 'none',
                          borderRight: opt.value !== 'ended' ? '1px solid #e5e3de' : 'none',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {hasFilters && (
                    <button className="btn btn-sm" style={{ color: '#e24b4a', borderColor: '#e24b4a' }}
                      onClick={() => { setFilterGuests([]); setFilterVehicles([]); setFilterDateFrom(''); setFilterDateTo(''); setFilterStatus('all'); setFilterAmountMin(''); setFilterAmountMax(''); }}>
                      Clear filters
                    </button>
                  )}
                </div>
                {hasFilters && (
                  <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                    Showing {filteredTrips.length} of {allTrips.length} trips
                  </p>
                )}
              </div>
            );
          })()}

          {sortedTrips.map(t => (
            <TripCard key={t.trip_db_id} t={t} reportRange={results.report_range} vehicles={vehicles} />
          ))}

          <div className="action-bar">
            <button className="btn" onClick={exportCSV}>⬇ Export CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}
