'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, Loader2, RefreshCw, Store, Tags, Grid3x3,
} from 'lucide-react';
import {
  fetchRestaurants, createRestaurant, updateRestaurant, deleteRestaurant,
  fetchCategories, createCategory, updateCategory, deleteCategory,
  fetchTables, createTable, updateTable, deleteTable,
  type ApiRestaurant, type ApiCategory, type ApiTable,
} from '@/lib/admin-api';
import { RESTAURANT_ID } from '@/lib/api-config';

const C = {
  red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1',
  white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF',
};

type Tab = 'restaurants' | 'categories' | 'tables';
type Toast = { msg: string; kind: 'ok' | 'err' } | null;

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('restaurants');
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
        Settings
      </h1>
      <p style={{ color: C.muted, fontSize: 14, margin: '0 0 20px' }}>
        Manage restaurants, menu categories and tables.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {([
          ['restaurants', 'Restaurants', Store],
          ['categories', 'Categories', Tags],
          ['tables', 'Tables', Grid3x3],
        ] as [Tab, string, any][]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
              fontWeight: 700, color: tab === key ? C.red : C.muted,
              borderBottom: tab === key ? `2px solid ${C.red}` : '2px solid transparent',
              marginBottom: -1,
            }}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'restaurants' && <RestaurantsTab showToast={showToast} />}
      {tab === 'categories'  && <CategoriesTab  showToast={showToast} />}
      {tab === 'tables'      && <TablesTab      showToast={showToast} />}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '12px 18px', borderRadius: 10,
          background: toast.kind === 'ok' ? '#0F9D58' : C.red, color: '#fff', fontWeight: 600,
          fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 100,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── shared bits ───────────────────────────────────────────────────────────────

const btn = (bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: 'none', borderRadius: 8, background: bg, color: '#fff', fontWeight: 700,
  fontSize: 13, cursor: 'pointer',
});
const iconBtn: React.CSSProperties = {
  padding: 6, border: `1px solid ${C.border}`, borderRadius: 6, background: '#fff',
  cursor: 'pointer', display: 'inline-flex',
};
const cell: React.CSSProperties = { padding: '10px 12px', fontSize: 14, color: C.text };
const th: React.CSSProperties = {
  padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1,
  textTransform: 'uppercase', color: C.subtle, textAlign: 'left',
};
const input: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 14, boxSizing: 'border-box',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 5,
};

