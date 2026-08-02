// /app/admin/tables/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, X, Loader2, RefreshCw, Grid3x3, ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  fetchTables,
  createTable,
  updateTable,
  deleteTable,
  type ApiTable,
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
  Tooltip,
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

// ── Styled MUI Table ──────────────────────────────────────────────────────
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
    minWidth: 700,
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
      width: '20%',
      paddingLeft: '16px',
    },
    '&:nth-of-type(2)': {
      width: '18%',
      textAlign: 'center',
    },
    '&:nth-of-type(3)': {
      width: '18%',
      textAlign: 'center',
    },
    '&:nth-of-type(4)': {
      width: '12%',
      textAlign: 'center',
    },
    '&:nth-of-type(5)': {
      width: '15%',
      textAlign: 'center',
    },
    '&:last-of-type': {
      width: '17%',
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
    '&:nth-of-type(4)': {
      textAlign: 'center',
    },
    '&:nth-of-type(5)': {
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

const StatusChipTable = styled(Chip)<{ status: boolean }>(({ status }) => ({
  backgroundColor: status ? '#E6F7E6' : '#F5F5F5',
  color: status ? '#0F9D58' : C.subtle,
  fontWeight: 600,
  fontSize: 12,
}));

// ── Tables Modal ──────────────────────────────────────────────────────────────
function TableModal({
  edit,
  onClose,
  onSaved,
  showToast,
  isMobile,
}: {
  edit?: ApiTable;
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string, k?: 'ok' | 'err') => void;
  isMobile?: boolean;
}) {
  const [f, setF] = useState({
    tableNumber: edit?.tableNumber ?? '',
    zone: edit?.zone ?? 'Main Hall',
    outlet: edit?.outlet ?? 'Main Hall',
    capacity: edit?.capacity ?? 4,
    isActive: edit?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.tableNumber.trim()) {
      alert('Table number is required!');
      return;
    }
    setSaving(true);
    const payload = {
      tableNumber: f.tableNumber,
      zone: f.zone,
      outlet: f.outlet,
      capacity: f.capacity,
      isActive: f.isActive,
    };
    try {
      if (edit) {
        await updateTable(edit.tableId, payload);
        showToast('Table updated successfully! ✅');
      } else {
        await createTable(payload);
        showToast('Table created successfully! ✅');
      }
      onSaved();
    } catch (e: any) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

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
            {edit ? 'Edit Table' : 'New Table'}
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
            <label style={labelStyle}>Table Number *</label>
            <input
              style={inputStyle}
              value={f.tableNumber}
              onChange={(e) => set('tableNumber', e.target.value)}
              placeholder="e.g., T1, Table-01"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Zone</label>
              <input
                style={inputStyle}
                value={f.zone}
                onChange={(e) => set('zone', e.target.value)}
                placeholder="Main Hall"
              />
            </div>
            <div>
              <label style={labelStyle}>Outlet</label>
              <input
                style={inputStyle}
                value={f.outlet}
                onChange={(e) => set('outlet', e.target.value)}
                placeholder="Main Hall"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Capacity (persons) *</label>
            <input
              type="number"
              min="1"
              style={inputStyle}
              value={f.capacity}
              onChange={(e) => set('capacity', parseInt(e.target.value) || 1)}
              placeholder="4"
            />
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              color: C.text,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
            />
            Active Table
          </label>
          <button
            onClick={save}
            disabled={saving || !f.tableNumber}
            style={{
              ...btnStyle(C.red),
              justifyContent: 'center',
              width: '100%',
              opacity: saving || !f.tableNumber ? 0.6 : 1,
            }}
          >
            {saving ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : null}
            {edit ? 'Save Changes' : 'Create Table'}
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

// ── Styles for Table Modal ──────────────────────────────────────────────────
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function TablesPage() {
  const router = useRouter();
  const [tableRows, setTableRows] = useState<ApiTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableModal, setTableModal] = useState<{ open: boolean; edit?: ApiTable }>({ open: false });
  const [toast, setToast] = useState<Toast>(null);

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    tableId?: string;
    tableNumber?: string;
  }>({ open: false });

  const isMobile = useMediaQuery('(max-width:768px)');

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTables();
      setTableRows(data);
    } catch (e: any) {
      showToast(e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // ── Go Back ──────────────────────────────────────────────────────────────
  const goBack = () => {
    router.back();
  };

  // ── Delete Functions ──────────────────────────────────────────────────────
  function onDeleteTable(t: ApiTable) {
    setDeleteModal({
      open: true,
      tableId: t.tableId,
      tableNumber: t.tableNumber,
    });
  }

  async function confirmDeleteTable() {
    if (!deleteModal.tableId) return;
    try {
      await deleteTable(deleteModal.tableId);
      showToast('Table deleted successfully! 🗑️');
      loadTables();
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
        <Typography sx={{ ml: 2, color: C.muted }}>Loading tables...</Typography>
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
              Tables Management
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: 14, mt: 0.5 }}>
              Manage all tables across your restaurants. Found {tableRows.length} tables.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setTableModal({ open: true })}
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
            New Table
          </Button>
          <button 
            onClick={loadTables} 
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

      {tableRows.length === 0 ? (
        <Box
          sx={{
            p: { xs: 4, sm: 6 },
            textAlign: 'center',
            border: `2px dashed ${C.border}`,
            borderRadius: 2,
            color: C.subtle,
          }}
        >
          <Grid3x3 size={48} style={{ opacity: 0.4 }} />
          <Typography sx={{ mt: 2, fontSize: 16 }}>No tables yet.</Typography>
          <Typography sx={{ fontSize: 14 }}>
            Click "New Table" to create your first table.
          </Typography>
        </Box>
      ) : (
        <StyledTableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Table #</TableCell>
                <TableCell align="center">Zone</TableCell>
                <TableCell align="center">Outlet</TableCell>
                <TableCell align="center">Capacity</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map((t) => (
                <TableRow key={t.tableId}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Grid3x3 size={16} color={C.red} />
                      <Typography sx={{ fontWeight: 600 }}>
                        {t.tableNumber}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={t.zone ?? '—'}
                      size="small"
                      sx={{
                        bgcolor: C.border,
                        color: C.text,
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={t.outlet ?? '—'}
                      size="small"
                      sx={{
                        bgcolor: C.border,
                        color: C.text,
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${t.capacity} seats`}
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
                    <StatusChipTable
                      label={t.isActive !== false ? 'Active' : 'Inactive'}
                      status={t.isActive !== false}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Copy QR Code">
                      <IconButton
                        size="small"
                        onClick={() => {
                          navigator.clipboard.writeText(t.qrCode || '');
                          showToast('QR Code copied! 📋');
                        }}
                        sx={{ mr: 0.5 }}
                      >
                        {/* <QrCode size={14} /> */}
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={() => setTableModal({ open: true, edit: t })}
                    >
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{ color: C.red }}
                      onClick={() => onDeleteTable(t)}
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

      {/* Table Modal */}
      {tableModal.open && (
        <TableModal
          edit={tableModal.edit}
          onClose={() => setTableModal({ open: false })}
          onSaved={() => {
            setTableModal({ open: false });
            loadTables();
          }}
          showToast={showToast}
          isMobile={isMobile}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false })}
        onConfirm={confirmDeleteTable}
        title="Delete Table?"
        message="Are you sure you want to delete table"
        itemName={deleteModal.tableNumber || ''}
        itemType="table"
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