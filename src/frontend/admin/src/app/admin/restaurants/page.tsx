// /app/admin/restaurants/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, Loader2, RefreshCw, Store,
} from 'lucide-react';
import {
  fetchRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  type ApiRestaurant,
} from '@/lib/admin-api';
import { useAuth } from '@/hooks/useAuth';

// MUI Imports (Only Table)
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Box,
  Typography,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  useMediaQuery,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const C = {
  red: '#E1251B',
  dark: '#891C1C',
  gold: '#FFC72C',
  bg: '#FFF8F1',
  white: '#fff',
  border: '#F0E8E0',
  text: '#1A1A1A',
  muted: '#687780',
  subtle: '#9CA3AF',
};

type Toast = { msg: string; kind: 'ok' | 'err' } | null;

// ✅ Styled MUI Table Components - Responsive with Horizontal Scroll
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  overflow: 'auto', // ✅ Auto scroll for horizontal
  width: '100%',
  maxWidth: '100%',
  // ✅ Custom scrollbar styling
  '&::-webkit-scrollbar': {
    height: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: C.bg,
    borderRadius: 4,
  },
  '&::-webkit-scrollbar-thumb': {
    background: C.border,
    borderRadius: 4,
    '&:hover': {
      background: C.muted,
    },
  },
  '& .MuiTable-root': {
    width: '100%',
    minWidth: 650, // ✅ Minimum width for table
    tableLayout: 'fixed',
  },
  '& .MuiTableHead-root': {
    backgroundColor: C.bg,
  },
  '& .MuiTableCell-head': {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.subtle,
    padding: '10px 12px',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap', // ✅ Prevent header text wrap
    '&:first-of-type': {
      width: '30%',
      paddingLeft: '16px',
    },
    '&:nth-of-type(2)': {
      width: '20%',
      textAlign: 'center',
    },
    '&:nth-of-type(3)': {
      width: '18%',
      textAlign: 'center',
    },
    '&:nth-of-type(4)': {
      width: '17%',
      textAlign: 'center',
    },
    '&:last-of-type': {
      width: '15%',
      textAlign: 'right',
      paddingRight: '16px',
    },
  },
  '& .MuiTableCell-body': {
    fontSize: 14,
    color: C.text,
    padding: '12px 12px',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap', // ✅ Prevent content wrap
    '&:first-of-type': {
      paddingLeft: '16px',
    },
    '&:nth-of-type(2)': {
      textAlign: 'center',
    },
    '&:nth-of-type(3)': {
      textAlign: 'center',
    },
    '&:nth-of-type(4)': {
      textAlign: 'center',
    },
    '&:last-of-type': {
      textAlign: 'right',
      paddingRight: '16px',
    },
  },
  '& .MuiTableRow-root': {
    '&:hover': {
      backgroundColor: '#FFF8F3',
    },
  },
}));

const StatusChip = styled(Chip)<{ status: boolean }>(({ status }) => ({
  backgroundColor: status ? '#E6F7E6' : '#F5F5F5',
  color: status ? '#0F9D58' : C.subtle,
  fontWeight: 600,
  fontSize: 12,
}));

