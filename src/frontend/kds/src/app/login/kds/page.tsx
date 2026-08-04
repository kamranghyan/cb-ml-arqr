// src/app/login/kds/page.tsx
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AlertCircle, ChefHat, Eye, EyeOff, LogIn, CheckCircle } from 'lucide-react'

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' }

function KdsLoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const reason       = searchParams.get('reason')
  const { login, handleNewPassword, loading, error } = useAuth()

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [session,     setSession]     = useState('')
  const [step,        setStep]        = useState<'login' | 'new_password'>('login')
  const [localError,  setLocalError]  = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [showNew,     setShowNew]     = useState(false)

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
    if (newPassword.length < 8)     { setLocalError('Password must be at least 8 characters'); return }
    const result = await handleNewPassword(email, newPassword, session)
    if (result.success) router.push('/kds')
  }

  const displayError = error || localError

  return (
    <main style={{ minHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: 24 }}>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Hero header */}
        <div style={{ background: `linear-gradient(135deg, ${C.dark}, #B22222)`, borderRadius: '20px 20px 0 0', padding: '32px 32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,199,44,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

          {/* Icon */}
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,199,44,0.2)', border: '2.5px solid rgba(255,199,44,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', position: 'relative', zIndex: 1 }}>
            <ChefHat size={34} color={C.gold} />
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: '0 0 6px', fontFamily: 'Georgia, serif', position: 'relative', zIndex: 1 }}>Kitchen Display</h1>
          <p style={{ color: 'rgba(255,199,44,0.75)', fontSize: 13, margin: 0, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>Das Pardes · KDS Access</p>
        </div>

        {/* Form card */}
        <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 20px 20px', padding: '28px 32px 32px', boxShadow: '0 8px 32px rgba(137,28,28,0.12)' }}>

          {/* Session expired notice */}
          {reason === 'expired' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, marginBottom: 16 }}>
              <AlertCircle size={15} color="#d97706" />
              <p style={{ fontSize: 13, color: '#92400e', margin: 0, fontWeight: 600 }}>Session expired. Please sign in again.</p>
            </div>
          )}

          {/* Error */}
          {displayError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: 12, marginBottom: 16 }}>
              <AlertCircle size={15} color={C.red} />
              <p style={{ fontSize: 13, color: C.red, margin: 0 }}>{displayError}</p>
            </div>
          )}

          {/* ── Login form ── */}
          {step === 'login' && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: '0 0 20px', fontFamily: 'Georgia, serif' }}>Sign In</h2>
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="kitchen@daspardes.com"
                    style={{ width: '100%', height: 46, borderRadius: 12, padding: '0 14px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                    onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ width: '100%', height: 46, borderRadius: 12, padding: '0 44px 0 14px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                      onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                      {showPass ? <EyeOff size={16} color={C.subtle} /> : <Eye size={16} color={C.subtle} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  style={{ height: 50, borderRadius: 14, background: loading ? '#ccc' : C.red, color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, boxShadow: loading ? 'none' : '0 6px 20px rgba(225,37,27,0.3)', transition: 'all 0.2s' }}>
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
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF3E0', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle size={18} color={C.red} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>Set New Password</h2>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>First login — set a permanent password</p>
                </div>
              </div>
              <form onSubmit={handleNewPass} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showNew ? 'text' : 'password'} required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars, uppercase, number"
                      style={{ width: '100%', height: 46, borderRadius: 12, padding: '0 44px 0 14px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                      onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                      {showNew ? <EyeOff size={16} color={C.subtle} /> : <Eye size={16} color={C.subtle} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Confirm Password</label>
                  <input type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                    placeholder="Repeat password"
                    style={{ width: '100%', height: 46, borderRadius: 12, padding: '0 14px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
                    onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                    onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
                  />
                </div>
                {/* Password hint */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['8+ characters', '1 uppercase', '1 number'].map(hint => (
                    <span key={hint} style={{ fontSize: 10, color: C.muted, background: '#FFF3E0', border: '1px solid #FED7AA', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{hint}</span>
                  ))}
                </div>
                <button type="submit" disabled={loading}
                  style={{ height: 50, borderRadius: 14, background: loading ? '#ccc' : C.red, color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, boxShadow: loading ? 'none' : '0 6px 20px rgba(225,37,27,0.3)', transition: 'all 0.2s' }}>
                  {loading
                    ? <><div style={{ width: 18, height: 18, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Setting password…</>
                    : <><CheckCircle size={18} /> Set Password & Enter</>}
                </button>
              </form>
            </>
          )}

          <p style={{ textAlign: 'center', fontSize: 11, color: '#D1D5DB', margin: '20px 0 0' }}>
            Kitchen staff access only · Das Pardes Restaurant
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default function KdsLoginPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100dvh', background: '#FFF8F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#891C1C,#B22222)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👨‍🍳</div>
        <div style={{ width: 24, height: 24, border: '3px solid #E1251B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    }>
      <KdsLoginContent />
    </Suspense>
  )
}