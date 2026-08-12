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
import { useTheme } from '@/hooks/useTheme';

const BRAND = '#ff5723';
const GREEN = '#16a34a';

function useD() {
  const { isDark } = useTheme();
  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', subtle: '#6B7280',
  } : {
    bg: '#FFFFFF', card: '#fff', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', subtle: '#9CA3AF',
  };
  return { isDark, D };
}
type DShape = ReturnType<typeof useD>['D'];

export default function UsersView() {
  const { D } = useD();
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: '0 0 4px', fontFamily: "'Baloo 2', sans-serif" }}>Users</h1>
          <p style={{ color: D.muted, fontSize: 14, margin: 0 }}>
            Everyone on the platform — administrators, company owners and kitchen staff.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={ghost(D)}><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setOpen(true)} style={primary}>
            <Plus size={16} /> New Admin
          </button>
        </div>
      </div>

      <input
        value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="Filter by email or company…"
        style={{ ...input(D), maxWidth: 320, marginBottom: 16 }}
      />

      {loading && <div style={{ padding: 60, textAlign: 'center', color: D.muted }}>
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</div>}

      {!loading && error && <div style={{ padding: 40, textAlign: 'center', color: BRAND }}>
        <AlertCircle size={20} /> {error}</div>}

      {!loading && !error && shown.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: D.subtle }}>
          <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>
            {filter ? 'Nothing matches that filter.' : 'No users yet.'}
          </p>
        </div>
      )}

      {!loading && !error && shown.length > 0 && (
        <div style={{ border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: D.bg }}>
              <tr>
                <th style={th(D)}>Email</th><th style={th(D)}>Name</th>
                <th style={th(D)}>Company</th><th style={th(D)}>Status</th><th style={th(D)}></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(u => {
                const isPlatform = !u.tenantId;
                return (
                  <tr key={u.username} style={{ borderTop: `1px solid ${D.border}` }}>
                    <td style={cell(D)}>
                      {u.email}
                      {me && u.email === me.email && (
                        <span style={{ fontSize: 11, color: D.subtle, marginLeft: 6 }}>(you)</span>
                      )}
                    </td>
                    <td style={{ ...cell(D), color: D.muted }}>{u.name || '—'}</td>
                    <td style={cell(D)}>
                      {isPlatform ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: 'rgba(255,87,35,0.13)', color: BRAND,
                        }}>
                          <Shield size={11} /> Platform
                        </span>
                      ) : (
                        <span style={{ color: D.muted }}>{companyOf(u)}</span>
                      )}
                    </td>
                    <td style={cell(D)}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: u.enabled ? GREEN : BRAND }}>
                        {u.enabled ? '● active' : '● disabled'}
                      </span>
                    </td>
                    <td style={{ ...cell(D), textAlign: 'right' }}>
                      <button onClick={() => remove(u)} style={{ ...ghost(D), color: BRAND }}>
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
          background: toast.kind === 'ok' ? GREEN : BRAND, color: '#fff',
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
  const { D } = useD();
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
        background: D.card, borderRadius: 14, padding: 24, width: '100%', maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: D.text, fontFamily: "'Baloo 2', sans-serif" }}>New Administrator</h3>
          <button onClick={onClose} style={{ ...ghost(D), border: 'none' }}><X size={18} /></button>
        </div>
        <p style={{ color: D.muted, fontSize: 13, margin: '0 0 18px' }}>
          Full platform access — tenants, plans and support. Not tied to any company.
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={label(D)}>Email</label>
            <input style={input(D)} type="email" value={f.email}
                   onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label style={label(D)}>Name</label>
            <input style={input(D)} value={f.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label style={label(D)}>Temporary Password</label>
            <input style={input(D)} value={f.password}
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
  border: 'none', borderRadius: 8, background: BRAND, color: '#fff',
  fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const ghost = (D: DShape): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px',
  border: `1px solid ${D.border}`, borderRadius: 8, background: D.card,
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: D.text,
});
const cell = (D: DShape): React.CSSProperties => ({ padding: '11px 12px', fontSize: 14, color: D.text });
const th = (D: DShape): React.CSSProperties => ({
  padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
  textTransform: 'uppercase', color: D.subtle, textAlign: 'left',
});
const input = (D: DShape): React.CSSProperties => ({
  width: '100%', padding: '9px 11px', border: `1px solid ${D.border}`,
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: D.bg, color: D.text,
});
const label = (D: DShape): React.CSSProperties => ({
  display: 'block', fontSize: 12, fontWeight: 700, color: D.muted, marginBottom: 5,
});