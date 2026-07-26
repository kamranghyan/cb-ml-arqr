'use client';

import { useState, useEffect, useCallback } from 'react';
import { Edit2, Lock, X, ShieldCheck, ShieldX, RefreshCw, Plus, AlertCircle, CheckCircle, Search } from 'lucide-react';

interface CognitoUser {
  id: string; username: string; email: string; name: string;
  role: string; tenantId: string; tenantName: string;
  status: string; enabled: boolean; createdAt: string; updatedAt: string;
  mfaEnabled: boolean; groups: string[];
}

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };

const PERMS = ['View Menu', 'Edit Menu', 'View Orders', 'Manage Users', 'QR Codes', 'Analytics'];
const DEFAULT_PERMS = [true, true, true, false, true, false];

function getRoleCfg(role: string): { label: string; bg: string; color: string; border: string; initBg: string } {
  if (role === 'super_admin' || role === 'menulay_admin')
    return { label: 'Super Admin',   bg: '#FFF3E0', color: '#c2410c', border: '#FED7AA', initBg: '#FFF3E0' };
  if (role === 'manager')
    return { label: 'Manager',       bg: '#EFF6FF', color: '#1d4ed8', border: '#BFDBFE', initBg: '#EFF6FF' };
  if (role === 'kitchen' || role === 'kds')
    return { label: 'Kitchen Staff', bg: '#FAF5FF', color: '#7c3aed', border: '#DDD6FE', initBg: '#FAF5FF' };
  return   { label: role || 'Admin', bg: '#F0FFF4', color: '#16a34a', border: '#BBF7D0', initBg: '#F0FFF4' };
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase() || 'U';
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<CognitoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [perms,   setPerms]   = useState(DEFAULT_PERMS);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'manager' });

  const [apiNote, setApiNote] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('dp_access') ?? localStorage.getItem('dp_id') ?? '')
        : '';
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: token },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `API ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      if (data.note) setApiNote(data.note);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(u =>
    search === '' ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total Users',  val: users.length,                              color: C.text    },
    { label: 'Enabled',      val: users.filter(u => u.enabled).length,       color: '#16a34a' },
    { label: 'MFA Enabled',  val: users.filter(u => u.mfaEnabled).length,    color: C.red     },
    { label: 'Confirmed',    val: users.filter(u => u.status === 'CONFIRMED').length, color: '#d97706' },
  ];

  const togglePerm = (i: number) => setPerms(p => p.map((v, idx) => idx === i ? !v : v));

  const saveUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false); setSaved(true);
    setTimeout(() => { setModal(false); setSaved(false); setNewUser({ name: '', email: '', role: 'manager' }); setPerms(DEFAULT_PERMS); }, 900);
  };

  const inputStyle: React.CSSProperties = { width: '100%', height: 42, borderRadius: 10, padding: '0 12px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' };

  return (
    <>
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: C.white, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>User Management</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Cognito User Pool · Role-based access control</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.subtle, pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…"
              style={{ height: 36, paddingLeft: 36, paddingRight: 14, borderRadius: 10, width: 200, fontSize: 13, background: C.bg, border: `1.5px solid ${C.border}`, color: C.text, outline: 'none' }}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
              onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
            />
          </div>
          <button onClick={loadUsers} title="Refresh"
            style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3E0', border: '1.5px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={14} color={C.dark} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setModal(true); setSaved(false); setPerms(DEFAULT_PERMS); setNewUser({ name: '', email: '', role: 'manager' }); }}
            style={{ height: 36, padding: '0 16px', borderRadius: 10, background: C.red, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,37,27,0.25)' }}>
            <Plus size={15} /> Add User
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: C.bg, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 10px' }}>{s.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Georgia, serif', margin: 0, lineHeight: 1 }}>
                {loading ? '…' : s.val}
              </p>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#FFF0F0', border: '1.5px solid #FFD0D0', borderRadius: 14 }}>
            <AlertCircle size={16} color={C.red} style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: C.red, flex: 1, margin: 0 }}>{error}</p>
            <button onClick={loadUsers} style={{ padding: '6px 14px', borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFD0D0', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* API info note */}
        {apiNote && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12 }}>
            <span style={{ fontSize: 14 }}>ℹ️</span>
            <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>{apiNote}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0E8E0', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 10, width: '25%', background: '#F0E8E0', borderRadius: 6 }} />
                  <div style={{ height: 8, width: '35%', background: '#F0E8E0', borderRadius: 6 }} />
                </div>
                <div style={{ width: 80, height: 24, background: '#F0E8E0', borderRadius: 20 }} />
                <div style={{ width: 60, height: 24, background: '#F0E8E0', borderRadius: 20 }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, border: `2px dashed ${C.border}`, borderRadius: 20, background: C.white }}>
            <span style={{ fontSize: 36, opacity: 0.2 }}>👤</span>
            <p style={{ fontSize: 13, color: C.subtle, margin: 0 }}>{search ? 'No users match your search' : 'No users found in Cognito pool'}</p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(137,28,28,0.05)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 120px 90px 100px 1fr 90px', gap: 12, padding: '10px 20px', borderBottom: `1.5px solid ${C.border}`, background: C.bg }}>
              {['User', 'Role', 'MFA', 'Status', 'Created', 'Actions'].map(h => (
                <p key={h} style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{h}</p>
              ))}
            </div>

            {filtered.map(user => {
              const cfg = getRoleCfg(user.role);
              const ini = initials(user.name);
              return (
                <div key={user.id}
                  style={{ display: 'grid', gridTemplateColumns: '220px 120px 90px 100px 1fr 90px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.bg}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

                  {/* Avatar + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.initBg, border: `1.5px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: cfg.color, flexShrink: 0 }}>
                      {ini}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                      <p style={{ fontSize: 11, color: C.subtle, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>

                  {/* MFA */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: user.mfaEnabled ? '#F0FFF4' : '#FFF0F0', color: user.mfaEnabled ? '#16a34a' : C.red, border: `1px solid ${user.mfaEnabled ? '#BBF7D0' : '#FFD0D0'}` }}>
                    {user.mfaEnabled ? <ShieldCheck size={11} /> : <ShieldX size={11} />}
                    {user.mfaEnabled ? 'On' : 'Off'}
                  </span>

                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: user.enabled && user.status === 'CONFIRMED' ? '#22c55e' : user.status === 'FORCE_CHANGE_PASSWORD' ? '#f97316' : '#D1D5DB', display: 'inline-block' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: user.enabled && user.status === 'CONFIRMED' ? '#16a34a' : user.status === 'FORCE_CHANGE_PASSWORD' ? '#c2410c' : C.subtle }}>
                      {user.status === 'CONFIRMED' ? 'Active' : user.status === 'FORCE_CHANGE_PASSWORD' ? 'Pending' : user.status}
                    </span>
                  </div>

                  {/* Created */}
                  <p style={{ fontSize: 11, color: C.subtle, margin: 0 }}>{formatDate(user.createdAt)}</p>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button title="Edit user"
                      style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF3E0', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Edit2 size={12} color={C.dark} />
                    </button>
                    <button title="Reset password"
                      style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF0F0', border: '1px solid #FFD0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Lock size={12} color={C.red} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: `1.5px solid ${C.border}`, background: C.bg }}>
              <p style={{ fontSize: 11, color: C.subtle, margin: 0 }}>Showing {filtered.length} of {users.length} users</p>
              <p style={{ fontSize: 11, color: '#D1D5DB', fontFamily: 'monospace', margin: 0 }}>Source: AWS Cognito User Pool</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Create User Modal ──────────────────────────────────────────────── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 24, width: 420, padding: 24, boxShadow: '0 20px 60px rgba(137,28,28,0.15)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>Create New User</h2>
              <button onClick={() => setModal(false)} style={{ width: 32, height: 32, borderRadius: 10, background: C.bg, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color={C.muted} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Full Name</label>
              <input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Ahmed Raza" style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Email Address</label>
              <input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="ahmed@daspardes.com" style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Role</label>
              <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} style={{ ...inputStyle, appearance: 'none' as any }}
                onFocus={e => (e.target as HTMLSelectElement).style.borderColor = C.red}
                onBlur={e  => (e.target as HTMLSelectElement).style.borderColor = C.border}>
                <option value="manager">Manager</option>
                <option value="kitchen">Kitchen Staff</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Permissions</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PERMS.map((perm, i) => (
                  <div key={perm} onClick={() => togglePerm(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${perms[i] ? '#FED0CC' : C.border}`, background: perms[i] ? '#FFF0EE' : C.white, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${perms[i] ? C.red : C.border}`, background: perms[i] ? C.red : C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                      {perms[i] && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: perms[i] ? C.red : C.muted }}>{perm}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(false)}
                style={{ flex: 1, height: 42, borderRadius: 12, background: C.bg, border: `1.5px solid ${C.border}`, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveUser} disabled={saving || !newUser.name.trim() || !newUser.email.trim()}
                style={{ flex: 2, height: 42, borderRadius: 12, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.2s',
                  background: saved ? '#F0FFF4' : (!newUser.name.trim() || !newUser.email.trim() || saving) ? '#ccc' : C.red,
                  color:      saved ? '#16a34a' : '#fff',
                  border:     saved ? '1.5px solid #BBF7D0' : 'none',
                  boxShadow:  saved || !newUser.name.trim() ? 'none' : '0 4px 12px rgba(225,37,27,0.25)',
                }}>
                {saving
                  ? <><div style={{ width: 16, height: 16, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></>
                  : saved ? <><CheckCircle size={15} /> User Created!</>
                  : <>👤 Create User</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}