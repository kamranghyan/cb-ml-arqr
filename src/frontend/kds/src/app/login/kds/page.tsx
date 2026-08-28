'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import {
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
  CheckCircle,
  Sun,
  Moon,
} from 'lucide-react'
import { toast } from 'sonner'

const BRAND = '#ff5723'

function KdsLoginContent() {
  const restaurantName = 'Kitchen'

  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const {
    login,
    handleNewPassword,
    loading,
  } = useAuth()

  const { isDark, toggle } = useTheme()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [session, setSession] = useState('')

  const [step, setStep] = useState<'login' | 'new_password'>('login')
  const [showPass, setShowPass] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const D = isDark
    ? {
        bg: '#111111',
        card: '#1C1C1C',
        border: 'rgba(255,255,255,0.08)',
        input: '#242424',
        text: '#F5F0E8',
        muted: '#9CA3AF',
        subtle: '#6B7280',
      }
    : {
        bg: '#FFFFFF',
        card: '#FFFFFF',
        border: '#F0EBE6',
        input: '#F5F5F5',
        text: '#000000',
        muted: '#6B6B6B',
        subtle: '#9CA3AF',
      }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const result = await login(email, password)

    if (result.success) {
      toast.success('Login successful! Welcome to the kitchen.')
      router.push('/kds')
      return
    }

    if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
      setSession(result.session ?? '')
      setStep('new_password')

      toast.info('First login detected. Please set your new password.')
      return
    }

    toast.error(
      result.error ||
        'Unable to sign in. Please check your email and password.'
    )
  }

  async function handleNewPass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!newPassword) {
      toast.error('Please enter a new password.')
      return
    }

    if (newPassword !== confirmPass) {
      toast.error('Passwords do not match.')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }

    if (!/[A-Z]/.test(newPassword)) {
      toast.error(
        'Password must contain at least one uppercase letter.'
      )
      return
    }

    if (!/[0-9]/.test(newPassword)) {
      toast.error(
        'Password must contain at least one number.'
      )
      return
    }

    if (!session) {
      toast.error(
        'Your password session has expired. Please sign in again.'
      )
      setStep('login')
      return
    }

    const result = await handleNewPassword(
      email,
      newPassword,
      session
    )

    if (result.success) {
      toast.success(
        'Password set successfully! Entering kitchen...'
      )
      router.push('/kds')
      return
    }

    toast.error(
      result.error ||
        'Unable to set password. Please try again.'
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 46,
    borderRadius: 12,
    padding: '0 14px',
    background: D.input,
    border: `1.5px solid ${D.border}`,
    fontSize: 14,
    color: D.text,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s ease',
  }

  const focusInput = (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    e.currentTarget.style.borderColor = BRAND
    e.currentTarget.style.boxShadow = `0 0 0 3px ${
      isDark
        ? 'rgba(255,87,35,0.2)'
        : 'rgba(255,87,35,0.15)'
    }`
  }

  const blurInput = (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    e.currentTarget.style.borderColor = D.border
    e.currentTarget.style.boxShadow = 'none'
  }

  const buttonStyle: React.CSSProperties = {
    height: 50,
    borderRadius: 14,
    background: loading
      ? 'rgba(255,87,35,0.5)'
      : BRAND,
    color: '#fff',
    border: 'none',
    fontSize: 15,
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    fontFamily: "'Poppins', sans-serif",
    boxShadow: loading
      ? 'none'
      : '0 6px 20px rgba(255,87,35,0.3)',
    transition: 'all 0.2s ease',
    outline: 'none',
    opacity: loading ? 0.7 : 1,
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: D.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Poppins', sans-serif",
        padding: 24,
        position: 'relative',
        transition: 'background 0.25s',
      }}
    >

      {/* Theme Toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: 12,
          background: D.card,
          border: `1.5px solid ${D.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
      >
        {isDark ? (
          <Sun size={17} color={D.muted} />
        ) : (
          <Moon size={17} color={D.muted} />
        )}
      </button>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
        }}
      >
        {/* Hero Header */}
        <div
          style={{
            background: BRAND,
            borderRadius: '20px 20px 0 0',
            padding: '32px 32px 28px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: -30,
              left: -30,
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <img
              src="/Images/white-logo.png"
              alt="Restaurant Icon"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          <h1
            style={{
              color: '#fff',
              fontSize: 24,
              fontWeight: 700,
              margin: '0 0 6px',
              fontFamily: "'Poppins', sans-serif",
              position: 'relative',
              zIndex: 1,
            }}
          >
            Kitchen Display
          </h1>

          <p
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 13,
              margin: 0,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              position: 'relative',
              zIndex: 1,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {restaurantName} · KDS Access
          </p>
        </div>

        {/* Form Card */}
        <div
          style={{
            background: D.card,
            border: `1.5px solid ${D.border}`,
            borderTop: 'none',
            borderRadius: '0 0 20px 20px',
            padding: '28px 32px 32px',
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.3)'
              : '0 8px 32px rgba(255,87,35,0.1)',
            transition: 'all 0.25s',
          }}
        >
          {/* Session expired */}
          {reason === 'expired' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: isDark
                  ? 'rgba(217,119,6,0.15)'
                  : '#FFFBEB',
                border: `1px solid ${
                  isDark
                    ? 'rgba(217,119,6,0.35)'
                    : '#FDE68A'
                }`,
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <AlertCircle
                size={15}
                color={isDark ? '#fbbf24' : '#d97706'}
              />

              <p
                style={{
                  fontSize: 13,
                  color: isDark
                    ? '#fbbf24'
                    : '#92400e',
                  margin: 0,
                  fontWeight: 600,
                }}
              >
                Session expired. Please sign in again.
              </p>
            </div>
          )}

          {/* Login */}
          {step === 'login' && (
            <>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: D.text,
                  margin: '0 0 20px',
                }}
              >
                Sign In
              </h2>

              <form
                onSubmit={handleLogin}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div>
                  <label
                    htmlFor="kds-email"
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: D.subtle,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Email
                  </label>

                  <input
                    id="kds-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="kitchen@daspardes.com"
                    style={inputStyle}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                <div>
                  <label
                    htmlFor="kds-password"
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: D.subtle,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Password
                  </label>

                  <div
                    style={{
                      position: 'relative',
                    }}
                  >
                    <input
                      id="kds-password"
                      type={
                        showPass ? 'text' : 'password'
                      }
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="••••••••"
                      style={{
                        ...inputStyle,
                        padding: '0 44px 0 14px',
                      }}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPass((prev) => !prev)
                      }
                      aria-label={
                        showPass
                          ? 'Hide password'
                          : 'Show password'
                      }
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform:
                          'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        outline: 'none',
                      }}
                    >
                      {showPass ? (
                        <EyeOff
                          size={16}
                          color={D.subtle}
                        />
                      ) : (
                        <Eye
                          size={16}
                          color={D.subtle}
                        />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={buttonStyle}
                >
                  {loading ? (
                    <>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          border: '2.5px solid #fff',
                          borderTopColor:
                            'transparent',
                          borderRadius: '50%',
                          animation:
                            'spin 0.8s linear infinite',
                        }}
                      />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Enter Kitchen
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* New Password */}
          {step === 'new_password' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: isDark
                      ? 'rgba(255,87,35,0.15)'
                      : '#FFF3E0',
                    border: `1px solid ${
                      isDark
                        ? 'rgba(255,87,35,0.3)'
                        : '#FED7AA'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle
                    size={18}
                    color={BRAND}
                  />
                </div>

                <div>
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: D.text,
                      margin: 0,
                    }}
                  >
                    Set New Password
                  </h2>

                  <p
                    style={{
                      fontSize: 12,
                      color: D.muted,
                      margin: 0,
                    }}
                  >
                    First login — set a permanent
                    password
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleNewPass}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div>
                  <label
                    htmlFor="kds-new-password"
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: D.subtle,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    New Password
                  </label>

                  <div
                    style={{
                      position: 'relative',
                    }}
                  >
                    <input
                      id="kds-new-password"
                      type={
                        showNew ? 'text' : 'password'
                      }
                      required
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) =>
                        setNewPassword(e.target.value)
                      }
                      placeholder="Min 8 chars, uppercase, number"
                      style={{
                        ...inputStyle,
                        padding: '0 44px 0 14px',
                      }}
                      onFocus={focusInput}
                      onBlur={blurInput}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowNew((prev) => !prev)
                      }
                      aria-label={
                        showNew
                          ? 'Hide new password'
                          : 'Show new password'
                      }
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform:
                          'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        outline: 'none',
                      }}
                    >
                      {showNew ? (
                        <EyeOff
                          size={16}
                          color={D.subtle}
                        />
                      ) : (
                        <Eye
                          size={16}
                          color={D.subtle}
                        />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="kds-confirm-password"
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: D.subtle,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    Confirm Password
                  </label>

                  <input
                    id="kds-confirm-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPass}
                    onChange={(e) =>
                      setConfirmPass(e.target.value)
                    }
                    placeholder="Repeat password"
                    style={inputStyle}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                </div>

                {/* Password hints */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  {[
                    '8+ characters',
                    '1 uppercase',
                    '1 number',
                  ].map((hint) => (
                    <span
                      key={hint}
                      style={{
                        fontSize: 10,
                        color: D.muted,
                        background: isDark
                          ? 'rgba(255,87,35,0.12)'
                          : '#FFF3E0',
                        border: `1px solid ${
                          isDark
                            ? 'rgba(255,87,35,0.3)'
                            : '#FED7AA'
                        }`,
                        borderRadius: 20,
                        padding: '3px 10px',
                        fontWeight: 600,
                      }}
                    >
                      {hint}
                    </span>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={buttonStyle}
                >
                  {loading ? (
                    <>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          border: '2.5px solid #fff',
                          borderTopColor:
                            'transparent',
                          borderRadius: '50%',
                          animation:
                            'spin 0.8s linear infinite',
                        }}
                      />
                      Setting password…
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Set Password & Enter
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <p
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: D.subtle,
              margin: '20px 0 0',
            }}
          >
            Kitchen staff access only ·{' '}
            {restaurantName} Restaurant
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  )
}

export default function KdsLoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100dvh',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 16,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#ff5723',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            👨‍🍳
          </div>

          <div
            style={{
              width: 24,
              height: 24,
              border: '3px solid #ff5723',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation:
                'spin 0.8s linear infinite',
            }}
          />

          <style>{`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </main>
      }
    >
      <KdsLoginContent />
    </Suspense>
  )
}