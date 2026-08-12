// src/app/login/page.tsx  — the single door into the console.
// Platform admins and company owners use the same form; the role in their
// token decides which section they land in.
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { AlertCircle, Eye, EyeOff, LogIn, CheckCircle, KeyRound, UserPlus, Mail, Store, ArrowLeft } from 'lucide-react'

type Step = 'login' | 'new_password' | 'forgot' | 'reset_confirm' | 'register' | 'verify'

const BRAND = '#ff5723'

function useD() {
  const { isDark } = useTheme()
  const D = isDark ? {
    bg: '#111111', white: '#1C1C1C', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', subtle: '#6B7280',
  } : {
    bg: '#FFFFFF', white: '#fff', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', subtle: '#9CA3AF',
  };
  return { isDark, D };
}

function Field({ label, type, value, onChange, placeholder, showToggle, show, onToggle }: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder?: string; showToggle?: boolean; show?: boolean; onToggle?: () => void;
}) {
  const { D } = useD();
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: D.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={showToggle ? (show ? 'text' : 'password') : type}
          required value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', height: 46, borderRadius: 12, padding: showToggle ? '0 44px 0 14px' : '0 14px', background: D.bg, border: `1.5px solid ${D.border}`, fontSize: 14, color: D.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'sans-serif', transition: 'border-color 0.2s' }}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = BRAND}
          onBlur={e => (e.target as HTMLInputElement).style.borderColor = D.border}
        />
        {showToggle && (
          <button type="button" onClick={onToggle}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            {show ? <EyeOff size={16} color={D.subtle} /> : <Eye size={16} color={D.subtle} />}
          </button>
        )}
      </div>
    </div>
  )
}

