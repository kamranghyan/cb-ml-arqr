'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, Trash2, X, Loader2, RefreshCw, Grid3x3, AlertCircle } from 'lucide-react';
import {
  fetchTables, createTable, updateTable, deleteTable, type ApiTable,
} from '@/lib/admin-api';
import { getTheme } from '@/lib/theme';
import { toast } from 'sonner';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFF8F1',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F9FAFB',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  text: isDark ? '#F5F0E8' : '#1A1A1A',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  green: isDark ? '#4ade80' : '#0F9D58',
  danger: isDark ? '#ff8a5c' : '#E1251B',
  placeholder: isDark ? '#6B7280' : '#888888',
  modalOverlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
});

export default function TablesPage() {
  const restaurantId = String(useParams().restaurantId ?? '');
  const [isDark, setIsDark] = useState(false);
  const [rows, setRows] = useState<ApiTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiTable }>({ open: false });

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
    if (kind === 'err') {
      toast.error(msg);
    } else {
      toast.success(msg);
    }
  };

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError('');
    try {
      setRows(await fetchTables(restaurantId));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load tables');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(t: ApiTable) {
    if (!confirm(`Delete table "${t.tableNumber}"? Its QR code will stop working.`)) {
      return;
    }

    try {
      await deleteTable(t.tableId, restaurantId);
      say('Table deleted successfully.');
      await load();
    } catch (e: any) {
      console.error('TABLE DELETE ERROR:', e);
      say(
        e?.message ?? 'Could not delete the table. Please try again.',
        'err'
      );
    }
  }

  const zones = Array.from(new Set(rows.map(r => r.zone).filter(Boolean)));

  return (
    <div style={{
      padding: '24px 20px 40px',
      background: colors.bg,
      minHeight: '100vh',
      fontFamily: "'Poppins', sans-serif",
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
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
        }
        ::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'};
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 18,
      }}>
        <p style={{
          color: colors.muted,
          fontSize: 14,
          margin: 0,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Physical tables in this branch. Each one gets its own QR code.
        </p>
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
            <RefreshCw size={14} /> Refresh
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
            <Plus size={16} /> New Table
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {!loading && !error && rows.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}>
          <Stat label="Tables" value={rows.length} colors={colors} />
          <Stat label="Zones" value={zones.length} colors={colors} />
          <Stat label="Seats" value={rows.reduce((s, r) => s + (r.capacity ?? 0), 0)} colors={colors} />
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: colors.muted,
        }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontSize: 14, fontFamily: "'Poppins', sans-serif" }}>
            Loading tables…
          </p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '40px 20px',
          color: colors.danger,
        }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && rows.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: colors.subtle,
        }}>
          <Grid3x3 size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{
            margin: 0,
            fontWeight: 600,
            color: colors.muted,
            fontFamily: "'Poppins', sans-serif",
          }}>
            No tables yet.
          </p>
          <p style={{
            margin: '4px 0 0',
            fontSize: 13,
            color: colors.subtle,
            fontFamily: "'Poppins', sans-serif",
          }}>
            Add tables here, then print their QR codes from the QR tab.
          </p>
        </div>
      )}

      {/* ── Tables Table ── */}
      {!loading && !error && rows.length > 0 && (
        <div style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          background: colors.card,
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 500,
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
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>Table</th>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>Zone</th>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>Outlet</th>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}>Seats</th>
                  <th style={{
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: colors.subtle,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Poppins', sans-serif",
                  }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.tableId} style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: colors.text,
                      fontFamily: "'Poppins', sans-serif",
                    }}>{t.tableNumber}</td>
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.muted,
                      fontFamily: "'Poppins', sans-serif",
                    }}>{t.zone || '—'}</td>
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.muted,
                      fontFamily: "'Poppins', sans-serif",
                    }}>{t.outlet || '—'}</td>
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                      fontFamily: "'Poppins', sans-serif",
                    }}>{t.capacity}</td>
                    <td style={{
                      padding: '11px 12px',
                      fontSize: 14,
                      color: colors.text,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      <button
                        onClick={() => setModal({ open: true, edit: t })}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          border: `1.5px solid ${colors.border}`,
                          borderRadius: 8,
                          background: colors.card,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                          color: colors.text,
                          marginRight: 6,
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
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(t)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          border: `1.5px solid ${colors.border}`,
                          borderRadius: 8,
                          background: colors.card,
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                          color: colors.danger,
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
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Table Modal ── */}
      {modal.open && (
        <TableModal
          restaurantId={restaurantId}
          edit={modal.edit}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
          say={say}
          colors={colors}
          isDark={isDark}
        />
      )}

    </div>
  );
}

// ── Table Modal ──

function TableModal({
  restaurantId,
  edit,
  onClose,
  onSaved,
  say,
  colors,
  isDark,
}: {
  restaurantId: string;
  edit?: ApiTable;
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok' | 'err') => void;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
}) {
  const [f, setF] = useState({
    tableNumber: edit?.tableNumber ?? '',
    zone: edit?.zone ?? 'Main Hall',
    outlet: edit?.outlet ?? 'Main Hall',
    capacity: edit?.capacity ?? 4,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      if (edit) {
        await updateTable(edit.tableId, f, restaurantId);
        say('Table updated');
      } else {
        await createTable(f, restaurantId);
        say('Table created');
      }
      onSaved();
    } catch (e: any) {
      say(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: `1.5px solid ${colors.border}`,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    boxSizing: 'border-box',
    color: colors.text,
    background: colors.bg,
    outline: 'none',
    transition: 'all 0.2s ease',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: colors.muted,
    marginBottom: 5,
    fontFamily: "'Poppins', sans-serif",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = BRAND;
    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = colors.border;
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: colors.modalOverlay,
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
          padding: 'clamp(20px, 3vw, 24px)',
          width: '100%',
          maxWidth: 420,
          border: `1px solid ${colors.border}`,
          boxShadow: `0 8px 32px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'}`,
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: colors.text,
            fontFamily: "'Poppins', sans-serif",
          }}>
            {edit ? 'Edit Table' : 'New Table'}
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

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Table Number</label>
            <input
              style={inputStyle}
              value={f.tableNumber}
              placeholder="T1"
              onChange={e => set('tableNumber', e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Zone</label>
              <input
                style={inputStyle}
                value={f.zone}
                placeholder="Enter zone"
                onChange={e => set('zone', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>Outlet</label>
              <input
                style={inputStyle}
                value={f.outlet}
                placeholder="Enter outlet"
                onChange={e => set('outlet', e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Seats</label>
            <input
              style={inputStyle}
              type="number"
              value={f.capacity}
              placeholder="4"
              onChange={e => set('capacity', parseInt(e.target.value) || 1)}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <button
            onClick={save}
            disabled={saving || !f.tableNumber.trim()}
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
              cursor: saving || !f.tableNumber.trim() ? 'not-allowed' : 'pointer',
              fontFamily: "'Poppins', sans-serif",
              opacity: saving || !f.tableNumber.trim() ? 0.6 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (!saving && f.tableNumber.trim()) {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              if (!saving && f.tableNumber.trim()) {
                e.currentTarget.style.background = '#e64a1a';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving && f.tableNumber.trim()) {
                e.currentTarget.style.background = BRAND;
              }
            }}
          >
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {edit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stat Component ──

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: '10px 16px',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.subtle,
        fontFamily: "'Poppins', sans-serif",
      }}>{label}</div>
      <div style={{
        fontSize: 'clamp(18px, 2.5vw, 20px)',
        fontWeight: 800,
        color: colors.text,
        fontFamily: "'Poppins', sans-serif",
      }}>{value}</div>
    </div>
  );
}