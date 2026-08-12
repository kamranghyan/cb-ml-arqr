'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, Loader2, RefreshCw, Building2,
  Pause, Play, AlertCircle,
} from 'lucide-react';
import {
  fetchTenants, createTenant, updateTenant, deleteTenant,
  planUsage, PLAN_LABELS,
  type ApiTenant, type PlanTier,
} from '@/lib/auth-api';
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

type Toast = { msg: string; kind: 'ok' | 'err' } | null;

export default function TenantsView() {
  const { D } = useD();
  const [rows, setRows]       = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState<Toast>(null);
  const [modal, setModal]     = useState<{ open: boolean; edit?: ApiTenant }>({ open: false });

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setRows(await fetchTenants());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(t: ApiTenant) {
    const next = !t.isActive;
    if (!next && !confirm(
      `Suspend "${t.companyName}"?\n\nThe owner will not be able to log in and ` +
      `no new restaurants can be created until you reactivate them.`
    )) return;

    try {
      await updateTenant(t.tenantId, { isActive: next });
      showToast(next ? 'Tenant activated' : 'Tenant suspended');
      load();
    } catch (e: any) { showToast(e.message, 'err'); }
  }

  async function onDelete(t: ApiTenant) {
    if (t.restaurantCount > 0) {
      showToast(
        `"${t.companyName}" still owns ${t.restaurantCount} restaurant(s). ` +
        `They must be deleted first.`, 'err');
      return;
    }
    if (!confirm(`Delete "${t.companyName}" and its owner login? This cannot be undone.`)) return;

    try {
      await deleteTenant(t.tenantId);
      showToast('Tenant deleted');
      load();
    } catch (e: any) { showToast(e.message, 'err'); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: '0 0 4px', fontFamily: "'Baloo 2', sans-serif" }}>
            Tenants
          </h1>
          <p style={{ color: D.muted, fontSize: 14, margin: 0 }}>
            Customer companies on the platform. Each one manages its own restaurants.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnGhost(D)}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setModal({ open: true })} style={btn(BRAND)}>
            <Plus size={16} /> New Tenant
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && !error && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <Stat label="Tenants" value={rows.length} D={D} />
          <Stat label="Active"  value={rows.filter(r => r.isActive).length} D={D} />
          <Stat label="Restaurants"
                value={rows.reduce((s, r) => s + (r.restaurantCount ?? 0), 0)} D={D} />
        </div>
      )}

      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: D.muted }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading tenants…
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 40, textAlign: 'center', color: BRAND }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: D.subtle }}>
          <Building2 size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No tenants yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Create one to onboard your first customer company.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: D.bg }}>
              <tr>
                <th style={th(D)}>Company</th>
                <th style={th(D)}>Owner</th>
                <th style={th(D)}>Plan</th>
                <th style={th(D)}>Usage</th>
                <th style={th(D)}>Status</th>
                <th style={th(D)}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.tenantId} style={{ borderTop: `1px solid ${D.border}` }}>
                  <td style={{ ...cell(D), fontWeight: 600 }}>{t.companyName}</td>
                  <td style={{ ...cell(D), color: D.muted }}>{t.email}</td>
                  <td style={cell(D)}>
                    <span style={planBadge(t.planTier)}>{t.planTier}</span>
                  </td>
                  <td style={{ ...cell(D), color: D.muted, fontSize: 13 }}>{planUsage(t)}</td>
                  <td style={cell(D)}>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: t.isActive ? GREEN : BRAND,
                    }}>
                      {t.isActive ? '● active' : '● suspended'}
                    </span>
                  </td>
                  <td style={{ ...cell(D), textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => toggleActive(t)} style={{ ...iconBtn(D), marginRight: 6 }}
                            title={t.isActive ? 'Suspend' : 'Activate'}>
                      {t.isActive ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button onClick={() => setModal({ open: true, edit: t })}
                            style={{ ...iconBtn(D), marginRight: 6 }} title="Edit plan">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => onDelete(t)} style={{ ...iconBtn(D), color: BRAND }}
                            title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <TenantModal
          edit={modal.edit}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
          showToast={showToast}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 18px', borderRadius: 10,
          background: toast.kind === 'ok' ? GREEN : BRAND, color: '#fff',
          fontWeight: 600, fontSize: 14, maxWidth: 420,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 100,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Modal — top-level sibling ────────────────────────────────────────────

function TenantModal({ edit, onClose, onSaved, showToast }: {
  edit?: ApiTenant;
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string, k?: 'ok' | 'err') => void;
}) {
  const { D } = useD();
  const isEdit = Boolean(edit);
  const [f, setF] = useState({
    companyName: edit?.companyName ?? '',
    email:       edit?.email ?? '',
    password:    '',
    name:        '',
    planTier:    (edit?.planTier ?? 'starter') as PlanTier,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      if (isEdit) {
        await updateTenant(edit!.tenantId, {
          companyName: f.companyName,
          planTier:    f.planTier,
        });
        showToast('Tenant updated');
      } else {
        await createTenant({
          companyName: f.companyName,
          email:       f.email,
          password:    f.password,
          name:        f.name,
          planTier:    f.planTier,
        });
        showToast(`Tenant created — share the login with ${f.email}`);
      }
      onSaved();
    } catch (e: any) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  const canSave = isEdit
    ? f.companyName.trim().length > 0
    : f.companyName.trim() && f.email.trim() && f.password.length >= 8;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: D.card, borderRadius: 14, padding: 24, width: '100%',
        maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: D.text, fontFamily: "'Baloo 2', sans-serif" }}>
            {isEdit ? 'Edit Tenant' : 'New Tenant'}
          </h3>
          <button onClick={onClose} style={{ ...iconBtn(D), border: 'none' }}><X size={18} /></button>
        </div>
        <p style={{ color: D.muted, fontSize: 13, margin: '0 0 18px' }}>
          {isEdit
            ? 'Change the company name or subscription plan.'
            : 'Creates the company and its owner login in one step. The owner then adds their own restaurants.'}
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={label(D)}>Company Name</label>
            <input style={input(D)} value={f.companyName} placeholder="McDonald's Pakistan"
                   onChange={e => set('companyName', e.target.value)} />
          </div>

          {!isEdit && (
            <>
              <div>
                <label style={label(D)}>Owner Email</label>
                <input style={input(D)} type="email" value={f.email} placeholder="owner@company.com"
                       onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label style={label(D)}>Owner Name</label>
                <input style={input(D)} value={f.name} placeholder="Ali Khan"
                       onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label style={label(D)}>Temporary Password</label>
                <input style={input(D)} type="text" value={f.password}
                       placeholder="min 8 chars, upper + lower + number + symbol"
                       onChange={e => set('password', e.target.value)} />
                <p style={{ fontSize: 12, color: D.subtle, margin: '4px 0 0' }}>
                  Share this with the owner — they can change it after logging in.
                </p>
              </div>
            </>
          )}

          <div>
            <label style={label(D)}>Subscription Plan</label>
            <select style={input(D)} value={f.planTier}
                    onChange={e => set('planTier', e.target.value as PlanTier)}>
              {(Object.keys(PLAN_LABELS) as PlanTier[]).map(p => (
                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
              ))}
            </select>
            {isEdit && (
              <p style={{ fontSize: 12, color: D.subtle, margin: '4px 0 0' }}>
                Currently using {edit!.restaurantCount} restaurant(s). Lowering the plan
                does not delete anything, but blocks new ones past the limit.
              </p>
            )}
          </div>

          <button onClick={save} disabled={saving || !canSave}
                  style={{ ...btn(BRAND), justifyContent: 'center',
                           opacity: saving || !canSave ? 0.6 : 1, marginTop: 4 }}>
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {isEdit ? 'Save Changes' : 'Create Tenant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────

function Stat({ label, value, D }: { label: string; value: number; D: DShape }) {
  return (
    <div style={{
      background: D.card, border: `1px solid ${D.border}`, borderRadius: 12,
      padding: '12px 18px', minWidth: 110,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1,
                    textTransform: 'uppercase', color: D.subtle }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: D.text, fontFamily: "'Baloo 2', sans-serif" }}>{value}</div>
    </div>
  );
}

const btn = (bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: 'none', borderRadius: 8, background: bg, color: '#fff',
  fontWeight: 700, fontSize: 13, cursor: 'pointer',
});

const btnGhost = (D: DShape): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${D.border}`, borderRadius: 8, background: D.card,
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: D.text,
});

const iconBtn = (D: DShape): React.CSSProperties => ({
  padding: 6, border: `1px solid ${D.border}`, borderRadius: 6,
  background: D.card, cursor: 'pointer', display: 'inline-flex',
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

// Plan tiers use shading within the brand color rather than three unrelated
// hues — there's no strict convention these need to differ in a specific
// universally-understood way, unlike active/suspended status.
function planBadge(plan: string): React.CSSProperties {
  const colors: Record<string, string> = {
    starter:      '#9CA3AF',
    professional: '#ff5723',
    enterprise:   '#c2410c',
  };
  const c = colors[plan] ?? '#9CA3AF';
  return {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 0.5, padding: '3px 8px', borderRadius: 6,
    background: `${c}22`,
    color: c,
  };
}