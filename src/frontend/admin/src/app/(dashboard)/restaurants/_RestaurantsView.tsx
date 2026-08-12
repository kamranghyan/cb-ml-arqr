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
import { useTheme } from '@/hooks/useTheme';

const BRAND = '#ff5723';
const GREEN = '#16a34a';

// Shared by the view and the modal — each calls useTheme() independently
// (cheap, just a state read) rather than the modal closing over the
// parent's values, so it stays a stable top-level component and doesn't
// lose its form state if the parent re-renders while it's open.
function useD() {
  const { isDark } = useTheme();
  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF', subtle: '#6B7280',
  } : {
    bg: '#FFFFFF', card: '#fff', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B', subtle: '#9CA3AF',
  };
  const ORANGE_TINT = isDark ? { bg: 'rgba(255,87,35,0.15)', border: 'rgba(255,87,35,0.3)' } : { bg: '#FFF3E0', border: '#FED7AA' };
  const AMBER = isDark ? { bg: 'rgba(217,119,6,0.15)', border: 'rgba(217,119,6,0.35)', text: '#fbbf24' } : { bg: '#FFF7E6', border: '#FFE0A3', text: '#92400e' };
  return { isDark, D, ORANGE_TINT, AMBER };
}

type Toast = { msg: string; kind: 'ok' | 'err' } | null;

