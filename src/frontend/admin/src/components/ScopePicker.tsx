'use client';

import { useState, useEffect } from 'react';
import { Building2, Store, Loader2 } from 'lucide-react';
import { fetchTenants, type ApiTenant } from '@/lib/auth-api';
import {
  fetchRestaurantsForTenant,
  type SupportRestaurant,
} from '@/lib/support-api';
import { getTheme } from '@/lib/theme';

// ── Brand Color ───────────────────────────────────────────────────────
const BRAND = '#ff5723';

// ── Dark Theme ────────────────────────────────────────────────────────
const DARK = {
  bg: '#111111',
  card: '#1C1C1C',
  card2: '#242424',
  border: 'rgba(255,255,255,0.08)',
  selectBorder: '#2A2A2A',
  text: '#F5F0E8',
  muted: '#9CA3AF',
  subtle: '#6B7280',
  danger: '#ff8a5c',
};

// ── Light Theme ───────────────────────────────────────────────────────
const LIGHT = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  card2: '#F9FAFB',
  border: '#E5E7EB',
  selectBorder: '#E5E7EB',
  text: '#000000',
  muted: '#6B6B6B',
  subtle: '#9CA3AF',
  danger: '#ff5723',
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

  // ── Theme listener ─────────────────────────────────────────────────
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

    const handleThemeToggle = () => {
      updateTheme();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('themeChange', handleThemeToggle);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);

  // ── Active theme colors ────────────────────────────────────────────
  const colors = isDark ? DARK : LIGHT;

  // ── Load companies ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchTenants();
        setTenants(list);

        if (!value.tenantId) {
          const saved = readSaved(storageKey);

          if (
            saved?.tenantId &&
            list.some(t => t.tenantId === saved.tenantId)
          ) {
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

  // ── Load restaurants when company changes ──────────────────────────
  useEffect(() => {
    if (!value.tenantId) {
      setRestaurants([]);
      return;
    }

    let cancelled = false;

    setLoadingR(true);
    setError('');

    fetchRestaurantsForTenant(value.tenantId)
      .then(list => {
        if (!cancelled) {
          setRestaurants(list);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e?.message ?? 'Could not load restaurants');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingR(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value.tenantId]);

  // ── Company selection ──────────────────────────────────────────────
  function pickTenant(tenantId: string) {
    const next: Scope = {
      tenantId,
      restaurantId: '',
      currency: 'PKR',
    };

    save(storageKey, next);
    onChange(next);
  }

  // ── Restaurant selection ───────────────────────────────────────────
  function pickRestaurant(restaurantId: string) {
    const restaurant = restaurants.find(
      x => x.restaurantId === restaurantId
    );

    const next: Scope = {
      ...value,
      restaurantId,
      currency: restaurant?.currencyCode || 'PKR',
    };

    save(storageKey, next);
    onChange(next);
  }

  return (
    <div
      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2 p-4 rounded-xl mb-4 w-full"
      style={{
        fontFamily: "'Poppins', sans-serif",
        background: colors.card,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        transition:
          'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* ── Company Section ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{
            color: colors.muted,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Building2 size={15} />

          <span
            className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline"
            style={{
              fontFamily: "'Poppins', sans-serif",
            }}
          >
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
            padding: '8px 32px 8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            background: colors.card2,
            border: `1px solid ${colors.selectBorder}`,
            color: colors.text,
            outline: 'none',
            cursor: loadingT ? 'not-allowed' : 'pointer',
            transition:
              'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
            opacity: loadingT ? 0.5 : 1,
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            boxShadow: 'none',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = BRAND;
            e.currentTarget.style.boxShadow =
              '0 0 0 2px rgba(255,87,35,0.20)';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = colors.selectBorder;
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <option value="" disabled>
            {loadingT ? 'Loading…' : 'Select company'}
          </option>

          {tenants.map(t => (
            <option key={t.tenantId} value={t.tenantId}>
              {t.companyName}
              {t.isActive ? '' : ' (suspended)'}
            </option>
          ))}
        </select>
      </div>

      {/* ── Restaurant Section ────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{
            color: colors.muted,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Store size={15} />

          <span
            className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline"
            style={{
              fontFamily: "'Poppins', sans-serif",
            }}
          >
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
            padding: '8px 32px 8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            background: colors.card2,
            border: `1px solid ${colors.selectBorder}`,
            color: colors.text,
            outline: 'none',
            cursor:
              !value.tenantId || loadingR
                ? 'not-allowed'
                : 'pointer',
            transition:
              'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
            opacity:
              !value.tenantId || loadingR ? 0.4 : 1,
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            boxShadow: 'none',
          }}
          onFocus={e => {
            if (!value.tenantId || loadingR) return;

            e.currentTarget.style.borderColor = BRAND;
            e.currentTarget.style.boxShadow =
              '0 0 0 2px rgba(255,87,35,0.20)';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = colors.selectBorder;
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <option value="" disabled>
            {!value.tenantId
              ? 'Pick a company first'
              : loadingR
                ? 'Loading…'
                : restaurants.length === 0
                  ? 'No restaurants'
                  : 'Select a restaurant'}
          </option>

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

      {/* ── Loading & Error ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0 self-center">
        {(loadingT || loadingR) && (
          <Loader2
            size={16}
            color={colors.muted}
            style={{
              animation: 'scopePickerSpin 1s linear infinite',
            }}
          />
        )}

        {error && (
          <span
            className="text-xs whitespace-nowrap"
            style={{
              color: colors.danger,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {error}
          </span>
        )}
      </div>

      {/* ── Select Styling ────────────────────────────────────────── */}
      <style>{`
        @keyframes scopePickerSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .scope-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%239CA3AF' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 10px 6px;
        }

        .scope-select:focus,
        .scope-select:focus-visible {
          outline: none !important;
        }

        .scope-select::-moz-focus-inner {
          border: 0 !important;
        }

        .scope-select option {
          background: ${colors.card2};
          color: ${colors.text};
          font-family: 'Poppins', sans-serif;
          padding: 6px 12px;
        }

        .scope-select option:hover,
        .scope-select option:focus,
        .scope-select option:active,
        .scope-select option:checked {
          background: ${BRAND} !important;
          background-color: ${BRAND} !important;
          color: #ffffff !important;
        }

        .scope-select option:disabled {
          color: ${colors.subtle};
        }

        .scope-select:disabled {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

// ── Session memory ────────────────────────────────────────────────────

function save(key: string, s: Scope) {
  try {
    sessionStorage.setItem(key, JSON.stringify(s));
  } catch {
    // Private mode / storage unavailable
  }
}

function readSaved(key: string): Scope | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Scope) : null;
  } catch {
    return null;
  }
}

export const EMPTY_SCOPE: Scope = {
  tenantId: '',
  restaurantId: '',
  currency: 'PKR',
};