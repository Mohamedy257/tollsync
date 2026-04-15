import React, { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CAR_YEARS, CAR_MAKES, CAR_MODELS } from '../data/carData';

const EMPTY_VEHICLE = () => ({
  nickname: '', year: '', make: '', model: '', freeformMake: '', freeformModel: '',
  plate: '', transponder_id: '', vin: '',
});

function VehicleForm({ v, idx, onChange, onRemove, showRemove }) {
  const availableModels = v.make && v.make !== 'Other' ? (CAR_MODELS[v.make] || []) : [];
  const set = (patch) => onChange(idx, patch);

  const labelStyle = { fontSize: 12, color: '#666', marginBottom: 3, display: 'block', fontWeight: 500 };
  const reqStar = <span style={{ color: '#e24b4a' }}>*</span>;

  return (
    <div style={{ background: '#f8f7f4', borderRadius: 12, padding: '16px', marginBottom: 12, position: 'relative' }}>
      {showRemove && (
        <button onClick={() => onRemove(idx)} style={{
          position: 'absolute', top: 12, right: 12,
          background: 'none', border: 'none', color: '#aaa', fontSize: 16, cursor: 'pointer', lineHeight: 1,
        }}>✕</button>
      )}

      <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 12px', color: '#185fa5' }}>
        Vehicle {idx + 1}
      </p>

      {/* Nickname */}
      <div className="form-group">
        <label style={labelStyle}>Nickname {reqStar}</label>
        <input className="form-control" placeholder="e.g. Blue Nissan, Family SUV"
          value={v.nickname}
          onChange={e => set({ nickname: e.target.value })} />
        <p style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>Used to identify this car when selecting vehicles later</p>
      </div>

      {/* YMM */}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Year {reqStar}</label>
          <select className="form-control"
            value={v.year}
            onChange={e => set({ year: e.target.value })}>
            <option value="">Year</option>
            {CAR_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Make {reqStar}</label>
          <select className="form-control"
            value={v.make}
            onChange={e => set({ make: e.target.value, model: '', freeformMake: '', freeformModel: '' })}>
            <option value="">Make</option>
            {CAR_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Model {reqStar}</label>
          {v.make === 'Other' ? (
            <input className="form-control" placeholder="Make"
              value={v.freeformMake}
              onChange={e => set({ freeformMake: e.target.value })} />
          ) : (
            <select className="form-control"
              value={v.model}
              disabled={!v.make}
              onChange={e => set({ model: e.target.value, freeformModel: '' })}>
              <option value="">Model</option>
              {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Free-form model (Other make → also need model) */}
      {v.make === 'Other' && (
        <div className="form-group">
          <label style={labelStyle}>Model {reqStar}</label>
          <input className="form-control" placeholder="e.g. Altima"
            value={v.freeformModel}
            onChange={e => set({ freeformModel: e.target.value })} />
        </div>
      )}

      {/* Other model for known make */}
      {v.make && v.make !== 'Other' && v.model === 'Other' && (
        <div className="form-group">
          <label style={labelStyle}>Model name {reqStar}</label>
          <input className="form-control" placeholder="Enter model"
            value={v.freeformModel}
            onChange={e => set({ freeformModel: e.target.value })} />
        </div>
      )}

      {/* Plate + Transponder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>License Plate {reqStar}</label>
          <input className="form-control" placeholder="ABC1234"
            style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
            value={v.plate}
            onChange={e => set({ plate: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label style={labelStyle}>EZ-Pass Transponder {reqStar}</label>
          <input className="form-control" placeholder="Transponder ID"
            style={{ fontFamily: 'monospace' }}
            value={v.transponder_id}
            onChange={e => set({ transponder_id: e.target.value })} />
        </div>
      </div>

      {/* VIN */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label style={labelStyle}>VIN <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
        <input className="form-control" placeholder="17-character VIN"
          style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
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

export default function SetupWizard() {
  const { completeSetup } = useAuth();
  const [step, setStep] = useState(1); // 1 = vehicles, 2 = toll upload
  const [vehicles, setVehicles] = useState([EMPTY_VEHICLE()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [finishing, setFinishing] = useState(false);

  const updateVehicle = (idx, patch) => {
    setVehicles(vs => vs.map((v, i) => i === idx ? { ...v, ...patch } : v));
  };
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
        const ymmName = `${v.year} ${makeName} ${modelName}`.trim();
        await api.post('/vehicles', {
          name: ymmName,
          nickname: v.nickname.trim(),
          year: v.year,
          make: makeName,
          model: modelName,
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

  const STEPS = [
    { n: 1, label: 'Your vehicles' },
    { n: 2, label: 'EZ-Pass statement' },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 16px 40px',
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 560,
        paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>TollSync</span>
        </div>

        {/* Progress steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: step > s.n ? '#3b6d11' : step === s.n ? '#185fa5' : '#e5e3de',
                  color: step >= s.n ? '#fff' : '#aaa',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 11, color: step === s.n ? '#185fa5' : '#aaa', fontWeight: step === s.n ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > s.n ? '#3b6d11' : '#e5e3de', margin: '0 8px', marginBottom: 18 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Add your vehicles</h2>
            <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
              Add each car you host on Turo. This lets TollSync match toll charges to the right trips.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>Upload EZ-Pass statement</h2>
            <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
              Optional — upload your EZ-Pass PDF, CSV, or screenshots now or anytime later from Toll Records.
            </p>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ width: '100%', maxWidth: 560 }}>
        {step === 1 && (
          <>
            {vehicles.map((v, idx) => (
              <VehicleForm key={idx} v={v} idx={idx}
                onChange={updateVehicle}
                onRemove={removeVehicle}
                showRemove={vehicles.length > 1} />
            ))}

            <button className="btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
              onClick={addVehicle}>
              + Add another vehicle
            </button>

            {saveError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{saveError}</div>}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}
              disabled={!allValid || saving}
              onClick={saveVehicles}
            >
              {saving ? <><span className="spinner" /> Saving...</> : 'Next →'}
            </button>

            {!allValid && (
              <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 8 }}>
                Fill in all required fields (*) for each vehicle to continue
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            {!uploadDone ? (
              <div className="card" style={{ marginBottom: 16 }}>
                <label className="upload-zone" style={{ cursor: uploading ? 'default' : 'pointer' }}>
                  <input type="file" multiple accept=".csv,.pdf,image/*" style={{ display: 'none' }}
                    onChange={e => handleTollUpload(e.target.files)} />
                  {uploading ? (
                    <><span className="spinner" style={{ margin: '0 auto 8px' }} />
                      <p className="upload-label">Parsing with AI...</p></>
                  ) : (
                    <>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🛣️</div>
                      <p className="upload-label">Drop EZ-Pass files or click to browse</p>
                      <p className="upload-hint">PDF · CSV · Screenshots — multiple files OK</p>
                    </>
                  )}
                </label>
                {uploadError && <div className="alert alert-error" style={{ marginTop: 8 }}>{uploadError}</div>}
              </div>
            ) : (
              <div className="alert alert-success" style={{ marginBottom: 16, fontSize: 14 }}>
                ✓ EZ-Pass statement uploaded successfully
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15, marginBottom: 10 }}
              disabled={finishing}
              onClick={finish}
            >
              {finishing ? <><span className="spinner" /> Starting...</> : uploadDone ? 'Go to TollSync →' : 'Finish setup →'}
            </button>

            {!uploadDone && (
              <button className="btn" style={{ width: '100%', justifyContent: 'center', color: '#888' }}
                onClick={finish} disabled={finishing}>
                Skip for now
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
