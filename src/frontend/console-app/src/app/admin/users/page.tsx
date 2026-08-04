'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Loader2, RefreshCw, AlertCircle, Plus, Trash2, X, Shield,
} from 'lucide-react';
import {
  fetchUsers, createAdmin, deleteUser, fetchTenants,
  type ApiUser, type ApiTenant,
} from '@/lib/auth-api';
import { loadUser } from '@/lib/cognito';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF', green: '#0F9D58',
};

export default function UsersPage() {
  const [users, setUsers]     = useState<ApiUser[]>([]);
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState<{ msg: string; kind: 'ok'|'err' } | null>(null);
  const [open, setOpen]       = useState(false);
  const [filter, setFilter]   = useState('');

  const me = typeof window !== 'undefined' ? loadUser() : null;

  const say = (msg: string, kind: 'ok'|'err' = 'ok') => {
    setToast({ msg, kind }); setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [u, t] = await Promise.all([fetchUsers(), fetchTenants().catch(() => [])]);
      setUsers(u); setTenants(t);
    } catch (e: any) { setError(e?.message ?? 'Could not load users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // A user with no tenant is a platform admin; otherwise show its company.
  const companyOf = (u: ApiUser) =>
    u.tenantId
      ? tenants.find(t => t.tenantId === u.tenantId)?.companyName ?? u.tenantId.slice(0, 8)
      : 'Platform';

  const shown = filter
    ? users.filter(u =>
        u.email.toLowerCase().includes(filter.toLowerCase()) ||
        companyOf(u).toLowerCase().includes(filter.toLowerCase()))
    : users;

  async function remove(u: ApiUser) {
    if (me && u.email === me.email) {
      say('You cannot delete your own account.', 'err');
      return;
    }
    if (!confirm(`Delete ${u.email}? They lose access immediately.`)) return;
    try { await deleteUser(u.username); say('User deleted'); load(); }
    catch (e: any) { say(e.message, 'err'); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1050, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>Users</h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            Everyone on the platform — administrators, company owners and kitchen staff.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={ghost}><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setOpen(true)} style={primary}>
            <Plus size={16} /> New Admin
          </button>
        </div>
      </div>

      <input
        value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="Filter by email or company…"
        style={{ ...input, maxWidth: 320, marginBottom: 16 }}
      />

      {loading && <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</div>}

      {!loading && error && <div style={{ padding: 40, textAlign: 'center', color: C.red }}>
        <AlertCircle size={20} /> {error}</div>}

      {!loading && !error && shown.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: C.subtle }}>
          <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>
            {filter ? 'Nothing matches that filter.' : 'No users yet.'}
          </p>
        </div>
      )}

      {!loading && !error && shown.length > 0 && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: C.bg }}>
              <tr>
                <th style={th}>Email</th><th style={th}>Name</th>
                <th style={th}>Company</th><th style={th}>Status</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(u => {
                const isPlatform = !u.tenantId;
                return (
                  <tr key={u.username} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={cell}>
                      {u.email}
                      {me && u.email === me.email && (
                        <span style={{ fontSize: 11, color: C.subtle, marginLeft: 6 }}>(you)</span>
                      )}
                    </td>
                    <td style={{ ...cell, color: C.muted }}>{u.name || '—'}</td>
                    <td style={cell}>
                      {isPlatform ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: `${C.red}15`, color: C.red,
                        }}>
                          <Shield size={11} /> Platform
                        </span>
                      ) : (
                        <span style={{ color: C.muted }}>{companyOf(u)}</span>
                      )}
                    </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <AdminModal onClose={() => setOpen(false)}
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

function AdminModal({ onClose, onSaved, say }: {
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok'|'err') => void;
}) {
  const [f, setF] = useState({ email: '', password: '', name: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await createAdmin(f);
      say(`Administrator created — share the login with ${f.email}`);
      onSaved();
    } catch (e: any) { say(e.message, 'err'); }
    finally { setSaving(false); }
  }

  const ok = f.email.trim() && f.password.length >= 8;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>New Administrator</h3>
          <button onClick={onClose} style={{ ...ghost, border: 'none' }}><X size={18} /></button>
        </div>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 18px' }}>
          Full platform access — tenants, plans and support. Not tied to any company.
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={label}>Email</label>
            <input style={input} type="email" value={f.email}
                   onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label style={label}>Name</label>
            <input style={input} value={f.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label style={label}>Temporary Password</label>
            <input style={input} value={f.password}
                   placeholder="min 8 chars, upper + lower + number + symbol"
                   onChange={e => set('password', e.target.value)} />
          </div>
          <button onClick={save} disabled={saving || !ok}
                  style={{ ...primary, justifyContent: 'center', opacity: saving || !ok ? 0.6 : 1 }}>
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            Create Administrator
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
