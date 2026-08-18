'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Edit2, Trash2, X, Loader2, RefreshCw, Store, AlertCircle, Lock, ChevronRight,
  CloudUpload,
} from 'lucide-react';
import {
  fetchRestaurants,
  fetchRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  type ApiRestaurant,
  uploadRestaurantLogo,
  uploadRestaurantBanner,
} from '@/lib/admin-api';
import { fetchMyTenant, planUsage, isAtPlanLimit, type ApiTenant } from '@/lib/auth-api';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import Image from 'next/image';
import { getTheme } from '@/lib/theme';

// ── Brand Color ──
const BRAND = '#ff5723';

// ── Theme-based colors (matching checkout page) ──
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
  focusRing: isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.15)',
  green: isDark ? '#4ade80' : '#16a34a',
  placeholder: isDark ? '#6B7280' : '#888888',
});

// ── Accent colors ──
const getAccents = (isDark: boolean) => ({
  orange: {
    bg: isDark ? 'rgba(255,87,35,0.15)' : '#FFF3E0',
    border: isDark ? 'rgba(255,87,35,0.3)' : '#FED7AA',
  },
  amber: {
    bg: isDark ? 'rgba(217,119,6,0.15)' : '#FFF7E6',
    border: isDark ? 'rgba(217,119,6,0.35)' : '#FFE0A3',
    text: isDark ? '#fbbf24' : '#92400e',
  },
});

type Toast = { msg: string; kind: 'ok' | 'err' } | null;

