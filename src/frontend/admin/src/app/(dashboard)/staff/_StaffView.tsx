'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, RefreshCw, AlertCircle, Plus, Trash2, X } from 'lucide-react';
import { fetchUsers, createStaff, deleteUser, type ApiUser } from '@/lib/auth-api';
import { fetchRestaurants, type ApiRestaurant } from '@/lib/admin-api';
import { getTheme } from '@/lib/theme';

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
  placeholder: isDark ? '#6B7280' : '#888888',
});

export default function StaffView() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [rests, setRests] = useState<ApiRestaurant[]>([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [open, setOpen] = useState(false);
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

  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoad(true);
    setError('');
    try {
      const [u, r] = await Promise.all([fetchUsers(), fetchRestaurants()]);
      setUsers(u);
      setRests(r);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load staff');
    } finally {
      setLoad(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nameOf = (rid: string) =>
    rests.find(r => r.restaurantId === rid)?.name ?? (rid ? '—' : 'All branches');

  async function remove(u: ApiUser) {
    if (!confirm(`Remove ${u.email}? They will lose access immediately.`)) return;
    try {
      await deleteUser(u.username);
      say('User removed');
      load();
    } catch (e: any) {
      say(e.message, 'err');
    }
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: 1000,
      margin: '0 auto',
      fontFamily: "'Poppins', sans-serif",
      background: colors.bg,
      minHeight: '100vh',
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder,
        input::-webkit-input-placeholder,
        input::-moz-placeholder {
          color: ${colors.placeholder} !important;
          opacity: 0.8;
        }
        input:focus {
          outline: none;
        }
        select:focus {
          outline: none;
        }
        select option:disabled {
          color: ${colors.placeholder};
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
            Staff
          </h1>
          <p style={{
            color: colors.muted,
            fontSize: 14,
            margin: 0,
            fontFamily: "'Poppins', sans-serif",
          }}>
            Kitchen users. Each one sees only the restaurant you assign.
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
            onClick={() => setOpen(true)}
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
            <Plus size={16} /> Add Kitchen User
          </button>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          color: colors.muted,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12 }}>Loading…</p>
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
      {!loading && !error && users.length === 0 && (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          color: colors.subtle,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No staff yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Add a kitchen user so they can work the orders screen.
          </p>
        </div>
      )}

      {/* ── Staff Table ── */}
      {!loading && !error && users.length > 0 && (
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
                }}>Email</th>
                <th style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: colors.subtle,
                  textAlign: 'left',
                  fontFamily: "'Poppins', sans-serif",
                }}>Name</th>
                <th style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: colors.subtle,
                  textAlign: 'left',
                  fontFamily: "'Poppins', sans-serif",
                }}>Restaurant</th>
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
              {users.map(u => (
                <tr key={u.username} style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    color: colors.text,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{u.email}</td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    color: colors.muted,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{u.name || '—'}</td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    color: colors.muted,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{nameOf(u.restaurantId)}</td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    color: colors.text,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: u.enabled ? colors.green : BRAND,
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {u.enabled ? '● active' : '● disabled'}
                    </span>
                  </td>
                  <td style={{
                    padding: '11px 12px',
                    fontSize: 14,
                    textAlign: 'right',
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    <button
                      onClick={() => remove(u)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 10px',
                        border: `1.5px solid ${colors.border}`,
                        borderRadius: 8,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: BRAND,
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        fontFamily: "'Poppins', sans-serif",
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

      {/* ── Add Modal ── */}
      {open && (
        <AddModal
          restaurants={rests}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); load(); }}
          say={say}
          colors={colors}
          isDark={isDark}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          padding: '12px 18px',
          borderRadius: 10,
          background: toast.kind === 'ok' ? colors.green : BRAND,
          color: '#fff',
          fontWeight: 600,
          fontSize: 14,
          maxWidth: 420,
          zIndex: 100,
          fontFamily: "'Poppins', sans-serif",
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Add Modal Component ──

function AddModal({
  restaurants,
  onClose,
  onSaved,
  say,
  colors,
  isDark,
}: {
  restaurants: ApiRestaurant[];
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok' | 'err') => void;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
}) {
  const [f, setF] = useState({
    email: '',
    password: '',
    name: '',
    restaurantId: restaurants[0]?.restaurantId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await createStaff({
        email: f.email,
        password: f.password,
        name: f.name,
        restaurantId: f.restaurantId,
      });
      say(`Created — share the login with ${f.email}`);
      onSaved();
    } catch (e: any) {
      say(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  const ok = f.email.trim() && f.password.length >= 8 && f.restaurantId;

  const passwordPlaceholderColor = isDark ? '#6B7280' : '#AAAAAA';

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
          maxWidth: 440,
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
            Add Kitchen User
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
          They will only see orders for the restaurant you pick.
        </p>

        <div style={{ display: 'grid', gap: 14 }}>
          {/* ── Restaurant Select ── */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Restaurant
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
              value={f.restaurantId}
              onChange={e => set('restaurantId', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {restaurants.map(r => (
                <option key={r.restaurantId} value={r.restaurantId}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* ── Email ── */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Email
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
              placeholder="john.doe@example.com"
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

          {/* ── Name ── */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 5,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Name
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
              placeholder="Alice, Bob, etc."
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

          {/* ── Password ── */}
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
            <style>{`
              input[type="password"]::placeholder,
              input[type="password"]::-webkit-input-placeholder,
              input[type="password"]::-moz-placeholder {
                color: ${passwordPlaceholderColor} !important;
                opacity: 0.8;
              }
            `}</style>
          </div>

          {/* ── Submit Button ── */}
          <button
            onClick={save}
            disabled={saving || !ok}
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
              cursor: saving || !ok ? 'not-allowed' : 'pointer',
              fontFamily: "'Poppins', sans-serif",
              opacity: saving || !ok ? 0.6 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (!saving && ok) {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              if (!saving && ok) {
                e.currentTarget.style.background = '#e64a1a';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving && ok) {
                e.currentTarget.style.background = BRAND;
              }
            }}
          >
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}