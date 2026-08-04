'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, Trash2, X, Loader2, RefreshCw, Grid3x3, AlertCircle } from 'lucide-react';
import {
  fetchTables, createTable, updateTable, deleteTable, type ApiTable,
} from '@/lib/admin-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

export default function TablesPage() {
  const restaurantId = String(useParams().restaurantId ?? '');

  const [rows, setRows]       = useState<ApiTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState<{ msg: string; kind: 'ok'|'err' } | null>(null);
  const [modal, setModal]     = useState<{ open: boolean; edit?: ApiTable }>({ open: false });

  const say = (msg: string, kind: 'ok'|'err' = 'ok') => {
    setToast({ msg, kind }); setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true); setError('');
    try { setRows(await fetchTables(restaurantId)); }
    catch (e: any) { setError(e?.message ?? 'Could not load tables'); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(t: ApiTable) {
    if (!confirm(`Delete table "${t.tableNumber}"? Its QR code will stop working.`)) return;
    try { await deleteTable(t.tableId, restaurantId); say('Table deleted'); load(); }
    catch (e: any) { say(e.message, 'err'); }
  }

  const zones = Array.from(new Set(rows.map(r => r.zone).filter(Boolean)));

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Physical tables in this branch. Each one gets its own QR code.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={ghost}><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setModal({ open: true })} style={primary}>
            <Plus size={16} /> New Table
          </button>
        </div>
      </div>

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Stat label="Tables" value={rows.length} />
          <Stat label="Zones"  value={zones.length} />
          <Stat label="Seats"  value={rows.reduce((s, r) => s + (r.capacity ?? 0), 0)} />
        </div>
      )}

      {loading && <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</div>}

      {!loading && error && <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
        <AlertCircle size={20} /> {error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: C.subtle }}>
          <Grid3x3 size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No tables yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Add tables here, then print their QR codes from the QR tab.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: C.bg }}>
              <tr><th style={th}>Table</th><th style={th}>Zone</th>
                  <th style={th}>Outlet</th><th style={th}>Seats</th><th style={th}></th></tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.tableId} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...cell, fontWeight: 600 }}>{t.tableNumber}</td>
                  <td style={{ ...cell, color: C.muted }}>{t.zone || '—'}</td>
                  <td style={{ ...cell, color: C.muted }}>{t.outlet || '—'}</td>
                  <td style={cell}>{t.capacity}</td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setModal({ open: true, edit: t })}
                            style={{ ...ghost, marginRight: 6 }}><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(t)} style={{ ...ghost, color: C.red }}>
                      <Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <TableModal restaurantId={restaurantId} edit={modal.edit}
                    onClose={() => setModal({ open: false })}
                    onSaved={() => { setModal({ open: false }); load(); }} say={say} />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 18px', borderRadius: 10,
          background: toast.kind === 'ok' ? C.green : C.red, color: '#fff',
          fontWeight: 600, fontSize: 14, zIndex: 100,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

function TableModal({ restaurantId, edit, onClose, onSaved, say }: {
  restaurantId: string;
  edit?: ApiTable;
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok'|'err') => void;
}) {
  const [f, setF] = useState({
    tableNumber: edit?.tableNumber ?? '',
    zone:        edit?.zone ?? 'Main Hall',
    outlet:      edit?.outlet ?? 'Main Hall',
    capacity:    edit?.capacity ?? 4,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      if (edit) { await updateTable(edit.tableId, f, restaurantId); say('Table updated'); }
      else      { await createTable(f, restaurantId); say('Table created'); }
      onSaved();
    } catch (e: any) { say(e.message, 'err'); }
    finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {edit ? 'Edit Table' : 'New Table'}
          </h3>
          <button onClick={onClose} style={{ ...ghost, border: 'none' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={label}>Table Number</label>
            <input style={input} value={f.tableNumber} placeholder="T1"
                   onChange={e => set('tableNumber', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>Zone</label>
              <input style={input} value={f.zone} onChange={e => set('zone', e.target.value)} />
            </div>
            <div>
              <label style={label}>Outlet</label>
              <input style={input} value={f.outlet} onChange={e => set('outlet', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={label}>Seats</label>
            <input style={input} type="number" value={f.capacity}
                   onChange={e => set('capacity', parseInt(e.target.value) || 1)} />
          </div>
          <button onClick={save} disabled={saving || !f.tableNumber.trim()}
                  style={{ ...primary, justifyContent: 'center',
                           opacity: saving || !f.tableNumber.trim() ? 0.6 : 1 }}>
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {edit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '10px 16px', minWidth: 90,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    textTransform: 'uppercase', color: C.subtle }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{value}</div>
    </div>
  );
}

const primary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: 'none', borderRadius: 8, background: C.red, color: '#fff',
  fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const ghost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px',
  border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: C.text,
};
const cell: React.CSSProperties = { padding: '11px 12px', fontSize: 14, color: C.text };
const th: React.CSSProperties = {
  padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
  textTransform: 'uppercase', color: C.subtle, textAlign: 'left',
};
const input: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 5,
};
