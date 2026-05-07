import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';

function MultiSelect({ label, icon, options, selected, setSelected, open, setOpen }) {
  if (!options.length) return null;
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-sm"
        style={{ gap: 5, background: selected.length ? '#e8f0fb' : undefined, color: selected.length ? '#185fa5' : undefined, borderColor: selected.length ? '#185fa5' : undefined }}
        onClick={() => setOpen(o => !o)}
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
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{opt}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function fmtDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

const clean = v => (v && typeof v === 'string' && !/^[-_\s.]+$/.test(v.trim())) ? v.trim() : null;

const COLS = [
  { key: 'transponder_id',  label: 'Transponder / Plate', mono: true, fmt: v => clean(v) || '—' },
  { key: 'agency',          label: 'Agency',         fmt: v => clean(v) || '—' },
  { key: 'entry_plaza',     label: 'Entry Plaza',    fmt: v => clean(v) || '—' },
  { key: 'exit_plaza',      label: 'Exit Plaza',     fmt: v => clean(v) || '—' },
  { key: 'plaza_facility',  label: 'Plaza Facility', fmt: v => clean(v) || '—' },
  { key: 'entry_datetime',  label: 'Entry Date & Time', fmt: fmtDt },
  { key: 'exit_datetime',   label: 'Exit Date & Time',  fmt: fmtDt },
  { key: 'amount',          label: 'Amount', right: true, fmt: v => `$${parseFloat(v).toFixed(2)}` },
];

export default function EzPassPage() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightRef = useRef(null);
  const [tolls, setTolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState('exit_datetime');
  const [sortDir, setSortDir] = useState(-1);
  const [search, setSearch] = useState('');
  const [deletingFile, setDeletingFile] = useState(null);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterTransponders, setFilterTransponders] = useState([]);
  const [transponderDropOpen, setTransponderDropOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, highlightId]);

  const load = async () => {
    setLoading(true);
    try {
      // Fix any existing placeholder locations silently before loading
      await api.post('/ezpass/fix-locations').catch(() => {});
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

  // Unique transponder IDs in the data
  const existingTransponders = [...new Set(tolls.map(t => t.transponder_id).filter(Boolean))].sort();

  // Unique dates (YYYY-MM-DD) that actually appear in the data
  const existingDates = [...new Set(
    tolls.map(t => {
      const dt = t.exit_datetime || t.entry_datetime;
      return dt ? dt.slice(0, 10) : null;
    }).filter(Boolean)
  )].sort();

  const filtered = tolls.filter(t => {
    if (filterTransponders.length && !filterTransponders.includes(t.transponder_id)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matches = (
        (t.transponder_id || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q) ||
        (t.source_file || '').toLowerCase().includes(q)
      );
      if (!matches) return false;
    }
    if (filterDateFrom || filterDateTo) {
      const dt = t.exit_datetime || t.entry_datetime;
      const dateStr = dt ? dt.slice(0, 10) : null;
      if (!dateStr) return false;
      if (filterDateFrom && dateStr < filterDateFrom) return false;
      if (filterDateTo && dateStr > filterDateTo) return false;
    }
    return true;
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
          <p>All toll transactions — re-uploading the same file only adds new records.</p>
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
          No toll records yet. Upload a toll statement from the Calculator page.
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

          {/* Summary + filters row */}
          {(() => {
            const hasFilters = filterTransponders.length || filterDateFrom || filterDateTo || search;
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                  <span className="badge badge-blue">
                    {hasFilters ? `${filtered.length} / ` : ''}{tolls.length} record{tolls.length !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 13, color: '#555' }}>Total: <strong>${total.toFixed(2)}</strong></span>
                  <input
                    className="form-control"
                    style={{ fontSize: 13, padding: '5px 10px', width: isMobile ? '100%' : 200, marginLeft: isMobile ? 0 : 'auto' }}
                    placeholder="Search location…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <MultiSelect
                    label="Transponder" icon="📡"
                    options={existingTransponders}
                    selected={filterTransponders}
                    setSelected={setFilterTransponders}
                    open={transponderDropOpen}
                    setOpen={setTransponderDropOpen}
                  />
                  {/* Date filters using only dates that exist in the data */}
                  <label style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>From</label>
                  <select className="form-control" style={{ fontSize: 12, padding: '5px 8px', width: 'auto' }}
                    value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}>
                    <option value="">All dates</option>
                    {existingDates.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <label style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>To</label>
                  <select className="form-control" style={{ fontSize: 12, padding: '5px 8px', width: 'auto' }}
                    value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}>
                    <option value="">All dates</option>
                    {existingDates.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {hasFilters && (
                    <button className="btn btn-sm" style={{ color: '#e24b4a', borderColor: '#e24b4a' }}
                      onClick={() => { setFilterTransponders([]); setFilterDateFrom(''); setFilterDateTo(''); setSearch(''); }}>
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {isMobile ? (
            /* Mobile: card per record */
            <div>
              {sorted.map((t) => {
                const isHighlighted = highlightId && (t._id || t.id) === highlightId;
                return (
                <div key={t._id || t.id} className="card"
                  ref={isHighlighted ? highlightRef : null}
                  style={{ marginBottom: 8, padding: '12px 14px', transition: 'background 0.4s', background: isHighlighted ? '#e8f0fb' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', flex: 1 }}>
                      {[t.agency, t.entry_plaza, t.exit_plaza, t.plaza_facility].map(clean).filter(Boolean).join(' · ') || '—'}
                    </span>
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
                );
              })}
              <div style={{ fontSize: 12, color: '#888', textAlign: 'right', marginTop: 8 }}>
                {filtered.length} record{filtered.length !== 1 ? 's' : ''}{(search || filterDateFrom || filterDateTo || filterTransponders.length) ? ' (filtered)' : ''} · Total <strong style={{ color: '#185fa5' }}>${total.toFixed(2)}</strong>
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
                    {sorted.map((t, i) => {
                      const isHighlighted = highlightId && (t._id || t.id) === highlightId;
                      return (
                      <tr key={t._id || t.id}
                        ref={isHighlighted ? highlightRef : null}
                        style={{ borderBottom: i < sorted.length - 1 ? '0.5px solid #f0ede8' : 'none', background: isHighlighted ? '#e8f0fb' : undefined, transition: 'background 0.4s' }}>
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
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8f7f4', borderTop: '1px solid #e5e3de' }}>
                      <td colSpan={8} style={{ padding: '8px 14px', fontSize: 12, color: '#888' }}>
                        {filtered.length} record{filtered.length !== 1 ? 's' : ''}{(search || filterDateFrom || filterDateTo || filterTransponders.length) ? ' (filtered)' : ''}
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