function PrimaryBtn({ children, loading, disabled }: { children: React.ReactNode; loading?: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={loading || disabled}
      style={{ width: '100%', height: 50, borderRadius: 14, background: (loading || disabled) ? '#ccc' : BRAND, color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: (loading || disabled) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6, boxShadow: (loading || disabled) ? 'none' : '0 6px 20px rgba(255,87,35,0.3)', transition: 'all 0.2s' }}>
      {loading
        ? <><div style={{ width: 18, height: 18, border: '2.5px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Working…</>
        : children}
    </button>
  )
}

function TenantLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const { login, handleNewPassword, sendResetCode, resetPassword, register, verifyEmail, loading, error } = useAuth()
  const { isDark, D } = useD()

  const [step, setStep] = useState<Step>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [code, setCode] = useState('')
  const [restaurant, setRestaurant] = useState('')
  const [session, setSession] = useState('')
  const [message, setMessage] = useState('')
  const [localError, setLocalError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showNew, setShowNew] = useState(false)

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

  // Step meta — icon sits on the brand-orange header, so white throughout
  const stepMeta: Record<Step, { icon: React.ReactNode; title: string; sub: string }> = {
    login: { icon: <img src='./Images/white-logo.png' color="#fff" />, title: 'MenuLay Console', sub: 'Sign in to your workspace' },
    new_password: { icon: <img src='./Images/white-logo.png' color="#fff" />, title: 'Set New Password', sub: 'First login — permanent password' },
    forgot: { icon: <img src='./Images/white-logo.png' color="#fff" />, title: 'Reset Password', sub: 'Enter email to receive a code' },
    reset_confirm: { icon: <img src='./Images/white-logo.png' color="#fff" />, title: 'Enter Reset Code', sub: 'Check your email for the code' },
    register: { icon: <img src='./Images/white-logo.png' color="#fff" />, title: 'Register Restaurant', sub: 'Create your account' },
    verify: { icon: <img src='./Images/white-logo.png' color="#fff" />, title: 'Verify Email', sub: `Code sent to ${email}` },
  }
  const meta = stepMeta[step]

  // Theme-aware pastel notice tones — same reasoning as the KDS board: a
  // light pastel bg + saturated text reads fine on white, goes low-contrast
  // on dark, so each gets its own dark pairing.
  const AMBER = isDark ? { bg: 'rgba(217,119,6,0.15)', border: 'rgba(217,119,6,0.35)', text: '#fbbf24' } : { bg: '#FFFBEB', border: '#FDE68A', text: '#d97706' };
  const GREEN = isDark ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' } : { bg: '#F0FFF4', border: '#BBF7D0', text: '#16a34a' };
  const DANGER = isDark ? { bg: 'rgba(255,87,35,0.12)', border: 'rgba(255,87,35,0.3)', text: '#ff8a5c' } : { bg: '#FFF0F0', border: '#FFD0D0', text: BRAND };
  const ORANGE = isDark ? { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' } : { bg: '#FFF3E0', border: '#FED7AA', text: '#c2410c' };

  return (
    <main style={{ minHeight: '100dvh', background: D.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: 20, transition: 'background 0.25s' }}>
      <div className="login-card" style={{ width: '100%', maxWidth: 420 }}>

        {/* Header — brand orange, constant across themes */}
        <div className="login-card-header" style={{ background: BRAND, borderRadius: '20px 20px 0 0', padding: '32px 32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -30, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', position: 'relative', zIndex: 1 }}>
            {meta.icon}
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 6px', fontFamily: "'Baloo 2', sans-serif", position: 'relative', zIndex: 1 }}>{meta.title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: 0, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>{meta.sub}</p>
        </div>

        {/* Form card */}
        <div className="login-card-form" style={{ background: D.white, border: `1.5px solid ${D.border}`, borderTop: 'none', borderRadius: '0 0 20px 20px', padding: '28px 32px 32px', boxShadow: '0 8px 32px rgba(255,87,35,0.1)' }}>

          {/* Notices */}
          {reason === 'expired' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: AMBER.bg, border: `1px solid ${AMBER.border}`, borderRadius: 12, marginBottom: 14 }}>
              <AlertCircle size={14} color={AMBER.text} /><p style={{ fontSize: 13, color: AMBER.text, margin: 0, fontWeight: 600 }}>Session expired. Please sign in again.</p>
            </div>
          )}
          {reason === 'unauthorized' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: DANGER.bg, border: `1px solid ${DANGER.border}`, borderRadius: 12, marginBottom: 14 }}>
              <AlertCircle size={14} color={DANGER.text} /><p style={{ fontSize: 13, color: DANGER.text, margin: 0, fontWeight: 600 }}>You don't have permission to access that page.</p>
            </div>
          )}
          {message && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: GREEN.bg, border: `1px solid ${GREEN.border}`, borderRadius: 12, marginBottom: 14 }}>
              <CheckCircle size={14} color={GREEN.text} /><p style={{ fontSize: 13, color: GREEN.text, margin: 0, fontWeight: 600 }}>{message}</p>
            </div>
          )}
          {displayError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: DANGER.bg, border: `1px solid ${DANGER.border}`, borderRadius: 12, marginBottom: 14 }}>
              <AlertCircle size={14} color={DANGER.text} /><p style={{ fontSize: 13, color: DANGER.text, margin: 0 }}>{displayError}</p>
            </div>
          )}

          {/* ── Login ── */}
          {step === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="owner@daspardes.com" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" showToggle show={showPass} onToggle={() => setShowPass(!showPass)} />
              <PrimaryBtn loading={loading}><LogIn size={18} /> Sign In</PrimaryBtn>
              <div className="login-links-row" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <button type="button" onClick={() => { setStep('forgot'); setMessage(''); setLocalError(''); }}
                  style={{ fontSize: 13, color: D.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  onMouseEnter={e => (e.target as HTMLButtonElement).style.color = BRAND}
                  onMouseLeave={e => (e.target as HTMLButtonElement).style.color = D.muted}>
                  Forgot password?
                </button>
                <button type="button" onClick={() => { setStep('register'); setMessage(''); setLocalError(''); }}
                  style={{ fontSize: 13, color: D.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  onMouseEnter={e => (e.target as HTMLButtonElement).style.color = BRAND}
                  onMouseLeave={e => (e.target as HTMLButtonElement).style.color = D.muted}>
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
                  <span key={h} style={{ fontSize: 10, color: D.muted, background: ORANGE.bg, border: `1px solid ${ORANGE.border}`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              <PrimaryBtn loading={loading}><CheckCircle size={18} /> Set Password & Sign In</PrimaryBtn>
            </form>
          )}

          {/* ── Forgot ── */}
          {step === 'forgot' && (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="owner@daspardes.com" />
              <PrimaryBtn loading={loading}><Mail size={18} /> Send Reset Code</PrimaryBtn>
              <button type="button" onClick={() => setStep('login')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: D.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, marginTop: 4 }}>
                <ArrowLeft size={14} /> Back to sign in
              </button>
            </form>
          )}

          {/* ── Reset confirm ── */}
          {step === 'reset_confirm' && (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: D.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Reset Code</label>
                <input type="text" required value={code} onChange={e => setCode(e.target.value)} placeholder="123456"
                  className="login-code-input"
                  style={{ width: '100%', height: 46, borderRadius: 12, padding: '0 14px', background: D.bg, border: `1.5px solid ${D.border}`, fontSize: 18, fontWeight: 700, color: D.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center' }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = BRAND}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = D.border}
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
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="owner@yourrestaurant.com" />
              <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 8 chars, uppercase, number" showToggle show={showPass} onToggle={() => setShowPass(!showPass)} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['8+ characters', '1 uppercase', '1 number'].map(h => (
                  <span key={h} style={{ fontSize: 10, color: D.muted, background: ORANGE.bg, border: `1px solid ${ORANGE.border}`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              <PrimaryBtn loading={loading}><UserPlus size={18} /> Create Account</PrimaryBtn>
              <button type="button" onClick={() => setStep('login')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: D.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, marginTop: 4 }}>
                <ArrowLeft size={14} /> Already have an account?
              </button>
            </form>
          )}

          {/* ── Verify ── */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', background: GREEN.bg, border: `1px solid ${GREEN.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={15} color={GREEN.text} />
                <p style={{ fontSize: 13, color: GREEN.text, margin: 0, fontWeight: 600 }}>Code sent to <strong>{email}</strong></p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: D.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Verification Code</label>
                <input type="text" required value={code} onChange={e => setCode(e.target.value)} placeholder="123456"
                  className="login-code-input login-code-input-lg"
                  style={{ width: '100%', height: 52, borderRadius: 12, padding: '0 14px', background: D.bg, border: `1.5px solid ${D.border}`, fontSize: 24, fontWeight: 700, color: D.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 6, textAlign: 'center' }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = BRAND}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = D.border}
                />
              </div>
              <PrimaryBtn loading={loading}><CheckCircle size={18} /> Verify Email</PrimaryBtn>
            </form>
          )}

          <p style={{ textAlign: 'center', fontSize: 11, color: D.subtle, margin: '20px 0 0' }}>
            © {new Date().getFullYear()} Das Pardes · Admin access only
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Narrow phones: fixed 32px card padding stacked on top of the
           outer 20px page padding leaves too little room, the two-link row
           gets tight, and the 6-digit code input's wide letter-spacing at
           24px can overflow. Scale those three down specifically rather
           than the whole layout, which already flexes fine via maxWidth. */
        @media (max-width: 380px) {
          .login-card-header { padding: 26px 20px 22px !important; }
          .login-card-form   { padding: 22px 18px 24px !important; }
          .login-links-row   { flex-direction: column; gap: 10px; align-items: flex-start; }
          .login-code-input  { font-size: 15px !important; letter-spacing: 2px !important; }
          .login-code-input-lg { font-size: 19px !important; letter-spacing: 3px !important; }
        }
      `}</style>
    </main>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100dvh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ff5723', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍽️</div>
        <div style={{ width: 24, height: 24, border: '3px solid #ff5723', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    }>
      <TenantLoginContent />
    </Suspense>
  )
}