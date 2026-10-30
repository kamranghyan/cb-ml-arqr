// lib/guest-scope.ts

const RID_KEY = 'lm_rid'
const TID_KEY = 'lm_tid'
const TABLE_NUM_KEY = 'lm_table'

export interface GuestScope {
  restaurantId: string
  tableId: string
  tableNumber?: string
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
    /* private mode */
  }
}

/**
 * Check if string is a UUID
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Extract table number ONLY from table format strings
 * Does NOT extract from UUID
 */
export function extractTableNumber(tableId: string): string {
  if (!tableId) return ''
  
  // Don't extract from UUID
  if (isUUID(tableId)) return ''
  
  // Only extract if it's in table format (table-12, T-12, table_12, etc.)
  const match = tableId.match(/^[Tt](?:able)?[-_]?(\d+)$/)
  if (match) {
    const num = parseInt(match[1], 10)
    return `T-${num.toString().padStart(2, '0')}`
  }
  
  return ''
}

export function getGuestScope(params?: URLSearchParams): GuestScope {
  const search =
    params ??
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams())

  const restaurantId = search.get('rid') || readSession(RID_KEY)
  const tableId = search.get('tid') || readSession(TID_KEY)
  
  // Priority for table number:
  // 1. URL param 'table' or 'tableNumber'
  // 2. Session storage 'lm_table'
  // 3. Extract from tableId ONLY if NOT UUID
  let tableNumber = search.get('table') || search.get('tableNumber') || ''
  
  if (!tableNumber) {
    tableNumber = readSession(TABLE_NUM_KEY)
  }
  
  // If still no table number and tableId is NOT UUID, try to extract
  if (!tableNumber && tableId && !isUUID(tableId)) {
    const extracted = extractTableNumber(tableId)
    if (extracted) {
      tableNumber = extracted
    }
  }

  // Remember a fresh scan for the rest of the visit.
  if (search.get('rid')) writeSession(RID_KEY, search.get('rid')!)
  if (search.get('tid')) writeSession(TID_KEY, search.get('tid')!)
  
  // Save table number only if valid
  if (tableNumber && tableNumber.startsWith('T-')) {
    writeSession(TABLE_NUM_KEY, tableNumber)
  }

  return { restaurantId, tableId, tableNumber: tableNumber || undefined }
}

export function hasScope(scope: GuestScope): boolean {
  return Boolean(scope.restaurantId)
}

export function withScope(path: string, scope: GuestScope): string {
  const url = new URL(path, 'http://local')
  if (scope.restaurantId) url.searchParams.set('rid', scope.restaurantId)
  if (scope.tableId) url.searchParams.set('tid', scope.tableId)
  if (scope.tableNumber) url.searchParams.set('table', scope.tableNumber)
  return `${url.pathname}${url.search}`
}

export const NO_SCOPE_MESSAGE =
  'Please scan the QR code on your table to see the menu.'

export function clearGuestScope(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(RID_KEY)
    sessionStorage.removeItem(TID_KEY)
    sessionStorage.removeItem(TABLE_NUM_KEY)
  } catch {
    /* nothing to do */
  }
}