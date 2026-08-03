/**
 * guest-scope.ts
 * ==============
 * Where a guest "is": which restaurant and which table.
 *
 * Both come from the QR code on the table:
 *     /guest?rid=<restaurantId>&tid=<tableId>
 *
 * They are kept in sessionStorage so the guest can move between menu, item,
 * cart and tracking pages without the ids falling out of the URL. Nothing is
 * hardcoded — the same build serves every branch of every company.
 *
 * The tenant is deliberately absent: the guest never needs to know it, and the
 * server resolves it from the restaurant.
 */

const RID_KEY = 'lm_rid'
const TID_KEY = 'lm_tid'

export interface GuestScope {
  restaurantId: string
  tableId:      string
}

function readSession(key: string): string {
  if (typeof window === 'undefined') return ''
  try {
    return sessionStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeSession(key: string, value: string): void {
  if (typeof window === 'undefined' || !value) return
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* private mode — the URL still carries the ids */
  }
}

/**
 * Resolve the guest's scope, preferring the URL (a fresh scan) and falling
 * back to the session (moving between pages in the same visit).
 *
 * Pass the page's search params so this works during render.
 */
export function getGuestScope(params?: URLSearchParams): GuestScope {
  const search =
    params ??
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams())

  const restaurantId = search.get('rid') || readSession(RID_KEY)
  const tableId      = search.get('tid') || readSession(TID_KEY)

  // Remember a fresh scan for the rest of the visit.
  if (search.get('rid')) writeSession(RID_KEY, search.get('rid')!)
  if (search.get('tid')) writeSession(TID_KEY, search.get('tid')!)

  return { restaurantId, tableId }
}

/** True when we know which restaurant the guest is sitting in. */
export function hasScope(scope: GuestScope): boolean {
  return Boolean(scope.restaurantId)
}

/** Keep rid/tid on internal links so a refresh still works. */
export function withScope(path: string, scope: GuestScope): string {
  const url = new URL(path, 'http://local')
  if (scope.restaurantId) url.searchParams.set('rid', scope.restaurantId)
  if (scope.tableId)      url.searchParams.set('tid', scope.tableId)
  return `${url.pathname}${url.search}`
}

export const NO_SCOPE_MESSAGE =
  'Please scan the QR code on your table to see the menu.'

export function clearGuestScope(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(RID_KEY)
    sessionStorage.removeItem(TID_KEY)
  } catch {
    /* nothing to do */
  }
}
