import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CAR_YEARS, CAR_MAKES, CAR_MODELS } from '../data/carData';

const EMPTY_VEHICLE = () => ({
  nickname: '', year: '', make: '', model: '', freeformMake: '', freeformModel: '',
  plate: '', transponder_id: '', vin: '',
});

const label = { fontSize: 13, color: '#555', marginBottom: 4, display: 'block', fontWeight: 500 };
const req = <span style={{ color: '#e24b4a' }}>*</span>;

function VehicleForm({ v, idx, onChange, onRemove, showRemove, isMobile }) {
  const models = v.make && v.make !== 'Other' ? (CAR_MODELS[v.make] || []) : [];
  const set = patch => onChange(idx, patch);

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '0.5px solid #e5e3de',
      padding: isMobile ? '16px' : '20px', marginBottom: 12, position: 'relative',
    }}>
      {showRemove && (
        <button onClick={() => onRemove(idx)} style={{
          position: 'absolute', top: 14, right: 14,
          background: '#f0ede8', border: 'none', color: '#888',
          width: 28, height: 28, borderRadius: 99, cursor: 'pointer',
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      )}

      <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 14px', color: '#185fa5' }}>
        Vehicle {idx + 1}
      </p>

      {/* Nickname */}
      <div className="form-group">
        <label style={label}>Nickname {req}</label>
        <input className="form-control" placeholder="e.g. Blue Nissan, Family SUV"
          style={{ fontSize: 16 }} // 16px prevents iOS zoom
          value={v.nickname}
          onChange={e => set({ nickname: e.target.value })} />
        <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
          This is how you'll identify the car later
        </p>
      </div>

      {/* Year */}
      <div className="form-group">
        <label style={label}>Year {req}</label>
        <select className="form-control" style={{ fontSize: 16 }}
          value={v.year} onChange={e => set({ year: e.target.value })}>
          <option value="">Select year</option>
          {CAR_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Make */}
      <div className="form-group">
        <label style={label}>Make {req}</label>
        <select className="form-control" style={{ fontSize: 16 }}
          value={v.make}
          onChange={e => set({ make: e.target.value, model: '', freeformMake: '', freeformModel: '' })}>
          <option value="">Select make</option>
          {CAR_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Make free-form (Other) */}
      {v.make === 'Other' && (
        <div className="form-group">
          <label style={label}>Make name {req}</label>
          <input className="form-control" placeholder="e.g. Tesla" style={{ fontSize: 16 }}
            value={v.freeformMake} onChange={e => set({ freeformMake: e.target.value })} />
        </div>
      )}

      {/* Model */}
      {v.make && v.make !== 'Other' && (
        <div className="form-group">
          <label style={label}>Model {req}</label>
          <select className="form-control" style={{ fontSize: 16 }}
            value={v.model} onChange={e => set({ model: e.target.value, freeformModel: '' })}>
            <option value="">Select model</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      {/* Model free-form */}
      {((v.make === 'Other') || (v.make && v.model === 'Other')) && (
        <div className="form-group">
          <label style={label}>Model name {req}</label>
          <input className="form-control" placeholder="e.g. Model 3" style={{ fontSize: 16 }}
            value={v.freeformModel} onChange={e => set({ freeformModel: e.target.value })} />
        </div>
      )}

      {/* Plate */}
      <div className="form-group">
        <label style={label}>License Plate {req}</label>
        <input className="form-control" placeholder="ABC1234"
          style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontSize: 16, letterSpacing: 1 }}
          value={v.plate}
          onChange={e => set({ plate: e.target.value.toUpperCase() })} />
      </div>

      {/* Transponder */}
      <div className="form-group">
        <label style={label}>EZ-Pass Transponder {req}</label>
        <input className="form-control" placeholder="Transponder ID"
          style={{ fontFamily: 'monospace', fontSize: 16 }}
          value={v.transponder_id}
          onChange={e => set({ transponder_id: e.target.value })} />
      </div>

      {/* VIN */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label style={label}>VIN <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
        <input className="form-control" placeholder="17-character VIN"
          style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontSize: 16 }}
          value={v.vin}
          onChange={e => set({ vin: e.target.value.toUpperCase() })} />
      </div>
    </div>
  );
}

function isVehicleValid(v) {
  if (!v.nickname.trim()) return false;
  if (!v.year) return false;
  const makeName = v.make === 'Other' ? v.freeformMake.trim() : v.make;
  if (!makeName) return false;
  const modelName = v.make === 'Other'
    ? v.freeformModel.trim()
    : v.model === 'Other' ? v.freeformModel.trim() : v.model;
  if (!modelName) return false;
  if (!v.plate.trim()) return false;
  if (!v.transponder_id.trim()) return false;
  return true;
}

const STEPS = [
  { n: 1, label: 'Your vehicles' },
  { n: 2, label: 'EZ-Pass statement' },
];

