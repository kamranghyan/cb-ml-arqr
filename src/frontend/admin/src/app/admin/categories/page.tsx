// /app/admin/categories/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, Loader2, RefreshCw, Tags, ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type ApiCategory,
} from '@/lib/admin-api';
import { RESTAURANT_ID } from '@/lib/api-config';

// MUI Imports
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

// Import Delete Modal
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';

const C = {
  red: '#E1251B',
  dark: '#891C1C',
  bg: '#FFF8F1',
  border: '#F0E8E0',
  text: '#1A1A1A',
  muted: '#687780',
  subtle: '#9CA3AF',
};

type Toast = { msg: string; kind: 'ok' | 'err' } | null;

// Styled MUI Table Components
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  overflow: 'auto',
  width: '100%',
  maxWidth: '100%',
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
    minWidth: 600,
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
    whiteSpace: 'nowrap',
    '&:first-of-type': {
      width: '40%',
      paddingLeft: '16px',
    },
    '&:nth-of-type(2)': {
      width: '20%',
      textAlign: 'center',
    },
    '&:nth-of-type(3)': {
      width: '20%',
      textAlign: 'center',
    },
    '&:last-of-type': {
      width: '20%',
      textAlign: 'right',
      paddingRight: '16px',
    },
  },
  '& .MuiTableCell-body': {
    fontSize: 14,
    color: C.text,
    padding: '12px 12px',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
    '&:first-of-type': {
      paddingLeft: '16px',
    },
    '&:nth-of-type(2)': {
      textAlign: 'center',
    },
    '&:nth-of-type(3)': {
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

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [modal, setModal] = useState<{ open: boolean; edit?: ApiCategory }>({ open: false });

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    categoryId?: string;
    categoryName?: string;
  }>({ open: false });

  const isMobile = useMediaQuery('(max-width:768px)');

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCategories(RESTAURANT_ID);
      setCategories(data);
    } catch (e: any) {
      showToast(e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ── Go Back ──────────────────────────────────────────────────────────────
  const goBack = () => {
    router.back();
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const handleCreateCategory = async (id: string | undefined, data: { 
    name: string; 
    displayOrder: number; 
    isActive: boolean;
  }) => {
    try {
      await createCategory(data, RESTAURANT_ID);
      showToast('Category created successfully! ✅');
      loadCategories();
      setModal({ open: false });
    } catch (e: any) {
      showToast(e.message, 'err');
    }
  };

  const handleUpdateCategory = async (id: string | undefined, data: { 
    name: string; 
    displayOrder: number; 
    isActive: boolean;
  }) => {
    try {
      if (!id) throw new Error('Category ID is required');
      await updateCategory(id, data, RESTAURANT_ID);
      showToast('Category updated successfully! ✅');
      loadCategories();
      setModal({ open: false });
    } catch (e: any) {
      showToast(e.message, 'err');
    }
  };

  // ── Delete Functions ──────────────────────────────────────────────────────
  function onDeleteCategory(category: ApiCategory) {
    setDeleteModal({
      open: true,
      categoryId: category.categoryId,
      categoryName: category.name,
    });
  }

  async function confirmDeleteCategory() {
    if (!deleteModal.categoryId) return;
    try {
      await deleteCategory(deleteModal.categoryId, RESTAURANT_ID);
      showToast('Category deleted successfully! 🗑️');
      loadCategories();
    } catch (e: any) {
      showToast(e.message, 'err');
    } finally {
      setDeleteModal({ open: false });
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress sx={{ color: C.red }} />
        <Typography sx={{ ml: 2, color: C.muted }}>Loading categories...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, mx: 'auto', width: '100%' }}>
      
      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        mb: 2 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* ✅ Back Arrow */}
          <button
            onClick={goBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: C.bg,
              border: `1.5px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = C.bg;
            }}
          >
            <ArrowLeft size={20} color={C.text} />
          </button>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: C.text }}>
              Categories Management
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: 14, mt: 0.5 }}>
              Manage menu categories. Found {categories.length} categories.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setModal({ open: true })}
            sx={{
              bgcolor: C.red,
              '&:hover': { bgcolor: C.dark },
              py: 1,
              px: 3,
              borderRadius: '10px',
              fontWeight: 700,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            New Category
          </Button>
          <button 
            onClick={loadCategories} 
            title="Refresh"
            style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 10, 
              background: '#FFF3E0', 
              border: '1.5px solid #FED7AA', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer' 
            }}
          >
            <RefreshCw size={14} color={C.dark} />
          </button>
        </Box>
      </Box>

      {categories.length === 0 ? (
        <Box
          sx={{
            p: { xs: 4, sm: 6 },
            textAlign: 'center',
            border: `2px dashed ${C.border}`,
            borderRadius: 2,
            color: C.subtle,
          }}
        >
          <Tags size={48} style={{ opacity: 0.4 }} />
          <Typography sx={{ mt: 2, fontSize: 16 }}>No categories yet.</Typography>
          <Typography sx={{ fontSize: 14 }}>
            Click "New Category" to create your first category.
          </Typography>
        </Box>
      ) : (
        <StyledTableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="center">Order</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.sort((a, b) => a.displayOrder - b.displayOrder).map((c) => (
                <TableRow key={c.categoryId}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Tags size={16} color={c.isActive ? C.red : C.subtle} />
                      <Typography sx={{ fontWeight: 600 }}>
                        {c.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">{c.displayOrder}</TableCell>
                  <TableCell align="center">
                    <StatusChip
                      label={c.isActive ? 'Active' : 'Inactive'}
                      status={c.isActive}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton
                      size="small"
                      onClick={() => setModal({ open: true, edit: c })}
                    >
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{ color: C.red }}
                      onClick={() => onDeleteCategory(c)}
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

      {/* Category Modal */}
      {modal.open && (
        <CategoryModal
          edit={modal.edit}
          onClose={() => setModal({ open: false })}
          onSave={modal.edit ? handleUpdateCategory : handleCreateCategory}
          isMobile={isMobile}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false })}
        onConfirm={confirmDeleteCategory}
        title="Delete Category?"
        message="Are you sure you want to delete category"
        itemName={deleteModal.categoryName || ''}
        itemType="category"
      />

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

// ── CATEGORY MODAL ──────────────────────────────────────────────────────────

function CategoryModal({
  edit,
  onClose,
  onSave,
  isMobile,
}: {
  edit?: ApiCategory;
  onClose: () => void;
  onSave: (id: string | undefined, data: { name: string; displayOrder: number; isActive: boolean }) => Promise<void>;
  isMobile?: boolean;
}) {
  const [f, setF] = useState({
    name: edit?.name ?? '',
    displayOrder: edit?.displayOrder ?? 0,
    isActive: edit?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!f.name.trim()) {
      alert('Category name is required!');
      return;
    }
    setSaving(true);
    try {
      await onSave(edit?.categoryId, {
        name: f.name.trim(),
        displayOrder: f.displayOrder,
        isActive: f.isActive,
      });
      onClose();
    } catch (e) {
      // handled by parent
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
            {edit ? 'Edit Category' : 'New Category'}
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
            <label style={labelStyle}>Category Name *</label>
            <input
              style={inputStyle}
              value={f.name}
              onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., Appetizers"
            />
          </div>
          <div>
            <label style={labelStyle}>Display Order</label>
            <input
              type="number"
              style={inputStyle}
              value={f.displayOrder}
              onChange={(e) => setF((p) => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))}
              placeholder="0"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.text }}>
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => setF((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...btnStyle(C.red),
              justifyContent: 'center',
              width: '100%',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {edit ? 'Save Changes' : 'Create Category'}
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

// ── STYLES ──────────────────────────────────────────────────────────────────

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