// src/lib/cognito.ts
// Cognito token management — calls go through /api/auth proxy to avoid CORS

export type CognitoTokens = {
  accessToken:  string
  idToken:      string
  refreshToken: string
  expiresAt:    number
}

export type AuthUser = {
  email:       string
  role:        string
  tenantId:    string
  tenantName:  string
  displayName: string
  planTier:    string
  groups:      string[]
}

const KEYS = {
  tokens: 'menulay_tokens',
  user:   'menulay_user',
}

// ── Storage ──────────────────────────────────────────────────────────────────
export function saveTokens(tokens: CognitoTokens) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEYS.tokens, JSON.stringify(tokens))
}

export function loadTokens(): CognitoTokens | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEYS.tokens)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearTokens() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEYS.tokens)
  localStorage.removeItem(KEYS.user)
}

export function loadUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEYS.user)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ── JWT parser ───────────────────────────────────────────────────────────────
export function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch { return {} }
}

export function extractUser(idToken: string): AuthUser {
  const claims = parseJwt(idToken)
  return {
    email:       (claims['email']               as string) ?? '',
    role:        (claims['custom:role']         as string) ?? '',
    tenantId:    (claims['custom:tenant_id']    as string) ?? '',
    tenantName:  (claims['custom:tenant_name']  as string) ?? '',
    displayName: (claims['custom:display_name'] as string) ?? '',
    planTier:    (claims['custom:plan_tier']    as string) ?? '',
    groups:      (claims['cognito:groups']      as string[]) ?? [],
  }
}

// ── Proxy call — goes through /api/auth (avoids CORS) ───────────────────────
async function authProxy(action: string, payload: object) {
  const res = await fetch('/api/auth', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, ...payload }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? data.error ?? 'Auth error')
  return data
}

// ── Login ────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<{
  tokens?:    CognitoTokens
  user?:      AuthUser
  challenge?: string
  session?:   string
}> {
  const data = await authProxy('login', { email, password })

  if (data.challenge === 'NEW_PASSWORD_REQUIRED') {
    return { challenge: 'NEW_PASSWORD_REQUIRED', session: data.session }
  }

  const tokens: CognitoTokens = {
    accessToken:  data.accessToken,
    idToken:      data.idToken,
    refreshToken: data.refreshToken,
    expiresAt:    Date.now() + data.expiresIn * 1000,
  }
  const user = extractUser(tokens.idToken)
  saveTokens(tokens)
  localStorage.setItem(KEYS.user, JSON.stringify(user))
  return { tokens, user }
}

// ── Set new password ─────────────────────────────────────────────────────────
export async function setNewPassword(
  email: string,
  newPassword: string,
  session: string
): Promise<{ tokens: CognitoTokens; user: AuthUser }> {
  const data = await authProxy('setNewPassword', { email, newPassword, session })
  const tokens: CognitoTokens = {
    accessToken:  data.accessToken,
    idToken:      data.idToken,
    refreshToken: data.refreshToken,
    expiresAt:    Date.now() + data.expiresIn * 1000,
  }
  const user = extractUser(tokens.idToken)
  saveTokens(tokens)
  localStorage.setItem(KEYS.user, JSON.stringify(user))
  return { tokens, user }
}

// ── Refresh tokens ───────────────────────────────────────────────────────────
export async function refreshTokens(): Promise<CognitoTokens | null> {
  const existing = loadTokens()
  if (!existing?.refreshToken) return null
  try {
    const data = await authProxy('refresh', { refreshToken: existing.refreshToken })
    const tokens: CognitoTokens = {
      accessToken:  data.accessToken,
      idToken:      data.idToken,
      refreshToken: existing.refreshToken,
      expiresAt:    Date.now() + data.expiresIn * 1000,
    }
    saveTokens(tokens)
    return tokens
  } catch { return null }
}

// ── Get valid tokens (auto-refresh) ──────────────────────────────────────────
export async function getValidIdToken(): Promise<string | null> {
  let tokens = loadTokens()
  if (!tokens) return null
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
    tokens = await refreshTokens()
  }
  return tokens?.idToken ?? null
}

export async function getValidToken(): Promise<string | null> {
  let tokens = loadTokens()
  if (!tokens) return null
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
    tokens = await refreshTokens()
  }
  return tokens?.accessToken ?? null
}

// ── Forgot password ──────────────────────────────────────────────────────────
export async function forgotPassword(email: string): Promise<void> {
  await authProxy('forgotPassword', { email })
}

export async function confirmForgotPassword(
  email: string, code: string, newPassword: string
): Promise<void> {
  await authProxy('confirmForgotPassword', { email, code, newPassword })
}

// ── Sign up ───────────────────────────────────────────────────────────────────
export async function signUp(
  email: string, password: string, restaurantName: string
): Promise<void> {
  await authProxy('signUp', { email, password, restaurantName })
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await authProxy('confirmSignUp', { email, code })
}

// ── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  const tokens = loadTokens()
  if (tokens?.accessToken) {
    try { await authProxy('signOut', { accessToken: tokens.accessToken }) } catch {}
  }
  clearTokens()
}

// ── Role helpers ─────────────────────────────────────────────────────────────
export function isAdmin(user: AuthUser | null)        { return user?.groups.includes('menulay_admin') ?? false }
export function isTenant(user: AuthUser | null)       { return user?.groups.includes('menulay_tenant') ?? false }
export function isKitchenStaff(user: AuthUser | null) { return user?.groups.includes('menulay_kitchen_staff') ?? false }