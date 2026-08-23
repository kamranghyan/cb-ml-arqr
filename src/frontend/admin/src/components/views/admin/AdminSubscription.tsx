// app/admin/subscription/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    CreditCard,
    Plus,
    Loader2,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Trash2,
    Edit,
    Clock,
    Calendar,
    Zap,
    Crown,
    Star,
    X,
    Users,
} from 'lucide-react';
import { getTheme } from '@/lib/theme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import {
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    fetchSubscriptionStatus,
    type Plan,
    type Subscription,
} from '@/lib/subscription-api';
import {
    fetchTenants,
    type ApiTenant,
} from '@/lib/auth-api';

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
        bg: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
        border: isDark ? 'rgba(220,38,38,0.3)' : '#FECACA',
        text: isDark ? '#f87171' : '#dc2626'
    },
    orange: {
        bg: isDark ? 'rgba(251,146,60,0.15)' : '#FFFBEB',
        border: isDark ? 'rgba(251,146,60,0.3)' : '#FDE68A',
        text: isDark ? '#fb923c' : '#d97706'
    },
});

export default function AdminSubscription() {
    const router = useRouter();
    const { role, loading: authLoading } = useCurrentUser();

    // ── State ──
    const [plans, setPlans] = useState<Plan[]>([]);
    const [tenants, setTenants] = useState<ApiTenant[]>([]);
    const [subscriptions, setSubscriptions] = useState<Map<string, Subscription>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isDark, setIsDark] = useState(false);
    const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

    // ── Modal State ──
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [formData, setFormData] = useState({
        plan_id: 'monthly',
        plan_name: 'Monthly Plan',
        duration_days: 30,
        price: 9.99,
        currency: 'USD',
        description: 'Perfect for businesses',
    });
    const [submitting, setSubmitting] = useState(false);

    // ── Delete Modal State ──
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
    const [deleting, setDeleting] = useState(false);

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

    // ── Role Check ──
    useEffect(() => {
        if (!authLoading && role !== 'admin') {
            router.replace('/dashboard');
        }
    }, [role, authLoading, router]);

    const loadPlans = useCallback(async () => {
        setError('');

        try {
            const data = await fetchPlans();
            setPlans(data);
        } catch (e: any) {
            setError(e?.message || 'Failed to load plans');
        }
    }, []);

    const loadTenantsWithSubscriptions = useCallback(async () => {
        setLoadingSubscriptions(true);

        try {
            const tenantsData = await fetchTenants();
            setTenants(tenantsData);

            const subMap = new Map<string, Subscription>();

            await Promise.all(
                tenantsData.map(async (tenant) => {
                    try {
                        const data = await fetchSubscriptionStatus(
                            tenant.tenantId
                        );

                        if (data) {
                            subMap.set(tenant.tenantId, data);
                        }
                    } catch (err) {
                        console.error(
                            `Failed subscription for tenant ${tenant.tenantId}`,
                            err
                        );
                    }
                })
            );

            setSubscriptions(subMap);
        } catch (e: any) {
            setError(e?.message || 'Failed to load tenants');
        } finally {
            setLoadingSubscriptions(false);
        }
    }, []);

    const loadAllData = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            await Promise.all([
                loadPlans(),
                loadTenantsWithSubscriptions(),
            ]);
        } catch (e: any) {
            setError(e?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [loadPlans, loadTenantsWithSubscriptions]);


    useEffect(() => {
        if (role === 'admin') {
            loadAllData();
        }
    }, [role, loadAllData]);

    // ── Create Plan ──
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            await createPlan({
                plan_id: formData.plan_id,
                plan_name: formData.plan_name,
                duration_days: formData.duration_days,
                price: formData.price,
                currency: formData.currency,
                description: formData.description,
            });

            setSuccess(`Plan "${formData.plan_name}" created successfully!`);
            setShowModal(false);
            setEditingPlan(null);

            await loadPlans();
        } catch (e: any) {
            setError(e?.message || 'Failed to create plan');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Update Plan ──
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlan) return;

        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            await updatePlan(editingPlan.plan_id, {
                plan_id: formData.plan_id,
                plan_name: formData.plan_name,
                duration_days: formData.duration_days,
                price: formData.price,
                currency: formData.currency,
                description: formData.description,
            });

            setSuccess(`Plan "${formData.plan_name}" updated successfully!`);
            setShowModal(false);
            setEditingPlan(null);

            setFormData({
                plan_id: 'monthly',
                plan_name: 'Monthly Plan',
                duration_days: 30,
                price: 9.99,
                currency: 'USD',
                description: 'Perfect for businesses',
            });

            await loadPlans();

            setTimeout(() => setSuccess(''), 3000);
        } catch (e: any) {
            setError(e?.message || 'Failed to update plan');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Delete Plan ──
    const handleDeleteClick = (plan: Plan) => {
        setPlanToDelete(plan);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!planToDelete) return;

        setDeleting(true);
        setError('');
        setSuccess('');

        try {
            await deletePlan(planToDelete.plan_id);

            setSuccess(
                `Plan "${planToDelete.plan_name}" deleted successfully!`
            );

            await loadPlans();

            setTimeout(() => setSuccess(''), 3000);
        } catch (e: any) {
            setError(e?.message || 'Failed to delete plan');
        } finally {
            setDeleting(false);
            setShowDeleteModal(false);
            setPlanToDelete(null);
        }
    };

    // ── Open edit modal ──
    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setFormData({
            plan_id: plan.plan_id,
            plan_name: plan.plan_name,
            duration_days: plan.duration_days,
            price: plan.price,
            currency: plan.currency,
            description: plan.description || '',
        });
        setShowModal(true);
    };

    // ── Format price ──
    const formatPrice = (price: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
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

    // ── Get plan icon ──
    const getPlanIcon = (planId: string) => {
        const icons: Record<string, React.ReactNode> = {
            'weekly': <Clock size={18} />,
            'monthly': <Calendar size={18} />,
            'quarterly': <Zap size={18} />,
            'semi_annual': <Star size={18} />,
            'annual': <Crown size={18} />,
        };
        return icons[planId] || <CreditCard size={18} />;
    };

    // ── Get plan color ──
    const getPlanColor = (planId: string) => {
        const colorMap: Record<string, string> = {
            'weekly': '#6B7280',
            'monthly': '#3B82F6',
            'quarterly': '#8B5CF6',
            'semi_annual': '#EC4899',
            'annual': '#F59E0B',
        };
        return colorMap[planId] || BRAND;
    };

    const handleSubmit = editingPlan ? handleUpdate : handleCreate;

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

    // ── If not admin ──
    if (role !== 'admin') {
        return null;
    }
    const displayPlans = plans;

    // ── Stats ──
    const activeSubscriptions = Array.from(subscriptions.values()).filter(s => s.status === 'ACTIVE').length;
    const pendingSubscriptions = Array.from(subscriptions.values()).filter(s => s.status === 'PENDING').length;
    const totalTenants = tenants.length;

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
                    alignItems: 'center',
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
                        Plans & Subscriptions
                    </h1>
                    <p
                        style={{
                            color: colors.muted,
                            fontSize: 13,
                            margin: '4px 0 0',
                        }}
                    >
                        Manage subscription plans and view tenant subscriptions                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={loadAllData}
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
                        <RefreshCw
                            size={14}
                            style={loading ? { animation: 'spin 1s linear infinite' } : {}}
                        />
                        Refresh
                    </button>
                    <button
                        onClick={() => {
                            setEditingPlan(null);
                            setFormData({
                                plan_id: 'monthly',
                                plan_name: 'Monthly Plan',
                                duration_days: 30,
                                price: 9.99,
                                currency: 'USD',
                                description: 'Perfect for businesses',
                            });
                            setShowModal(true);
                        }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: 10,
                            background: BRAND,
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            color: '#fff',
                            fontFamily: "'Poppins', sans-serif",
                            transition: 'all 0.2s ease',
                            outline: 'none',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e64a1a';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = BRAND;
                        }}
                    >
                        <Plus size={16} />
                        Create Plan
                    </button>
                </div>
            </div>

            {/* ── Stats Cards ── */}
            {!loading && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 12,
                        marginBottom: 20,
                    }}
                >
                    <div
                        style={{
                            background: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 12,
                            padding: '14px 16px',
                        }}
                    >
                        <p
                            style={{
                                fontSize: 11,
                                color: colors.subtle,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                            }}
                        >
                            Total Tenants
                        </p>
                        <p
                            style={{
                                fontSize: 24,
                                fontWeight: 700,
                                color: colors.text,
                                margin: 2,
                            }}
                        >
                            {totalTenants}
                        </p>
                    </div>
                    <div
                        style={{
                            background: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 12,
                            padding: '14px 16px',
                        }}
                    >
                        <p
                            style={{
                                fontSize: 11,
                                color: colors.subtle,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                            }}
                        >
                            Active Subscriptions
                        </p>
                        <p
                            style={{
                                fontSize: 24,
                                fontWeight: 700,
                                color: accents.green.text,
                                margin: 2,
                            }}
                        >
                            {activeSubscriptions}
                        </p>
                    </div>
                    <div
                        style={{
                            background: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 12,
                            padding: '14px 16px',
                        }}
                    >
                        <p
                            style={{
                                fontSize: 11,
                                color: colors.subtle,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                            }}
                        >
                            Pending
                        </p>
                        <p
                            style={{
                                fontSize: 24,
                                fontWeight: 700,
                                color: accents.orange.text,
                                margin: 2,
                            }}
                        >
                            {pendingSubscriptions}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Success / Error ── */}
            {success && (
                <div
                    style={{
                        padding: '12px 16px',
                        background: accents.green.bg,
                        border: `1px solid ${accents.green.border}`,
                        borderRadius: 10,
                        color: accents.green.text,
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <CheckCircle size={18} />
                    {success}
                </div>
            )}

            {error && (
                <div
                    style={{
                        padding: '12px 16px',
                        background: accents.danger.bg,
                        border: `1px solid ${accents.danger.border}`,
                        borderRadius: 10,
                        color: accents.danger.text,
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

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
                    <p style={{ marginTop: 12, fontSize: 14 }}>Loading data…</p>
                </div>
            )}

            {/* ── Plans List ── */}
            {!loading && (
                <div>
                    <h2
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: colors.text,
                            margin: '0 0 16px',
                        }}
                    >
                        Plans
                    </h2>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: 16,
                            marginBottom: 24,
                        }}
                    >
                        {displayPlans.filter((p) => p.is_active).map((plan) => {
                            const planColor = getPlanColor(plan.plan_id);
                            return (
                                <div
                                    key={plan.plan_id}
                                    className="fade-in"
                                    style={{
                                        background: colors.card,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: 14,
                                        padding: '20px',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = BRAND;
                                        e.currentTarget.style.boxShadow = `0 4px 16px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'
                                            }`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = colors.border;
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            marginBottom: 10,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 36,
                                                    height: 36,
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
                                                        fontSize: 15,
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
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                onClick={() => handleEdit(plan)}
                                                style={{
                                                    padding: '4px 8px',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: colors.muted,
                                                    cursor: 'pointer',
                                                    borderRadius: 6,
                                                    transition: 'all 0.2s ease',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = colors.hoverBg;
                                                    e.currentTarget.style.color = BRAND;
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color = colors.muted;
                                                }}
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(plan)}
                                                style={{
                                                    padding: '4px 8px',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: colors.muted,
                                                    cursor: 'pointer',
                                                    borderRadius: 6,
                                                    transition: 'all 0.2s ease',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = accents.danger.bg;
                                                    e.currentTarget.style.color = accents.danger.text;
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color = colors.muted;
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <p
                                        style={{
                                            fontSize: 13,
                                            color: colors.muted,
                                            margin: '4px 0 10px',
                                            lineHeight: 1.4,
                                            minHeight: 36,
                                        }}
                                    >
                                        {plan.description || 'No description'}
                                    </p>

                                    <p
                                        style={{
                                            fontSize: 20,
                                            fontWeight: 800,
                                            color: colors.text,
                                            margin: 0,
                                        }}
                                    >
                                        {formatPrice(plan.price, plan.currency)}
                                    </p>

                                    <span
                                        style={{
                                            display: 'inline-block',
                                            marginTop: 8,
                                            padding: '2px 10px',
                                            borderRadius: 12,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: plan.is_active ? accents.green.text : colors.subtle,
                                            background: plan.is_active ? accents.green.bg : colors.card2,
                                        }}
                                    >
                                        {plan.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            );
                        })}

                        {displayPlans.length === 0 && (
                            <div
                                style={{
                                    gridColumn: '1 / -1',
                                    textAlign: 'center',
                                    padding: '40px 20px',
                                    color: colors.muted,
                                }}
                            >
                                <CreditCard size={40} style={{ opacity: 0.2 }} />
                                <p style={{ marginTop: 12, fontSize: 14 }}>No plans created yet</p>
                                <p style={{ fontSize: 13, color: colors.subtle }}>
                                    Click "Create Plan" to add your first subscription plan
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tenants Subscription Status ── */}
            {!loading && tenants.length > 0 && (
                <div>
                    <h2
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: colors.text,
                            margin: '0 0 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <Users size={20} color={BRAND} />
                        Tenant Subscriptions
                        {loadingSubscriptions && (
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        )}
                    </h2>

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        {tenants.slice(0, 10).map((tenant) => {
                            const sub = subscriptions.get(tenant.tenantId);
                            const statusBadge = sub ? getStatusBadge(sub.status) : getStatusBadge('INACTIVE');
                            const planName = sub ? displayPlans.find(p => p.plan_id === sub.plan_id)?.plan_name : '—';

                            return (
                                <div
                                    key={tenant.tenantId}
                                    className="fade-in"
                                    style={{
                                        background: colors.card,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: 10,
                                        padding: '12px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: 8,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                background: tenant.isActive ? accents.green.bg : accents.danger.bg,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: tenant.isActive ? accents.green.text : accents.danger.text,
                                            }}
                                        >
                                            {tenant.companyName?.charAt(0) || 'T'}
                                        </div>
                                        <div>
                                            <p
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: colors.text,
                                                    margin: 0,
                                                }}
                                            >
                                                {tenant.companyName}
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: 12,
                                                    color: colors.subtle,
                                                    margin: 0,
                                                }}
                                            >
                                                {tenant.email}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                color: colors.muted,
                                            }}
                                        >
                                            {planName}
                                        </span>
                                        <span
                                            style={{
                                                padding: '2px 12px',
                                                borderRadius: 20,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: statusBadge.color,
                                                background: statusBadge.bg,
                                            }}
                                        >
                                            {statusBadge.label}
                                        </span>
                                        {sub?.days_remaining !== null && sub?.days_remaining !== undefined && sub.status === 'ACTIVE' && (
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: sub.days_remaining < 7 ? accents.danger.text : colors.muted,
                                                }}
                                            >
                                                {sub.days_remaining} days left
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {tenants.length > 10 && (
                            <p
                                style={{
                                    textAlign: 'center',
                                    fontSize: 13,
                                    color: colors.subtle,
                                    padding: '12px 0',
                                }}
                            >
                                + {tenants.length - 10} more tenants
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Create/Edit Modal ── */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            background: colors.card,
                            borderRadius: 16,
                            maxWidth: 500,
                            width: '100%',
                            padding: 28,
                            maxHeight: '90vh',
                            overflowY: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 16,
                            }}
                        >
                            <h2
                                style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: colors.text,
                                    margin: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <CreditCard size={20} color={BRAND} />
                                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: colors.muted,
                                    cursor: 'pointer',
                                    padding: 4,
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Plan ID */}
                            <div style={{ marginBottom: 14 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: colors.text,
                                        marginBottom: 4,
                                    }}
                                >
                                    Plan ID
                                </label>
                                <select
                                    value={formData.plan_id}
                                    onChange={(e) =>
                                        setFormData({ ...formData, plan_id: e.target.value })
                                    }
                                    disabled={!!editingPlan}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: `1.5px solid ${colors.border}`,
                                        background: editingPlan ? colors.border : colors.card2,
                                        color: editingPlan ? colors.muted : colors.text,
                                        fontSize: 14,
                                        outline: 'none',
                                        fontFamily: "'Poppins', sans-serif",
                                        cursor: editingPlan ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="semi_annual">Semi-Annual</option>
                                    <option value="annual">Annual</option>
                                </select>
                            </div>

                            {/* Plan Name */}
                            <div style={{ marginBottom: 14 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: colors.text,
                                        marginBottom: 4,
                                    }}
                                >
                                    Plan Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.plan_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, plan_name: e.target.value })
                                    }
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: `1.5px solid ${colors.border}`,
                                        background: colors.card2,
                                        color: colors.text,
                                        fontSize: 14,
                                        outline: 'none',
                                        fontFamily: "'Poppins', sans-serif",
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = BRAND;
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = colors.border;
                                    }}
                                />
                            </div>

                            {/* Duration */}
                            <div style={{ marginBottom: 14 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: colors.text,
                                        marginBottom: 4,
                                    }}
                                >
                                    Duration (days)
                                </label>
                                <input
                                    type="number"
                                    value={formData.duration_days}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            duration_days: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    required
                                    min={1}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: `1.5px solid ${colors.border}`,
                                        background: colors.card2,
                                        color: colors.text,
                                        fontSize: 14,
                                        outline: 'none',
                                        fontFamily: "'Poppins', sans-serif",
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = BRAND;
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = colors.border;
                                    }}
                                />
                            </div>

                            {/* Price */}
                            <div style={{ marginBottom: 14 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: colors.text,
                                        marginBottom: 4,
                                    }}
                                >
                                    Price
                                </label>
                                <input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            price: parseFloat(e.target.value) || 0,
                                        })
                                    }
                                    required
                                    min={0}
                                    step={0.01}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: `1.5px solid ${colors.border}`,
                                        background: colors.card2,
                                        color: colors.text,
                                        fontSize: 14,
                                        outline: 'none',
                                        fontFamily: "'Poppins', sans-serif",
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = BRAND;
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = colors.border;
                                    }}
                                />
                            </div>

                            {/* Currency */}
                            <div style={{ marginBottom: 14 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: colors.text,
                                        marginBottom: 4,
                                    }}
                                >
                                    Currency
                                </label>
                                <select
                                    value={formData.currency}
                                    onChange={(e) =>
                                        setFormData({ ...formData, currency: e.target.value })
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: `1.5px solid ${colors.border}`,
                                        background: colors.card2,
                                        color: colors.text,
                                        fontSize: 14,
                                        outline: 'none',
                                        fontFamily: "'Poppins', sans-serif",
                                    }}
                                >
                                    <option value="USD">USD</option>
                                    <option value="PKR">PKR</option>
                                    <option value="EUR">EUR</option>
                                </select>
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: 16 }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: colors.text,
                                        marginBottom: 4,
                                    }}
                                >
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                    rows={2}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: `1.5px solid ${colors.border}`,
                                        background: colors.card2,
                                        color: colors.text,
                                        fontSize: 14,
                                        outline: 'none',
                                        resize: 'vertical',
                                        fontFamily: "'Poppins', sans-serif",
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = BRAND;
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = colors.border;
                                    }}
                                />
                            </div>

                            <div
                                style={{
                                    display: 'flex',
                                    gap: 10,
                                    marginTop: 4,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: 8,
                                        border: `1.5px solid ${colors.border}`,
                                        background: 'transparent',
                                        color: colors.text,
                                        fontWeight: 600,
                                        fontSize: 14,
                                        cursor: 'pointer',
                                        fontFamily: "'Poppins', sans-serif",
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = colors.hoverBg;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: submitting ? colors.muted : BRAND,
                                        color: '#fff',
                                        fontWeight: 700,
                                        fontSize: 14,
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        opacity: submitting ? 0.6 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        fontFamily: "'Poppins', sans-serif",
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!submitting) e.currentTarget.style.background = '#e64a1a';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!submitting) e.currentTarget.style.background = BRAND;
                                    }}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2
                                                size={16}
                                                style={{ animation: 'spin 1s linear infinite' }}
                                            />
                                            Saving…
                                        </>
                                    ) : editingPlan ? (
                                        'Update Plan'
                                    ) : (
                                        'Create Plan'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Confirm Delete Modal ── */}
            {showDeleteModal && planToDelete && (
                <ConfirmDeleteModal
                    open={showDeleteModal}
                    onCancel={() => {
                        setShowDeleteModal(false);
                        setPlanToDelete(null);
                    }}
                    onConfirm={handleConfirmDelete}
                    title="Delete Plan"
                    message={`Are you sure you want to delete the plan "${planToDelete.plan_name}"? This action cannot be undone.`}
                    itemName={planToDelete.plan_name}
                />
            )}
        </div>
    );
}