export default function RestaurantsPage() {
  console.log('🔵 RestaurantsPage rendering...');
  
  const { user } = useAuth();
  const [rows, setRows] = useState<ApiRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiRestaurant }>({ open: false });

  // MUI Responsive
  const isMobile = useMediaQuery('(max-width:768px)');

  useEffect(() => {
    console.log('✅ Component mounted');
  }, []);

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    console.log('🔄 Loading restaurants...');
    setLoading(true);
    try {
      const data = await fetchRestaurants();
      console.log('✅ Restaurants loaded:', data);
      setRows(data);
    } catch (e: any) {
      console.error('❌ Load Error:', e);
      showToast(e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(r: ApiRestaurant) {
    if (!confirm(`Delete restaurant "${r.name}"?`)) return;
    try {
      await deleteRestaurant(r.restaurantId);
      showToast('Restaurant deleted successfully! 🗑️');
      load();
    } catch (e: any) {
      showToast(e.message, 'err');
    }
  }

  const handleSave = async (editData: ApiRestaurant | undefined, formData: any) => {
    const tenantId = user?.['custom:tenant_id'] || user?.tenantId || user?.tenant || '';

    if (!tenantId) {
      showToast('Tenant ID not found. Please login again.', 'err');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      address: {
        street: formData.street.trim() || '',
        city: formData.city.trim() || '',
        country: formData.country.trim() || 'Pakistan',
        postcode: formData.postcode.trim() || '',
      },
      timezone: formData.timezone || 'Asia/Karachi',
      currencyCode: formData.currencyCode.toUpperCase().trim(),
      isActive: formData.isActive,
      tenantId: tenantId,
    };

    try {
      if (editData) {
        await updateRestaurant(editData.restaurantId, payload);
        showToast('Restaurant updated successfully! ✅');
      } else {
        await createRestaurant(payload);
        showToast('Restaurant created successfully! ✅');
      }
      load();
      setModal({ open: false });
    } catch (e: any) {
      showToast(e.message || 'Failed to save restaurant', 'err');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress sx={{ color: C.red }} />
        <Typography sx={{ ml: 2, color: C.muted }}>Loading restaurants...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, mx: 'auto', width: '100%' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        mb: 1 
      }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: C.text }}>
          Restaurants Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => setModal({ open: true })}
          sx={{
            bgcolor: C.red,
            '&:hover': { bgcolor: C.dark },
            py: 1,
            px: 3,
            fontWeight: 700,
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          New Restaurant
        </Button>
      </Box>
      <Typography sx={{ color: C.muted, fontSize: 14, mb: 2 }}>
        Manage all restaurants in your system. Found {rows.length} restaurants.
      </Typography>

      {/* Refresh Button */}
      <Button
        startIcon={<RefreshCw size={14} />}
        onClick={load}
        sx={{
          mb: 2,
          color: C.muted,
          border: `1px solid ${C.border}`,
          borderRadius: 2,
          width: { xs: '100%', sm: 'auto' },
        }}
        variant="outlined"
      >
        Refresh
      </Button>

      {rows.length === 0 ? (
        <Box
          sx={{
            p: { xs: 4, sm: 6 },
            textAlign: 'center',
            border: `2px dashed ${C.border}`,
            borderRadius: 2,
            color: C.subtle,
          }}
        >
          <Store size={48} style={{ opacity: 0.4 }} />
          <Typography sx={{ mt: 2, fontSize: 16 }}>No restaurants yet.</Typography>
          <Typography sx={{ fontSize: 14 }}>
            Click "New Restaurant" to create your first restaurant.
          </Typography>
        </Box>
      ) : (
        // ── MUI Table with Horizontal Scroll ──────────────────────────────────
        <StyledTableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="center">City</TableCell>
                <TableCell align="center">Currency</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.restaurantId}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Store size={16} color={r.isActive ? C.red : C.subtle} />
                      <Typography sx={{ fontWeight: 600 }}>
                        {r.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">{r.address?.city ?? '—'}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={r.currencyCode}
                      size="small"
                      sx={{
                        bgcolor: C.border,
                        color: C.text,
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <StatusChip
                      label={r.isActive ? 'Active' : 'Inactive'}
                      status={r.isActive}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton
                      size="small"
                      onClick={() => setModal({ open: true, edit: r })}
                    >
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{ color: C.red }}
                      onClick={() => onDelete(r)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
      )}

      {/* ── OLD MODAL (Non-MUI) ──────────────────────────────────────────────── */}

      {modal.open && (
        <RestaurantModal
          edit={modal.edit}
          onClose={() => setModal({ open: false })}
          onSave={handleSave}
          showToast={showToast}
          user={user}
          isMobile={isMobile}
        />
      )}

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        sx={{ bottom: { xs: 16, sm: 24 } }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.kind === 'ok' ? 'success' : 'error'}
          sx={{ width: '100%' }}
        >
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ── OLD RESTAURANT MODAL (Non-MUI) ──────────────────────────────────────────

function RestaurantModal({
  edit,
  onClose,
  onSave,
  showToast,
  user,
  isMobile,
}: {
  edit?: ApiRestaurant;
  onClose: () => void;
  onSave: (edit: ApiRestaurant | undefined, data: any) => Promise<void>;
  showToast: (m: string, k?: 'ok' | 'err') => void;
  user: any;
  isMobile?: boolean;
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
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!f.name.trim()) {
      alert('Restaurant name is required!');
      return;
    }
    if (!f.currencyCode.trim() || f.currencyCode.length !== 3) {
      alert('Currency code must be 3 characters (e.g., PKR, USD)');
      return;
    }

    setSaving(true);
    try {
      await onSave(edit, f);
      onClose();
    } catch (e) {
      // handled in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: isMobile ? 12 : 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: isMobile ? 20 : 24,
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <h3 style={{ margin: 0, fontSize: isMobile ? 17 : 18, fontWeight: 800, color: C.text }}>
            {edit ? 'Edit Restaurant' : 'New Restaurant'}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: 6,
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Restaurant Name *</label>
            <input
              style={inputStyle}
              value={f.name}
              onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., KFC"
            />
          </div>
          <div>
            <label style={labelStyle}>Street Address</label>
            <input
              style={inputStyle}
              value={f.street}
              onChange={(e) => setF((p) => ({ ...p, street: e.target.value }))}
              placeholder="108 Lane 6, Bahria Town"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>City</label>
              <input
                style={inputStyle}
                value={f.city}
                onChange={(e) => setF((p) => ({ ...p, city: e.target.value }))}
                placeholder="Islamabad"
              />
            </div>
            <div>
              <label style={labelStyle}>Postcode</label>
              <input
                style={inputStyle}
                value={f.postcode}
                onChange={(e) => setF((p) => ({ ...p, postcode: e.target.value }))}
                placeholder="5400"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Country</label>
              <input
                style={inputStyle}
                value={f.country}
                onChange={(e) => setF((p) => ({ ...p, country: e.target.value }))}
                placeholder="Pakistan"
              />
            </div>
            <div>
              <label style={labelStyle}>Currency (ISO) *</label>
              <input
                style={inputStyle}
                value={f.currencyCode}
                onChange={(e) => setF((p) => ({ ...p, currencyCode: e.target.value.toUpperCase() }))}
                maxLength={3}
                placeholder="PKR"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Timezone (IANA)</label>
            <input
              style={inputStyle}
              value={f.timezone}
              onChange={(e) => setF((p) => ({ ...p, timezone: e.target.value }))}
              placeholder="Asia/Karachi"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.text }}>
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => setF((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active Restaurant
          </label>
          <button
            onClick={handleSave}
            disabled={saving || !f.name || !f.currencyCode}
            style={{
              ...btnStyle(C.red),
              justifyContent: 'center',
              width: '100%',
              opacity: saving || !f.name || !f.currencyCode ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {edit ? 'Save Changes' : 'Create Restaurant'}
          </button>
        </div>

        <style>{`
          input::placeholder {
            color: #1A1A1A !important;
            opacity: 0.7;
          }
        `}</style>
      </div>
    </div>
  );
}

// ── OLD STYLES ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  color: C.text,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: C.muted,
  marginBottom: 5,
};

const btnStyle = (bg: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  border: 'none',
  borderRadius: 8,
  background: bg,
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
});