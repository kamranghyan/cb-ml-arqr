/**
 * lib/constants.ts
 * ================
 * Values that more than one layer needs to agree on.
 */

/**
 * The session cookie. Middleware runs on the server and cannot read
 * localStorage, so the token lives here too.
 *
 * The name is app-specific on purpose: cookies ignore the port, so on
 * localhost every app would otherwise share one cookie and log each other out.
 */
export const COOKIE_NAME = 'menulay_token_console'

/** localStorage keys used by the browser-side session. */
export const STORAGE_KEYS = {
  tokens: 'menulay_tokens',
  user:   'menulay_user',
} as const

export const PUBLIC_PATHS = ['/login', '/unauthorized']

export const IGNORED_PREFIXES = ['/_next', '/api/', '/public', '/favicon']
