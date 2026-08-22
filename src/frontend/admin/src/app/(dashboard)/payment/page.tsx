// app/tenant/payment/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Shield,
  Lock,
  Clock,
  Calendar,
  Zap,
  Crown,
  Star,
  ChevronRight,
} from 'lucide-react';
import { getTheme } from '@/lib/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchMyTenant } from '@/lib/auth-api';

const BRAND = '#ff5723';

// ── Theme Colors ──
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFFFFF',
  card: isDark ? '#1C1C1C' : '#FFFFFF',
  card2: isDark ? '#242424' : '#F5F5F5',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
  text: isDark ? '#F5F0E8' : '#000000',
  muted: isDark ? '#9CA3AF' : '#6B6B6B',
  subtle: isDark ? '#6B7280' : '#6B6B6B',
  brand: BRAND,
  brandBg: isDark ? 'rgba(255,87,35,0.12)' : 'rgba(255,87,35,0.12)',
  hoverBg: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
});

const getAccents = (isDark: boolean) => ({
  green: {
    bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
    border: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
    text: isDark ? '#4ade80' : '#16a34a'
  },
  danger: {
    bg: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0F0',
    border: isDark ? 'rgba(255,87,35,0.3)' : '#FFD0D0',
    text: isDark ? '#ff8a5c' : BRAND
  },
});

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, loading: authLoading } = useCurrentUser();

  // ── Get plan from URL ──
  const planId = searchParams.get('plan') || 'monthly';
  const planName = searchParams.get('name') || 'Monthly Plan';
  const planPrice = searchParams.get('price') || '9.99';
  const planCurrency = searchParams.get('currency') || 'USD';

  const [isDark, setIsDark] = useState(false);
  const [tenantId, setTenantId] = useState('');

  // ── Form state ──
  const [mobileNo, setMobileNo] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');

  // ── Theme listener ──
  useEffect(() => {
    const updateTheme = () => {
      const theme = getTheme();
      setIsDark(theme === 'dark');
    };
    updateTheme();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme') updateTheme();
    };
    window.addEventListener('storage', handleStorage);

    const handleThemeToggle = () => updateTheme();
    window.addEventListener('themeChange', handleThemeToggle);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('themeChange', handleThemeToggle);
    };
  }, []);

  const colors = getColors(isDark);
  const accents = getAccents(isDark);

  // ── Fetch tenant ID ──
  useEffect(() => {
    if (role === 'tenant') {
      fetchMyTenant()
        .then((tenant) => {
          if (tenant) {
            setTenantId(tenant.tenantId);
          }
        })
        .catch(() => {
          // Fallback: use demo tenant ID
          setTenantId('demo_tenant');
        });
    }
  }, [role]);

  // ── Format price ──
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // ── Get plan icon ──
  const getPlanIcon = (id: string) => {
    const icons: Record<string, React.ReactNode> = {
      'weekly': <Clock size={20} />,
      'monthly': <Calendar size={20} />,
      'quarterly': <Zap size={20} />,
      'semi_annual': <Star size={20} />,
      'annual': <Crown size={20} />,
    };
    return icons[id] || <CreditCard size={20} />;
  };

  // ── Handle payment (Real API Integration) ──
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsSubmitting(true);

    // Validate
    if (!mobileNo || mobileNo.length < 10) {
      setError('Please enter a valid mobile number');
      setIsSubmitting(false);
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      setIsSubmitting(false);
      return;
    }

    try {
      // Generate order ID
      const newOrderId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setOrderId(newOrderId);

      // ✅ 1. Initiate payment via Next.js API route
      const initRes = await fetch('/api/v1/payment/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId || 'demo_tenant',
          plan_id: planId,
          amount: parseFloat(planPrice),
          order_id: newOrderId,
          email: email,
          mobile_no: mobileNo,
        }),
      });

      const initData = await initRes.json();

      if (!initRes.ok) {
        throw new Error(initData?.error || initData?.detail || 'Payment initiation failed');
      }

      // ✅ 2. Check if we have a checkout URL
      if (initData.checkout_url) {
        setCheckoutUrl(initData.checkout_url);
        setSuccess(true);
        // Redirect to EasyPaisa after 2 seconds
        setTimeout(() => {
          window.location.href = initData.checkout_url;
        }, 2000);
      } else {
        // Fallback: Show success and redirect to subscription
        setSuccess(true);
        setTimeout(() => {
          router.push('/tenant/subscription');
        }, 3000);
      }

    } catch (err: any) {
      setError(err?.message || 'Payment failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── If loading auth ──
  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: colors.bg,
        }}
      >
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} color={BRAND} />
      </div>
    );
  }

  // ── If not tenant ──
  if (role !== 'tenant') {
    return null;
  }

  return (
    <div
      style={{
        background: colors.bg,
        padding: '20px 24px 40px',
        maxWidth: 600,
        margin: '0 auto',
        minHeight: '100vh',
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>

      {/* ── Back Button ── */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          color: colors.muted,
          fontSize: 14,
          cursor: 'pointer',
          padding: '8px 0',
          marginBottom: 16,
          fontFamily: "'Poppins', sans-serif",
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = BRAND;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.muted;
        }}
      >
        <ArrowLeft size={18} />
        Back
      </button>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 'clamp(22px, 3vw, 28px)',
            fontWeight: 800,
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <CreditCard size={28} color={BRAND} />
          Complete Payment
        </h1>
        <p
          style={{
            color: colors.muted,
            fontSize: 14,
            margin: '4px 0 0',
          }}
        >
          Secure checkout with EasyPaisa
        </p>
      </div>

      {/* ── Plan Summary ── */}
      <div
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: '20px',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: `${BRAND}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: BRAND,
            }}
          >
            {getPlanIcon(planId)}
          </div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: colors.text,
                margin: 0,
              }}
            >
              {planName}
            </p>
            <p
              style={{
                fontSize: 13,
                color: colors.muted,
                margin: 0,
              }}
            >
              {formatPrice(parseFloat(planPrice), planCurrency)}
            </p>
          </div>
          <ChevronRight size={20} color={colors.muted} />
        </div>
      </div>

      {/* ── Payment Form ── */}
      {!success ? (
        <form
          onSubmit={handlePayment}
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: '24px',
          }}
        >
          {/* Mobile Number */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: colors.text,
                marginBottom: 6,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Mobile Number (EasyPaisa)
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: colors.card2,
                border: `1.5px solid ${colors.border}`,
                borderRadius: 10,
                padding: '0 14px',
                transition: 'all 0.2s ease',
              }}
            >
              <Smartphone size={18} color={colors.muted} />
              <input
                type="tel"
                value={mobileNo}
                onChange={(e) =>
                  setMobileNo(e.target.value.replace(/\D/g, ''))
                }
                placeholder="03XX-XXXXXXX"
                style={{
                  width: '100%',
                  padding: '12px 10px',
                  border: 'none',
                  background: 'transparent',
                  fontSize: 15,
                  color: colors.text,
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif",
                }}
                required
              />
            </div>
            <p
              style={{
                fontSize: 11,
                color: colors.subtle,
                margin: '4px 0 0',
              }}
            >
              Enter your EasyPaisa registered mobile number
            </p>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: colors.text,
                marginBottom: 6,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Email Address
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: colors.card2,
                border: `1.5px solid ${colors.border}`,
                borderRadius: 10,
                padding: '0 14px',
                transition: 'all 0.2s ease',
              }}
            >
              <CreditCard size={18} color={colors.muted} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '12px 10px',
                  border: 'none',
                  background: 'transparent',
                  fontSize: 15,
                  color: colors.text,
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif",
                }}
                required
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 14px',
                background: accents.danger.bg,
                border: `1px solid ${accents.danger.border}`,
                borderRadius: 10,
                color: accents.danger.text,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: isSubmitting ? colors.muted : BRAND,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: "'Poppins', sans-serif",
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.background = '#e64a1a';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.background = BRAND;
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2
                  size={18}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
                Processing…
              </>
            ) : (
              <>
                <Lock size={18} />
                Pay with EasyPaisa
              </>
            )}
          </button>

          {/* Security Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 14,
              fontSize: 12,
              color: colors.subtle,
            }}
          >
            <Shield size={14} />
            <span>Secured by EasyPaisa · SSL Encrypted</span>
          </div>
        </form>
      ) : (
        // ── Success State ──
        <div
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: accents.green.bg,
              border: `2px solid ${accents.green.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CheckCircle size={36} color={accents.green.text} />
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: colors.text,
              margin: '0 0 8px',
            }}
          >
            {checkoutUrl ? 'Redirecting to EasyPaisa...' : 'Payment Initiated!'}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: colors.muted,
              margin: '0 0 4px',
            }}
          >
            Order ID: <strong style={{ color: colors.text }}>{orderId}</strong>
          </p>
          {checkoutUrl ? (
            <p
              style={{
                fontSize: 13,
                color: colors.subtle,
                margin: '16px 0 0',
              }}
            >
              You are being redirected to EasyPaisa to complete your payment.
            </p>
          ) : (
            <p
              style={{
                fontSize: 13,
                color: colors.subtle,
                margin: '16px 0 0',
              }}
            >
              Your payment has been initiated. You will be redirected shortly.
            </p>
          )}
          <div
            style={{
              marginTop: 20,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Loader2
              size={24}
              color={BRAND}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}