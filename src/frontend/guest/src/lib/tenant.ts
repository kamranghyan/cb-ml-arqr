// Same logic as the deleted Next.js proxy routes, moved client-side.
// menu_svc's read endpoints require tenant scoping via X-Tenant-Id OR a
// tenantId query param (confirmed in dependencies.py) — using the query
// param here since there's no server to inject a header from.

const MENU_BASE = process.env.NEXT_PUBLIC_API_BASE!
const tenantCache = new Map<string, { tenantId: string; at: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function resolveTenantId(restaurantId: string): Promise<string> {
  if (!restaurantId) return ''

  const hit = tenantCache.get(restaurantId)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenantId

  try {
    // Public lookup — genuinely doesn't need a tenant itself (you can't
    // require the thing you're trying to find).
    const res = await fetch(`${MENU_BASE}/menus/restaurants/${restaurantId}`)
    if (!res.ok) return ''
    const body = await res.json()
    const tenantId: string = body?.tenantId ?? ''
    if (tenantId) tenantCache.set(restaurantId, { tenantId, at: Date.now() })
    return tenantId
  } catch {
    return ''
  }
}