export default function RestaurantsView() {
  const { D, ORANGE_TINT, AMBER } = useD();

  const [rows, setRows] = useState<ApiRestaurant[]>([]);
  const [tenant, setTenant] = useState<ApiTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast>(null);
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiRestaurant }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    restaurant?: ApiRestaurant;
  }>({
    open: false,
  });
  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
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
    setDeleteModal({
      open: true,
      restaurant: r,
    });
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

      setDeleteModal({
        open: false,
      });

      await load();
    } catch (e: any) {
      showToast(
        e?.message ?? 'Could not delete restaurant',
        'err'
      );
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: D.text, margin: '0 0 4px', fontFamily: "'Baloo 2', sans-serif" }}>
            Restaurants
          </h1>
          <p style={{ color: D.muted, fontSize: 14, margin: 0 }}>
            {tenant
              ? <>Your branches — {planUsage(tenant)} on the {tenant.planTier} plan.</>
              : 'Your branches.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnGhost(D)}><RefreshCw size={14} /> Refresh</button>
          <button
            onClick={() => atLimit ? showToast(
              `You have used all ${tenant?.maxRestaurants} restaurants on the ` +
              `${tenant?.planTier} plan. Contact support to upgrade.`, 'err'
            ) : setModal({ open: true })}
            style={{ ...btn(atLimit ? D.subtle : BRAND), cursor: atLimit ? 'not-allowed' : 'pointer' }}
            title={atLimit ? 'Plan limit reached' : 'Add a branch'}
          >
            {atLimit ? <Lock size={15} /> : <Plus size={16} />} New Restaurant
          </button>
        </div>
      </div>

      {atLimit && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 16,
          background: AMBER.bg, border: `1px solid ${AMBER.border}`,
          color: AMBER.text, fontSize: 13,
        }}>
          <strong>Plan limit reached.</strong> You are using {tenant!.restaurantCount} of{' '}
          {tenant!.maxRestaurants} restaurants. Upgrade to add more branches.
        </div>
      )}

      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: D.muted }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 40, textAlign: 'center', color: BRAND }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: D.subtle }}>
          <Store size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No restaurants yet.</p>
          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
            Add your first branch to start building its menu.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {rows.map(r => (
            <div key={r.restaurantId} style={{
              background: D.card, border: `1px solid ${D.border}`,
              borderRadius: 14, padding: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: D.text, fontFamily: "'Baloo 2', sans-serif" }}>{r.name}</div>
                  <div style={{ fontSize: 13, color: D.muted, marginTop: 2 }}>
                    {r.address?.city || '—'}{r.address?.country ? `, ${r.address.country}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: r.isActive ? GREEN : D.subtle, whiteSpace: 'nowrap',
                }}>
                  {r.isActive ? '● open' : '● closed'}
                </span>
              </div>

              <div style={{ fontSize: 12, color: D.subtle, marginTop: 10 }}>
                {r.currencyCode} · {r.timezone}
              </div>

              <Link href={`/restaurants/${r.restaurantId}/menu`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 12, padding: '9px 12px', borderRadius: 9,
                background: ORANGE_TINT.bg, color: BRAND, textDecoration: 'none',
                fontSize: 13, fontWeight: 700,
              }}>
                Manage menu, tables &amp; QR <ChevronRight size={15} />
              </Link>

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={async () => {
                    try {
                      const fullRestaurant = await fetchRestaurant(r.restaurantId);

                      setModal({
                        open: true,
                        edit: fullRestaurant,
                      });
                    } catch (e: any) {
                      showToast(
                        e?.message ?? 'Could not load restaurant details',
                        'err'
                      );
                    }
                  }}
                  style={{ ...iconBtn(D), flex: 1 }}
                >
                  <Edit2 size={14} />
                  Edit details
                </button>
                <button
                  onClick={() => onDelete(r)}
                  style={{ ...iconBtn(D), color: BRAND }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <RestaurantModal
          edit={modal.edit}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }}
          showToast={showToast}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 18px', borderRadius: 10,
          background: toast.kind === 'ok' ? GREEN : BRAND, color: '#fff',
          fontWeight: 600, fontSize: 14, maxWidth: 420,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 100,
        }}>
          {toast.msg}
        </div>
      )}
      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete Restaurant"
        message="Its menu, tables and QR codes will also be affected. This action cannot be undone."
        itemName={deleteModal.restaurant?.name}
        onCancel={() =>
          setDeleteModal({
            open: false,
          })
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ── Modal — top-level sibling, not nested, so it stays a stable component
// identity across the parent's re-renders ──────────────────────────────

function RestaurantModal({ edit, onClose, onSaved, showToast }: {
  edit?: ApiRestaurant;
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string, k?: 'ok' | 'err') => void;
}) {
  const { D, ORANGE_TINT } = useD();

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
  const [logoPreview, setLogoPreview] = useState<string>(
    edit?.logoUrl ?? ''
  );

  const [bannerPreview, setBannerPreview] = useState<string>(
    edit?.bannerUrl ?? ''
  );

  async function save() {
    setSaving(true);
    const payload = {
      name: f.name,

      logoKey: f.logoKey || null,
      bannerKey: f.bannerKey || null,

      ratingValue: f.ratingValue
        ? Number(f.ratingValue)
        : null,

      ratingCount: f.ratingCount
        ? Number(f.ratingCount)
        : null,

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

      cuisineTags: f.cuisineTags
        .split(',')
        .map(x => x.trim())
        .filter(Boolean),

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
          const uploadedLogo = await uploadRestaurantLogo(
            logoFile,
            edit.restaurantId
          );

          updatedPayload.logoKey = uploadedLogo.s3Key;
        }

        if (bannerFile) {
          const uploadedBanner = await uploadRestaurantBanner(
            bannerFile,
            edit.restaurantId
          );

          updatedPayload.bannerKey = uploadedBanner.s3Key;
        }

        await updateRestaurant(
          edit.restaurantId,
          updatedPayload
        );

        showToast('Restaurant updated');
      } else {
        const created = await createRestaurant(payload as any);

        let logoKey: string | null = null;
        let bannerKey: string | null = null;

        if (logoFile) {
          const uploadedLogo = await uploadRestaurantLogo(
            logoFile,
            created.restaurantId
          );

          logoKey = uploadedLogo.s3Key;
        }

        if (bannerFile) {
          const uploadedBanner = await uploadRestaurantBanner(
            bannerFile,

            created.restaurantId
          );

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

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: D.card, borderRadius: 14, padding: 24, width: '100%',
        maxWidth: 470, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: D.text, fontFamily: "'Baloo 2', sans-serif" }}>
            {edit ? 'Edit Restaurant' : 'New Restaurant'}
          </h3>
          <button onClick={onClose} style={{ ...iconBtn(D), border: 'none' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle(D)}>Restaurant Name</label>
            <input style={inputStyle(D)} value={f.name} placeholder="Cheezious"
              onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle(D)}>Street</label>
            <input style={inputStyle(D)} value={f.street} onChange={e => set('street', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle(D)}>City</label>
              <input style={inputStyle(D)} value={f.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle(D)}>Postcode</label>
              <input style={inputStyle(D)} value={f.postcode} onChange={e => set('postcode', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle(D)}>Country</label>
              <input style={inputStyle(D)} value={f.country} onChange={e => set('country', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle(D)}>Currency</label>
              <input style={inputStyle(D)} value={f.currencyCode} maxLength={3}
                onChange={e => set('currencyCode', e.target.value.toUpperCase())} />
            </div>
          </div>
          <div>
            <label style={labelStyle(D)}>Timezone</label>
            <input style={inputStyle(D)} value={f.timezone} onChange={e => set('timezone', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle(D)}>Tagline</label>
            <input
              style={inputStyle(D)}
              value={f.tagline}
              placeholder="Fine Dining Experience"
              onChange={e => set('tagline', e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle(D)}>Opening Hours</label>
            <input
              style={inputStyle(D)}
              value={f.openingHours}
              placeholder="10:00AM - 11:00PM"
              onChange={e => set('openingHours', e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle(D)}>Delivery Note</label>
            <input
              style={inputStyle(D)}
              value={f.deliveryNote}
              placeholder="Free Delivery"
              onChange={e => set('deliveryNote', e.target.value)}
            />
          </div>

          {/* Restaurant Logo */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(D)}>
              Restaurant Logo
            </label>

            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 20,
                borderRadius: 16,
                border: `2px dashed ${logoFile ? ORANGE_TINT.border : D.border}`,
                background: logoFile ? ORANGE_TINT.bg : D.bg,
                cursor: 'pointer',
                transition: 'all 0.2s',
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

              <CloudUpload
                size={24}
                color={logoFile ? BRAND : D.subtle}
              />

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: logoFile ? BRAND : D.subtle,
                }}
              >
                {logoFile
                  ? `✓ ${logoFile.name}`
                  : 'Click to upload logo · PNG, JPG'}
              </span>
            </label>

            {logoPreview && (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
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
                    border: `1px solid ${D.border}`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Restaurant Banner */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle(D)}>
              Restaurant Banner
            </label>

            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 20,
                borderRadius: 16,
                border: `2px dashed ${bannerFile ? ORANGE_TINT.border : D.border}`,
                background: bannerFile ? ORANGE_TINT.bg : D.bg,
                cursor: 'pointer',
                transition: 'all 0.2s',
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

              <CloudUpload
                size={24}
                color={bannerFile ? BRAND : D.subtle}
              />

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: bannerFile ? BRAND : D.subtle,
                }}
              >
                {bannerFile
                  ? `✓ ${bannerFile.name}`
                  : 'Click to upload banner · PNG, JPG'}
              </span>
            </label>

            {bannerPreview && (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
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
                    border: `1px solid ${D.border}`,
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle(D)}>Rating</label>
              <input
                style={inputStyle(D)}
                type="number"
                value={f.ratingValue}
                placeholder="4.8"
                onChange={e => set('ratingValue', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle(D)}>Rating Count</label>
              <input
                style={inputStyle(D)}
                type="number"
                value={f.ratingCount}
                placeholder="100"
                onChange={e => set('ratingCount', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle(D)}>Cuisine Tags</label>
            <input
              style={inputStyle(D)}
              value={f.cuisineTags}
              placeholder="Fast Food, Pizza, BBQ"
              onChange={e => set('cuisineTags', e.target.value)}
            />
          </div>
          <div style={{
            marginTop: 8,
            paddingTop: 14,
            borderTop: `1px solid ${D.border}`
          }}>
            <h4 style={{
              margin: '0 0 12px',
              fontSize: 15,
              fontWeight: 700,
              color: D.text,
              fontFamily: "'Baloo 2', sans-serif",
            }}>
              Social Media
            </h4>

            <div>
              <label style={labelStyle(D)}>X / Twitter</label>
              <input
                style={inputStyle(D)}
                value={f.socialX}
                placeholder="https://x.com/kfc_pk"
                onChange={e => set('socialX', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle(D)}>Instagram</label>
              <input
                style={inputStyle(D)}
                value={f.socialInstagram}
                placeholder="https://instagram.com/kfcpakistanofficial"
                onChange={e => set('socialInstagram', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle(D)}>Facebook</label>
              <input
                style={inputStyle(D)}
                value={f.socialFacebook}
                placeholder="https://facebook.com/KFCPakistan"
                onChange={e => set('socialFacebook', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle(D)}>Youtube</label>
              <input
                style={inputStyle(D)}
                value={f.socialYoutube}
                placeholder="https://youtube.com/@kfcpakistan6047"
                onChange={e => set('socialYoutube', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle(D)}>LinkedIn</label>
              <input
                style={inputStyle(D)}
                value={f.socialLinkedin}
                placeholder="https://linkedin.com/company/kfcpakistan"
                onChange={e => set('socialLinkedin', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle(D)}>TikTok</label>
              <input
                style={inputStyle(D)}
                value={f.socialTiktok}
                placeholder="https://tiktok.com/@kfcpakistanofficial"
                onChange={e => set('socialTiktok', e.target.value)}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: D.text }}>
            <input type="checkbox" checked={f.isActive}
              onChange={e => set('isActive', e.target.checked)} /> Open for orders
          </label>

          <button onClick={save} disabled={saving || !f.name.trim()}
            style={{
              ...btn(BRAND), justifyContent: 'center',
              opacity: saving || !f.name.trim() ? 0.6 : 1
            }}>
            {saving && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {edit ? 'Save Changes' : 'Create Restaurant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bits — take D as a parameter, so both components share one definition
// instead of each redeclaring their own copy ────────────────────────────

type DShape = ReturnType<typeof useD>['D'];

const btn = (bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: 'none', borderRadius: 8, background: bg, color: '#fff',
  fontWeight: 700, fontSize: 13, cursor: 'pointer',
});

const btnGhost = (D: DShape): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  border: `1px solid ${D.border}`, borderRadius: 8, background: D.card,
  fontWeight: 600, fontSize: 13, cursor: 'pointer', color: D.text,
});

const iconBtn = (D: DShape): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '7px 10px', border: `1px solid ${D.border}`, borderRadius: 8,
  background: D.card, cursor: 'pointer', fontSize: 13, color: D.text,
});

const inputStyle = (D: DShape): React.CSSProperties => ({
  width: '100%', padding: '9px 11px', border: `1px solid ${D.border}`, borderRadius: 8,
  fontSize: 14, boxSizing: 'border-box', color: D.text, background: D.bg,
});

const labelStyle = (D: DShape): React.CSSProperties => ({
  display: 'block', fontSize: 12, fontWeight: 700, color: D.muted, marginBottom: 5,
});