'use client';

import { useState, useEffect } from 'react';
import { Building2, Store, Loader2 } from 'lucide-react';
import { fetchTenants, type ApiTenant } from '@/lib/auth-api';
import { fetchRestaurantsForTenant, type SupportRestaurant } from '@/lib/support-api';

const C = {
  red: '#E1251B', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0',
  text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF',
};

export interface Scope {
  tenantId:     string
  restaurantId: string
  currency:     string
}

/**
 * A platform admin belongs to no company, so any view of real orders has to
 * start by asking which company and which branch. The choice is remembered
 * for the session so moving between the kitchen and history views does not
 * mean picking twice.
 */
export default function ScopePicker({
  value,
  onChange,
  storageKey = 'console_support_scope',
}: {
  value: Scope;
  onChange: (s: Scope) => void;
  storageKey?: string;
}) {
  const [tenants, setTenants]         = useState<ApiTenant[]>([]);
  const [restaurants, setRestaurants] = useState<SupportRestaurant[]>([]);
  const [loadingT, setLoadingT]       = useState(true);
  const [loadingR, setLoadingR]       = useState(false);
  const [error, setError]             = useState('');

  // Load companies once, and restore the last choice.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load that company's branches whenever it changes.
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
    // Changing company invalidates the branch.
    const next = { tenantId, restaurantId: '', currency: 'PKR' };
    save(storageKey, next);
    onChange(next);
  }

  function pickRestaurant(restaurantId: string) {
    const r = restaurants.find(x => x.restaurantId === restaurantId);
    const next = {
      ...value,
      restaurantId,
      currency: r?.currencyCode || 'PKR',
    };
    save(storageKey, next);
    onChange(next);
  }

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '12px 14px', marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted }}>
        <Building2 size={15} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Company
        </span>
      </div>
      <select
        value={value.tenantId}
        onChange={e => pickTenant(e.target.value)}
        disabled={loadingT}
        style={{ ...select, minWidth: 200 }}
      >
        <option value="">{loadingT ? 'Loading…' : 'Select a company'}</option>
        {tenants.map(t => (
          <option key={t.tenantId} value={t.tenantId}>
            {t.companyName}{t.isActive ? '' : ' (suspended)'}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, marginLeft: 6 }}>
        <Store size={15} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Restaurant
        </span>
      </div>
      <select
        value={value.restaurantId}
        onChange={e => pickRestaurant(e.target.value)}
        disabled={!value.tenantId || loadingR}
        style={{ ...select, minWidth: 200, opacity: value.tenantId ? 1 : 0.6 }}
      >
        <option value="">
          {!value.tenantId ? 'Pick a company first'
            : loadingR      ? 'Loading…'
            : restaurants.length === 0 ? 'No restaurants'
            : 'Select a restaurant'}
        </option>
        {restaurants.map(r => (
          <option key={r.restaurantId} value={r.restaurantId}>{r.name}</option>
        ))}
      </select>

      {(loadingT || loadingR) && (
        <Loader2 size={15} color={C.subtle} style={{ animation: 'spin 1s linear infinite' }} />
      )}

      {error && (
        <span style={{ fontSize: 12, color: C.red, marginLeft: 'auto' }}>{error}</span>
      )}
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

const select: React.CSSProperties = {
  padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 13, background: '#fff', color: C.text, cursor: 'pointer',
};
