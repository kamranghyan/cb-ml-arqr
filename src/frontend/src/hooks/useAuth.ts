// src/hooks/useAuth.ts
// Auth hook — use in any component to get current user and auth actions

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  login as cognitoLogin,
  signOut as cognitoSignOut,
  loadUser,
  loadTokens,
  refreshTokens,
  forgotPassword,
  confirmForgotPassword,
  signUp,
  confirmSignUp,
  setNewPassword,
  isAdmin,
  isTenant,
  isKitchenStaff,
  type AuthUser,
} from '@/lib/cognito'

type AuthState = {
  user:        AuthUser | null
  loading:     boolean
  error:       string | null
}

type LoginResult = {
  success:   boolean
  challenge?: 'NEW_PASSWORD_REQUIRED'
  session?:  string
  redirect?: string // where to go after login
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user:    null,
    loading: true,
    error:   null,
  })

  // ── Load user on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const user   = loadUser()
    const tokens = loadTokens()
    if (user && tokens && Date.now() < tokens.expiresAt) {
      setState({ user, loading: false, error: null })
    } else if (tokens?.refreshToken) {
      // Try silent refresh
      refreshTokens().then(newTokens => {
        if (newTokens) {
          setState({ user: loadUser(), loading: false, error: null })
        } else {
          setState({ user: null, loading: false, error: null })
        }
      })
    } else {
      setState({ user: null, loading: false, error: null })
    }
  }, [])

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<LoginResult> => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const result = await cognitoLogin(email, password)

      if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
        setState(s => ({ ...s, loading: false }))
        return { success: false, challenge: 'NEW_PASSWORD_REQUIRED', session: result.session }
      }

      const user = result.user!
      // Set cookie for middleware
      setCookie('menulay_id_token', result.tokens!.idToken, 30)

      setState({ user, loading: false, error: null })

      // Determine redirect based on group
      let redirect = '/'
      if (isAdmin(user))        redirect = '/admin/dashboard'
      if (isTenant(user))       redirect = '/admin/dashboard'
      if (isKitchenStaff(user)) redirect = '/kds'

      return { success: true, redirect }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setState(s => ({ ...s, loading: false, error: message }))
      return { success: false }
    }
  }, [])

  // ── Handle new password challenge ────────────────────────────────────────
  const handleNewPassword = useCallback(async (
    email: string,
    newPassword: string,
    session: string
  ): Promise<LoginResult> => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const result = await setNewPassword(email, newPassword, session)
      setCookie('menulay_id_token', result.tokens.idToken, 30)
      const user = result.user
      setState({ user, loading: false, error: null })
      let redirect = '/'
      if (isAdmin(user))        redirect = '/admin/dashboard'
      if (isTenant(user))       redirect = '/admin/dashboard'
      if (isKitchenStaff(user)) redirect = '/kds'
      return { success: true, redirect }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set password'
      setState(s => ({ ...s, loading: false, error: message }))
      return { success: false }
    }
  }, [])

  // ── Sign out ─────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await cognitoSignOut()
    deleteCookie('menulay_id_token')
    setState({ user: null, loading: false, error: null })
    window.location.href = '/'
  }, [])

  // ── Forgot password ──────────────────────────────────────────────────────
  const sendResetCode = useCallback(async (email: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      await forgotPassword(email)
      setState(s => ({ ...s, loading: false }))
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send code'
      setState(s => ({ ...s, loading: false, error: message }))
      return { success: false, error: message }
    }
  }, [])

  const resetPassword = useCallback(async (
    email: string, code: string, newPassword: string
  ) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      await confirmForgotPassword(email, code, newPassword)
      setState(s => ({ ...s, loading: false }))
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed'
      setState(s => ({ ...s, loading: false, error: message }))
      return { success: false, error: message }
    }
  }, [])

  // ── Register (tenant self-signup) ────────────────────────────────────────
  const register = useCallback(async (
    email: string, password: string, restaurantName: string
  ) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      await signUp(email, password, restaurantName)
      setState(s => ({ ...s, loading: false }))
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setState(s => ({ ...s, loading: false, error: message }))
      return { success: false, error: message }
    }
  }, [])

  const verifyEmail = useCallback(async (email: string, code: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      await confirmSignUp(email, code)
      setState(s => ({ ...s, loading: false }))
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed'
      setState(s => ({ ...s, loading: false, error: message }))
      return { success: false, error: message }
    }
  }, [])

  return {
    // State
    user:            state.user,
    loading:         state.loading,
    error:           state.error,
    isAuthenticated: !!state.user,
    // Role checks
    isAdmin:         isAdmin(state.user),
    isTenant:        isTenant(state.user),
    isKitchenStaff:  isKitchenStaff(state.user),
    // Actions
    login,
    logout,
    handleNewPassword,
    sendResetCode,
    resetPassword,
    register,
    verifyEmail,
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}