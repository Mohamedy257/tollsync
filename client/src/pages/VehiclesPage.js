import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { CAR_YEARS, CAR_MAKES, CAR_MODELS } from '../data/carData';

const EMPTY_FORM = { nickname: '', plate: '', transponder_id: '', vin: '' };
const EMPTY_YMM = { year: '', make: '', model: '' };

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [ymm, setYmm] = useState(EMPTY_YMM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/vehicles');
      setVehicles(res.data.vehicles);
    } catch { setError('Failed to load vehicles'); }
  };

  const handle = e => {
    const val = e.target.name === 'plate' ? e.target.value.toUpperCase() : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
  };

  const add = async e => {
    e.preventDefault();
    if (!ymm.make || !ymm.model || !ymm.year) { setError('Year, make, and model are required'); return; }
    const name = `${ymm.make} ${ymm.model} ${ymm.year}`;
    setSaving(true); setError('');
    try {
      await api.post('/vehicles', { ...form, name });
      setForm(EMPTY_FORM);
      setYmm(EMPTY_YMM);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add vehicle');
    } finally { setSaving(false); }
  };

  const startEdit = (v) => {
    setEditingId(v.id);
    setEditForm({
      nickname: v.nickname || '',
      name: v.name || '',
      plate: v.plate || '',
      transponder_id: v.transponder_id || '',
      vin: v.vin || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (id) => {
    setSavingId(id);
    try {
      await api.put(`/vehicles/${id}`, editForm);
      setEditingId(null); setEditForm({});
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSavingId(null); }
  };

  const remove = async id => {
    if (!window.confirm('Remove this vehicle?')) return;
    try { await api.delete(`/vehicles/${id}`); load(); }
    catch { setError('Failed to remove vehicle'); }
  };

  const fg = { marginBottom: 8 };
  const lbl = { fontSize: 12, color: '#666', marginBottom: 3, display: 'block', fontWeight: 500 };

  // Render inline to avoid re-mounting when parent state changes (which would kill input focus)
  const renderVehicle = (v) => {
    if (editingId === v.id) {
      return (
        <div key={v.id} style={{ padding: '14px 0', borderBottom: '0.5px solid #f0ede8' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 12px', marginBottom: 10 }}>
            <div style={fg}>
              <label style={lbl}>Nickname</label>
              <input className="form-control" value={editForm.nickname}
                onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))} />
            </div>
            <div style={fg}>
              <label style={lbl}>Make, model &amp; year</label>
              <input className="form-control" value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={fg}>
              <label style={lbl}>License plate</label>
              <input className="form-control" style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                value={editForm.plate}
                onChange={e => setEditForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} />
            </div>
            <div style={fg}>
              <label style={lbl}>EZ-Pass transponder</label>
              <input className="form-control" style={{ fontFamily: 'monospace' }}
                value={editForm.transponder_id}
                onChange={e => setEditForm(f => ({ ...f, transponder_id: e.target.value }))} />
            </div>
            <div style={fg}>
              <label style={lbl}>VIN <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
              <input className="form-control" style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                value={editForm.vin}
                onChange={e => setEditForm(f => ({ ...f, vin: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => saveEdit(v.id)}
              disabled={savingId === v.id}>
              {savingId === v.id ? <><span className="spinner" /> Saving...</> : 'Save'}
            </button>
            <button className="btn btn-sm" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <div className="row-item" key={v.id}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: v.transponder_id ? '#f0ede8' : '#faeeda',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>🚗</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 600, margin: 0 }}>{v.nickname || v.name}</p>
            {v.nickname && <p style={{ fontSize: 12, color: '#555', margin: 0 }}>{v.name}</p>}
            <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
              {v.plate && <>{v.plate} &nbsp;·&nbsp;</>}
              {v.transponder_id
                ? <span style={{ fontFamily: 'monospace' }}>{v.transponder_id}</span>
                : <span style={{ color: '#f0a500' }}>No transponder</span>}
              {v.vin && <> &nbsp;·&nbsp; <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.vin}</span></>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-sm" onClick={() => startEdit(v)}>Edit</button>
          <button className="btn btn-sm btn-danger" onClick={() => remove(v.id)}>Remove</button>
        </div>
      </div>
    );
  };

  const noTransponder = vehicles.filter(v => !v.transponder_id);
  const withTransponder = vehicles.filter(v => v.transponder_id);

  return (
    <div>
      <div className="page-header">
        <h2>Vehicles</h2>
        <p>Manage your fleet. All fields can be edited after adding.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {noTransponder.length > 0 && (
        <>
          <p className="section-title" style={{ color: '#854f0b' }}>⚠️ Missing transponder ID</p>
          <div className="card" style={{ borderColor: '#f0c060', marginBottom: 12 }}>
            {noTransponder.map(v => renderVehicle(v))}
          </div>
        </>
      )}

      {withTransponder.length > 0 && (
        <>
          <p className="section-title">Registered vehicles</p>
          <div className="card" style={{ marginBottom: 12 }}>
            {withTransponder.map(v => renderVehicle(v))}
          </div>
        </>
      )}

      <div className="card">
        <p style={{ fontWeight: 600, marginBottom: 14 }}>Add a vehicle</p>
        <form onSubmit={add}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 12px', marginBottom: 12 }}>
            <div>
              <label style={lbl}>Nickname <span style={{ color: '#e24b4a' }}>*</span></label>
              <input className="form-control" name="nickname" placeholder="e.g. Blue Nissan"
                value={form.nickname} onChange={handle} />
            </div>
            <div>
              <label style={lbl}>Year <span style={{ color: '#e24b4a' }}>*</span></label>
              <select className="form-control" value={ymm.year}
                onChange={e => setYmm(y => ({ ...y, year: e.target.value }))}>
                <option value="">Select year</option>
                {CAR_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Make <span style={{ color: '#e24b4a' }}>*</span></label>
              <select className="form-control" value={ymm.make}
                onChange={e => setYmm(y => ({ ...y, make: e.target.value, model: '' }))}>
                <option value="">Select make</option>
                {CAR_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Model <span style={{ color: '#e24b4a' }}>*</span></label>
              <select className="form-control" value={ymm.model}
                onChange={e => setYmm(y => ({ ...y, model: e.target.value }))}
                disabled={!ymm.make}>
                <option value="">Select model</option>
                {(CAR_MODELS[ymm.make] || []).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>License plate <span style={{ color: '#e24b4a' }}>*</span></label>
              <input className="form-control" name="plate" placeholder="ABC1234"
                style={{ textTransform: 'uppercase' }}
                value={form.plate} onChange={handle} />
            </div>
            <div>
              <label style={lbl}>EZ-Pass transponder <span style={{ color: '#e24b4a' }}>*</span></label>
              <input className="form-control" name="transponder_id" placeholder="10613822"
                value={form.transponder_id} onChange={handle} />
            </div>
            <div>
              <label style={lbl}>VIN <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
              <input className="form-control" name="vin" placeholder="17-character VIN"
                style={{ fontFamily: 'monospace' }} value={form.vin} onChange={handle} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <><span className="spinner" /> Adding...</> : '+ Add vehicle'}
          </button>
        </form>
      </div>
    </div>
  );
}
