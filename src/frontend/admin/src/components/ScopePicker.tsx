'use client';

import { useState, useEffect } from 'react';
import { Building2, Store, Loader2 } from 'lucide-react';
import { fetchTenants, type ApiTenant } from '@/lib/auth-api';
import { fetchRestaurantsForTenant, type SupportRestaurant } from '@/lib/support-api';
import { getTheme } from '@/lib/theme';

// ── Color Schema (Matches your KDS page) ──────────────────────────────
const BRAND = '#ff5723';
const D = {
  bg: '#111111',
  card: '#1C1C1C',
  card2: '#242424',
  border: 'rgba(255,255,255,0.08)',
  text: '#F5F0E8',
  muted: '#9CA3AF',
  subtle: '#6B7280',
};
const TONE = {
  orange: { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' },
  danger: { bg: 'rgba(255,87,35,0.12)', border: 'rgba(255,87,35,0.3)', text: '#ff8a5c' },
};

export interface Scope {
  tenantId: string;
  restaurantId: string;
  currency: string;
}

export default function ScopePicker({
  value,
  onChange,
  storageKey = 'console_support_scope',
}: {
  value: Scope;
  onChange: (s: Scope) => void;
  storageKey?: string;
}) {
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [restaurants, setRestaurants] = useState<SupportRestaurant[]>([]);
  const [loadingT, setLoadingT] = useState(true);
  const [loadingR, setLoadingR] = useState(false);
  const [error, setError] = useState('');
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

  // Theme-aware colors for light mode support
  const colors = isDark ? D : {
    bg: '#FFFFFF',
    card: '#ffffff',
    card2: '#F9FAFB',
    border: '#E5E7EB',
    text: '#000000',
    muted: '#6B6B6B',
    subtle: '#9CA3AF',
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchTenants();
        setTenants(list);
        if (!value.tenantId) {
          const saved = readSaved(storageKey);
          if (saved?.tenantId && list.some(t => t.tenantId === saved.tenantId)) {
            onChange(saved);
          }
        }
      } catch (e: any) {
        setError(e?.message ?? 'Could not load companies');
      } finally {
        setLoadingT(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!value.tenantId) { setRestaurants([]); return; }
    let cancelled = false;
    setLoadingR(true);
    fetchRestaurantsForTenant(value.tenantId)
      .then(list => { if (!cancelled) setRestaurants(list); })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Could not load restaurants'); })
      .finally(() => { if (!cancelled) setLoadingR(false); });
    return () => { cancelled = true; };
  }, [value.tenantId]);

  function pickTenant(tenantId: string) {
    const next = { tenantId, restaurantId: '', currency: 'PKR' };
    save(storageKey, next);
    onChange(next);
  }

  function pickRestaurant(restaurantId: string) {
    const r = restaurants.find(x => x.restaurantId === restaurantId);
    const next = { ...value, restaurantId, currency: r?.currencyCode || 'PKR' };
    save(storageKey, next);
    onChange(next);
  }

  // Get select background based on theme
  const selectBg = isDark ? '#242424' : '#FFFFFF';
  const selectBorder = isDark ? '#2A2A2A' : '#E5E7EB';
  const selectText = isDark ? '#F5F0E8' : '#000000';

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2 p-4 rounded-xl border border-[#2A2A2A] bg-[#1C1C1C] mb-4 w-full" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Company Section */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[#9CA3AF] flex-shrink-0">
          <Building2 size={15} />
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Company
          </span>
        </div>
        <select
          value={value.tenantId}
          onChange={e => pickTenant(e.target.value)}
          disabled={loadingT}
          className="scope-select"
          style={{
            flex: 1,
            minWidth: '120px',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            background: selectBg,
            border: `1px solid ${selectBorder}`,
            color: selectText,
            outline: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: loadingT ? 0.5 : 1,
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            boxShadow: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = BRAND;
            e.currentTarget.style.boxShadow = `0 0 0 2px rgba(255,87,35,0.25)`;
            e.currentTarget.style.outline = 'none';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = selectBorder;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.outline = 'none';
          }}
        >
          <option value="" disabled className="placeholder-option">{loadingT ? 'Loading…' : 'Select company'}</option>
          {tenants.map(t => (
            <option key={t.tenantId} value={t.tenantId}>
              {t.companyName}{t.isActive ? '' : ' (suspended)'}
            </option>
          ))}
        </select>
      </div>

      {/* Restaurant Section */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[#9CA3AF] flex-shrink-0">
          <Store size={15} />
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Restaurant
          </span>
        </div>
        <select
          value={value.restaurantId}
          onChange={e => pickRestaurant(e.target.value)}
          disabled={!value.tenantId || loadingR}
          className="scope-select"
          style={{
            flex: 1,
            minWidth: '120px',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            background: selectBg,
            border: `1px solid ${selectBorder}`,
            color: selectText,
            outline: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: (!value.tenantId || loadingR) ? 0.4 : 1,
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            boxShadow: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = BRAND;
            e.currentTarget.style.boxShadow = `0 0 0 2px rgba(255,87,35,0.25)`;
            e.currentTarget.style.outline = 'none';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = selectBorder;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.outline = 'none';
          }}
        >
          <option value="" disabled className="placeholder-option">
            {!value.tenantId ? 'Pick a company first'
              : loadingR ? 'Loading…'
              : restaurants.length === 0 ? 'No restaurants'
              : 'Select a restaurant'}
          </option>
          {restaurants.map(r => (
            <option key={r.restaurantId} value={r.restaurantId}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Loading & Error */}
      <div className="flex items-center gap-2 flex-shrink-0 self-center">
        {(loadingT || loadingR) && (
          <Loader2 size={16} color={D.muted} className="animate-spin" />
        )}
        {error && (
          <span className="text-xs text-[#ff8a5c] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {error}
          </span>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── Custom Select Styles ── */
        .scope-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%239CA3AF' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 10px 6px;
          padding-right: 32px;
        }

        /* ── Remove default select styles ── */
        .scope-select {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        }

        /* ── Remove default blue outline ── */
        .scope-select:focus,
        .scope-select:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }

        /* ── For Firefox - remove blue outline ── */
        .scope-select::-moz-focus-inner {
          border: 0 !important;
        }

        /* ── For Safari/Webkit - remove blue glow ── */
        .scope-select:focus {
          outline: none !important;
        }

        /* ── Firefox fix for focus ring ── */
        .scope-select:-moz-focusring {
          color: transparent;
          text-shadow: 0 0 0 ${selectText};
        }

        /* ── All Options - Orange on Hover ── */
        .scope-select option {
          background: ${selectBg};
          color: ${selectText};
          font-family: 'Poppins', sans-serif;
          padding: 6px 12px;
          transition: all 0.15s ease;
        }

        /* ── Hover effect for ALL options including placeholder ── */
        .scope-select option:hover,
        .scope-select option:focus,
        .scope-select option:active {
          background: ${BRAND} !important;
          color: #ffffff !important;
        }

        /* ── Selected option - Orange background ── */
        .scope-select option:checked {
          background: ${BRAND} !important;
          color: #ffffff !important;
        }

        /* ── For Firefox ── */
        .scope-select option:checked,
        .scope-select option:focus,
        .scope-select option:active,
        .scope-select option:hover {
          background: ${BRAND} !important;
          background-color: ${BRAND} !important;
          color: #ffffff !important;
        }

        /* ── For Webkit/Safari ── */
        .scope-select option:checked {
          background-color: ${BRAND} !important;
          color: #ffffff !important;
        }

        /* ── For Edge/Chrome ── */
        .scope-select option:checked {
          background-color: ${BRAND} !important;
          color: #ffffff !important;
        }

        /* ── Disabled state ── */
        .scope-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Placeholder option - grayed out but hoverable ── */
        .scope-select option:disabled {
          color: ${isDark ? '#6B7280' : '#9CA3AF'};
        }

        /* ── Placeholder hover - Orange ── */
        .scope-select option:disabled:hover {
          background: ${BRAND} !important;
          color: #ffffff !important;
        }

        /* ── Selected value display in dropdown (when closed) ── */
        .scope-select option:checked {
          font-weight: 600 !important;
        }

        /* ── For all browsers - ensure orange on any interaction ── */
        .scope-select option:checked,
        .scope-select option:focus,
        .scope-select option:active,
        .scope-select option:hover {
          background: ${BRAND} !important;
          background-color: ${BRAND} !important;
          color: #ffffff !important;
        }

        /* ── Fix for Firefox selected value ── */
        .scope-select option:checked {
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
}

// ── Session memory ────────────────────────────────────────────────────

function save(key: string, s: Scope) {
  try { sessionStorage.setItem(key, JSON.stringify(s)); } catch { /* private mode */ }
}

function readSaved(key: string): Scope | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as Scope : null;
  } catch {
    return null;
  }
}

export const EMPTY_SCOPE: Scope = { tenantId: '', restaurantId: '', currency: 'PKR' };