export default function SetupWizard() {
  const { completeSetup } = useAuth();
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState([EMPTY_VEHICLE()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const updateVehicle = (idx, patch) =>
    setVehicles(vs => vs.map((v, i) => i === idx ? { ...v, ...patch } : v));
  const removeVehicle = (idx) => setVehicles(vs => vs.filter((_, i) => i !== idx));
  const addVehicle = () => setVehicles(vs => [...vs, EMPTY_VEHICLE()]);

  const allValid = vehicles.length > 0 && vehicles.every(isVehicleValid);

  const saveVehicles = async () => {
    setSaving(true); setSaveError('');
    try {
      for (const v of vehicles) {
        const makeName = v.make === 'Other' ? v.freeformMake.trim() : v.make;
        const modelName = v.make === 'Other'
          ? v.freeformModel.trim()
          : v.model === 'Other' ? v.freeformModel.trim() : v.model;
        await api.post('/vehicles', {
          name: `${v.year} ${makeName} ${modelName}`.trim(),
          nickname: v.nickname.trim(),
          year: v.year, make: makeName, model: modelName,
          plate: v.plate.trim(),
          transponder_id: v.transponder_id.trim(),
          vin: v.vin.trim(),
        });
      }
      setStep(2);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save vehicles');
    } finally { setSaving(false); }
  };

  const handleTollUpload = async (files) => {
    if (!files || !files.length) return;
    setUploading(true); setUploadError('');
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      await api.post('/upload/auto', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadDone(true);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  const finish = async () => {
    setFinishing(true);
    await completeSetup();
  };

  // bottom padding: sticky button height + safe area
  const bottomPad = isMobile ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : '48px';

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4' }}>
      {/* Scrollable content area */}
      <div style={{
        maxWidth: 520, margin: '0 auto',
        padding: `calc(1.5rem + env(safe-area-inset-top, 0px)) 16px ${bottomPad}`,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 17 }}>TollSync</span>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  background: step > s.n ? '#3b6d11' : step === s.n ? '#185fa5' : '#e5e3de',
                  color: step >= s.n ? '#fff' : '#aaa',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 11, color: step === s.n ? '#185fa5' : '#aaa', fontWeight: step === s.n ? 600 : 400 }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > s.n ? '#3b6d11' : '#e5e3de', margin: '0 10px', marginBottom: 20 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step heading */}
        {step === 1 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, margin: '0 0 6px' }}>Add your vehicles</h2>
            <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.5 }}>
              Add each car you host. TollSync uses this to match toll charges to the right trips.
            </p>
          </div>
        )}
        {step === 2 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, margin: '0 0 6px' }}>Upload EZ-Pass statement</h2>
            <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.5 }}>
              Optional — upload now or anytime later from Toll Records.
            </p>
          </div>
        )}

        {/* Step 1 — vehicles */}
        {step === 1 && (
          <>
            {vehicles.map((v, idx) => (
              <VehicleForm key={idx} v={v} idx={idx}
                onChange={updateVehicle} onRemove={removeVehicle}
                showRemove={vehicles.length > 1} isMobile={isMobile} />
            ))}

            <button className="btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 8, padding: '11px' }}
              onClick={addVehicle}>
              + Add another vehicle
            </button>

            {saveError && <div className="alert alert-error" style={{ marginTop: 8 }}>{saveError}</div>}

            {!allValid && (
              <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 10 }}>
                Fill in all required (*) fields to continue
              </p>
            )}

            {/* Desktop Next button (mobile uses sticky footer) */}
            {!isMobile && (
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 8 }}
                disabled={!allValid || saving} onClick={saveVehicles}>
                {saving ? <><span className="spinner" /> Saving...</> : 'Next →'}
              </button>
            )}
          </>
        )}

        {/* Step 2 — toll upload */}
        {step === 2 && (
          <>
            {uploadDone ? (
              <div className="alert alert-success" style={{ marginBottom: 16, fontSize: 14 }}>
                ✓ EZ-Pass statement uploaded successfully
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 12 }}>
                <label className="upload-zone" style={{ cursor: uploading ? 'default' : 'pointer', padding: isMobile ? '1.5rem 1rem' : '2rem' }}>
                  <input type="file" multiple accept=".csv,.pdf,image/*" style={{ display: 'none' }}
                    onChange={e => handleTollUpload(e.target.files)} />
                  {uploading ? (
                    <><span className="spinner" style={{ margin: '0 auto 8px' }} />
                      <p className="upload-label">Parsing with AI...</p></>
                  ) : (
                    <>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🛣️</div>
                      <p className="upload-label">{isMobile ? 'Tap to upload EZ-Pass files' : 'Drop files or click to browse'}</p>
                      <p className="upload-hint">PDF · CSV · Screenshots — multiple files OK</p>
                    </>
                  )}
                </label>
                {uploadError && <div className="alert alert-error" style={{ marginTop: 8 }}>{uploadError}</div>}
              </div>
            )}

            {/* Desktop buttons */}
            {!isMobile && (
              <>
                <button className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginBottom: 10 }}
                  disabled={finishing} onClick={finish}>
                  {finishing ? <><span className="spinner" /> Starting...</> : uploadDone ? 'Go to TollSync →' : 'Finish setup →'}
                </button>
                {!uploadDone && (
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', color: '#888' }}
                    disabled={finishing} onClick={finish}>
                    Skip for now
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Mobile sticky footer ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#fff', borderTop: '0.5px solid #e5e3de',
          padding: `12px 16px calc(12px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {step === 1 && (
            <button className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16, borderRadius: 12 }}
              disabled={!allValid || saving} onClick={saveVehicles}>
              {saving ? <><span className="spinner" /> Saving...</> : 'Next →'}
            </button>
          )}
          {step === 2 && (
            <>
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 16, borderRadius: 12 }}
                disabled={finishing} onClick={finish}>
                {finishing ? <><span className="spinner" /> Starting...</> : uploadDone ? 'Go to TollSync →' : 'Finish setup →'}
              </button>
              {!uploadDone && (
                <button className="btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px', color: '#888' }}
                  disabled={finishing} onClick={finish}>
                  Skip for now
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