function Loading() {
  return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
    <Loader2 className="spin" size={22} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 460,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ ...iconBtn, border: 'none' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Restaurants
// ══════════════════════════════════════════════════════════════════════════════

function RestaurantsTab({ showToast }: { showToast: (m: string, k?: 'ok' | 'err') => void }) {
  const [rows, setRows] = useState<ApiRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiRestaurant }>({ open: false });

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchRestaurants()); }
    catch (e: any) { showToast(e.message, 'err'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(r: ApiRestaurant) {
    if (!confirm(`Delete restaurant "${r.name}"?`)) return;
    try { await deleteRestaurant(r.restaurantId); showToast('Restaurant deleted'); load(); }
    catch (e: any) { showToast(e.message, 'err'); }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={load} style={{ ...iconBtn, gap: 6, display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={() => setModal({ open: true })} style={btn(C.red)}>
          <Plus size={16} /> New Restaurant
        </button>
      </div>

      {loading ? <Loading /> : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: C.bg }}>
              <tr><th style={th}>Name</th><th style={th}>City</th><th style={th}>Currency</th><th style={th}>Active</th><th style={th}></th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: C.subtle }}>No restaurants yet.</td></tr>}
              {rows.map(r => (
                <tr key={r.restaurantId} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={cell}>{r.name}</td>
                  <td style={cell}>{r.address?.city ?? '—'}</td>
                  <td style={cell}>{r.currencyCode}</td>
                  <td style={cell}>{r.isActive ? '✅' : '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setModal({ open: true, edit: r })} style={{ ...iconBtn, marginRight: 6 }}><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(r)} style={{ ...iconBtn, color: C.red }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <RestaurantModal edit={modal.edit} onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }} showToast={showToast} />
      )}
    </>
  );
}

function RestaurantModal({ edit, onClose, onSaved, showToast }: {
  edit?: ApiRestaurant; onClose: () => void; onSaved: () => void;
  showToast: (m: string, k?: 'ok' | 'err') => void;
}) {
  const [f, setF] = useState({
    name: edit?.name ?? '',
    street: edit?.address?.street ?? '', city: edit?.address?.city ?? '',
    country: edit?.address?.country ?? 'Pakistan', postcode: edit?.address?.postcode ?? '',
    timezone: edit?.timezone ?? 'Asia/Karachi', currencyCode: edit?.currencyCode ?? 'PKR',
    isActive: edit?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    const payload = {
      name: f.name,
      address: { street: f.street, city: f.city, country: f.country, postcode: f.postcode },
      timezone: f.timezone, currencyCode: f.currencyCode, isActive: f.isActive,
    };
    try {
      if (edit) { await updateRestaurant(edit.restaurantId, payload); showToast('Restaurant updated'); }
      else      { await createRestaurant(payload); showToast('Restaurant created'); }
      onSaved();
    } catch (e: any) { showToast(e.message, 'err'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={edit ? 'Edit Restaurant' : 'New Restaurant'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><label style={label}>Name</label><input style={input} value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label style={label}>Street</label><input style={input} value={f.street} onChange={e => set('street', e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={label}>City</label><input style={input} value={f.city} onChange={e => set('city', e.target.value)} /></div>
          <div><label style={label}>Postcode</label><input style={input} value={f.postcode} onChange={e => set('postcode', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={label}>Country</label><input style={input} value={f.country} onChange={e => set('country', e.target.value)} /></div>
          <div><label style={label}>Currency (ISO)</label><input style={input} value={f.currencyCode} onChange={e => set('currencyCode', e.target.value.toUpperCase())} maxLength={3} /></div>
        </div>
        <div><label style={label}>Timezone (IANA)</label><input style={input} value={f.timezone} onChange={e => set('timezone', e.target.value)} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.text }}>
          <input type="checkbox" checked={f.isActive} onChange={e => set('isActive', e.target.checked)} /> Active
        </label>
        <button onClick={save} disabled={saving || !f.name} style={{ ...btn(C.red), justifyContent: 'center', opacity: saving || !f.name ? 0.6 : 1 }}>
          {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null} {edit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Categories
// ══════════════════════════════════════════════════════════════════════════════

function CategoriesTab({ showToast }: { showToast: (m: string, k?: 'ok' | 'err') => void }) {
  const [rows, setRows] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiCategory }>({ open: false });

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchCategories()); }
    catch (e: any) { showToast(e.message, 'err'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(c: ApiCategory) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try { await deleteCategory(c.categoryId); showToast('Category deleted'); load(); }
    catch (e: any) { showToast(e.message, 'err'); }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={load} style={{ ...iconBtn, gap: 6, display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={() => setModal({ open: true })} style={btn(C.red)}>
          <Plus size={16} /> New Category
        </button>
      </div>

      {loading ? <Loading /> : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: C.bg }}>
              <tr><th style={th}>Name</th><th style={th}>Order</th><th style={th}>Active</th><th style={th}></th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', color: C.subtle }}>No categories yet.</td></tr>}
              {rows.sort((a, b) => a.displayOrder - b.displayOrder).map(c => (
                <tr key={c.categoryId} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={cell}>{c.name}</td>
                  <td style={cell}>{c.displayOrder}</td>
                  <td style={cell}>{c.isActive ? '✅' : '—'}</td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setModal({ open: true, edit: c })} style={{ ...iconBtn, marginRight: 6 }}><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(c)} style={{ ...iconBtn, color: C.red }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <CategoryModal edit={modal.edit} onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }} showToast={showToast} />
      )}
    </>
  );
}

function CategoryModal({ edit, onClose, onSaved, showToast }: {
  edit?: ApiCategory; onClose: () => void; onSaved: () => void;
  showToast: (m: string, k?: 'ok' | 'err') => void;
}) {
  const [f, setF] = useState({
    name: edit?.name ?? '', displayOrder: edit?.displayOrder ?? 0, isActive: edit?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      if (edit) { await updateCategory(edit.categoryId, f); showToast('Category updated'); }
      else      { await createCategory(f); showToast('Category created'); }
      onSaved();
    } catch (e: any) { showToast(e.message, 'err'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={edit ? 'Edit Category' : 'New Category'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><label style={label}>Name</label><input style={input} value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label style={label}>Display Order</label><input type="number" style={input} value={f.displayOrder} onChange={e => set('displayOrder', parseInt(e.target.value) || 0)} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.text }}>
          <input type="checkbox" checked={f.isActive} onChange={e => set('isActive', e.target.checked)} /> Active
        </label>
        <button onClick={save} disabled={saving || !f.name} style={{ ...btn(C.red), justifyContent: 'center', opacity: saving || !f.name ? 0.6 : 1 }}>
          {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null} {edit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tables
// ══════════════════════════════════════════════════════════════════════════════

function TablesTab({ showToast }: { showToast: (m: string, k?: 'ok' | 'err') => void }) {
  const [rows, setRows] = useState<ApiTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiTable }>({ open: false });

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchTables()); }
    catch (e: any) { showToast(e.message, 'err'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function onDelete(t: ApiTable) {
    if (!confirm(`Delete table "${t.tableNumber}"?`)) return;
    try { await deleteTable(t.tableId); showToast('Table deleted'); load(); }
    catch (e: any) { showToast(e.message, 'err'); }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={load} style={{ ...iconBtn, gap: 6, display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={() => setModal({ open: true })} style={btn(C.red)}>
          <Plus size={16} /> New Table
        </button>
      </div>

      {loading ? <Loading /> : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: C.bg }}>
              <tr><th style={th}>Table #</th><th style={th}>Zone</th><th style={th}>Outlet</th><th style={th}>Capacity</th><th style={th}></th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: C.subtle }}>No tables yet.</td></tr>}
              {rows.map(t => (
                <tr key={t.tableId} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={cell}>{t.tableNumber}</td>
                  <td style={cell}>{t.zone}</td>
                  <td style={cell}>{t.outlet}</td>
                  <td style={cell}>{t.capacity}</td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setModal({ open: true, edit: t })} style={{ ...iconBtn, marginRight: 6 }}><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(t)} style={{ ...iconBtn, color: C.red }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && (
        <TableModal edit={modal.edit} onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load(); }} showToast={showToast} />
      )}
    </>
  );
}

function TableModal({ edit, onClose, onSaved, showToast }: {
  edit?: ApiTable; onClose: () => void; onSaved: () => void;
  showToast: (m: string, k?: 'ok' | 'err') => void;
}) {
  const [f, setF] = useState({
    tableNumber: edit?.tableNumber ?? '', zone: edit?.zone ?? 'Main Hall',
    outlet: edit?.outlet ?? 'Main Hall', capacity: edit?.capacity ?? 4,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      if (edit) { await updateTable(edit.tableId, f); showToast('Table updated'); }
      else      { await createTable(f); showToast('Table created'); }
      onSaved();
    } catch (e: any) { showToast(e.message, 'err'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={edit ? 'Edit Table' : 'New Table'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><label style={label}>Table Number</label><input style={input} value={f.tableNumber} onChange={e => set('tableNumber', e.target.value)} placeholder="T1" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={label}>Zone</label><input style={input} value={f.zone} onChange={e => set('zone', e.target.value)} /></div>
          <div><label style={label}>Outlet</label><input style={input} value={f.outlet} onChange={e => set('outlet', e.target.value)} /></div>
        </div>
        <div><label style={label}>Capacity</label><input type="number" style={input} value={f.capacity} onChange={e => set('capacity', parseInt(e.target.value) || 1)} /></div>
        <button onClick={save} disabled={saving || !f.tableNumber} style={{ ...btn(C.red), justifyContent: 'center', opacity: saving || !f.tableNumber ? 0.6 : 1 }}>
          {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null} {edit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </Modal>
  );
}