import React, { useEffect, useState } from 'react';
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

const COLS = [
  { key: 'transponder_id', label: 'Transponder ID', mono: true },
  { key: 'entry_datetime', label: 'Entry Date & Time', fmt: fmtDt },
  { key: 'exit_datetime',  label: 'Exit Date & Time',  fmt: fmtDt },
  { key: 'location',       label: 'Location' },
  { key: 'amount',         label: 'Amount', right: true, fmt: v => `$${parseFloat(v).toFixed(2)}` },
];

export default function EzPassPage() {
  const [tolls, setTolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState('exit_datetime');
  const [sortDir, setSortDir] = useState(-1);
  const [search, setSearch] = useState('');
  const [deletingFile, setDeletingFile] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ezpass');
      setTolls(res.data.tolls);
    } catch { setError('Failed to load toll records'); }
    finally { setLoading(false); }
  };

  const removeToll = async (id) => {
    try { await api.delete(`/ezpass/${id}`); setTolls(t => t.filter(x => x._id !== id && x.id !== id)); }
    catch { setError('Failed to remove record'); }
  };

  const clearAll = async () => {
    if (!window.confirm('Delete all toll records? This cannot be undone.')) return;
    try { await api.delete('/ezpass'); setTolls([]); }
    catch { setError('Failed to clear records'); }
  };

  const deleteFile = async (filename) => {
    if (!window.confirm(`Delete all tolls from "${filename}"? This cannot be undone.`)) return;
    setDeletingFile(filename);
    try {
      await api.delete(`/ezpass/file/${encodeURIComponent(filename)}`);
      setTolls(t => t.filter(x => x.source_file !== filename));
    } catch { setError('Failed to delete file records'); }
    finally { setDeletingFile(null); }
  };

  const toggleSort = (key) => {
    if (sortCol === key) setSortDir(d => d * -1);
    else { setSortCol(key); setSortDir(-1); }
  };

  const filtered = tolls.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.transponder_id || '').toLowerCase().includes(q) ||
      (t.location || '').toLowerCase().includes(q) ||
      (t.source_file || '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (sortCol === 'amount') { av = parseFloat(av); bv = parseFloat(bv); }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -sortDir;
    if (av > bv) return sortDir;
    return 0;
  });

  const total = filtered.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  // Group tolls by source file for the file summary panel
  const fileGroups = tolls.reduce((acc, t) => {
    const f = t.source_file || '(unknown)';
    if (!acc[f]) acc[f] = { count: 0, total: 0 };
    acc[f].count++;
    acc[f].total += parseFloat(t.amount || 0);
    return acc;
  }, {});
  const fileNames = Object.keys(fileGroups).sort();

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ color: '#ccc', marginLeft: 4, fontSize: 10 }}>↕</span>;
    return <span style={{ marginLeft: 4, fontSize: 10, color: '#185fa5' }}>{sortDir === -1 ? '▼' : '▲'}</span>;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Toll Records</h2>
          <p>All EZ-Pass transactions — re-uploading the same file only adds new records.</p>
        </div>
        {tolls.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={clearAll}>Delete all tolls</button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}><span className="spinner spinner-lg" /></div>
      ) : tolls.length === 0 ? (
        <div className="empty">
          <p style={{ fontSize: 32, marginBottom: 8 }}>🛣️</p>
          No toll records yet. Upload an EZ-Pass statement from the Calculator page.
        </div>
      ) : (
        <>
          {/* Uploaded files summary */}
          {fileNames.length > 0 && (
            <>
              <p className="section-title">Uploaded files</p>
              <div className="card" style={{ marginBottom: 16, padding: 0 }}>
                {fileNames.map((f, i) => (
                  <div key={f} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    borderBottom: i < fileNames.length - 1 ? '0.5px solid #f0ede8' : 'none',
                  }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                        {fileGroups[f].count} record{fileGroups[f].count !== 1 ? 's' : ''} · ${fileGroups[f].total.toFixed(2)}
                      </p>
                    </div>
                    <button
                      className="btn btn-sm btn-danger"
                      style={{ flexShrink: 0 }}
                      disabled={deletingFile === f}
                      onClick={() => deleteFile(f)}
                    >
                      {deletingFile === f ? <><span className="spinner" /> Deleting…</> : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Summary + search row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="badge badge-blue">{tolls.length} record{tolls.length !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 13, color: '#555' }}>Total: <strong>${total.toFixed(2)}</strong></span>
            <input
              className="form-control"
              style={{ fontSize: 13, padding: '5px 10px', width: isMobile ? '100%' : 220, marginLeft: isMobile ? 0 : 'auto' }}
              placeholder="Search transponder, location…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {isMobile ? (
            /* Mobile: card per record */
            <div>
              {sorted.map((t) => (
                <div key={t._id || t.id} className="card" style={{ marginBottom: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', flex: 1 }}>{t.location || '—'}</span>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#185fa5', flexShrink: 0 }}>${parseFloat(t.amount).toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'monospace' }}>{t.transponder_id || '—'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>In: {fmtDt(t.entry_datetime)}</div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Out: {fmtDt(t.exit_datetime)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{t.source_file || ''}</span>
                    <button className="btn btn-sm btn-danger" style={{ padding: '3px 8px', fontSize: 11 }}
                      onClick={() => removeToll(t._id || t.id)}>✕</button>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: '#888', textAlign: 'right', marginTop: 8 }}>
                {filtered.length} record{filtered.length !== 1 ? 's' : ''}{search ? ' (filtered)' : ''} · Total <strong style={{ color: '#185fa5' }}>${total.toFixed(2)}</strong>
              </div>
            </div>
          ) : (
            /* Desktop: full table */
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="scroll-x">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8f7f4', borderBottom: '1px solid #e5e3de' }}>
                      {COLS.map(c => (
                        <th key={c.key} onClick={() => toggleSort(c.key)} style={{
                          padding: '9px 14px', textAlign: c.right ? 'right' : 'left',
                          fontWeight: 600, fontSize: 11, color: sortCol === c.key ? '#185fa5' : '#888',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                        }}>
                          {c.label}<SortIcon col={c.key} />
                        </th>
                      ))}
                      <th style={{ width: 36 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((t, i) => (
                      <tr key={t._id || t.id} style={{ borderBottom: i < sorted.length - 1 ? '0.5px solid #f0ede8' : 'none' }}>
                        {COLS.map(c => {
                          const raw = t[c.key];
                          const val = c.fmt ? c.fmt(raw) : (raw || '—');
                          return (
                            <td key={c.key} style={{
                              padding: '9px 14px', textAlign: c.right ? 'right' : 'left',
                              fontFamily: c.mono ? 'monospace' : undefined, fontSize: c.mono ? 12 : 13,
                              color: c.right ? '#185fa5' : '#1a1a1a',
                              fontWeight: c.right ? 600 : undefined,
                              whiteSpace: c.key === 'location' ? 'normal' : 'nowrap',
                            }}>
                              {val}
                            </td>
                          );
                        })}
                        <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                          <button className="btn btn-sm btn-danger" style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => removeToll(t._id || t.id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8f7f4', borderTop: '1px solid #e5e3de' }}>
                      <td colSpan={4} style={{ padding: '8px 14px', fontSize: 12, color: '#888' }}>
                        {filtered.length} record{filtered.length !== 1 ? 's' : ''}{search ? ' (filtered)' : ''}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#185fa5' }}>
                        ${total.toFixed(2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
