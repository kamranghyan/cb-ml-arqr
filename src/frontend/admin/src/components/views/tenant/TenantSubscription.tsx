// app/tenant/subscription/page.tsx

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
} from 'lucide-react';
import { getTheme } from '@/lib/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchMyTenant, type ApiTenant } from '@/lib/auth-api';
import { getValidIdToken, refreshTokens } from '@/lib/cognito'; // Import these functions

const BRAND = '#ff5723';

// ── Types ──
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

// ── Static Demo Data (Fallback) ──
const DEMO_PLANS: Plan[] = [
    {
        plan_id: 'weekly',
        plan_name: 'Weekly Plan',
        duration_days: 7,
        price: 2.99,
        currency: 'USD',
        description: 'Try our service for a week',
        is_active: true,
    },
    {
        plan_id: 'monthly',
        plan_name: 'Monthly Plan',
        duration_days: 30,
        price: 9.99,
        currency: 'USD',
        description: 'Perfect for small businesses',
        is_active: true,
    },
    {
        plan_id: 'quarterly',
        plan_name: 'Quarterly Plan',
        duration_days: 90,
        price: 24.99,
        currency: 'USD',
        description: 'Best value for growing businesses',
        is_active: true,
    },
    {
        plan_id: 'annual',
        plan_name: 'Annual Plan',
        duration_days: 365,
        price: 79.99,
        currency: 'USD',
        description: 'Maximum savings! Full year access',
        is_active: true,
    },
];

const DEMO_SUBSCRIPTION: Subscription = {
    tenant_id: 'demo_tenant',
    plan_id: 'monthly',
    status: 'ACTIVE',
    start_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    days_remaining: 15,
};

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
    orange: {
        bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
        border: isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A',
        text: isDark ? '#fb923c' : '#d97706'
    },
    danger: {
        bg: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
        border: isDark ? 'rgba(220,38,38,0.3)' : '#FECACA',
        text: isDark ? '#f87171' : '#dc2626'
    },
});

