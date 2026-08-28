'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Loader2,
  RefreshCw,
  AlertCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  fetchUsers,
  createStaff,
  deleteUser,
  type ApiUser,
} from '@/lib/auth-api';

import {
  fetchRestaurants,
  type ApiRestaurant,
} from '@/lib/admin-api';

import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: BRAND,
  brandBg: 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark
    ? 'rgba(255,87,35,0.2)'
    : 'rgba(255,87,35,0.15)',
  green: isDark ? '#4ade80' : '#16a34a',
  placeholder: isDark ? '#6B7280' : '#888888',
});

export default function StaffView() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [rests, setRests] = useState<ApiRestaurant[]>([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState('');
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
      if (e.key === 'admin_theme') {
        updateTheme();
      }
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

  // ── Load users + restaurants ──
  const load = useCallback(async () => {
    setLoad(true);
    setError('');

    try {
      const [u, r] = await Promise.all([
        fetchUsers(),
        fetchRestaurants(),
      ]);

      setUsers(u);
      setRests(r);
    } catch (e: any) {
      const message = e?.message ?? 'Could not load staff';

      setError(message);
      toast.error(message);
    } finally {
      setLoad(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Restaurant name ──
  const nameOf = (rid: string) =>
    rests.find(r => r.restaurantId === rid)?.name ??
    (rid ? '—' : 'All branches');

  // ── Remove staff ──
  async function remove(u: ApiUser) {
    if (
      !confirm(
        `Remove ${u.email}?\n\nThey will lose access immediately.`
      )
    ) {
      return;
    }

    try {
      await deleteUser(u.username);

      toast.success('Staff user removed successfully');

      await load();
    } catch (e: any) {
      toast.error(
        e?.message ?? 'Failed to remove staff user'
      );
    }
  }

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: 1000,
        margin: '0 auto',
        fontFamily: "'Poppins', sans-serif",
        background: colors.bg,
        minHeight: '100vh',
      }}
    >
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        input::placeholder,
        input::-webkit-input-placeholder,
        input::-moz-placeholder {
          color: ${colors.placeholder} !important;
          opacity: 0.8;
        }

        input[type="password"]::placeholder,
        input[type="password"]::-webkit-input-placeholder,
        input[type="password"]::-moz-placeholder {
          color: ${isDark ? '#6B7280' : '#AAAAAA'} !important;
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(20px, 3vw, 24px)',
              fontWeight: 700,
              color: colors.text,
              margin: '0 0 4px',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Staff
          </h1>

          <p
            style={{
              color: colors.muted,
              fontSize: 14,
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Kitchen users. Each one sees only the restaurant you assign.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
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
              cursor: loading ? 'not-allowed' : 'pointer',
              color: colors.text,
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
              opacity: loading ? 0.7 : 1,
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow =
                `0 0 0 3px ${colors.focusRing}`;
              e.currentTarget.style.borderColor = BRAND;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = colors.border;
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = colors.hoverBg;
                e.currentTarget.style.borderColor = BRAND;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.card;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <RefreshCw
              size={14}
              style={
                loading
                  ? { animation: 'spin 1s linear infinite' }
                  : undefined
              }
            />
            Refresh
          </button>

          {/* Add user */}
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
              e.currentTarget.style.boxShadow =
                `0 0 0 3px ${colors.focusRing}`;
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
            <Plus size={16} />
            Add Kitchen User
          </button>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div
          style={{
            padding: '60px',
            textAlign: 'center',
            color: colors.muted,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Loader2
            size={22}
            style={{
              animation: 'spin 1s linear infinite',
            }}
          />

          <p style={{ marginTop: 12 }}>
            Loading…
          </p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: BRAND,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <AlertCircle
            size={20}
            style={{
              verticalAlign: 'middle',
              marginRight: 6,
            }}
          />

          {error}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && users.length === 0 && (
        <div
          style={{
            padding: '60px',
            textAlign: 'center',
            color: colors.subtle,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Users
            size={28}
            style={{
              opacity: 0.4,
              marginBottom: 8,
            }}
          />

          <p
            style={{
              margin: 0,
              fontWeight: 600,
            }}
          >
            No staff yet.
          </p>

          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
            }}
          >
            Add a kitchen user so they can work the orders screen.
          </p>
        </div>
      )}

      {/* ── Staff Table ── */}
      {!loading && !error && users.length > 0 && (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <thead
              style={{
                background: colors.card2,
              }}
            >
              <tr>
                {[
                  'Email',
                  'Name',
                  'Restaurant',
                  'Status',
                ].map(label => (
                  <th
                    key={label}
                    style={{
                      padding: '10px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: colors.subtle,
                      textAlign: 'left',
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {label}
                  </th>
                ))}

                <th
                  style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'right',
                    fontFamily: "'Poppins', sans-serif",
                  }}
                />
              </tr>
            </thead>

            <tbody>
              {users.map(u => (
                <tr
                  key={u.username}
                  style={{
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  {/* Email */}
                  <td
                    style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {u.email}
                  </td>

                  {/* Name */}
                  <td
                    style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.muted,
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {u.name || '—'}
                  </td>

                  {/* Restaurant */}
                  <td
                    style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.muted,
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {nameOf(u.restaurantId)}
                  </td>

                  {/* Status */}
                  <td
                    style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: u.enabled
                          ? colors.green
                          : BRAND,
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {u.enabled
                        ? '● active'
                        : '● disabled'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      textAlign: 'right',
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
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
                      title="Remove user"
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow =
                          `0 0 0 3px ${colors.focusRing}`;
                        e.currentTarget.style.borderColor = BRAND;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor =
                          colors.border;
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          colors.hoverBg;
                        e.currentTarget.style.borderColor = BRAND;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          'transparent';
                        e.currentTarget.style.borderColor =
                          colors.border;
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
          onSaved={() => {
            setOpen(false);
            load();
          }}
          colors={colors}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Add Modal
// ─────────────────────────────────────────────

function AddModal({
  restaurants,
  onClose,
  onSaved,
  colors,
}: {
  restaurants: ApiRestaurant[];
  onClose: () => void;
  onSaved: () => void;
  colors: ReturnType<typeof getColors>;
}) {
  const [f, setF] = useState({
    email: '',
    password: '',
    name: '',
    restaurantId:
      restaurants[0]?.restaurantId ?? '',
  });

  const [saving, setSaving] = useState(false);

  const set = (
    key: keyof typeof f,
    value: string
  ) => {
    setF(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  async function save() {
    if (!f.email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (f.password.length < 8) {
      toast.error(
        'Password must be at least 8 characters'
      );
      return;
    }

    if (!f.restaurantId) {
      toast.error('Please select a restaurant');
      return;
    }

    setSaving(true);

    try {
      await createStaff({
        email: f.email.trim(),
        password: f.password,
        name: f.name.trim(),
        restaurantId: f.restaurantId,
      });

      toast.success(
        `Kitchen user created — share the login with ${f.email.trim()}`
      );

      onSaved();
    } catch (e: any) {
      toast.error(
        e?.message ?? 'Failed to create kitchen user'
      );
    } finally {
      setSaving(false);
    }
  }

  const ok =
    f.email.trim().length > 0 &&
    f.password.length >= 8 &&
    Boolean(f.restaurantId);

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
          maxHeight: '90vh',
          overflowY: 'auto',
          border: `1px solid ${colors.border}`,
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: colors.text,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
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
              e.currentTarget.style.boxShadow =
                `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                colors.hoverBg;
              e.currentTarget.style.color =
                colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                'transparent';
              e.currentTarget.style.color =
                colors.muted;
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p
          style={{
            color: colors.muted,
            fontSize: 13,
            margin: '0 0 18px',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          They will only see orders for the restaurant
          you pick.
        </p>

        <div
          style={{
            display: 'grid',
            gap: 14,
          }}
        >
          {/* Restaurant */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: colors.muted,
                marginBottom: 5,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Restaurant
            </label>

            <select
              value={f.restaurantId}
              onChange={e =>
                set(
                  'restaurantId',
                  e.target.value
                )
              }
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
              onFocus={(e) => {
                e.currentTarget.style.borderColor =
                  BRAND;
                e.currentTarget.style.boxShadow =
                  `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor =
                  colors.border;
                e.currentTarget.style.boxShadow =
                  'none';
              }}
            >
              {restaurants.length === 0 && (
                <option value="" disabled>
                  No restaurants available
                </option>
              )}

              {restaurants.map(r => (
                <option
                  key={r.restaurantId}
                  value={r.restaurantId}
                >
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Email */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: colors.muted,
                marginBottom: 5,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Email
            </label>

            <input
              type="email"
              value={f.email}
              placeholder="john.doe@example.com"
              onChange={e =>
                set('email', e.target.value)
              }
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
              onFocus={(e) => {
                e.currentTarget.style.borderColor =
                  BRAND;
                e.currentTarget.style.boxShadow =
                  `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor =
                  colors.border;
                e.currentTarget.style.boxShadow =
                  'none';
              }}
            />
          </div>

          {/* Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: colors.muted,
                marginBottom: 5,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Name
            </label>

            <input
              value={f.name}
              placeholder="Alice, Bob, etc."
              onChange={e =>
                set('name', e.target.value)
              }
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
              onFocus={(e) => {
                e.currentTarget.style.borderColor =
                  BRAND;
                e.currentTarget.style.boxShadow =
                  `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor =
                  colors.border;
                e.currentTarget.style.boxShadow =
                  'none';
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: colors.muted,
                marginBottom: 5,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Temporary Password
            </label>

            <input
              type="password"
              value={f.password}
              placeholder="min 8 chars, upper + lower + number + symbol"
              onChange={e =>
                set('password', e.target.value)
              }
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
              onFocus={(e) => {
                e.currentTarget.style.borderColor =
                  BRAND;
                e.currentTarget.style.boxShadow =
                  `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor =
                  colors.border;
                e.currentTarget.style.boxShadow =
                  'none';
              }}
            />

            <p
              style={{
                fontSize: 12,
                color: colors.subtle,
                margin: '4px 0 0',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Share this with the kitchen user — they
              can change it after logging in.
            </p>
          </div>

          {/* Submit */}
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
              cursor:
                saving || !ok
                  ? 'not-allowed'
                  : 'pointer',
              fontFamily: "'Poppins', sans-serif",
              opacity:
                saving || !ok ? 0.6 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
              marginTop: 4,
            }}
            onFocus={(e) => {
              if (!saving && ok) {
                e.currentTarget.style.boxShadow =
                  `0 0 0 3px ${colors.focusRing}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow =
                'none';
            }}
            onMouseEnter={(e) => {
              if (!saving && ok) {
                e.currentTarget.style.background =
                  '#e64a1a';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving && ok) {
                e.currentTarget.style.background =
                  BRAND;
              }
            }}
          >
            {saving && (
              <Loader2
                size={16}
                style={{
                  animation:
                    'spin 1s linear infinite',
                }}
              />
            )}

            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}