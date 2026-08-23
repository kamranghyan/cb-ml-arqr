'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    CreditCard,
    CheckCircle,
    AlertCircle,
    Loader2,
    ArrowLeft,
    Lock,
    Shield,
    Zap,
} from 'lucide-react';
import { getTheme } from '@/lib/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getValidIdToken } from '@/lib/cognito';

const BRAND = '#ff5723';

const getColors = (isDark: boolean) => ({
    bg: isDark ? '#111111' : '#FFFFFF',
    card: isDark ? '#1C1C1C' : '#FFFFFF',
    card2: isDark ? '#242424' : '#F5F5F5',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE6',
    text: isDark ? '#F5F0E8' : '#000000',
    muted: isDark ? '#9CA3AF' : '#6B6B6B',
    subtle: isDark ? '#6B7280' : '#6B6B6B',
    brand: BRAND,
});

interface SubscriptionData {
    tenant_id: string;
    plan_id: string;
    plan_name: string;
    price: number;
    currency: string;
    duration_days: number;
    status: string;
    start_date?: string;
    end_date?: string;
}

export default function TenantPayment() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { role, loading: authLoading } = useCurrentUser();
    const [isDark, setIsDark] = useState(false);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // ── Get subscription data from URL params ──
    useEffect(() => {
        const plan = searchParams.get('plan');
        const name = searchParams.get('name');
        const price = searchParams.get('price');
        const currency = searchParams.get('currency');
        const duration = searchParams.get('duration');

        if (plan && name && price) {
            setSubscription({
                tenant_id: '', // Will be filled from user
                plan_id: plan,
                plan_name: name,
                price: parseFloat(price),
                currency: currency || 'USD',
                duration_days: parseInt(duration || '30'),
                status: 'PENDING',
            });
        } else {
            // No subscription data, redirect back
            router.push('/tenant/subscription');
        }
    }, [searchParams, router]);

    // ── Theme ──
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

    // ── Role Check ──
    useEffect(() => {
        if (!authLoading && role !== 'tenant') {
            router.replace('/dashboard');
        }
    }, [role, authLoading, router]);

    // ── Format Price ──
    const formatPrice = (price: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 2,
        }).format(price);
    };

    // ── Handle Payment ──
    const handlePayment = async () => {
        if (!subscription) return;

        setProcessing(true);
        setError('');

        try {
            const token = await getValidIdToken();

            if (!token) {
                setError('Session expired. Please login again.');
                setProcessing(false);
                return;
            }

            // ✅ Get tenant_id from token or user
            // Option 1: From localStorage
            const user = JSON.parse(localStorage.getItem('menulay_user') || '{}');
            const tenantId = user?.tenantId || subscription.tenant_id;

            // Option 2: From token
            // const tokenData = parseJwt(token);
            // const tenantId = tokenData['custom:tenant_id'];

            // ── Confirm subscription with tenant_id ──
            const confirmRes = await fetch('/api/auth-svc/subscriptions/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,  // ✅ Add tenant_id in header
                },
                body: JSON.stringify({
                    tenant_id: tenantId,  // ✅ Add tenant_id in body
                    plan_id: subscription.plan_id,
                    payment_id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                }),
            });

            if (!confirmRes.ok) {
                const error = await confirmRes.json();
                throw new Error(error?.error || 'Payment confirmation failed');
            }

            setIsSuccess(true);
            localStorage.removeItem('pending_payment');

            setTimeout(() => {
                router.push('/subscription');
            }, 3000);

        } catch (e: any) {
            setError(e?.message || 'Payment failed. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    if (authLoading || !subscription) {
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
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>

            {/* ── Back Button ── */}
            <button
                onClick={() => router.back()}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 0',
                    border: 'none',
                    background: 'none',
                    color: colors.muted,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontFamily: "'Poppins', sans-serif",
                }}
            >
                <ArrowLeft size={18} />
                Back
            </button>

            {isSuccess ? (
                // ── Success Screen ──
                <div
                    className="fade-in"
                    style={{
                        background: colors.card,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 16,
                        padding: '40px 32px',
                        textAlign: 'center',
                        marginTop: 20,
                    }}
                >
                    <div
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: 'rgba(34,197,94,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            color: '#16a34a',
                        }}
                    >
                        <CheckCircle size={36} />
                    </div>
                    <h2
                        style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: colors.text,
                            margin: '0 0 8px',
                        }}
                    >
                        Payment Successful! 🎉
                    </h2>
                    <p
                        style={{
                            fontSize: 14,
                            color: colors.muted,
                            margin: 0,
                        }}
                    >
                        Your subscription has been activated.
                        Redirecting to dashboard...
                    </p>
                    <Loader2
                        size={20}
                        style={{
                            animation: 'spin 1s linear infinite',
                            marginTop: 16,
                            color: colors.muted,
                        }}
                    />
                </div>
            ) : (
                // ── Payment Details ──
                <div className="fade-in">
                    <h1
                        style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: colors.text,
                            margin: '16px 0 4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <CreditCard size={24} color={BRAND} />
                        Payment Details
                    </h1>
                    <p
                        style={{
                            color: colors.muted,
                            fontSize: 14,
                            margin: '0 0 24px',
                        }}
                    >
                        Review and confirm your subscription
                    </p>

                    {/* ── Error ── */}
                    {error && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '12px 16px',
                                background: 'rgba(220,38,38,0.12)',
                                border: '1px solid rgba(220,38,38,0.3)',
                                borderRadius: 10,
                                color: '#dc2626',
                                marginBottom: 16,
                            }}
                        >
                            <AlertCircle size={18} />
                            <span style={{ fontSize: 14 }}>{error}</span>
                        </div>
                    )}

                    {/* ── Plan Details ── */}
                    <div
                        style={{
                            background: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 16,
                            padding: '24px',
                            marginBottom: 20,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingBottom: 16,
                                borderBottom: `1px solid ${colors.border}`,
                            }}
                        >
                            <div>
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: colors.subtle,
                                        margin: 0,
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    Plan
                                </p>
                                <p
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: colors.text,
                                        margin: '4px 0 0',
                                    }}
                                >
                                    {subscription.plan_name}
                                </p>
                            </div>
                            <div
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: 20,
                                    background: 'rgba(251,146,60,0.15)',
                                    color: '#d97706',
                                    fontSize: 12,
                                    fontWeight: 700,
                                }}
                            >
                                {subscription.status}
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 16,
                                paddingTop: 16,
                            }}
                        >
                            <div>
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: colors.subtle,
                                        margin: 0,
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    Duration
                                </p>
                                <p
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        color: colors.text,
                                        margin: '4px 0 0',
                                    }}
                                >
                                    {subscription.duration_days} days
                                </p>
                            </div>
                            <div>
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: colors.subtle,
                                        margin: 0,
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    Amount
                                </p>
                                <p
                                    style={{
                                        fontSize: 24,
                                        fontWeight: 800,
                                        color: colors.text,
                                        margin: '4px 0 0',
                                    }}
                                >
                                    {formatPrice(subscription.price, subscription.currency)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Security Badges ── */}
                    <div
                        style={{
                            display: 'flex',
                            gap: 16,
                            justifyContent: 'center',
                            marginBottom: 24,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                color: colors.muted,
                                fontSize: 12,
                            }}
                        >
                            <Lock size={16} />
                            Secure Payment
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                color: colors.muted,
                                fontSize: 12,
                            }}
                        >
                            <Shield size={16} />
                            Protected
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                color: colors.muted,
                                fontSize: 12,
                            }}
                        >
                            <Zap size={16} />
                            Instant
                        </div>
                    </div>

                    {/* ── Pay Now Button ── */}
                    <button
                        onClick={handlePayment}
                        disabled={processing}
                        style={{
                            width: '100%',
                            padding: '16px',
                            borderRadius: 12,
                            border: 'none',
                            background: processing ? colors.muted : BRAND,
                            color: '#fff',
                            fontSize: 18,
                            fontWeight: 700,
                            cursor: processing ? 'not-allowed' : 'pointer',
                            opacity: processing ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            transition: 'all 0.2s ease',
                            fontFamily: "'Poppins', sans-serif",
                        }}
                        onMouseEnter={(e) => {
                            if (!processing) e.currentTarget.style.background = '#e64a1a';
                        }}
                        onMouseLeave={(e) => {
                            if (!processing) e.currentTarget.style.background = BRAND;
                        }}
                    >
                        {processing ? (
                            <>
                                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                Processing…
                            </>
                        ) : (
                            <>
                                <Lock size={18} />
                                Pay {formatPrice(subscription.price, subscription.currency)}
                            </>
                        )}
                    </button>

                    <p
                        style={{
                            textAlign: 'center',
                            fontSize: 12,
                            color: colors.subtle,
                            margin: '12px 0 0',
                        }}
                    >
                        By clicking Pay, you agree to our Terms of Service
                    </p>
                </div>
            )}
        </div>
    );
}