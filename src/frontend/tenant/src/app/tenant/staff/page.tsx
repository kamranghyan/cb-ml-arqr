'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, RefreshCw, AlertCircle, Plus, Trash2, X } from 'lucide-react';
import { fetchUsers, createStaff, deleteUser, type ApiUser } from '@/lib/auth-api';
import { fetchRestaurants, type ApiRestaurant } from '@/lib/admin-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

export default function StaffPage() {
  const [users, setUsers]   = useState<ApiUser[]>([]);
  const [rests, setRests]   = useState<ApiRestaurant[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState('');
  const [toast, setToast]   = useState<{ msg: string; kind: 'ok'|'err' } | null>(null);
  const [open, setOpen]     = useState(false);

  const say = (msg: string, kind: 'ok'|'err' = 'ok') => {
    setToast({ msg, kind }); setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoad(true); setError('');
    try {
      const [u, r] = await Promise.all([fetchUsers(), fetchRestaurants()]);
      setUsers(u); setRests(r);
    } catch (e: any) { setError(e?.message ?? 'Could not load staff'); }
    finally { setLoad(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nameOf = (rid: string) =>
    rests.find(r => r.restaurantId === rid)?.name ?? (rid ? '—' : 'All branches');

  async function remove(u: ApiUser) {
    if (!confirm(`Remove ${u.email}? They will lose access immediately.`)) return;
    try { await deleteUser(u.username); say('User removed'); load(); }
    catch (e: any) { say(e.message, 'err'); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Staff</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            Kitchen users. Each one sees only the restaurant you assign.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={ghost}><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setOpen(true)} style={primary}><Plus size={16} /> Add Kitchen User</button>
        </div>
      </div>

      {loading && <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</div>}

      {!loading && error && <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
        <AlertCircle size={20} /> {error}</div>}

      {!loading && !error && users.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: C.subtle }}>
          <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No staff yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Add a kitchen user so they can work the orders screen.
          </p>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: C.bg }}>
              <tr><th style={th}>Email</th><th style={th}>Name</th>
                  <th style={th}>Restaurant</th><th style={th}>Status</th><th style={th}></th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.username} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={cell}>{u.email}</td>
                  <td style={{ ...cell, color: C.muted }}>{u.name || '—'}</td>
                  <td style={{ ...cell, color: C.muted }}>{nameOf(u.restaurantId)}</td>
                  <td style={cell}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: u.enabled ? C.green : C.red }}>
                      {u.enabled ? '● active' : '● disabled'}
                    </span>
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    <button onClick={() => remove(u)} style={{ ...ghost, color: C.red }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <AddModal restaurants={rests} onClose={() => setOpen(false)}
                        onSaved={() => { setOpen(false); load(); }} say={say} />}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 18px', borderRadius: 10,
          background: toast.kind === 'ok' ? C.green : C.red, color: '#fff',
          fontWeight: 600, fontSize: 14, maxWidth: 420, zIndex: 100,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

function AddModal({ restaurants, onClose, onSaved, say }: {
  restaurants: ApiRestaurant[];
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok'|'err') => void;
}) {
  const [f, setF] = useState({
    email: '', password: '', name: '',
    restaurantId: restaurants[0]?.restaurantId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await createStaff({
        email: f.email, password: f.password, name: f.name, restaurantId: f.restaurantId,
      });
      say(`Created — share the login with ${f.email}`);
      onSaved();
    } catch (e: any) { say(e.message, 'err'); }
    finally { setSaving(false); }
  }

  const ok = f.email.trim() && f.password.length >= 8 && f.restaurantId;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Add Kitchen User</h3>
          <button onClick={onClose} style={{ ...ghost, border: 'none' }}><X size={18} /></button>
        </div>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 18px' }}>
          They will only see orders for the restaurant you pick.
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={label}>Restaurant</label>
            <select style={input} value={f.restaurantId} onChange={e => set('restaurantId', e.target.value)}>
              {restaurants.map(r => (
                <option key={r.restaurantId} value={r.restaurantId}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Email</label>
            <input style={input} type="email" value={f.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label style={label}>Name</label>
            <input style={input} value={f.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label style={label}>Temporary Password</label>
            <input style={input} value={f.password} placeholder="min 8 chars, upper + lower + number + symbol"
                   onChange={e => set('password', e.target.value)} />
          </div>
          <button onClick={save} disabled={saving || !ok}
                  style={{ ...primary, justifyContent: 'center', opacity: saving || !ok ? 0.6 : 1 }}>
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />} Create
          </button>
        </div>
      </div>
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
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 5,
};