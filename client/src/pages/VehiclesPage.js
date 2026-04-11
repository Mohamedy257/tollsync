import React, { useEffect, useState } from 'react';
import api from '../api/client';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ name: '', plate: '', transponder_id: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingTransponder, setEditingTransponder] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/vehicles');
      setVehicles(res.data.vehicles);
    } catch { setError('Failed to load vehicles'); }
  };

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const add = async e => {
    e.preventDefault();
    if (!form.name) { setError('Vehicle name is required'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/vehicles', form);
      setForm({ name: '', plate: '', transponder_id: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add vehicle');
    } finally { setSaving(false); }
  };

  const saveTransponder = async (v) => {
    const val = (editingTransponder[v.id] || '').trim();
    if (!val) return;
    setSavingId(v.id);
    try {
      await api.put(`/vehicles/${v.id}`, { transponder_id: val });
      setEditingTransponder(s => { const n = { ...s }; delete n[v.id]; return n; });
      load();
    } catch {}
    finally { setSavingId(null); }
  };

  const remove = async id => {
    if (!window.confirm('Remove this vehicle?')) return;
    try { await api.delete(`/vehicles/${id}`); load(); }
    catch { setError('Failed to remove vehicle'); }
  };

  const needsTransponder = vehicles.filter(v => !v.transponder_id);
  const hasTransponder = vehicles.filter(v => v.transponder_id);

  return (
    <div>
      <div className="page-header">
        <h2>Vehicles</h2>
        <p>Cars added from trip reports. Add their EZ-Pass transponder IDs for accurate matching.</p>
      </div>

      {needsTransponder.length > 0 && (
        <>
          <p className="section-title" style={{ color: '#854f0b' }}>⚠️ Missing transponder ID</p>
          <div className="card" style={{ borderColor: '#f0c060', marginBottom: 12 }}>
            {needsTransponder.map(v => (
              <div className="row-item" key={v.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#faeeda', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚗</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 500 }}>{v.name}</p>
                    {v.plate && <p style={{ fontSize: 12, color: '#888' }}>Plate: {v.plate}</p>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                      <input
                        className="form-control"
                        style={{ maxWidth: 200, padding: '5px 8px', fontSize: 13 }}
                        placeholder="EZ-Pass transponder ID"
                        value={editingTransponder[v.id] || ''}
                        onChange={e => setEditingTransponder(s => ({ ...s, [v.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && saveTransponder(v)}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => saveTransponder(v)}
                        disabled={savingId === v.id || !editingTransponder[v.id]}
                      >
                        {savingId === v.id ? <span className="spinner" /> : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => remove(v.id)}>Remove</button>
              </div>
            ))}
          </div>
        </>
      )}

      {hasTransponder.length > 0 && (
        <>
          <p className="section-title">Registered vehicles</p>
          <div className="card" style={{ marginBottom: 12 }}>
            {hasTransponder.map(v => (
              <div className="row-item" key={v.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚗</div>
                  <div>
                    <p style={{ fontWeight: 500 }}>{v.name}</p>
                    <p style={{ fontSize: 12, color: '#888' }}>
                      {v.plate && <>Plate: {v.plate} &nbsp;·&nbsp; </>}
                      Transponder: <span style={{ fontFamily: 'monospace' }}>{v.transponder_id}</span>
                    </p>
                  </div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => remove(v.id)}>Remove</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card">
        <p style={{ fontWeight: 500, marginBottom: 14 }}>Add a vehicle manually</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={add}>
          <div className="form-grid" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Make &amp; model</label>
              <input className="form-control" name="name" placeholder="Nissan Altima 2020" value={form.name} onChange={handle} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>License plate (optional)</label>
              <input className="form-control" name="plate" placeholder="ABC1234" value={form.plate} onChange={handle} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>EZ-Pass transponder ID</label>
              <input className="form-control" name="transponder_id" placeholder="10613822" value={form.transponder_id} onChange={handle} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <span className="spinner" /> : '+ Add vehicle'}
          </button>
        </form>
      </div>
    </div>
  );
}
