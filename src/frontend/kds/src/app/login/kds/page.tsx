// src/app/login/kds/page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { AlertCircle, ChefHat, Eye, EyeOff, LogIn, CheckCircle, Sun, Moon } from 'lucide-react'

const BRAND = '#ff5723'

function KdsLoginContent() {
  const [restaurantName, setRestaurantName] = useState('Kitchen')
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const { login, handleNewPassword, loading, error } = useAuth()
  const { isDark, toggle } = useTheme()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [session, setSession] = useState('')
  const [step, setStep] = useState<'login' | 'new_password'>('login')
  const [localError, setLocalError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', border: 'rgba(255,255,255,0.08)',
    input: '#242424', text: '#F5F0E8', muted: '#9CA3AF', subtle: '#6B7280',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', border: '#F0EBE6',
    input: '#F5F5F5', text: '#000000', muted: '#6B6B6B', subtle: '#9CA3AF',
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    const result = await login(email, password)
    if (result.success) {
      router.push('/kds')
    } else if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
      setSession(result.session ?? '')
      setStep('new_password')
    }
  }

  async function handleNewPass(e: React.FormEvent) {
    e.preventDefault()
    setLocalError('')
    if (newPassword !== confirmPass) { setLocalError('Passwords do not match'); return }
    if (newPassword.length < 8) { setLocalError('Password must be at least 8 characters'); return }
    const result = await handleNewPassword(email, newPassword, session)
    if (result.success) router.push('/kds')
  }

  const displayError = error || localError

  return (
    <main style={{ 
      minHeight: '100dvh', 
      background: D.bg, 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      fontFamily: "'Poppins', sans-serif", 
      padding: 24, 
      position: 'relative', 
      transition: 'background 0.25s' 
    }}>

      {/* ── Theme Toggle ── */}
      <button 
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
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark ? '#2A2A2A' : '#F0F0F0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = D.card;
        }}
      >
        {isDark ? <Sun size={17} color={D.muted} /> : <Moon size={17} color={D.muted} />}
      </button>

      {/* ── Card ── */}
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* ── Hero Header ── */}
        <div style={{ 
          background: BRAND, 
          borderRadius: '20px 20px 0 0', 
          padding: '32px 32px 28px', 
          textAlign: 'center', 
          position: 'relative', 
          overflow: 'hidden' 
        }}>
          <div style={{ 
            position: 'absolute', 
            top: -40, 
            right: -40, 
            width: 130, 
            height: 130, 
            borderRadius: '50%', 
            background: 'rgba(255,255,255,0.08)', 
            pointerEvents: 'none' 
          }} />
          <div style={{ 
            position: 'absolute', 
            bottom: -30, 
            left: -30, 
            width: 100, 
            height: 100, 
            borderRadius: '50%', 
            background: 'rgba(255,255,255,0.06)', 
            pointerEvents: 'none' 
          }} />

          <div style={{ 
            width: 72, 
            height: 72, 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px', 
            position: 'relative', 
            zIndex: 1 
          }}>
            <img src='/Images/white-logo.png' alt="Restaurant Icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{ 
            color: '#fff', 
            fontSize: 24, 
            fontWeight: 700, 
            margin: '0 0 6px', 
            fontFamily: "'Poppins', sans-serif", 
            position: 'relative', 
            zIndex: 1 
          }}>Kitchen Display</h1>
          <p style={{ 
            color: 'rgba(255,255,255,0.8)', 
            fontSize: 13, 
            margin: 0, 
            fontWeight: 600, 
            letterSpacing: 1, 
            textTransform: 'uppercase', 
            position: 'relative', 
            zIndex: 1,
            fontFamily: "'Poppins', sans-serif",
          }}>{restaurantName} · KDS Access</p>
        </div>

        {/* ── Form Card ── */}
        <div style={{ 
          background: D.card, 
          border: `1.5px solid ${D.border}`, 
          borderTop: 'none', 
          borderRadius: '0 0 20px 20px', 
          padding: '28px 32px 32px', 
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(255,87,35,0.1)',
          transition: 'all 0.25s',
        }}>

          {/* ── Session expired notice ── */}
          {reason === 'expired' && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 10, 
              padding: '12px 14px', 
              background: isDark ? 'rgba(217,119,6,0.15)' : '#FFFBEB', 
              border: `1px solid ${isDark ? 'rgba(217,119,6,0.35)' : '#FDE68A'}`, 
              borderRadius: 12, 
              marginBottom: 16,
              fontFamily: "'Poppins', sans-serif",
            }}>
              <AlertCircle size={15} color={isDark ? '#fbbf24' : '#d97706'} />
              <p style={{ 
                fontSize: 13, 
                color: isDark ? '#fbbf24' : '#92400e', 
                margin: 0, 
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
              }}>Session expired. Please sign in again.</p>
            </div>
          )}

          {/* ── Error ── */}
          {displayError && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 10, 
              padding: '12px 14px', 
              background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0', 
              border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0'}`, 
              borderRadius: 12, 
              marginBottom: 16,
              fontFamily: "'Poppins', sans-serif",
            }}>
              <AlertCircle size={15} color={BRAND} />
              <p style={{ 
                fontSize: 13, 
                color: isDark ? '#ff8a5c' : BRAND, 
                margin: 0,
                fontFamily: "'Poppins', sans-serif",
              }}>{displayError}</p>
            </div>
          )}

          {/* ── Login form ── */}
          {step === 'login' && (
            <>
              <h2 style={{ 
                fontSize: 18, 
                fontWeight: 700, 
                color: D.text, 
                margin: '0 0 20px', 
                fontFamily: "'Poppins', sans-serif" 
              }}>Sign In</h2>
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: 11, 
                    color: D.subtle, 
                    fontWeight: 700, 
                    letterSpacing: 1.5, 
                    textTransform: 'uppercase', 
                    marginBottom: 6,
                    fontFamily: "'Poppins', sans-serif",
                  }}>Email</label>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    placeholder="kitchen@daspardes.com"
                    style={{ 
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
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = BRAND;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = D.border;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: 11, 
                    color: D.subtle, 
                    fontWeight: 700, 
                    letterSpacing: 1.5, 
                    textTransform: 'uppercase', 
                    marginBottom: 6,
                    fontFamily: "'Poppins', sans-serif",
                  }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPass ? 'text' : 'password'} 
                      required 
                      value={password} 
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ 
                        width: '100%', 
                        height: 46, 
                        borderRadius: 12, 
                        padding: '0 44px 0 14px', 
                        background: D.input, 
                        border: `1.5px solid ${D.border}`, 
                        fontSize: 14, 
                        color: D.text, 
                        outline: 'none', 
                        boxSizing: 'border-box', 
                        fontFamily: "'Poppins', sans-serif",
                        transition: 'all 0.2s ease',
                      }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = BRAND;
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = D.border;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPass(!showPass)}
                      style={{ 
                        position: 'absolute', 
                        right: 12, 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: 4, 
                        display: 'flex', 
                        alignItems: 'center',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                        e.currentTarget.style.borderRadius = '6px';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {showPass ? <EyeOff size={16} color={D.subtle} /> : <Eye size={16} color={D.subtle} />}
                    </button>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ 
                    height: 50, 
                    borderRadius: 14, 
                    // ✅ BRAND color with 0.5 opacity when loading
                    background: loading ? `rgba(255,87,35,0.5)` : BRAND, 
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
                    boxShadow: loading ? 'none' : '0 6px 20px rgba(255,87,35,0.3)', 
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    opacity: loading ? 0.7 : 1,
                  }}
                  onFocus={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}, 0 6px 20px rgba(255,87,35,0.3)`;
                    }
                  }}
                  onBlur={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,87,35,0.3)';
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = '#e64a1a';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = BRAND;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {loading
                    ? <><div style={{ width: 18, height: 18, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Signing in…</>
                    : <><LogIn size={18} /> Enter Kitchen</>}
                </button>
              </form>
            </>
          )}

          {/* ── New password form ── */}
          {step === 'new_password' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 10, 
                  background: isDark ? 'rgba(255,87,35,0.15)' : '#FFF3E0', 
                  border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FED7AA'}`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexShrink: 0 
                }}>
                  <CheckCircle size={18} color={BRAND} />
                </div>
                <div>
                  <h2 style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: D.text, 
                    margin: 0, 
                    fontFamily: "'Poppins', sans-serif" 
                  }}>Set New Password</h2>
                  <p style={{ 
                    fontSize: 12, 
                    color: D.muted, 
                    margin: 0,
                    fontFamily: "'Poppins', sans-serif",
                  }}>First login — set a permanent password</p>
                </div>
              </div>
              <form onSubmit={handleNewPass} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: 11, 
                    color: D.subtle, 
                    fontWeight: 700, 
                    letterSpacing: 1.5, 
                    textTransform: 'uppercase', 
                    marginBottom: 6,
                    fontFamily: "'Poppins', sans-serif",
                  }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showNew ? 'text' : 'password'} 
                      required 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars, uppercase, number"
                      style={{ 
                        width: '100%', 
                        height: 46, 
                        borderRadius: 12, 
                        padding: '0 44px 0 14px', 
                        background: D.input, 
                        border: `1.5px solid ${D.border}`, 
                        fontSize: 14, 
                        color: D.text, 
                        outline: 'none', 
                        boxSizing: 'border-box', 
                        fontFamily: "'Poppins', sans-serif",
                        transition: 'all 0.2s ease',
                      }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = BRAND;
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = D.border;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowNew(!showNew)}
                      style={{ 
                        position: 'absolute', 
                        right: 12, 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: 4, 
                        display: 'flex', 
                        alignItems: 'center',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                        e.currentTarget.style.borderRadius = '6px';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {showNew ? <EyeOff size={16} color={D.subtle} /> : <Eye size={16} color={D.subtle} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: 11, 
                    color: D.subtle, 
                    fontWeight: 700, 
                    letterSpacing: 1.5, 
                    textTransform: 'uppercase', 
                    marginBottom: 6,
                    fontFamily: "'Poppins', sans-serif",
                  }}>Confirm Password</label>
                  <input 
                    type="password" 
                    required 
                    value={confirmPass} 
                    onChange={e => setConfirmPass(e.target.value)}
                    placeholder="Repeat password"
                    style={{ 
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
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = BRAND;
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}`;
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = D.border;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                {/* Password hint */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['8+ characters', '1 uppercase', '1 number'].map(hint => (
                    <span key={hint} style={{ 
                      fontSize: 10, 
                      color: D.muted, 
                      background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF3E0', 
                      border: `1px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FED7AA'}`, 
                      borderRadius: 20, 
                      padding: '3px 10px', 
                      fontWeight: 600,
                      fontFamily: "'Poppins', sans-serif",
                    }}>{hint}</span>
                  ))}
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ 
                    height: 50, 
                    borderRadius: 14, 
                    // ✅ BRAND color with 0.5 opacity when loading
                    background: loading ? `rgba(255,87,35,0.5)` : BRAND, 
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
                    boxShadow: loading ? 'none' : '0 6px 20px rgba(255,87,35,0.3)', 
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    opacity: loading ? 0.7 : 1,
                  }}
                  onFocus={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)'}, 0 6px 20px rgba(255,87,35,0.3)`;
                    }
                  }}
                  onBlur={(e) => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,87,35,0.3)';
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = '#e64a1a';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = BRAND;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {loading
                    ? <><div style={{ width: 18, height: 18, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Setting password…</>
                    : <><CheckCircle size={18} /> Set Password & Enter</>}
                </button>
              </form>
            </>
          )}

          <p style={{ 
            textAlign: 'center', 
            fontSize: 11, 
            color: D.subtle, 
            margin: '20px 0 0',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Kitchen staff access only · {restaurantName} Restaurant
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
      `}</style>
    </main>
  )
}

export default function KdsLoginPage() {
  return (
    <Suspense fallback={
      <main style={{ 
        minHeight: '100dvh', 
        background: '#FFFFFF', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        flexDirection: 'column', 
        gap: 16,
        fontFamily: "'Poppins', sans-serif",
      }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ff5723', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👨‍🍳</div>
        <div style={{ width: 24, height: 24, border: '3px solid #ff5723', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    }>
      <KdsLoginContent />
    </Suspense>
  )
}