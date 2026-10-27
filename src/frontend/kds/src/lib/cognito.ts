// src/lib/cognito.ts
// Cognito token management — calls go through /api/auth proxy to avoid CORS

export type CognitoTokens = {
  accessToken:  string
  idToken:      string
  refreshToken: string
  expiresAt:    number
}

export type AuthUser = {
  email:        string
  role:         string
  tenantId:     string
  restaurantId: string
  tenantName:   string
  displayName:  string
  planTier:     string
  groups:       string[]
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

const ROLE_BY_GROUP: Record<string, string> = {
  menulay_admin:            'admin',              // platform admin
  menulay_tenant:           'tenant',             // company owner
  menulay_kitchen_staff:    'staff',
}

export function extractUser(idToken: string): AuthUser {
  const claims = parseJwt(idToken)
  const groups = (claims['cognito:groups'] as string[]) ?? []

  // Prefer the group-derived role; custom:role is legacy and often unset.
  const roleFromGroup = groups.map(g => ROLE_BY_GROUP[g]).find(Boolean) ?? ''

  return {
    email:        (claims['email']                as string) ?? '',
    role:         roleFromGroup || ((claims['custom:role'] as string) ?? ''),
    tenantId:     (claims['custom:tenant_id']     as string) ?? '',
    restaurantId: (claims['custom:restaurant_id'] as string) ?? '',
    tenantName:   (claims['custom:tenant_name']   as string) ?? '',
    displayName:  (claims['custom:display_name']  as string) ?? '',
    planTier:     (claims['custom:plan_tier']     as string) ?? '',
    groups,
  }
}

const REGION    = process.env.NEXT_PUBLIC_COGNITO_REGION!      // e.g. ap-south-1
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!

async function cognito(target: string, body: object) {
  const res = await fetch(`https://cognito-idp.${REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? data.__type ?? 'Auth error')
  return data
}

function tokensFrom(r: any) {
  const a = r.AuthenticationResult
  return {
    accessToken: a.AccessToken,
    idToken: a.IdToken,
    refreshToken: a.RefreshToken,
    expiresIn: a.ExpiresIn,
  }
}

// Same shape as before, so login(), refreshTokens() etc. don't change
async function authProxy(action: string, p: any) {
  switch (action) {
    case 'login': {
      const r = await cognito('InitiateAuth', {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: p.email, PASSWORD: p.password },
      })
      if (r.ChallengeName === 'NEW_PASSWORD_REQUIRED')
        return { challenge: 'NEW_PASSWORD_REQUIRED', session: r.Session }
      return tokensFrom(r)
    }
    case 'setNewPassword':
      return tokensFrom(await cognito('RespondToAuthChallenge', {
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: CLIENT_ID,
        Session: p.session,
        ChallengeResponses: { USERNAME: p.email, NEW_PASSWORD: p.newPassword },
      }))
    case 'refresh':
      return tokensFrom(await cognito('InitiateAuth', {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: p.refreshToken },
      }))
    case 'forgotPassword':
      return cognito('ForgotPassword', { ClientId: CLIENT_ID, Username: p.email })
    case 'confirmForgotPassword':
      return cognito('ConfirmForgotPassword', {
        ClientId: CLIENT_ID, Username: p.email,
        ConfirmationCode: p.code, Password: p.newPassword,
      })
    case 'confirmSignUp':
      return cognito('ConfirmSignUp', {
        ClientId: CLIENT_ID, Username: p.email, ConfirmationCode: p.code,
      })
    case 'signOut':
      return cognito('GlobalSignOut', { AccessToken: p.accessToken })
    case 'signUp':
      return cognito('SignUp', {
        ClientId: CLIENT_ID, Username: p.email, Password: p.password,
        UserAttributes: [
          { Name: 'email', Value: p.email },
          // restaurantName: see note below
        ],
      })
    default:
      throw new Error('Unknown action')
  }
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
/** Users pinned to a single branch. Today that means kitchen staff. */
export function isBranchUser(user: AuthUser | null) {
  return isKitchenStaff(user)
}