export default function RestaurantsView() {
  const [rows, setRows] = useState<ApiRestaurant[]>([]);
  const [tenant, setTenant] = useState<ApiTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast>(null);
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiRestaurant }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    restaurant?: ApiRestaurant;
  }>({ open: false });
  const [isDark, setIsDark] = useState(false);

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

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rs, t] = await Promise.all([
        fetchRestaurants(),
        fetchMyTenant().catch(() => null),
      ]);
      setRows(rs);
      setTenant(t);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load restaurants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const atLimit = tenant ? isAtPlanLimit(tenant) : false;

  async function onDelete(r: ApiRestaurant) {
    setDeleteModal({ open: true, restaurant: r });
  }

  async function confirmDelete() {
    const restaurant = deleteModal.restaurant;
    if (!restaurant?.restaurantId) {
      showToast('Restaurant ID is missing.', 'err');
      return;
    }
    try {
      await deleteRestaurant(restaurant.restaurantId);
      showToast('Restaurant deleted');
      setDeleteModal({ open: false });
      await load();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not delete restaurant', 'err');
    }
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: 1000,
      margin: '0 auto',
      fontFamily: "'Poppins', sans-serif",
      background: colors.bg,
      minHeight: '100vh',
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder,
        input::-webkit-input-placeholder,
        input::-moz-placeholder {
          color: ${colors.placeholder} !important;
          opacity: 0.8;
        }
        input:focus {
          outline: none;
        }
        select:focus {
          outline: none;
        }
        select option:disabled {
          color: ${colors.placeholder};
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{
            fontSize: 'clamp(20px, 3vw, 24px)',
            fontWeight: 700,
            color: colors.text,
            margin: '0 0 4px',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Restaurants
          </h1>
          <p style={{
            color: colors.muted,
            fontSize: 14,
            margin: 0,
            fontFamily: "'Poppins', sans-serif",
          }}>
            {tenant
              ? <>Your branches — {planUsage(tenant)} on the {tenant.planTier} plan.</>
              : 'Your branches.'}
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={load}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              border: `1.5px solid ${colors.border}`,
              borderRadius: 10,
              background: colors.card,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              color: colors.text,
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              e.currentTarget.style.borderColor = BRAND;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = colors.border;
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.hoverBg;
              e.currentTarget.style.borderColor = BRAND;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.card;
              e.currentTarget.style.borderColor = colors.border;
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button
            onClick={() => atLimit ? showToast(
              `You have used all ${tenant?.maxRestaurants} restaurants on the ` +
              `${tenant?.planTier} plan. Contact support to upgrade.`, 'err'
            ) : setModal({ open: true })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              border: 'none',
              borderRadius: 10,
              background: atLimit ? colors.subtle : BRAND,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: atLimit ? 'not-allowed' : 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.2s ease',
              outline: 'none',
              opacity: atLimit ? 0.6 : 1,
            }}
            title={atLimit ? 'Plan limit reached' : 'Add a branch'}
            onFocus={(e) => {
              if (!atLimit) {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              if (!atLimit) {
                e.currentTarget.style.background = '#e64a1a';
              }
            }}
            onMouseLeave={(e) => {
              if (!atLimit) {
                e.currentTarget.style.background = BRAND;
              }
            }}
          >
            {atLimit ? <Lock size={15} /> : <Plus size={16} />} New Restaurant
          </button>
        </div>
      </div>

      {/* ── Plan Limit Warning ── */}
      {atLimit && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 10,
          marginBottom: 16,
          background: accents.amber.bg,
          border: `1px solid ${accents.amber.border}`,
          color: accents.amber.text,
          fontSize: 13,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <strong>Plan limit reached.</strong> You are using {tenant!.restaurantCount} of{' '}
          {tenant!.maxRestaurants} restaurants. Upgrade to add more branches.
        </div>
      )}

      {/* ── Loading State ── */}
      {loading && (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          color: colors.muted,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      )}

      {/* ── Error State ── */}
      {!loading && error && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: BRAND,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && rows.length === 0 && (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          color: colors.subtle,
          fontFamily: "'Poppins', sans-serif",
        }}>
          <Store size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No restaurants yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Add your first branch to start building its menu.
          </p>
        </div>
      )}

      {/* ── Restaurants Grid ── */}
      {!loading && !error && rows.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}>
          {rows.map(r => (
            <div key={r.restaurantId} style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              padding: 16,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: colors.text,
                    fontFamily: "'Poppins', sans-serif",
                  }}>{r.name}</div>
                  <div style={{
                    fontSize: 13,
                    color: colors.muted,
                    marginTop: 2,
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    {r.address?.city || '—'}{r.address?.country ? `, ${r.address.country}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: r.isActive ? colors.green : colors.subtle,
                  whiteSpace: 'nowrap',
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  {r.isActive ? '● open' : '● closed'}
                </span>
              </div>

              <div style={{
                fontSize: 12,
                color: colors.subtle,
                marginTop: 10,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {r.currencyCode} · {r.timezone}
              </div>

              <Link href={`/restaurants/${r.restaurantId}/menu`} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12,
                padding: '9px 12px',
                borderRadius: 9,
                background: accents.orange.bg,
                color: BRAND,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}>
                Manage menu, tables &amp; QR <ChevronRight size={15} />
              </Link>

              <div style={{
                display: 'flex',
                gap: 6,
                marginTop: 8,
              }}>
                <button
                  onClick={async () => {
                    try {
                      const fullRestaurant = await fetchRestaurant(r.restaurantId);
                      setModal({ open: true, edit: fullRestaurant });
                    } catch (e: any) {
                      showToast(e?.message ?? 'Could not load restaurant details', 'err');
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    padding: '7px 10px',
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 8,
                    background: colors.card,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: colors.text,
                    fontFamily: "'Poppins', sans-serif",
                    flex: 1,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                    e.currentTarget.style.borderColor = BRAND;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.hoverBg;
                    e.currentTarget.style.borderColor = BRAND;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.card;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <Edit2 size={14} />
                  Edit details
                </button>
                <button
                  onClick={() => onDelete(r)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    padding: '7px 10px',
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 8,
                    background: colors.card,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: BRAND,
                    fontFamily: "'Poppins', sans-serif",
                    transition: 'all 0.2s ease',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                    e.currentTarget.style.borderColor = BRAND;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.hoverBg;
                    e.currentTarget.style.borderColor = BRAND;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.card;
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Restaurant Modal ── */}
      {modal.open && (
        <RestaurantModal
          edit={modal.edit}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
          showToast={showToast}
          colors={colors}
          accents={accents}
          isDark={isDark}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          padding: '12px 18px',
          borderRadius: 10,
          background: toast.kind === 'ok' ? colors.green : BRAND,
          color: '#fff',
          fontWeight: 600,
          fontSize: 14,
          maxWidth: 420,
          zIndex: 100,
          fontFamily: "'Poppins', sans-serif",
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete Restaurant"
        message="Its menu, tables and QR codes will also be affected. This action cannot be undone."
        itemName={deleteModal.restaurant?.name}
        onCancel={() => setDeleteModal({ open: false })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ── Restaurant Modal ──

function RestaurantModal({
  edit,
  onClose,
  onSaved,
  showToast,
  colors,
  accents,
  isDark,
}: {
  edit?: ApiRestaurant;
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string, k?: 'ok' | 'err') => void;
  colors: ReturnType<typeof getColors>;
  accents: ReturnType<typeof getAccents>;
  isDark: boolean;
}) {
  const [f, setF] = useState({
    name: edit?.name ?? '',
    street: edit?.address?.street ?? '',
    city: edit?.address?.city ?? '',
    country: edit?.address?.country ?? 'Pakistan',
    postcode: edit?.address?.postcode ?? '',
    timezone: edit?.timezone ?? 'Asia/Karachi',
    currencyCode: edit?.currencyCode ?? 'PKR',
    isActive: edit?.isActive ?? true,
    tagline: edit?.tagline ?? '',
    openingHours: edit?.openingHours ?? '',
    deliveryNote: edit?.deliveryNote ?? '',
    cuisineTags: edit?.cuisineTags?.join(', ') ?? '',
    socialX: edit?.socialMedia?.x ?? '',
    socialInstagram: edit?.socialMedia?.instagram ?? '',
    socialFacebook: edit?.socialMedia?.facebook ?? '',
    socialYoutube: edit?.socialMedia?.youtube ?? '',
    socialLinkedin: edit?.socialMedia?.linkedin ?? '',
    socialTiktok: edit?.socialMedia?.tiktok ?? '',
    logoKey: edit?.logoKey ?? '',
    bannerKey: edit?.bannerKey ?? '',
    ratingValue: edit?.ratingValue ?? '',
    ratingCount: edit?.ratingCount ?? '',
  });

  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(edit?.logoUrl ?? '');
  const [bannerPreview, setBannerPreview] = useState<string>(edit?.bannerUrl ?? '');

  const passwordPlaceholderColor = isDark ? '#6B7280' : '#AAAAAA';

  async function save() {
    setSaving(true);
    const payload = {
      name: f.name,
      logoKey: f.logoKey || null,
      bannerKey: f.bannerKey || null,
      ratingValue: f.ratingValue ? Number(f.ratingValue) : null,
      ratingCount: f.ratingCount ? Number(f.ratingCount) : null,
      address: {
        street: f.street,
        city: f.city,
        country: f.country,
        postcode: f.postcode,
      },
      timezone: f.timezone,
      currencyCode: f.currencyCode,
      isActive: f.isActive,
      tagline: f.tagline,
      openingHours: f.openingHours,
      deliveryNote: f.deliveryNote,
      cuisineTags: f.cuisineTags.split(',').map(x => x.trim()).filter(Boolean),
      socialMedia: {
        x: f.socialX || null,
        instagram: f.socialInstagram || null,
        facebook: f.socialFacebook || null,
        youtube: f.socialYoutube || null,
        linkedin: f.socialLinkedin || null,
        tiktok: f.socialTiktok || null,
      },
    };

    try {
      if (edit) {
        let updatedPayload: any = { ...payload };
        if (logoFile) {
          const uploadedLogo = await uploadRestaurantLogo(logoFile, edit.restaurantId);
          updatedPayload.logoKey = uploadedLogo.s3Key;
        }
        if (bannerFile) {
          const uploadedBanner = await uploadRestaurantBanner(bannerFile, edit.restaurantId);
          updatedPayload.bannerKey = uploadedBanner.s3Key;
        }
        await updateRestaurant(edit.restaurantId, updatedPayload);
        showToast('Restaurant updated');
      } else {
        const created = await createRestaurant(payload as any);
        let logoKey: string | null = null;
        let bannerKey: string | null = null;
        if (logoFile) {
          const uploadedLogo = await uploadRestaurantLogo(logoFile, created.restaurantId);
          logoKey = uploadedLogo.s3Key;
        }
        if (bannerFile) {
          const uploadedBanner = await uploadRestaurantBanner(bannerFile, created.restaurantId);
          bannerKey = uploadedBanner.s3Key;
        }
        if (logoKey || bannerKey) {
          await updateRestaurant(created.restaurantId, {
            ...(logoKey ? { logoKey } : {}),
            ...(bannerKey ? { bannerKey } : {}),
          });
        }
        showToast('Restaurant created');
      }
      onSaved();
    } catch (e: any) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  const canSave = f.name.trim().length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.card,
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 470,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: `1px solid ${colors.border}`,
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: colors.text,
            fontFamily: "'Poppins', sans-serif",
          }}>
            {edit ? 'Edit Restaurant' : 'New Restaurant'}
          </h3>
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              cursor: 'pointer',
              color: colors.muted,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.hoverBg;
              e.currentTarget.style.color = colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colors.muted;
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {/* ── Restaurant Name ── */}
          <div>
            <label style={labelStyle(colors)}>Restaurant Name</label>
            <input
              style={inputStyle(colors)}
              value={f.name}
              placeholder="Cheezious"
              onChange={e => set('name', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ── Street ── */}
          <div>
            <label style={labelStyle(colors)}>Street</label>
            <input
              style={inputStyle(colors)}
              value={f.street}
              placeholder="Street address"
              onChange={e => set('street', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ── City & Postcode ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle(colors)}>City</label>
              <input
                style={inputStyle(colors)}
                value={f.city}
                placeholder="Lahore"
                onChange={e => set('city', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            <div>
              <label style={labelStyle(colors)}>Postcode</label>
              <input
                style={inputStyle(colors)}
                value={f.postcode}
                placeholder="54000"
                onChange={e => set('postcode', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* ── Country & Currency ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle(colors)}>Country</label>
              <input
                style={inputStyle(colors)}
                value={f.country}
                placeholder="Pakistan"
                onChange={e => set('country', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            <div>
              <label style={labelStyle(colors)}>Currency</label>
              <input
                style={inputStyle(colors)}
                value={f.currencyCode}
                maxLength={3}
                placeholder="PKR"
                onChange={e => set('currencyCode', e.target.value.toUpperCase())}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* ── Timezone ── */}
          <div>
            <label style={labelStyle(colors)}>Timezone</label>
            <input
              style={inputStyle(colors)}
              value={f.timezone}
              placeholder="Asia/Karachi"
              onChange={e => set('timezone', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ── Tagline ── */}
          <div>
            <label style={labelStyle(colors)}>Tagline</label>
            <input
              style={inputStyle(colors)}
              value={f.tagline}
              placeholder="Fine Dining Experience"
              onChange={e => set('tagline', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ── Opening Hours ── */}
          <div>
            <label style={labelStyle(colors)}>Opening Hours</label>
            <input
              style={inputStyle(colors)}
              value={f.openingHours}
              placeholder="10:00AM - 11:00PM"
              onChange={e => set('openingHours', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ── Delivery Note ── */}
          <div>
            <label style={labelStyle(colors)}>Delivery Note</label>
            <input
              style={inputStyle(colors)}
              value={f.deliveryNote}
              placeholder="Free Delivery"
              onChange={e => set('deliveryNote', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ── Logo Upload ── */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(colors)}>Restaurant Logo</label>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 20,
                borderRadius: 16,
                border: `2px dashed ${logoFile ? accents.orange.border : colors.border}`,
                background: logoFile ? accents.orange.bg : colors.bg,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }
                }}
              />
              <CloudUpload size={24} color={logoFile ? BRAND : colors.subtle} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: logoFile ? BRAND : colors.subtle,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {logoFile ? `✓ ${logoFile.name}` : 'Click to upload logo · PNG, JPG'}
              </span>
            </label>
            {logoPreview && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                <Image
                  src={logoPreview}
                  alt="restaurant logo"
                  width={90}
                  height={90}
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Banner Upload ── */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(colors)}>Restaurant Banner</label>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 20,
                borderRadius: 16,
                border: `2px dashed ${bannerFile ? accents.orange.border : colors.border}`,
                background: bannerFile ? accents.orange.bg : colors.bg,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setBannerFile(file);
                    setBannerPreview(URL.createObjectURL(file));
                  }
                }}
              />
              <CloudUpload size={24} color={bannerFile ? BRAND : colors.subtle} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: bannerFile ? BRAND : colors.subtle,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {bannerFile ? `✓ ${bannerFile.name}` : 'Click to upload banner · PNG, JPG'}
              </span>
            </label>
            {bannerPreview && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                <Image
                  src={bannerPreview}
                  alt="restaurant banner"
                  width={470}
                  height={120}
                  style={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Rating & Rating Count ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle(colors)}>Rating</label>
              <input
                style={inputStyle(colors)}
                type="number"
                value={f.ratingValue}
                placeholder="4.8"
                onChange={e => set('ratingValue', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
            <div>
              <label style={labelStyle(colors)}>Rating Count</label>
              <input
                style={inputStyle(colors)}
                type="number"
                value={f.ratingCount}
                placeholder="100"
                onChange={e => set('ratingCount', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* ── Cuisine Tags ── */}
          <div>
            <label style={labelStyle(colors)}>Cuisine Tags</label>
            <input
              style={inputStyle(colors)}
              value={f.cuisineTags}
              placeholder="Fast Food, Pizza, BBQ"
              onChange={e => set('cuisineTags', e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = BRAND;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ── Social Media ── */}
          <div style={{
            marginTop: 8,
            paddingTop: 14,
            borderTop: `1px solid ${colors.border}`,
          }}>
            <h4 style={{
              margin: '0 0 12px',
              fontSize: 15,
              fontWeight: 700,
              color: colors.text,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Social Media
            </h4>

            <div>
              <label style={labelStyle(colors)}>X / Twitter</label>
              <input
                style={inputStyle(colors)}
                value={f.socialX}
                placeholder="https://x.com/kfc_pk"
                onChange={e => set('socialX', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={labelStyle(colors)}>Instagram</label>
              <input
                style={inputStyle(colors)}
                value={f.socialInstagram}
                placeholder="https://instagram.com/kfcpakistanofficial"
                onChange={e => set('socialInstagram', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={labelStyle(colors)}>Facebook</label>
              <input
                style={inputStyle(colors)}
                value={f.socialFacebook}
                placeholder="https://facebook.com/KFCPakistan"
                onChange={e => set('socialFacebook', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={labelStyle(colors)}>Youtube</label>
              <input
                style={inputStyle(colors)}
                value={f.socialYoutube}
                placeholder="https://youtube.com/@kfcpakistan6047"
                onChange={e => set('socialYoutube', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={labelStyle(colors)}>LinkedIn</label>
              <input
                style={inputStyle(colors)}
                value={f.socialLinkedin}
                placeholder="https://linkedin.com/company/kfcpakistan"
                onChange={e => set('socialLinkedin', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={labelStyle(colors)}>TikTok</label>
              <input
                style={inputStyle(colors)}
                value={f.socialTiktok}
                placeholder="https://tiktok.com/@kfcpakistanofficial"
                onChange={e => set('socialTiktok', e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = BRAND;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* ── Active Checkbox ── */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            color: colors.text,
            fontFamily: "'Poppins', sans-serif",
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={e => set('isActive', e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: BRAND,
                cursor: 'pointer',
              }}
            />
            Open for orders
          </label>

          {/* ── Submit Button ── */}
          <button
            onClick={save}
            disabled={saving || !canSave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              border: 'none',
              borderRadius: 10,
              background: BRAND,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: saving || !canSave ? 'not-allowed' : 'pointer',
              fontFamily: "'Poppins', sans-serif",
              opacity: saving || !canSave ? 0.6 : 1,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (!saving && canSave) {
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.focusRing}`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseEnter={(e) => {
              if (!saving && canSave) {
                e.currentTarget.style.background = '#e64a1a';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving && canSave) {
                e.currentTarget.style.background = BRAND;
              }
            }}
          >
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {edit ? 'Save Changes' : 'Create Restaurant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper Styles ──

const inputStyle = (colors: ReturnType<typeof getColors>): React.CSSProperties => ({
  width: '100%',
  padding: '9px 12px',
  border: `1.5px solid ${colors.border}`,
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "'Poppins', sans-serif",
  boxSizing: 'border-box',
  color: colors.text,
  background: colors.bg,
  transition: 'all 0.2s ease',
  outline: 'none',
});

const labelStyle = (colors: ReturnType<typeof getColors>): React.CSSProperties => ({
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: colors.muted,
  marginBottom: 5,
  fontFamily: "'Poppins', sans-serif",
});