'use client';

import { useState, useEffect } from 'react';
import { Building2, Store, Loader2 } from 'lucide-react';
import { fetchTenants, type ApiTenant } from '@/lib/auth-api';
import { fetchRestaurantsForTenant, type SupportRestaurant } from '@/lib/support-api';

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

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2 p-4 rounded-xl border border-[#2A2A2A] bg-[#1C1C1C] mb-4 w-full">
      {/* Company Section */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[#9CA3AF] flex-shrink-0">
          <Building2 size={15} />
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline">
            Company
          </span>
        </div>
        <select
          value={value.tenantId}
          onChange={e => pickTenant(e.target.value)}
          disabled={loadingT}
          className="flex-1 min-w-[120px] sm:min-w-[160px] px-3 py-2 rounded-lg text-sm bg-[#242424] border border-[#2A2A2A] text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#ff5723] cursor-pointer disabled:opacity-50"
        >
          <option value="">{loadingT ? 'Loading…' : 'Select company'}</option>
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
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider hidden xs:inline">
            Restaurant
          </span>
        </div>
        <select
          value={value.restaurantId}
          onChange={e => pickRestaurant(e.target.value)}
          disabled={!value.tenantId || loadingR}
          className="flex-1 min-w-[120px] sm:min-w-[160px] px-3 py-2 rounded-lg text-sm bg-[#242424] border border-[#2A2A2A] text-[#F5F0E8] focus:outline-none focus:ring-2 focus:ring-[#ff5723] cursor-pointer disabled:opacity-40"
        >
          <option value="">
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
          <span className="text-xs text-[#ff8a5c] whitespace-nowrap">{error}</span>
        )}
      </div>
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