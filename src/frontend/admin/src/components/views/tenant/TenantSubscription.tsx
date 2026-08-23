'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    CreditCard,
    CheckCircle,
    AlertCircle,
    Loader2,
    RefreshCw,
    Clock,
    Calendar,
    Zap,
    Crown,
    Star,
    ArrowRight,
    ArrowLeft,
    ShieldCheck,
} from 'lucide-react';

import { getTheme } from '@/lib/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchMyTenant, type ApiTenant } from '@/lib/auth-api';
import { getValidIdToken, refreshTokens } from '@/lib/cognito';

const BRAND = '#ff5723';

interface Plan {
    plan_id: string;
    plan_name: string;
    duration_days: number;
    price: number;
    currency: string;
    description: string | null;
    is_active: boolean;
}

interface Subscription {
    tenant_id: string;
    plan_id: string;
    status: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    days_remaining: number | null;
}

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

const getAccents = (isDark: boolean) => ({
    green: {
        bg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
        border: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
        text: isDark ? '#4ade80' : '#16a34a',
    },
    danger: {
        bg: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
        border: isDark ? 'rgba(220,38,38,0.3)' : '#FECACA',
        text: isDark ? '#f87171' : '#dc2626',
    },
});

export default function TenantSubscription() {
    const router = useRouter();

    const { role, loading: authLoading } = useCurrentUser();

    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] =
        useState<Subscription | null>(null);

    const [tenant, setTenant] = useState<ApiTenant | null>(null);

    const [loading, setLoading] = useState(false);
    const [subscribing, setSubscribing] = useState(false);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [isDark, setIsDark] = useState(false);

    // Selected plan = detail page/view
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    // --------------------------------------------------
    // THEME
    // --------------------------------------------------

    useEffect(() => {
        const updateTheme = () => {
            setIsDark(getTheme() === 'dark');
        };

        updateTheme();

        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'admin_theme') {
                updateTheme();
            }
        };

        const handleThemeToggle = () => updateTheme();

        window.addEventListener('storage', handleStorage);
        window.addEventListener('themeChange', handleThemeToggle);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(
                'themeChange',
                handleThemeToggle
            );
        };
    }, []);

    const colors = getColors(isDark);
    const accents = getAccents(isDark);

    // --------------------------------------------------
    // ROLE CHECK
    // --------------------------------------------------

    useEffect(() => {
        if (!authLoading && role !== 'tenant') {
            router.replace('/dashboard');
        }
    }, [role, authLoading, router]);

    // --------------------------------------------------
    // TOKEN
    // --------------------------------------------------

    const getToken = async () => {
        try {
            const token = await getValidIdToken();

            if (token) {
                return token;
            }

            const refreshed = await refreshTokens();

            if (refreshed) {
                return await getValidIdToken();
            }

            return null;
        } catch (error) {
            console.error('Token error:', error);
            return null;
        }
    };

    // --------------------------------------------------
    // LOAD SUBSCRIPTION DATA
    // --------------------------------------------------

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const tenantData = await fetchMyTenant().catch(() => null);

            setTenant(tenantData);

            if (!tenantData) {
                setError('Could not load tenant information');
                return;
            }

            const token = await getToken();

            if (!token) {
                setError('Session expired. Please login again.');

                setTimeout(() => {
                    router.push('/login');
                }, 1500);

                return;
            }

            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            };

            const [plansRes, subRes] = await Promise.all([
                fetch('/api/auth-svc/plans', {
                    headers,
                }).then(async (res) => {
                    if (!res.ok) {
                        throw new Error(
                            `Plans fetch failed: ${res.status}`
                        );
                    }

                    return res.json();
                }),

                fetch(
                    `/api/auth-svc/subscriptions/status/${tenantData.tenantId}`,
                    {
                        headers,
                    }
                ).then(async (res) => {
                    if (res.status === 404) {
                        return null;
                    }

                    if (res.status === 401) {
                        const refreshed = await refreshTokens();

                        if (refreshed) {
                            const newToken = await getValidIdToken();

                            if (newToken) {
                                const retry = await fetch(
                                    `/api/auth-svc/subscriptions/status/${tenantData.tenantId}`,
                                    {
                                        headers: {
                                            'Content-Type':
                                                'application/json',
                                            Authorization: `Bearer ${newToken}`,
                                        },
                                    }
                                );

                                if (retry.ok) {
                                    return retry.json();
                                }
                            }
                        }

                        return null;
                    }

                    return res.ok ? res.json() : null;
                }),
            ]);

            setPlans(Array.isArray(plansRes) ? plansRes : []);

            if (subRes?.tenant_id) {
                setSubscription(subRes);
            } else {
                setSubscription(null);
            }
        } catch (error: any) {
            console.error('Subscription load error:', error);

            setError(
                error?.message ||
                'Failed to load subscription data'
            );

            setPlans([]);
            setSubscription(null);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        if (role === 'tenant') {
            loadData();
        }
    }, [role, loadData]);

    // --------------------------------------------------
    // PAY NOW
    // --------------------------------------------------

    const handlePayNow = async () => {
        if (!selectedPlan) {
            return;
        }

        setSubscribing(true);
        setError('');

        try {
            const token = await getToken();

            if (!token) {
                setError('Session expired. Please login again.');

                router.push('/payment');

                return;
            }

            /*
             * IMPORTANT:
             * Plan selection sirf detail view open karta hai.
             *
             * Subscription API yahan call ho rahi hai,
             * jab tenant actual "Pay Now" press karta hai.
             */

            const res = await fetch(
                '/api/auth-svc/subscriptions/subscribe',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        plan_id: selectedPlan.plan_id,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data?.error ||
                    data?.detail ||
                    'Subscription failed'
                );
            }

            /*
             * Backend subscription successfully created.
             * Ab payment screen.
             */

            router.push(
                `/payment?plan=${encodeURIComponent(
                    selectedPlan.plan_id
                )}&name=${encodeURIComponent(
                    selectedPlan.plan_name
                )}&price=${selectedPlan.price}&currency=${encodeURIComponent(
                    selectedPlan.currency
                )}`
            );
        } catch (error: any) {
            console.error('Payment flow error:', error);

            setError(
                error?.message ||
                'Unable to continue to payment.'
            );
        } finally {
            setSubscribing(false);
        }
    };

    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------

    const formatPrice = (
        price: number,
        currency: string
    ) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    const getPlanIcon = (planId: string) => {
        const icons: Record<string, React.ReactNode> = {
            weekly: <Clock size={22} />,
            monthly: <Calendar size={22} />,
            quarterly: <Zap size={22} />,
            semi_annual: <Star size={22} />,
            annual: <Crown size={22} />,
        };

        return (
            icons[planId] || <CreditCard size={22} />
        );
    };

    const getPlanColor = (planId: string) => {
        const colors: Record<string, string> = {
            weekly: '#6B7280',
            monthly: '#3B82F6',
            quarterly: '#8B5CF6',
            semi_annual: '#EC4899',
            annual: '#F59E0B',
        };

        return colors[planId] || BRAND;
    };

    const currentPlan = plans.find(
        (p) => p.plan_id === subscription?.plan_id
    );

    // --------------------------------------------------
    // AUTH LOADING
    // --------------------------------------------------

    if (authLoading) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: colors.bg,
                }}
            >
                <Loader2
                    size={28}
                    color={BRAND}
                    style={{
                        animation: 'spin 1s linear infinite',
                    }}
                />
            </div>
        );
    }

    if (role !== 'tenant') {
        return null;
    }

    // ==================================================
    // PLAN DETAIL VIEW
    // ==================================================

    if (selectedPlan) {
        const planColor = getPlanColor(
            selectedPlan.plan_id
        );

        const isCurrentPlan =
            subscription?.plan_id ===
            selectedPlan.plan_id &&
            subscription?.status === 'ACTIVE';

        return (
            <div
                style={{
                    minHeight: '100vh',
                    background: colors.bg,
                    padding: '30px 24px 50px',
                    fontFamily: "'Poppins', sans-serif",
                }}
            >
                <style>{`
                    @keyframes spin {
                        to {
                            transform: rotate(360deg);
                        }
                    }
                `}</style>

                <div
                    style={{
                        maxWidth: 850,
                        margin: '0 auto',
                    }}
                >
                    {/* Back */}
                    <button
                        onClick={() =>
                            setSelectedPlan(null)
                        }
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            background: 'transparent',
                            border: 'none',
                            color: colors.muted,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                            marginBottom: 25,
                        }}
                    >
                        <ArrowLeft size={18} />
                        Back to Subscription
                    </button>

                    {/* Error */}
                    {error && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '14px 18px',
                                background:
                                    accents.danger.bg,
                                border: `1px solid ${accents.danger.border}`,
                                borderRadius: 12,
                                color:
                                    accents.danger.text,
                                marginBottom: 20,
                            }}
                        >
                            <AlertCircle size={19} />
                            {error}
                        </div>
                    )}

                    {/* Detail Card */}
                    <div
                        style={{
                            background: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 20,
                            overflow: 'hidden',
                        }}
                    >
                        {/* Top */}
                        <div
                            style={{
                                padding: '32px',
                                borderBottom: `1px solid ${colors.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 18,
                            }}
                        >
                            <div
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 18,
                                    background: `${planColor}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: planColor,
                                }}
                            >
                                {getPlanIcon(
                                    selectedPlan.plan_id
                                )}
                            </div>

                            <div>
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: colors.muted,
                                        margin: 0,
                                        fontWeight: 600,
                                    }}
                                >
                                    SUBSCRIPTION PLAN
                                </p>

                                <h1
                                    style={{
                                        fontSize: 28,
                                        fontWeight: 800,
                                        color: colors.text,
                                        margin: '3px 0 0',
                                    }}
                                >
                                    {selectedPlan.plan_name}
                                </h1>
                            </div>
                        </div>

                        {/* Body */}
                        <div
                            style={{
                                padding: '32px',
                            }}
                        >
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                        'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 15,
                                    marginBottom: 30,
                                }}
                            >
                                {/* Price */}
                                <div
                                    style={{
                                        background:
                                            colors.card2,
                                        borderRadius: 14,
                                        padding: 20,
                                    }}
                                >
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: colors.muted,
                                            margin: 0,
                                        }}
                                    >
                                        PRICE
                                    </p>

                                    <p
                                        style={{
                                            fontSize: 25,
                                            fontWeight: 800,
                                            color: colors.text,
                                            margin:
                                                '5px 0 0',
                                        }}
                                    >
                                        {formatPrice(
                                            selectedPlan.price,
                                            selectedPlan.currency
                                        )}
                                    </p>
                                </div>

                                {/* Duration */}
                                <div
                                    style={{
                                        background:
                                            colors.card2,
                                        borderRadius: 14,
                                        padding: 20,
                                    }}
                                >
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: colors.muted,
                                            margin: 0,
                                        }}
                                    >
                                        DURATION
                                    </p>

                                    <p
                                        style={{
                                            fontSize: 25,
                                            fontWeight: 800,
                                            color: colors.text,
                                            margin:
                                                '5px 0 0',
                                        }}
                                    >
                                        {
                                            selectedPlan.duration_days
                                        }{' '}
                                        Days
                                    </p>
                                </div>
                            </div>

                            {/* Description */}
                            <div
                                style={{
                                    marginBottom: 30,
                                }}
                            >
                                <h3
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: colors.text,
                                        margin:
                                            '0 0 10px',
                                    }}
                                >
                                    About this plan
                                </h3>

                                <p
                                    style={{
                                        fontSize: 14,
                                        lineHeight: 1.7,
                                        color: colors.muted,
                                        margin: 0,
                                    }}
                                >
                                    {selectedPlan.description ||
                                        'This subscription plan is designed to provide your business with access to the platform features.'}
                                </p>
                            </div>

                            {/* Included */}
                            <div
                                style={{
                                    marginBottom: 30,
                                }}
                            >
                                <h3
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: colors.text,
                                        margin:
                                            '0 0 14px',
                                    }}
                                >
                                    Subscription Details
                                </h3>

                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection:
                                            'column',
                                        gap: 12,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems:
                                                'center',
                                            gap: 10,
                                            color: colors.muted,
                                            fontSize: 14,
                                        }}
                                    >
                                        <CheckCircle
                                            size={17}
                                            color="#16a34a"
                                        />
                                        Access for{' '}
                                        {
                                            selectedPlan.duration_days
                                        }{' '}
                                        days
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems:
                                                'center',
                                            gap: 10,
                                            color: colors.muted,
                                            fontSize: 14,
                                        }}
                                    >
                                        <CheckCircle
                                            size={17}
                                            color="#16a34a"
                                        />
                                        Subscription managed
                                        through your tenant
                                        account
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems:
                                                'center',
                                            gap: 10,
                                            color: colors.muted,
                                            fontSize: 14,
                                        }}
                                    >
                                        <ShieldCheck
                                            size={17}
                                            color="#16a34a"
                                        />
                                        Secure payment
                                    </div>
                                </div>
                            </div>

                            {/* Pay */}
                            <div
                                style={{
                                    paddingTop: 25,
                                    borderTop: `1px solid ${colors.border}`,
                                }}
                            >
                                {isCurrentPlan ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems:
                                                'center',
                                            justifyContent:
                                                'center',
                                            gap: 8,
                                            padding: 14,
                                            borderRadius: 12,
                                            background:
                                                accents.green.bg,
                                            color:
                                                accents.green.text,
                                            fontWeight: 700,
                                        }}
                                    >
                                        <CheckCircle
                                            size={19}
                                        />
                                        This is your current
                                        plan
                                    </div>
                                ) : (
                                    <button
                                        onClick={
                                            handlePayNow
                                        }
                                        disabled={
                                            subscribing
                                        }
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems:
                                                'center',
                                            justifyContent:
                                                'center',
                                            gap: 9,
                                            padding: 15,
                                            border: 'none',
                                            borderRadius: 12,
                                            background:
                                                BRAND,
                                            color: '#fff',
                                            fontSize: 15,
                                            fontWeight: 700,
                                            cursor:
                                                subscribing
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                            opacity:
                                                subscribing
                                                    ? 0.7
                                                    : 1,
                                        }}
                                    >
                                        {subscribing ? (
                                            <>
                                                <Loader2
                                                    size={18}
                                                    style={{
                                                        animation:
                                                            'spin 1s linear infinite',
                                                    }}
                                                />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                Pay Now
                                                <ArrowRight
                                                    size={18}
                                                />
                                            </>
                                        )}
                                    </button>
                                )}

                                <p
                                    style={{
                                        textAlign: 'center',
                                        color: colors.subtle,
                                        fontSize: 11,
                                        margin:
                                            '12px 0 0',
                                    }}
                                >
                                    You will be redirected to
                                    the payment screen.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==================================================
    // SUBSCRIPTION LIST VIEW
    // ==================================================

    return (
        <div
            style={{
                background: colors.bg,
                padding: '20px 24px 40px',
                maxWidth: 1100,
                margin: '0 auto',
                minHeight: '100vh',
                fontFamily: "'Poppins', sans-serif",
            }}
        >
            <style>{`
                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>

            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent:
                        'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 25,
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: 26,
                            fontWeight: 800,
                            color: colors.text,
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <CreditCard
                            size={24}
                            color={BRAND}
                        />
                        Subscription
                    </h1>

                    <p
                        style={{
                            color: colors.muted,
                            fontSize: 13,
                            margin: '5px 0 0',
                        }}
                    >
                        View and manage your subscription
                        plan
                    </p>
                </div>

                <button
                    onClick={loadData}
                    disabled={loading}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '8px 15px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        background: colors.card2,
                        color: colors.text,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    <RefreshCw
                        size={14}
                        style={
                            loading
                                ? {
                                    animation:
                                        'spin 1s linear infinite',
                                }
                                : {}
                        }
                    />
                    Refresh
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div
                    style={{
                        padding: 60,
                        textAlign: 'center',
                        color: colors.muted,
                    }}
                >
                    <Loader2
                        size={25}
                        style={{
                            animation:
                                'spin 1s linear infinite',
                        }}
                    />

                    <p>Loading subscription...</p>
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: 15,
                        background:
                            accents.danger.bg,
                        border: `1px solid ${accents.danger.border}`,
                        borderRadius: 12,
                        color: accents.danger.text,
                        marginBottom: 20,
                    }}
                >
                    <AlertCircle size={19} />
                    {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    {/* Current Subscription */}
                    <div
                        style={{
                            background: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 16,
                            padding: 24,
                            marginBottom: 30,
                        }}
                    >
                        <h2
                            style={{
                                fontSize: 16,
                                color: colors.text,
                                margin:
                                    '0 0 18px',
                            }}
                        >
                            Current Subscription
                        </h2>

                        {subscription &&
                            subscription.status !==
                            'INACTIVE' ? (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                        'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 20,
                                }}
                            >
                                <div>
                                    <small
                                        style={{
                                            color: colors.muted,
                                        }}
                                    >
                                        PLAN
                                    </small>

                                    <p
                                        style={{
                                            fontWeight: 700,
                                            fontSize: 18,
                                            color: colors.text,
                                            margin:
                                                '5px 0',
                                        }}
                                    >
                                        {currentPlan?.plan_name ||
                                            subscription.plan_id}
                                    </p>
                                </div>

                                <div>
                                    <small
                                        style={{
                                            color: colors.muted,
                                        }}
                                    >
                                        STATUS
                                    </small>

                                    <p
                                        style={{
                                            fontWeight: 700,
                                            color:
                                                subscription.status ===
                                                    'ACTIVE'
                                                    ? '#16a34a'
                                                    : '#d97706',
                                            margin:
                                                '5px 0',
                                        }}
                                    >
                                        {
                                            subscription.status
                                        }
                                    </p>
                                </div>

                                {subscription.status ===
                                    'ACTIVE' && (
                                        <>
                                            <div>
                                                <small
                                                    style={{
                                                        color: colors.muted,
                                                    }}
                                                >
                                                    DAYS
                                                    REMAINING
                                                </small>

                                                <p
                                                    style={{
                                                        fontWeight: 700,
                                                        fontSize: 18,
                                                        color: colors.text,
                                                        margin:
                                                            '5px 0',
                                                    }}
                                                >
                                                    {subscription.days_remaining ??
                                                        '—'}
                                                </p>
                                            </div>

                                            <div>
                                                <small
                                                    style={{
                                                        color: colors.muted,
                                                    }}
                                                >
                                                    EXPIRES
                                                </small>

                                                <p
                                                    style={{
                                                        fontWeight: 700,
                                                        color: colors.text,
                                                        margin:
                                                            '5px 0',
                                                    }}
                                                >
                                                    {new Date(
                                                        subscription.end_date
                                                    ).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </>
                                    )}
                            </div>
                        ) : (
                            <p
                                style={{
                                    color: colors.muted,
                                    margin: 0,
                                }}
                            >
                                No active subscription.
                                Choose a plan below to get
                                started.
                            </p>
                        )}
                    </div>

                    {/* Plans */}
                    <h2
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: colors.text,
                            margin:
                                '0 0 16px',
                        }}
                    >
                        Available Plans
                    </h2>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns:
                                'repeat(auto-fit, minmax(210px, 1fr))',
                            gap: 16,
                        }}
                    >
                        {plans
                            .filter(
                                (plan) =>
                                    plan.is_active
                            )
                            .map((plan) => {
                                const isCurrent =
                                    subscription?.plan_id ===
                                    plan.plan_id &&
                                    subscription?.status ===
                                    'ACTIVE';

                                const planColor =
                                    getPlanColor(
                                        plan.plan_id
                                    );

                                return (
                                    <div
                                        key={
                                            plan.plan_id
                                        }
                                        style={{
                                            background:
                                                colors.card,
                                            border: `1px solid ${isCurrent ? BRAND : colors.border}`,
                                            borderRadius: 16,
                                            padding: 20,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display:
                                                    'flex',
                                                alignItems:
                                                    'center',
                                                gap: 10,
                                                marginBottom: 12,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 42,
                                                    height: 42,
                                                    borderRadius:
                                                        12,
                                                    background: `${planColor}20`,
                                                    display:
                                                        'flex',
                                                    alignItems:
                                                        'center',
                                                    justifyContent:
                                                        'center',
                                                    color:
                                                        planColor,
                                                }}
                                            >
                                                {getPlanIcon(
                                                    plan.plan_id
                                                )}
                                            </div>

                                            <div>
                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontWeight:
                                                            700,
                                                        color:
                                                            colors.text,
                                                    }}
                                                >
                                                    {
                                                        plan.plan_name
                                                    }
                                                </p>

                                                <p
                                                    style={{
                                                        margin: 0,
                                                        fontSize: 12,
                                                        color:
                                                            colors.muted,
                                                    }}
                                                >
                                                    {
                                                        plan.duration_days
                                                    }{' '}
                                                    days
                                                </p>
                                            </div>
                                        </div>

                                        <p
                                            style={{
                                                color:
                                                    colors.muted,
                                                fontSize: 13,
                                                lineHeight:
                                                    1.5,
                                                minHeight: 40,
                                            }}
                                        >
                                            {plan.description ||
                                                'Perfect for your business needs'}
                                        </p>

                                        <p
                                            style={{
                                                color:
                                                    colors.text,
                                                fontSize: 22,
                                                fontWeight:
                                                    800,
                                                margin:
                                                    '10px 0',
                                            }}
                                        >
                                            {formatPrice(
                                                plan.price,
                                                plan.currency
                                            )}
                                        </p>

                                        <button
                                            disabled={
                                                isCurrent
                                            }
                                            onClick={() =>
                                                setSelectedPlan(
                                                    plan
                                                )
                                            }
                                            style={{
                                                width: '100%',
                                                padding:
                                                    '10px',
                                                border: 'none',
                                                borderRadius: 10,
                                                background:
                                                    isCurrent
                                                        ? colors.card2
                                                        : BRAND,
                                                color:
                                                    isCurrent
                                                        ? colors.muted
                                                        : '#fff',
                                                fontWeight:
                                                    700,
                                                cursor:
                                                    isCurrent
                                                        ? 'not-allowed'
                                                        : 'pointer',
                                                display:
                                                    'flex',
                                                alignItems:
                                                    'center',
                                                justifyContent:
                                                    'center',
                                                gap: 7,
                                            }}
                                        >
                                            {isCurrent ? (
                                                <>
                                                    <CheckCircle
                                                        size={
                                                            16
                                                        }
                                                    />
                                                    Current
                                                    Plan
                                                </>
                                            ) : (
                                                <>
                                                    View
                                                    Details
                                                    <ArrowRight
                                                        size={
                                                            16
                                                        }
                                                    />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                    </div>
                </>
            )}
        </div>
    );
}