export default function TenantSubscription() {
    const router = useRouter();
    const { role, loading: authLoading } = useCurrentUser();
    const [plans, setPlans] = useState<Plan[]>(DEMO_PLANS);
    const [subscription, setSubscription] = useState<Subscription | null>(DEMO_SUBSCRIPTION);
    const [loading, setLoading] = useState(false);
    const [subscribing, setSubscribing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isDark, setIsDark] = useState(false);
    const [isApiLoaded, setIsApiLoaded] = useState(false);
    const [tenant, setTenant] = useState<ApiTenant | null>(null);

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
    const accents = getAccents(isDark);

    // ── Role-Based Access Check ──
    useEffect(() => {
        if (!authLoading) {
            if (role !== 'tenant') {
                router.replace('/dashboard');
                return;
            }
        }
    }, [role, authLoading, router]);

    // ── Helper function to get valid token ──
    const getToken = async () => {
        try {
            // Use the shared cognito helper
            const token = await getValidIdToken();
            
            // If token is null, try to refresh
            if (!token) {
                console.log('🔄 No valid token, attempting refresh...');
                const refreshed = await refreshTokens();
                if (refreshed) {
                    const newToken = await getValidIdToken();
                    if (newToken) {
                        console.log('✅ Token refreshed successfully');
                        return newToken;
                    }
                }
                return null;
            }
            
            return token;
        } catch (error) {
            console.error('❌ Error getting token:', error);
            return null;
        }
    };

    // ── Load Data (GET: Plans + Subscription Status with Token) ──
    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        setIsApiLoaded(false);

        try {
            // 1. Fetch tenant first
            const tenantData = await fetchMyTenant().catch(() => null);
            setTenant(tenantData);

            if (!tenantData) {
                setError('Could not load tenant information');
                setLoading(false);
                return;
            }

            // 2. Get valid token
            const token = await getToken();
            
            if (!token) {
                setError('Session expired. Please login again.');
                setLoading(false);
                // Redirect to login after a moment
                setTimeout(() => router.push('/login'), 2000);
                return;
            }

            console.log('🔑 Token obtained successfully');

            // 3. Build headers with token
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            };

            // 4. Fetch plans and subscription in parallel
            const [plansRes, subRes] = await Promise.all([
                fetch('/api/v1/plans', { headers })
                    .then(async r => {
                        if (!r.ok) throw new Error(`Plans fetch failed: ${r.status}`);
                        return r.json();
                    })
                    .catch(() => {
                        console.warn('⚠️ Plans API failed, using demo data');
                        return [];
                    }),
                fetch(`/api/v1/subscriptions/status/${tenantData.tenantId}`, { headers })
                    .then(async r => {
                        console.log('📡 Subscription response status:', r.status);
                        
                        if (r.status === 401) {
                            console.warn('⚠️ 401 Unauthorized - Token may be invalid');
                            // Try to refresh token and retry once
                            const refreshed = await refreshTokens();
                            if (refreshed) {
                                const newToken = await getValidIdToken();
                                if (newToken) {
                                    console.log('🔄 Retrying with new token...');
                                    const retryRes = await fetch(`/api/v1/subscriptions/status/${tenantData.tenantId}`, {
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${newToken}`,
                                        },
                                    });
                                    if (retryRes.ok) {
                                        return retryRes.json();
                                    }
                                }
                            }
                            return null;
                        }
                        
                        return r.ok ? r.json() : null;
                    })
                    .catch(() => null)
            ]);

            console.log('📋 Plans response:', plansRes);
            console.log('📋 Subscription response:', subRes);

            // 5. Set plans
            if (Array.isArray(plansRes) && plansRes.length > 0) {
                setPlans(plansRes);
                setIsApiLoaded(true);
            } else {
                setPlans(DEMO_PLANS);
                setIsApiLoaded(false);
            }

            // 6. Set subscription
            if (subRes && subRes.tenant_id) {
                setSubscription(subRes);
                setIsApiLoaded(true);
            } else {
                setSubscription(DEMO_SUBSCRIPTION);
                setIsApiLoaded(false);
            }

            setError('');
        } catch (e: any) {
            console.error('❌ Error in loadData:', e);
            setError(e?.message || 'Failed to load subscription data');
            // Fallback: Show demo data when API fails
            setPlans(DEMO_PLANS);
            setSubscription(DEMO_SUBSCRIPTION);
            setIsApiLoaded(false);
        } finally {
            setLoading(false);
            console.log('✅ loadData() completed');
        }
    }, [router]);

    useEffect(() => {
        if (role === 'tenant') {
            loadData();
        }
    }, [role, loadData]);

    // ── Subscribe to plan (POST + Redirect to Payment) ──
    const handleSubscribe = async (planId: string) => {
        const plan = plans.find(p => p.plan_id === planId);

        if (!plan) {
            setError('Plan not found');
            return;
        }

        if (subscription?.plan_id === planId && subscription?.status === 'ACTIVE') {
            setError('You are already subscribed to this plan');
            return;
        }

        setSubscribing(true);
        setError('');
        setSuccess('');

        try {
            // Get valid token
            const token = await getToken();
            
            if (!token) {
                setError('Session expired. Please login again.');
                setSubscribing(false);
                setTimeout(() => router.push('/login'), 2000);
                return;
            }

            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            };

            // POST to subscribe
            const res = await fetch('/api/v1/subscriptions/subscribe', {
                method: 'POST',
                headers,
                body: JSON.stringify({ plan_id: planId }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.error || data?.detail || 'Subscription failed');
            }

            setSuccess(`Successfully subscribed to "${plan.plan_name}"!`);
            await loadData();

            setTimeout(() => {
                const paymentUrl = `/tenant/payment?plan=${plan.plan_id}&name=${encodeURIComponent(plan.plan_name)}&price=${plan.price}&currency=${plan.currency}`;
                router.push(paymentUrl);
            }, 1500);

        } catch (e: any) {
            setError(e?.message || 'Failed to subscribe. Please try again.');
        } finally {
            setSubscribing(false);
        }
    };

    // ── Format price ──
    const formatPrice = (price: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    };

    // ── Format date ──
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // ── Get status badge ──
    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; color: string; bg: string }> = {
            'ACTIVE': { label: 'Active', color: '#16a34a', bg: isDark ? 'rgba(34,197,94,0.15)' : '#F0FFF4' },
            'PENDING': { label: 'Pending', color: '#d97706', bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB' },
            'EXPIRED': { label: 'Expired', color: '#dc2626', bg: isDark ? 'rgba(220,38,38,0.15)' : '#FEF2F2' },
            'CANCELLED': { label: 'Cancelled', color: '#6b7280', bg: isDark ? 'rgba(107,114,128,0.15)' : '#F3F4F6' },
            'INACTIVE': { label: 'Inactive', color: '#6b7280', bg: isDark ? 'rgba(107,114,128,0.15)' : '#F3F4F6' },
        };
        return statusMap[status] || statusMap['INACTIVE'];
    };

    // ── Plan icon ──
    const getPlanIcon = (planId: string) => {
        const icons: Record<string, React.ReactNode> = {
            'weekly': <Clock size={20} />,
            'monthly': <Calendar size={20} />,
            'quarterly': <Zap size={20} />,
            'semi_annual': <Star size={20} />,
            'annual': <Crown size={20} />,
        };
        return icons[planId] || <CreditCard size={20} />;
    };

    // ── Plan color ──
    const getPlanColor = (planId: string) => {
        const planColors: Record<string, string> = {
            'weekly': '#6B7280',
            'monthly': '#3B82F6',
            'quarterly': '#8B5CF6',
            'semi_annual': '#EC4899',
            'annual': '#F59E0B',
        };
        return planColors[planId] || BRAND;
    };

    const currentPlan = plans.find(p => p.plan_id === subscription?.plan_id);

    // ── Display plans (dynamic if API loaded, otherwise static) ──
    const displayPlans = isApiLoaded ? plans : DEMO_PLANS;
    const displaySubscription = isApiLoaded ? subscription : DEMO_SUBSCRIPTION;

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

    // ── If not tenant, show nothing (will redirect) ──
    if (role !== 'tenant') {
        return null;
    }

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

            {/* ── Header ── */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 24,
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: 'clamp(20px, 2.5vw, 26px)',
                            fontWeight: 800,
                            color: colors.text,
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <CreditCard size={24} color={BRAND} />
                        Subscription
                    </h1>
                    <p
                        style={{
                            color: colors.muted,
                            fontSize: 13,
                            margin: '4px 0 0',
                        }}
                    >
                        {isApiLoaded ? 'View and manage your subscription plan' : 'Showing demo data (API not connected)'}
                    </p>
                </div>
                <button
                    onClick={loadData}
                    disabled={loading}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        border: `1.5px solid ${colors.border}`,
                        borderRadius: 10,
                        background: colors.card2,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        color: colors.text,
                        opacity: loading ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                        outline: 'none',
                    }}
                >
                    <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                    Refresh
                </button>
            </div>

            {/* ── Loading ── */}
            {loading && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '60px 20px',
                        color: colors.muted,
                    }}
                >
                    <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: 12, fontSize: 14 }}>Loading subscription details…</p>
                </div>
            )}

            {/* ── Error ── */}
            {!loading && error && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '16px 20px',
                        background: accents.danger.bg,
                        border: `1px solid ${accents.danger.border}`,
                        borderRadius: 12,
                        color: accents.danger.text,
                        marginBottom: 16,
                    }}
                >
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Success ── */}
            {!loading && success && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '16px 20px',
                        background: accents.green.bg,
                        border: `1px solid ${accents.green.border}`,
                        borderRadius: 12,
                        color: accents.green.text,
                        marginBottom: 16,
                    }}
                >
                    <CheckCircle size={20} />
                    <span>{success}</span>
                </div>
            )}

            {!loading && !error && (
                <>
                    {/* ── Current Subscription Status ── */}
                    <div
                        style={{
                            background: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 16,
                            padding: '24px',
                            marginBottom: 28,
                        }}
                    >
                        <h2
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors.text,
                                margin: '0 0 16px',
                            }}
                        >
                            Current Subscription
                        </h2>

                        {displaySubscription && displaySubscription.status !== 'INACTIVE' ? (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 16,
                                }}
                            >
                                <div>
                                    <p
                                        style={{
                                            fontSize: 11,
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
                                            fontSize: 18,
                                            fontWeight: 700,
                                            color: colors.text,
                                            margin: '4px 0 0',
                                        }}
                                    >
                                        {currentPlan?.plan_name || displaySubscription.plan_id}
                                    </p>
                                </div>

                                <div>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: colors.subtle,
                                            margin: 0,
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5,
                                        }}
                                    >
                                        Status
                                    </p>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 14px',
                                            borderRadius: 20,
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: getStatusBadge(displaySubscription.status).color,
                                            background: getStatusBadge(displaySubscription.status).bg,
                                            marginTop: 4,
                                        }}
                                    >
                                        {getStatusBadge(displaySubscription.status).label}
                                    </span>
                                </div>

                                {displaySubscription.status === 'ACTIVE' && (
                                    <>
                                        <div>
                                            <p
                                                style={{
                                                    fontSize: 11,
                                                    color: colors.subtle,
                                                    margin: 0,
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                }}
                                            >
                                                Days Remaining
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: 18,
                                                    fontWeight: 700,
                                                    color:
                                                        displaySubscription.days_remaining &&
                                                        displaySubscription.days_remaining < 7
                                                            ? '#dc2626'
                                                            : colors.text,
                                                    margin: '4px 0 0',
                                                }}
                                            >
                                                {displaySubscription.days_remaining ?? '—'}
                                            </p>
                                        </div>

                                        <div>
                                            <p
                                                style={{
                                                    fontSize: 11,
                                                    color: colors.subtle,
                                                    margin: 0,
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                }}
                                            >
                                                Expires On
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: colors.text,
                                                    margin: '4px 0 0',
                                                }}
                                            >
                                                {formatDate(displaySubscription.end_date)}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: '20px 0',
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: 14,
                                        color: colors.muted,
                                        margin: 0,
                                    }}
                                >
                                    No active subscription. Choose a plan below to get started.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Available Plans ── */}
                    <h2
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: colors.text,
                            margin: '0 0 16px',
                        }}
                    >
                        Available Plans
                    </h2>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 16,
                        }}
                    >
                        {displayPlans
                            .filter((p) => p.is_active)
                            .map((plan) => {
                                const isCurrentPlan =
                                    displaySubscription?.plan_id === plan.plan_id &&
                                    displaySubscription?.status === 'ACTIVE';
                                const isPending =
                                    displaySubscription?.plan_id === plan.plan_id &&
                                    displaySubscription?.status === 'PENDING';
                                const planColor = getPlanColor(plan.plan_id);

                                return (
                                    <div
                                        key={plan.plan_id}
                                        className="fade-in"
                                        style={{
                                            background: colors.card,
                                            border: `2px solid ${isCurrentPlan ? BRAND : colors.border}`,
                                            borderRadius: 16,
                                            padding: '20px',
                                            position: 'relative',
                                            transition: 'all 0.3s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isCurrentPlan && !isPending) {
                                                e.currentTarget.style.transform = 'translateY(-4px)';
                                                e.currentTarget.style.boxShadow = `0 8px 24px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`;
                                                e.currentTarget.style.borderColor = BRAND;
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                            if (!isCurrentPlan) {
                                                e.currentTarget.style.borderColor = colors.border;
                                            }
                                        }}
                                    >
                                        {isCurrentPlan && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: -10,
                                                    right: 12,
                                                    background: BRAND,
                                                    color: '#fff',
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    padding: '2px 12px',
                                                    borderRadius: 12,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                }}
                                            >
                                                Current
                                            </div>
                                        )}

                                        {isPending && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: -10,
                                                    right: 12,
                                                    background: '#d97706',
                                                    color: '#fff',
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    padding: '2px 12px',
                                                    borderRadius: 12,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.5,
                                                }}
                                            >
                                                Pending
                                            </div>
                                        )}

                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                marginBottom: 8,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: '50%',
                                                    background: `${planColor}20`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: planColor,
                                                }}
                                            >
                                                {getPlanIcon(plan.plan_id)}
                                            </div>
                                            <div>
                                                <p
                                                    style={{
                                                        fontSize: 16,
                                                        fontWeight: 700,
                                                        color: colors.text,
                                                        margin: 0,
                                                    }}
                                                >
                                                    {plan.plan_name}
                                                </p>
                                                <p
                                                    style={{
                                                        fontSize: 12,
                                                        color: colors.subtle,
                                                        margin: 0,
                                                    }}
                                                >
                                                    {plan.duration_days} days
                                                </p>
                                            </div>
                                        </div>

                                        <p
                                            style={{
                                                fontSize: 13,
                                                color: colors.muted,
                                                margin: '8px 0 12px',
                                                lineHeight: 1.5,
                                                minHeight: 40,
                                            }}
                                        >
                                            {plan.description || 'Perfect for your business needs'}
                                        </p>

                                        <p
                                            style={{
                                                fontSize: 22,
                                                fontWeight: 800,
                                                color: colors.text,
                                                margin: 0,
                                            }}
                                        >
                                            {formatPrice(plan.price, plan.currency)}
                                        </p>

                                        {/* Subscribe Button */}
                                        <button
                                            onClick={() => handleSubscribe(plan.plan_id)}
                                            disabled={isCurrentPlan || isPending || subscribing}
                                            style={{
                                                width: '100%',
                                                marginTop: 14,
                                                padding: '10px',
                                                borderRadius: 10,
                                                border: isCurrentPlan
                                                    ? `2px solid ${colors.border}`
                                                    : 'none',
                                                background: isCurrentPlan
                                                    ? 'transparent'
                                                    : isPending
                                                        ? colors.border
                                                        : BRAND,
                                                color: isCurrentPlan
                                                    ? colors.muted
                                                    : isPending
                                                        ? colors.muted
                                                        : '#fff',
                                                fontWeight: 700,
                                                fontSize: 14,
                                                cursor:
                                                    isCurrentPlan || isPending || subscribing
                                                        ? 'not-allowed'
                                                        : 'pointer',
                                                opacity: isCurrentPlan || isPending || subscribing ? 0.6 : 1,
                                                transition: 'all 0.2s ease',
                                                outline: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                            }}
                                        >
                                            {subscribing ? (
                                                <>
                                                    <Loader2
                                                        size={16}
                                                        style={{ animation: 'spin 1s linear infinite' }}
                                                    />
                                                    Subscribing…
                                                </>
                                            ) : isCurrentPlan ? (
                                                <>
                                                    <CheckCircle size={16} />
                                                    Current Plan
                                                </>
                                            ) : isPending ? (
                                                <>
                                                    <Clock size={16} />
                                                    Pending
                                                </>
                                            ) : (
                                                <>
                                                    Subscribe
                                                    <ArrowRight size={16} />
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