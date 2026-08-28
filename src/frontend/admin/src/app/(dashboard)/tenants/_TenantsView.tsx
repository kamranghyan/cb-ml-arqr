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
import { getTheme } from '@/lib/theme';
import { toast } from 'sonner';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  green: isDark ? '#4ade80' : '#16a34a',
  placeholder: isDark ? '#6B7280' : '#888888', // ✅ Light: dark gray
});


export default function TenantsView() {
  const [rows, setRows] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiTenant }>({ open: false });
  const [isDark, setIsDark] = useState(false);

  // ── Theme listener ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };

    updateTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);

    const handleThemeToggle = () => updateTheme();
    window.addEventListener('themeChange', handleThemeToggle);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);

  const colors = getColors(isDark);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
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
      toast.success(next ? 'Tenant activated' : 'Tenant suspended'); load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update tenant');
    }
  }

  async function onDelete(t: ApiTenant) {
    if (t.restaurantCount > 0) {
      toast.error(
        `"${t.companyName}" still owns ${t.restaurantCount} restaurant(s). They must be deleted first.`
      );
      return;
    }
    if (!confirm(`Delete "${t.companyName}" and its owner login? This cannot be undone.`)) return;

    try {
      await deleteTenant(t.tenantId);
      toast.success('Tenant deleted'); load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete tenant');
    }
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: 1100,
      margin: '0 auto',
      fontFamily: "'Poppins', sans-serif",
      background: colors.bg,
      minHeight: '100vh',
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* ── All inputs placeholder color ── */
        input::placeholder,
        input::-webkit-input-placeholder,
        input::-moz-placeholder {
          color: ${colors.placeholder} !important;
          opacity: 0.8;
        }
        input:focus {
          outline: none;
        }
        /* ── Password input placeholder (light gray in light mode) ── */
        input[type="password"]::placeholder,
        input[type="password"]::-webkit-input-placeholder,
        input[type="password"]::-moz-placeholder {
          color: ${isDark ? '#6B7280' : '#AAAAAA'} !important;
          opacity: 0.8;
        }
        select option:disabled {
          color: ${colors.placeholder};
        }
        select:focus {
          outline: none;
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{
            fontSize: 'clamp(20px, 3vw, 24px)',
            fontWeight: 700,
            color: colors.text,
            margin: '0 0 4px',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Tenants
          </h1>
          <p style={{
            color: colors.muted,
            fontSize: 14,
            margin: 0,
            fontFamily: "'Poppins', sans-serif",
          }}>
            Customer companies on the platform. Each one manages its own restaurants.
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={load}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              border: `1.5px solid ${colors.border}`,
              borderRadius: 10,
              background: colors.card,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              color: colors.text,
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              e.currentTarget.style.borderColor = BRAND;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = colors.border;
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.hoverBg;
              e.currentTarget.style.borderColor = BRAND;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.card;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button
            onClick={() => setModal({ open: true })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              border: 'none',
              borderRadius: 10,
              background: BRAND,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e64a1a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = BRAND;
            }}
          >
            <Plus size={16} /> New Tenant
          </button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      {!loading && !error && rows.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}>
          <Stat label="Tenants" value={rows.length} colors={colors} />
          <Stat label="Active" value={rows.filter(r => r.isActive).length} colors={colors} />
          <Stat label="Restaurants" value={rows.reduce((s, r) => s + (r.restaurantCount ?? 0), 0)} colors={colors} />
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          color: colors.muted,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12 }}>Loading tenants…</p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: BRAND,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && rows.length === 0 && (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          color: colors.subtle,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <Building2 size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No tenants yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Create one to onboard your first customer company.
          </p>
        </div>
      )}

      {/* ── Tenants Table ── */}
      {!loading && !error && rows.length > 0 && (
        <div style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: "'Poppins', sans-serif",
          }}>
            <thead style={{ background: colors.card2 }}>
              <tr>
                <th style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: colors.subtle,
                  textAlign: 'left',
                  fontFamily: "'Poppins', sans-serif",
                }}>Company</th>
                <th style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: colors.subtle,
                  textAlign: 'left',
                  fontFamily: "'Poppins', sans-serif",
                }}>Owner</th>
                <th style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: colors.subtle,
                  textAlign: 'left',
                  fontFamily: "'Poppins', sans-serif",
                }}>Plan</th>
                <th style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: colors.subtle,
                  textAlign: 'left',
                  fontFamily: "'Poppins', sans-serif",
                }}>Usage</th>
                <th style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: colors.subtle,
                  textAlign: 'left',
                  fontFamily: "'Poppins', sans-serif",
                }}>Status</th>
                <th style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: colors.subtle,
                  textAlign: 'right',
                  fontFamily: "'Poppins', sans-serif",
                }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.tenantId} style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.text,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{t.companyName}</td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    color: colors.muted,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{t.email}</td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    color: colors.text,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    <span style={planBadge(t.planTier, isDark)}>{t.planTier}</span>
                  </td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 13,
                    color: colors.muted,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{planUsage(t)}</td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    color: colors.text,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: t.isActive ? colors.green : BRAND,
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {t.isActive ? '● active' : '● suspended'}
                    </span>
                  </td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    <button
                      onClick={() => toggleActive(t)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 8px',
                        marginRight: 6,
                        border: `1.5px solid ${colors.border}`,
                        borderRadius: 8,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: colors.muted,
                        transition: 'all 0.2s ease',
                        outline: 'none',
                      }}
                      title={t.isActive ? 'Suspend' : 'Activate'}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                        e.currentTarget.style.borderColor = BRAND;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = colors.border;
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.hoverBg;
                        e.currentTarget.style.borderColor = BRAND;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = colors.border;
                      }}
                    >
                      {t.isActive ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => setModal({ open: true, edit: t })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 8px',
                        marginRight: 6,
                        border: `1.5px solid ${colors.border}`,
                        borderRadius: 8,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: colors.muted,
                        transition: 'all 0.2s ease',
                        outline: 'none',
                      }}
                      title="Edit plan"
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                        e.currentTarget.style.borderColor = BRAND;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = colors.border;
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.hoverBg;
                        e.currentTarget.style.borderColor = BRAND;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = colors.border;
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(t)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 8px',
                        border: `1.5px solid ${colors.border}`,
                        borderRadius: 8,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: BRAND,
                        transition: 'all 0.2s ease',
                        outline: 'none',
                      }}
                      title="Delete"
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                        e.currentTarget.style.borderColor = BRAND;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = colors.border;
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.hoverBg;
                        e.currentTarget.style.borderColor = BRAND;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = colors.border;
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tenant Modal ── */}
      {modal.open && (
        <TenantModal
          edit={modal.edit}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
          colors={colors}
          isDark={isDark}
        />
      )}

    </div>
  );
}

