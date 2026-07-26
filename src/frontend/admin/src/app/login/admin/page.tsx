// src/app/login/admin/page.tsx
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AlertCircle, Eye, EyeOff, LogIn, CheckCircle, KeyRound, UserPlus, Mail, Store, ArrowLeft } from 'lucide-react'

type Step = 'login' | 'new_password' | 'forgot' | 'reset_confirm' | 'register' | 'verify'

const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' }

function Field({ label, type, value, onChange, placeholder, showToggle, show, onToggle }: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder?: string; showToggle?: boolean; show?: boolean; onToggle?: () => void;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={showToggle ? (show ? 'text' : 'password') : type}
          required value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', height: 46, borderRadius: 12, padding: showToggle ? '0 44px 0 14px' : '0 14px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif', transition: 'border-color 0.2s' }}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
          onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
        />
        {showToggle && (
          <button type="button" onClick={onToggle}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            {show ? <EyeOff size={16} color={C.subtle} /> : <Eye size={16} color={C.subtle} />}
          </button>
        )}
      </div>
    </div>
  )
}

function PrimaryBtn({ children, loading, disabled }: { children: React.ReactNode; loading?: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={loading || disabled}
      style={{ width: '100%', height: 50, borderRadius: 14, background: (loading || disabled) ? '#ccc' : C.red, color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: (loading || disabled) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, boxShadow: (loading || disabled) ? 'none' : '0 6px 20px rgba(225,37,27,0.3)', transition: 'all 0.2s' }}>
      {loading
        ? <><div style={{ width: 18, height: 18, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Working…</>
        : children}
    </button>
  )
}

function AdminLoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const reason       = searchParams.get('reason')
  const { login, handleNewPassword, sendResetCode, resetPassword, register, verifyEmail, loading, error } = useAuth()

  const [step,        setStep]        = useState<Step>('login')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [code,        setCode]        = useState('')
  const [restaurant,  setRestaurant]  = useState('')
  const [session,     setSession]     = useState('')
  const [message,     setMessage]     = useState('')
  const [localError,  setLocalError]  = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [showNew,     setShowNew]     = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLocalError('')
    const result = await login(email, password)
    if (result.success && result.redirect) router.push(result.redirect)
    else if (result.challenge === 'NEW_PASSWORD_REQUIRED') { setSession(result.session ?? ''); setStep('new_password') }
  }
  async function handleNewPass(e: React.FormEvent) {
    e.preventDefault(); setLocalError('')
    if (newPassword !== confirmPass) { setLocalError('Passwords do not match'); return }
    const result = await handleNewPassword(email, newPassword, session)
    if (result.success && result.redirect) router.push(result.redirect)
  }
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setLocalError('')
    const result = await sendResetCode(email)
    if (result.success) { setMessage('Check your email for a reset code'); setStep('reset_confirm') }
  }
  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); setLocalError('')
    if (newPassword !== confirmPass) { setLocalError('Passwords do not match'); return }
    const result = await resetPassword(email, code, newPassword)
    if (result.success) { setMessage('Password reset! You can now sign in.'); setStep('login') }
  }
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setLocalError('')
    const result = await register(email, password, restaurant)
    if (result.success) { setMessage('Check your email for a verification code'); setStep('verify') }
  }
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault(); setLocalError('')
    const result = await verifyEmail(email, code)
    if (result.success) { setMessage('Email verified! You can now sign in.'); setStep('login') }
  }

  const displayError = error || localError

  // Step meta
  const stepMeta: Record<Step, { icon: React.ReactNode; title: string; sub: string }> = {
    login:         { icon: <LogIn size={32} color={C.gold} />,      title: 'Admin Portal',         sub: 'Das Pardes Restaurant'          },
    new_password:  { icon: <CheckCircle size={32} color={C.gold} />,title: 'Set New Password',     sub: 'First login — permanent password' },
    forgot:        { icon: <KeyRound size={32} color={C.gold} />,   title: 'Reset Password',       sub: 'Enter email to receive a code'  },
    reset_confirm: { icon: <KeyRound size={32} color={C.gold} />,   title: 'Enter Reset Code',     sub: 'Check your email for the code'  },
    register:      { icon: <Store size={32} color={C.gold} />,      title: 'Register Restaurant',  sub: 'Create your admin account'      },
    verify:        { icon: <Mail size={32} color={C.gold} />,       title: 'Verify Email',         sub: `Code sent to ${email}`          },
  }
  const meta = stepMeta[step]

  return (
    <main style={{ minHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${C.dark}, #B22222)`, borderRadius: '20px 20px 0 0', padding: '32px 32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,199,44,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -30, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,199,44,0.2)', border: '2.5px solid rgba(255,199,44,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', position: 'relative', zIndex: 1 }}>
            {meta.icon}
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: '0 0 6px', fontFamily: 'Georgia, serif', position: 'relative', zIndex: 1 }}>{meta.title}</h1>
          <p style={{ color: 'rgba(255,199,44,0.75)', fontSize: 12, margin: 0, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>{meta.sub}</p>
        </div>

        {/* Form card */}
        <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 20px 20px', padding: '28px 32px 32px', boxShadow: '0 8px 32px rgba(137,28,28,0.12)' }}>

          {/* Notices */}
          {reason === 'expired' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, marginBottom: 14 }}>
              <AlertCircle size={14} color="#d97706" /><p style={{ fontSize: 13, color: '#92400e', margin: 0, fontWeight: 600 }}>Session expired. Please sign in again.</p>
            </div>
          )}
          {reason === 'unauthorized' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: 12, marginBottom: 14 }}>
              <AlertCircle size={14} color={C.red} /><p style={{ fontSize: 13, color: C.red, margin: 0, fontWeight: 600 }}>You don't have permission to access that page.</p>
            </div>
          )}
          {message && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 12, marginBottom: 14 }}>
              <CheckCircle size={14} color="#16a34a" /><p style={{ fontSize: 13, color: '#15803d', margin: 0, fontWeight: 600 }}>{message}</p>
            </div>
          )}
          {displayError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: 12, marginBottom: 14 }}>
              <AlertCircle size={14} color={C.red} /><p style={{ fontSize: 13, color: C.red, margin: 0 }}>{displayError}</p>
            </div>
          )}

          {/* ── Login ── */}
          {step === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="admin@daspardes.com" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" showToggle show={showPass} onToggle={() => setShowPass(!showPass)} />
              <PrimaryBtn loading={loading}><LogIn size={18} /> Sign In</PrimaryBtn>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <button type="button" onClick={() => { setStep('forgot'); setMessage(''); setLocalError(''); }}
                  style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  onMouseEnter={e => (e.target as HTMLButtonElement).style.color = C.red}
                  onMouseLeave={e => (e.target as HTMLButtonElement).style.color = C.muted}>
                  Forgot password?
                </button>
                <button type="button" onClick={() => { setStep('register'); setMessage(''); setLocalError(''); }}
                  style={{ fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  onMouseEnter={e => (e.target as HTMLButtonElement).style.color = C.red}
                  onMouseLeave={e => (e.target as HTMLButtonElement).style.color = C.muted}>
                  Register restaurant
                </button>
              </div>
            </form>
          )}

          {/* ── New password ── */}
          {step === 'new_password' && (
            <form onSubmit={handleNewPass} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="New Password" type="password" value={newPassword} onChange={setNewPassword} placeholder="Min 8 chars, uppercase, number" showToggle show={showNew} onToggle={() => setShowNew(!showNew)} />
              <Field label="Confirm Password" type="password" value={confirmPass} onChange={setConfirmPass} placeholder="Repeat password" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['8+ characters', '1 uppercase', '1 number'].map(h => (
                  <span key={h} style={{ fontSize: 10, color: C.muted, background: '#FFF3E0', border: '1px solid #FED7AA', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              <PrimaryBtn loading={loading}><CheckCircle size={18} /> Set Password & Sign In</PrimaryBtn>
            </form>
          )}

          {/* ── Forgot ── */}
          {step === 'forgot' && (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="admin@daspardes.com" />
              <PrimaryBtn loading={loading}><Mail size={18} /> Send Reset Code</PrimaryBtn>
              <button type="button" onClick={() => setStep('login')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, marginTop: 4 }}>
                <ArrowLeft size={14} /> Back to sign in
              </button>
            </form>
          )}

          {/* ── Reset confirm ── */}
          {step === 'reset_confirm' && (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Reset Code</label>
                <input type="text" required value={code} onChange={e => setCode(e.target.value)} placeholder="123456"
                  style={{ width: '100%', height: 46, borderRadius: 12, padding: '0 14px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 18, fontWeight: 800, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center' }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                  onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
                />
              </div>
              <Field label="New Password" type="password" value={newPassword} onChange={setNewPassword} placeholder="Min 8 chars, uppercase, number" showToggle show={showNew} onToggle={() => setShowNew(!showNew)} />
              <Field label="Confirm Password" type="password" value={confirmPass} onChange={setConfirmPass} placeholder="Repeat password" />
              <PrimaryBtn loading={loading}><KeyRound size={18} /> Reset Password</PrimaryBtn>
            </form>
          )}

          {/* ── Register ── */}
          {step === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Restaurant Name" type="text" value={restaurant} onChange={setRestaurant} placeholder="e.g. Das Pardes" />
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="admin@yourrestaurant.com" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 8 chars, uppercase, number" showToggle show={showPass} onToggle={() => setShowPass(!showPass)} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['8+ characters', '1 uppercase', '1 number'].map(h => (
                  <span key={h} style={{ fontSize: 10, color: C.muted, background: '#FFF3E0', border: '1px solid #FED7AA', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              <PrimaryBtn loading={loading}><UserPlus size={18} /> Create Account</PrimaryBtn>
              <button type="button" onClick={() => setStep('login')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, marginTop: 4 }}>
                <ArrowLeft size={14} /> Already have an account?
              </button>
            </form>
          )}

          {/* ── Verify ── */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={15} color="#16a34a" />
                <p style={{ fontSize: 13, color: '#15803d', margin: 0, fontWeight: 600 }}>Code sent to <strong>{email}</strong></p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Verification Code</label>
                <input type="text" required value={code} onChange={e => setCode(e.target.value)} placeholder="123456"
                  style={{ width: '100%', height: 52, borderRadius: 12, padding: '0 14px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 24, fontWeight: 800, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 6, textAlign: 'center' }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                  onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border}
                />
              </div>
              <PrimaryBtn loading={loading}><CheckCircle size={18} /> Verify Email</PrimaryBtn>
            </form>
          )}

          <p style={{ textAlign: 'center', fontSize: 11, color: '#D1D5DB', margin: '20px 0 0' }}>
            © {new Date().getFullYear()} Das Pardes · Admin access only
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100dvh', background: '#FFF8F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#891C1C,#B22222)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍽️</div>
        <div style={{ width: 24, height: 24, border: '3px solid #E1251B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    }>
      <AdminLoginContent />
    </Suspense>
  )
}