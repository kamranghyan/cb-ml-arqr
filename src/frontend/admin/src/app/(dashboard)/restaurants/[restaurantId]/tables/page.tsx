'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, Trash2, X, Loader2, RefreshCw, Grid3x3, AlertCircle, MapPin, Check } from 'lucide-react';
import {
  fetchTables, createTable, updateTable, deleteTable, type ApiTable,
  fetchZones, createZone, updateZone, deleteZone, type ApiZone,
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
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiTable }>({ open: false });
  const [zoneModal, setZoneModal] = useState(false);
  const [manageZonesModal, setManageZonesModal] = useState(false);

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
      const [tables, zoneList] = await Promise.all([
        fetchTables(restaurantId),
        fetchZones(restaurantId),
      ]);
      setRows(tables);
      setZones(zoneList);
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

  const tableCountByZoneName = rows.reduce((acc: Record<string, number>, r) => {
    if (r.zone) acc[r.zone] = (acc[r.zone] ?? 0) + 1;
    return acc;
  }, {});

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
        input:focus, select:focus {
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
          <HeaderButton onClick={load} colors={colors}>
            <RefreshCw size={14} /> Refresh
          </HeaderButton>
          <HeaderButton onClick={() => setManageZonesModal(true)} colors={colors}>
            <MapPin size={14} /> Manage Zones
          </HeaderButton>
          <HeaderButton onClick={() => setZoneModal(true)} colors={colors}>
            <Plus size={14} /> New Zone
          </HeaderButton>
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
                  <th style={thStyle(colors, 'left')}>Table</th>
                  <th style={thStyle(colors, 'left')}>Zone</th>
                  <th style={thStyle(colors, 'left')}>Outlet</th>
                  <th style={thStyle(colors, 'left')}>Seats</th>
                  <th style={thStyle(colors, 'right')}></th>
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
                      <IconButton onClick={() => setModal({ open: true, edit: t })} colors={colors}>
                        <Edit2 size={14} />
                      </IconButton>
                      <IconButton onClick={() => onDelete(t)} colors={colors} danger>
                        <Trash2 size={14} />
                      </IconButton>
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
          zones={zones}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
          say={say}
          colors={colors}
          isDark={isDark}
        />
      )}

      {/* ── Create Zone Modal ── */}
      {zoneModal && (
        <CreateZoneModal
          restaurantId={restaurantId}
          onClose={() => setZoneModal(false)}
          onSaved={() => { setZoneModal(false); load(); }}
          say={say}
          colors={colors}
          isDark={isDark}
        />
      )}

      {/* ── Manage Zones Modal ── */}
      {manageZonesModal && (
        <ManageZonesModal
          restaurantId={restaurantId}
          zones={zones}
          tableCountByZoneName={tableCountByZoneName}
          onClose={() => setManageZonesModal(false)}
          onChanged={load}
          say={say}
          colors={colors}
          isDark={isDark}
        />
      )}

    </div>
  );
}

// ── Shared small UI pieces ──

function thStyle(colors: ReturnType<typeof getColors>, align: 'left' | 'right'): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.subtle,
    textAlign: align,
    whiteSpace: 'nowrap',
    fontFamily: "'Poppins', sans-serif",
  };
}

function HeaderButton({
  onClick, colors, children,
}: {
  onClick: () => void;
  colors: ReturnType<typeof getColors>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
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
        transition: 'all 0.2s ease',
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
      {children}
    </button>
  );
}

function IconButton({
  onClick, colors, danger, children,
}: {
  onClick: () => void;
  colors: ReturnType<typeof getColors>;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
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
        color: danger ? colors.danger : colors.text,
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
      {children}
    </button>
  );
}

const inputStyleFor = (colors: ReturnType<typeof getColors>): React.CSSProperties => ({
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
});

const labelStyleFor = (colors: ReturnType<typeof getColors>): React.CSSProperties => ({
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: colors.muted,
  marginBottom: 5,
  fontFamily: "'Poppins', sans-serif",
});