// ── Tenant Modal ──

function TenantModal({
  edit,
  onClose,
  onSaved,
  colors,
  isDark,
}: {
  edit?: ApiTenant;
  onClose: () => void;
  onSaved: () => void;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
}) {
  const isEdit = Boolean(edit);
  const [f, setF] = useState({
    companyName: edit?.companyName ?? '',
    email: edit?.email ?? '',
    password: '',
    name: '',
    planTier: (edit?.planTier ?? 'starter') as PlanTier,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);

    try {
      if (isEdit) {
        await updateTenant(edit!.tenantId, {
          companyName: f.companyName,
          planTier: f.planTier,
        });

        toast.success('Tenant updated successfully');
      } else {
        await createTenant({
          companyName: f.companyName,
          email: f.email,
          password: f.password,
          name: f.name,
          planTier: f.planTier,
        });

        toast.success(`Tenant created — share the login with ${f.email}`);
      }

      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save tenant');
    } finally {
      setSaving(false);
    }
  }

  const canSave = isEdit
    ? f.companyName.trim().length > 0
    : f.companyName.trim() && f.email.trim() && f.password.length >= 8;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.card,
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: `1px solid ${colors.border}`,
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: colors.text,
            fontFamily: "'Poppins', sans-serif",
          }}>
            {isEdit ? 'Edit Tenant' : 'New Tenant'}
          </h3>
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              cursor: 'pointer',
              color: colors.muted,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.hoverBg;
              e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colors.muted;
            }}
          >
            <X size={18} />
          </button>
        </div>
        <p style={{
          color: colors.muted,
          fontSize: 13,
          margin: '0 0 18px',
          fontFamily: "'Poppins', sans-serif",
        }}>
          {isEdit
            ? 'Change the company name or subscription plan.'
            : 'Creates the company and its owner login in one step. The owner then adds their own restaurants.'}
        </p>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Company Name
            </label>
            <input
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1.5px solid ${colors.border}`,
                borderRadius: 10,
                fontSize: 14,
                fontFamily: "'Poppins', sans-serif",
                boxSizing: 'border-box',
                background: colors.bg,
                color: colors.text,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
              value={f.companyName}
              placeholder="McDonald's Pakistan"
              onChange={e => set('companyName', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {!isEdit && (
            <>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.muted,
                  marginBottom: 5,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  Owner Email
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    fontFamily: "'Poppins', sans-serif",
                    boxSizing: 'border-box',
                    background: colors.bg,
                    color: colors.text,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  type="email"
                  value={f.email}
                  placeholder="owner@company.com"
                  onChange={e => set('email', e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = BRAND;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.muted,
                  marginBottom: 5,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  Owner Name
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    fontFamily: "'Poppins', sans-serif",
                    boxSizing: 'border-box',
                    background: colors.bg,
                    color: colors.text,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  value={f.name}
                  placeholder="Ali Khan"
                  onChange={e => set('name', e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = BRAND;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.muted,
                  marginBottom: 5,
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  Temporary Password
                </label>
                <input
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 10,
                    fontSize: 14,
                    fontFamily: "'Poppins', sans-serif",
                    boxSizing: 'border-box',
                    background: colors.bg,
                    color: colors.text,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  type="password"
                  value={f.password}
                  placeholder="min 8 chars, upper + lower + number + symbol"
                  onChange={e => set('password', e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = BRAND;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <p style={{
                  fontSize: 12,
                  color: colors.subtle,
                  margin: '4px 0 0',
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  Share this with the owner — they can change it after logging in.
                </p>
              </div>
            </>
          )}

          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Subscription Plan
            </label>
            <select
              style={{
                width: '100%',
                padding: '9px 12px',
                border: `1.5px solid ${colors.border}`,
                borderRadius: 10,
                fontSize: 14,
                fontFamily: "'Poppins', sans-serif",
                boxSizing: 'border-box',
                background: colors.bg,
                color: colors.text,
                outline: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              value={f.planTier}
              onChange={e => set('planTier', e.target.value as PlanTier)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {(Object.keys(PLAN_LABELS) as PlanTier[]).map(p => (
                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
              ))}
            </select>
            {isEdit && (
              <p style={{
                fontSize: 12,
                color: colors.subtle,
                margin: '4px 0 0',
                fontFamily: "'Poppins', sans-serif",
              }}>
                Currently using {edit!.restaurantCount} restaurant(s). Lowering the plan
                does not delete anything, but blocks new ones past the limit.
              </p>
            )}
          </div>

          <button
            onClick={save}
            disabled={saving || !canSave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              border: 'none',
              borderRadius: 10,
              background: BRAND,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: saving || !canSave ? 'not-allowed' : 'pointer',
              fontFamily: "'Poppins', sans-serif",
              opacity: saving || !canSave ? 0.6 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
              marginTop: 4,
            }}
            onFocus={(e) => {
              if (!saving && canSave) {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              if (!saving && canSave) {
                e.currentTarget.style.background = '#e64a1a';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving && canSave) {
                e.currentTarget.style.background = BRAND;
              }
            }}
          >
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {isEdit ? 'Save Changes' : 'Create Tenant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stat Component ──

function Stat({ label, value, colors }: { label: string; value: number; colors: ReturnType<typeof getColors> }) {
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '12px 18px',
      minWidth: 110,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.subtle,
        fontFamily: "'Poppins', sans-serif",
      }}>{label}</div>
      <div style={{
        fontSize: 22,
        fontWeight: 700,
        color: colors.text,
        fontFamily: "'Poppins', sans-serif",
      }}>{value}</div>
    </div>
  );
}

// ── Plan Badge ──

function planBadge(plan: string, isDark: boolean): React.CSSProperties {
  const colors: Record<string, string> = {
    starter: isDark ? '#9CA3AF' : '#6B7280',
    professional: '#ff5723',
    enterprise: isDark ? '#fb923c' : '#d97706',
  };
  const c = colors[plan] ?? '#9CA3AF';
  return {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: '3px 10px',
    borderRadius: 6,
    background: isDark ? `${c}22` : `${c}15`,
    color: c,
    fontFamily: "'Poppins', sans-serif",
  };
}