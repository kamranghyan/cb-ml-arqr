// src/lib/api-client.ts
// Authenticated API client — auto-injects token + tenant headers

import { getValidIdToken, loadUser } from '@/lib/cognito'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!

type RequestOptions = {
  method?:  'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?:    object
  headers?: Record<string, string>
  public?:  boolean
}

export async function apiCall<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (!options.public) {
    const idToken = await getValidIdToken()
    if (!idToken) {
      throw new Error('Not authenticated')
    }
    headers['Authorization'] = idToken

    const user = loadUser()
    if (user?.tenantId) {
      headers['X-Tenant-Id'] = user.tenantId
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method:  options.method ?? 'GET',
    headers,
    body:    options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message ?? `API error ${res.status}`)
  }

  // Handle empty responses (204 No Content)
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}

// ── Convenience methods ───────────────────────────────────────────────────────
export const api = {
  get:    <T>(path: string, opts?: RequestOptions) =>
    apiCall<T>(path, { ...opts, method: 'GET' }),

  post:   <T>(path: string, body: object, opts?: RequestOptions) =>
    apiCall<T>(path, { ...opts, method: 'POST', body }),

  put:    <T>(path: string, body: object, opts?: RequestOptions) =>
    apiCall<T>(path, { ...opts, method: 'PUT', body }),

  delete: <T>(path: string, opts?: RequestOptions) =>
    apiCall<T>(path, { ...opts, method: 'DELETE' }),

  public: {
    get: <T>(path: string) =>
      apiCall<T>(path, { method: 'GET', public: true }),
  },
}