function focusHandlers(colors: ReturnType<typeof getColors>) {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = BRAND;
      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = colors.border;
      e.currentTarget.style.boxShadow = 'none';
    },
  };
}

function ModalShell({
  title, onClose, colors, isDark, children,
}: {
  title: string;
  onClose: () => void;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
  children: React.ReactNode;
}) {
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
          maxWidth: 440,
          maxHeight: '85vh',
          overflowY: 'auto',
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
            {title}
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
            onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
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
        {children}
      </div>
    </div>
  );
}

// ── Table Modal ──

function TableModal({
  restaurantId,
  edit,
  zones,
  onClose,
  onSaved,
  say,
  colors,
  isDark,
}: {
  restaurantId: string;
  edit?: ApiTable;
  zones: ApiZone[];
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok' | 'err') => void;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
}) {
  const [f, setF] = useState({
    tableNumber: edit?.tableNumber ?? '',
    zone: edit?.zone ?? (zones[0]?.name ?? 'Main Hall'),
    outlet: edit?.outlet ?? (zones[0]?.outlet ?? 'Main Hall'),
    capacity: edit?.capacity ?? 4,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  const inputStyle = inputStyleFor(colors);
  const labelStyle = labelStyleFor(colors);
  const { onFocus: handleFocus, onBlur: handleBlur } = focusHandlers(colors);

  function onZoneSelect(zoneName: string) {
    const match = zones.find(z => z.name === zoneName);
    setF(p => ({
      ...p,
      zone: zoneName,
      outlet: match?.outlet ?? p.outlet,
    }));
  }

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

  return (
    <ModalShell title={edit ? 'Edit Table' : 'New Table'} onClose={onClose} colors={colors} isDark={isDark}>
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
            {zones.length > 0 ? (
              <select
                style={inputStyle}
                value={f.zone}
                onChange={e => onZoneSelect(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
              >
                {!zones.some(z => z.name === f.zone) && (
                  <option value={f.zone}>{f.zone}</option>
                )}
                {zones.map(z => (
                  <option key={z.id} value={z.name}>{z.name}</option>
                ))}
              </select>
            ) : (
              <>
                <input
                  style={inputStyle}
                  value={f.zone}
                  placeholder="Enter zone"
                  onChange={e => set('zone', e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <p style={{ fontSize: 11, color: colors.subtle, margin: '4px 0 0', fontFamily: "'Poppins', sans-serif" }}>
                  No zones yet — create one via "New Zone" for a dropdown next time.
                </p>
              </>
            )}
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
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
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
    </ModalShell>
  );
}

// ── Create Zone Modal ──

function CreateZoneModal({
  restaurantId,
  onClose,
  onSaved,
  say,
  colors,
  isDark,
}: {
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
  say: (m: string, k?: 'ok' | 'err') => void;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
}) {
  const [name, setName] = useState('');
  const [outlet, setOutlet] = useState('');
  const [saving, setSaving] = useState(false);

  const inputStyle = inputStyleFor(colors);
  const labelStyle = labelStyleFor(colors);
  const { onFocus: handleFocus, onBlur: handleBlur } = focusHandlers(colors);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createZone({ name: name.trim(), outlet: outlet.trim() || undefined }, restaurantId);
      say('Zone created');
      onSaved();
    } catch (e: any) {
      say(e.message ?? 'Could not create zone', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="New Zone" onClose={onClose} colors={colors} isDark={isDark}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <label style={labelStyle}>Zone Name</label>
          <input
            style={inputStyle}
            value={name}
            placeholder="e.g. Rooftop"
            onChange={e => setName(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoFocus
          />
        </div>
        <div>
          <label style={labelStyle}>Outlet</label>
          <input
            style={inputStyle}
            value={outlet}
            placeholder={name || 'Same as zone name if left blank'}
            onChange={e => setOutlet(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        <button
          onClick={save}
          disabled={saving || !name.trim()}
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
            cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
            fontFamily: "'Poppins', sans-serif",
            opacity: saving || !name.trim() ? 0.6 : 1,
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
        >
          {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
          Create Zone
        </button>
      </div>
    </ModalShell>
  );
}

// ── Manage Zones Modal ──

function ManageZonesModal({
  restaurantId,
  zones,
  tableCountByZoneName,
  onClose,
  onChanged,
  say,
  colors,
  isDark,
}: {
  restaurantId: string;
  zones: ApiZone[];
  tableCountByZoneName: Record<string, number>;
  onClose: () => void;
  onChanged: () => void;
  say: (m: string, k?: 'ok' | 'err') => void;
  colors: ReturnType<typeof getColors>;
  isDark: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', outlet: '' });
  const [busyId, setBusyId] = useState<string | null>(null);

  const inputStyle = { ...inputStyleFor(colors), padding: '7px 10px', fontSize: 13 };
  const { onFocus: handleFocus, onBlur: handleBlur } = focusHandlers(colors);

  function startEdit(z: ApiZone) {
    setEditingId(z.id);
    setDraft({ name: z.name, outlet: z.outlet });
  }

  async function saveEdit(zoneId: string) {
    if (!draft.name.trim()) return;
    setBusyId(zoneId);
    try {
      await updateZone(zoneId, { name: draft.name.trim(), outlet: draft.outlet.trim() || draft.name.trim() }, restaurantId);
      say('Zone updated');
      setEditingId(null);
      onChanged();
    } catch (e: any) {
      say(e.message ?? 'Could not update zone', 'err');
    } finally {
      setBusyId(null);
    }
  }

  async function removeZone(z: ApiZone) {
    const inUse = tableCountByZoneName[z.name] ?? 0;
    const warning = inUse > 0
      ? `"${z.name}" is used by ${inUse} table${inUse === 1 ? '' : 's'}. Removing it only takes it out of the "New Table" dropdown — those tables keep their zone. Continue?`
      : `Delete zone "${z.name}"?`;
    if (!confirm(warning)) return;

    setBusyId(z.id);
    try {
      await deleteZone(z.id, restaurantId);
      say('Zone deleted');
      onChanged();
    } catch (e: any) {
      say(e.message ?? 'Could not delete zone', 'err');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModalShell title="Manage Zones" onClose={onClose} colors={colors} isDark={isDark}>
      {zones.length === 0 ? (
        <p style={{ fontSize: 13, color: colors.subtle, fontFamily: "'Poppins', sans-serif" }}>
          No zones yet. Close this and use "New Zone" to create one.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {zones.map(z => (
            <div
              key={z.id}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: 10,
                background: colors.card2,
              }}
            >
              {editingId === z.id ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <input
                    style={inputStyle}
                    value={draft.name}
                    placeholder="Zone name"
                    onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    autoFocus
                  />
                  <input
                    style={inputStyle}
                    value={draft.outlet}
                    placeholder="Outlet"
                    onChange={e => setDraft(p => ({ ...p, outlet: e.target.value }))}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <IconButton onClick={() => setEditingId(null)} colors={colors}>
                      <X size={14} />
                    </IconButton>
                    <IconButton onClick={() => saveEdit(z.id)} colors={colors}>
                      {busyId === z.id
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Check size={14} />}
                    </IconButton>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: "'Poppins', sans-serif" }}>
                      {z.name}
                    </div>
                    <div style={{ fontSize: 12, color: colors.subtle, fontFamily: "'Poppins', sans-serif" }}>
                      Outlet: {z.outlet} · {tableCountByZoneName[z.name] ?? 0} table{(tableCountByZoneName[z.name] ?? 0) === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexShrink: 0 }}>
                    <IconButton onClick={() => startEdit(z)} colors={colors}>
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton onClick={() => removeZone(z)} colors={colors} danger>
                      {busyId === z.id
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Trash2 size={14} />}
                    </IconButton>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
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