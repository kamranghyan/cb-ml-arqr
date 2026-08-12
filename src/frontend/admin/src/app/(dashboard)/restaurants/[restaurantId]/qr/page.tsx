'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { fetchTables, type ApiTable } from '@/lib/admin-api';
import {
  Download, Printer, Eye, X,
  Copy, CheckCheck, QrCode, MapPin,
  ExternalLink, AlertCircle, Loader2,
} from 'lucide-react';
import Image from 'next/image';
import { useTheme } from '@/hooks/useTheme';

const BRAND = '#ff5723';

interface QrRecord {
  id: string; restaurantId: string; tableId: string; tableNumber: string;
  zone: string; outlet: string; encodedUrl: string; s3Key: string; s3Url: string;
  createdAt: string; linked: boolean; qrDataUrl?: string;
}

// Where a scanned QR should land: the guest app, not this console.
const GUEST_BASE = process.env.NEXT_PUBLIC_GUEST_APP_URL ?? 'http://localhost:3000';
const ZONES = ['All Zones', 'Main Hall', 'Garden Terrace', 'Private Dining'];

// Theme colors
// Theme colors - Complete with all properties
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#111111' : '#FFF8F1',
  card: isDark ? '#1C1C1C' : '#ffffff',
  card2: isDark ? '#242424' : '#F9FAFB',
  border: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  text: isDark ? '#F5F0E8' : '#1A1A1A',
  muted: isDark ? '#9CA3AF' : '#687780',
  subtle: isDark ? '#6B7280' : '#9CA3AF',
  inputBg: isDark ? '#1C1C1C' : '#FFF8F1',
  inputBorder: isDark ? 'rgba(255,255,255,0.08)' : '#F0E8E0',
  inputText: isDark ? '#F5F0E8' : '#1A1A1A',
  // Image related colors
  imageBg: isDark ? 'rgba(255,87,35,0.08)' : '#FFF3E0',
  imageBorder: isDark ? 'rgba(255,87,35,0.2)' : '#FED7AA',
  // Brand colors
  brand: BRAND,
  brandHover: '#e04a1a',
  // Status colors
  success: isDark ? '#4ade80' : '#0F9D58',
  danger: isDark ? '#ff8a5c' : '#E1251B',
  warning: isDark ? '#fb923c' : '#d97706',
  // Shadows
  shadow: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(137,28,28,0.15)',
  // Status backgrounds
  statusBg: isDark ? 'rgba(34,197,94,0.12)' : '#F0FFF4',
  statusBorder: isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0',
  statusText: isDark ? '#4ade80' : '#16a34a',
  // Modal
  modalOverlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
  // Print
  printBg: isDark ? '#1C1C1C' : '#ffffff',
  printText: isDark ? '#F5F0E8' : '#000000',
  printBorder: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
});

type GenState = 'idle' | 'generating' | 'done' | 'error';

function buildQrUrl(baseUrl: string, restaurantId: string, tableId: string) {
  const url = new URL('/guest', baseUrl);
  url.searchParams.set('rid', restaurantId);
  url.searchParams.set('tid', tableId);
  return url.toString();
}
function buildS3Key(restaurantId: string, tableId: string) { return `qr-codes/${restaurantId}/${tableId}.png`; }
function buildS3Url(s3Key: string) { return `https://lamaison-assets.s3.ap-south-1.amazonaws.com/${s3Key}`; }

// Build a QR record from a real table stored in DynamoDB.
function tableToRecord(t: ApiTable): QrRecord {
  const base = GUEST_BASE;
  const s3Key = buildS3Key(t.restaurantId, t.tableId);
  return {
    id: t.tableId,
    restaurantId: t.restaurantId,
    tableId: t.tableId,
    tableNumber: t.tableNumber,
    zone: t.zone,
    outlet: t.outlet,
    encodedUrl: buildQrUrl(base, t.restaurantId, t.tableId),
    s3Key,
    s3Url: buildS3Url(s3Key),
    createdAt: t.createdAt ?? new Date().toISOString(),
    linked: true,
  };
}

export default function BranchQrPage() {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const restaurantId = String(useParams().restaurantId ?? '');
  const [records, setRecords] = useState<QrRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All Zones');
  const [preview, setPreview] = useState<QrRecord | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [genState, setGenState] = useState<GenState>('idle');
  const [genError, setGenError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dlAll, setDlAll] = useState(false);

  // Load real tables from the backend (created in Settings → Tables).
  const loadTables = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const tables = await fetchTables(restaurantId);
      setRecords(tables.map(tableToRecord));
    } catch (e: any) {
      setLoadError(e?.message ?? 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { loadTables(); }, [loadTables]);
  const printRef = useRef<HTMLDivElement>(null);

  const generateQR = useCallback(async (record: QrRecord): Promise<string | null> => {
    try {
      const res = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: record.restaurantId,
          tableId: record.tableId,
          tableNumber: record.tableNumber,
          zone: record.zone,
          outlet: record.outlet
        })
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      return data.pngDataUrl ?? null;
    } catch (err: any) {
      console.error('QR gen error:', err);
      return null;
    }
  }, []);

  const openPreview = async (record: QrRecord) => {
    setPreview(record);
    setPreviewImg(null);
    setGenState('generating');
    setGenError('');
    const img = await generateQR(record);
    if (img) {
      setPreviewImg(img);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, qrDataUrl: img } : r));
      setGenState('done');
    } else {
      setGenState('error');
      setGenError('Failed to generate QR — check API route');
    }
  };

  const downloadQR = async (record: QrRecord) => {
    let img = record.qrDataUrl ?? null;
    if (!img) img = await generateQR(record);
    if (!img) return;
    const a = document.createElement('a');
    a.href = img;
    a.download = `QR_Table${record.tableNumber}_${record.zone.replace(/\s/g, '_')}.png`;
    a.click();
  };

  const downloadAll = async () => {
    setDlAll(true);
    const updated = await Promise.all(records.map(async r => {
      if (r.qrDataUrl) return r;
      const img = await generateQR(r);
      return img ? { ...r, qrDataUrl: img } : r;
    }));
    setRecords(updated);
    setDlAll(false);
    setTimeout(() => window.print(), 300);
  };

  const copyUrl = (record: QrRecord) => {
    navigator.clipboard.writeText(record.encodedUrl);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = records.filter(r => zoneFilter === 'All Zones' || r.zone === zoneFilter);
  const stats = {
    total: records.length,
    linked: records.filter(r => r.linked).length,
    generated: records.filter(r => r.qrDataUrl).length,
    zones: new Set(records.map(r => r.zone)).size
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 42,
    borderRadius: 10,
    padding: '0 12px',
    background: colors.inputBg,
    border: `1.5px solid ${colors.inputBorder}`,
    fontSize: 13,
    color: colors.inputText,
    outline: 'none',
    boxSizing: 'border-box'
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print { 
          body > * { display: none !important; } 
          #print-sheet { display: flex !important; } 
        } 
        .animate-spin{animation:spin 0.8s linear infinite} 
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
        }
        ::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'};
        }
      `}} />

      {/* Hidden print sheet */}
      <div id="print-sheet" ref={printRef} style={{
        display: 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: colors.printBg,
        padding: 32,
        flexWrap: 'wrap',
        gap: 24,
        alignContent: 'flex-start',
        overflow: 'auto'
      }}>
        {records
          .filter((r): r is QrRecord & { qrDataUrl: string } => Boolean(r.qrDataUrl))
          .map(r => (
            <div key={r.id} style={{
              border: `1px solid ${colors.printBorder}`,
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              width: 200,
              breakInside: 'avoid',
              background: colors.printBg,
            }}>
              <Image
                src={r.qrDataUrl}
                alt={`Table ${r.tableNumber}`}
                width={140}
                height={140}
                style={{
                  width: 140,
                  height: 140,
                  objectFit: 'contain',
                }}
              />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: colors.printText }}>Table {r.tableNumber}</p>
                <p style={{ fontSize: 11, color: colors.muted }}>{r.zone}</p>
              </div>
            </div>
          ))}
      </div>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        background: colors.card,
        borderBottom: `1.5px solid ${colors.border}`,
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{
            fontSize: 20,
            fontWeight: 800,
            color: colors.text,
            margin: 0,
            fontFamily: 'Georgia, serif'
          }}>QR Code Management</h1>
          <p style={{
            fontSize: 12,
            color: colors.muted,
            margin: '2px 0 0'
          }}>Encode restaurantId + tableId → generate PNG → store in S3</p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <button onClick={downloadAll} disabled={dlAll}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 10,
              background: colors.imageBg,
              border: `1.5px solid ${colors.imageBorder}`,
              color: colors.text,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              opacity: dlAll ? 0.5 : 1
            }}>
            {dlAll ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {dlAll ? 'Generating…' : 'Print All'}
          </button>
          <button onClick={loadTables}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 10,
              background: BRAND,
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: `0 4px 12px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(225,37,27,0.25)'}`
            }}>
            <QrCode size={15} /> Refresh
          </button>
        </div>
      </div>

      <div style={{
        flex: 1,
        padding: '24px 32px',
        overflowY: 'auto',
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }}>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 16
        }}>
          {[
            { label: 'Total Tables', val: stats.total, icon: '🪑', color: colors.text },
            { label: 'Linked', val: stats.linked, icon: '🔗', color: BRAND },
            { label: 'QR Generated', val: stats.generated, icon: '📱', color: colors.success },
            { label: 'Zones', val: stats.zones, icon: '🏛️', color: isDark ? '#a78bfa' : '#7c3aed' },
          ].map(s => (
            <div key={s.label} style={{
              background: colors.card,
              border: `1.5px solid ${colors.border}`,
              borderRadius: 16,
              padding: '16px'
            }}>
              <span style={{ fontSize: 22, display: 'block', marginBottom: 8 }}>{s.icon}</span>
              <p style={{
                fontSize: 28,
                fontWeight: 800,
                color: s.color,
                fontFamily: 'Georgia, serif',
                margin: '0 0 4px',
                lineHeight: 1
              }}>{s.val}</p>
              <p style={{
                fontSize: 10,
                color: colors.subtle,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
                margin: 0
              }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Zone filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ZONES.map(z => (
            <button key={z} onClick={() => setZoneFilter(z)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: `1.5px solid ${zoneFilter === z ? BRAND : colors.border}`,
                background: zoneFilter === z ? (isDark ? 'rgba(255,87,35,0.12)' : '#FFF0EE') : colors.card,
                color: zoneFilter === z ? BRAND : colors.muted,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
              {z}
            </button>
          ))}
        </div>

        {/* Loading / error / empty states */}
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: colors.muted,
          }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 12, fontSize: 14 }}>Loading tables…</p>
          </div>
        )}
        {!loading && loadError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '40px 20px',
            color: colors.danger,
          }}>
            <AlertCircle size={20} /> {loadError}
          </div>
        )}
        {!loading && !loadError && records.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: colors.subtle,
          }}>
            <QrCode size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 600, color: colors.muted }}>No tables yet.</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtle }}>
              Create tables in <strong style={{ color: colors.text }}>Settings → Tables</strong>, then refresh here to generate QR codes.
            </p>
          </div>
        )}

        {/* QR Grid */}
        {!loading && records.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16
          }}>
            {filtered.map(record => (
              <div key={record.id} style={{
                background: colors.card,
                border: `1.5px solid ${colors.border}`,
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: `0 2px 8px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(137,28,28,0.05)'}`,
                transition: 'all 0.2s'
              }}
                onMouseEnter={e => {
                  const d = e.currentTarget as HTMLDivElement;
                  d.style.borderColor = isDark ? 'rgba(255,87,35,0.3)' : '#FED0CC';
                  d.style.boxShadow = `0 6px 20px ${isDark ? 'rgba(255,87,35,0.15)' : 'rgba(225,37,27,0.1)'}`;
                }}
                onMouseLeave={e => {
                  const d = e.currentTarget as HTMLDivElement;
                  d.style.borderColor = colors.border;
                  d.style.boxShadow = `0 2px 8px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(137,28,28,0.05)'}`;
                }}>

                {/* QR preview area */}
                <div style={{
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: colors.inputBg,
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                  onClick={() => openPreview(record)}>
                  {record.qrDataUrl
                    ? <Image
                      src={record.qrDataUrl}
                      alt={`Table ${record.tableNumber}`}
                      width={300}
                      height={300}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        padding: 16,
                        boxSizing: 'border-box',
                      }}
                    />
                    : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <QrCode size={40} color={colors.border} />
                      <p style={{ fontSize: 10, color: colors.subtle, fontWeight: 600 }}>Click to generate</p>
                    </div>
                  }
                  {/* Hover overlay */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: `${BRAND}CC`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: 0,
                    transition: 'opacity 0.2s'
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '0'}>
                    <Eye size={20} color="#fff" />
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Preview</span>
                  </div>
                </div>

                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                    <div>
                      <p style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.text,
                        margin: 0,
                        fontFamily: 'Georgia, serif'
                      }}>Table {record.tableNumber}</p>
                      <p style={{
                        fontSize: 11,
                        color: colors.muted,
                        margin: '2px 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}>
                        <MapPin size={10} />{record.zone}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10,
                      padding: '3px 8px',
                      borderRadius: 20,
                      fontWeight: 700,
                      background: record.linked ? colors.statusBg : colors.inputBg,
                      color: record.linked ? colors.statusText : colors.subtle,
                      border: `1px solid ${record.linked ? colors.statusBorder : colors.border}`
                    }}>
                      {record.linked ? 'Linked' : 'Unlinked'}
                    </span>
                  </div>

                  {/* URL copy row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: colors.inputBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: '6px 10px',
                    marginBottom: 10,
                    cursor: 'pointer'
                  }}
                    onClick={() => copyUrl(record)}>
                    <p style={{
                      fontSize: 10,
                      color: colors.muted,
                      fontFamily: 'monospace',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      margin: 0
                    }}>{record.encodedUrl}</p>
                    {copiedId === record.id ? <CheckCheck size={11} color={colors.success} style={{ flexShrink: 0 }} /> : <Copy size={11} color={colors.subtle} style={{ flexShrink: 0 }} />}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openPreview(record)}
                      style={{
                        flex: 1,
                        height: 32,
                        borderRadius: 10,
                        background: isDark ? 'rgba(255,87,35,0.12)' : '#FFF0EE',
                        border: `1.5px solid ${isDark ? 'rgba(255,87,35,0.3)' : '#FED0CC'}`,
                        color: BRAND,
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'pointer'
                      }}>
                      <Eye size={11} /> View
                    </button>
                    <button onClick={() => downloadQR(record)}
                      style={{
                        flex: 1,
                        height: 32,
                        borderRadius: 10,
                        background: colors.imageBg,
                        border: `1.5px solid ${colors.imageBorder}`,
                        color: colors.text,
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'pointer'
                      }}>
                      <Download size={11} /> Save
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview Modal ──────────────────────────────────────────────────── */}
      {preview && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: colors.modalOverlay,
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: 24
        }}
          onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div style={{
            background: colors.card,
            border: `1.5px solid ${colors.border}`,
            borderRadius: 24,
            width: 500,
            maxWidth: '100%',
            boxShadow: `0 20px 60px ${colors.shadow}`,
            overflow: 'hidden'
          }}>
            {/* Modal header - ORANGE/BRAND THEME */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              background: isDark
                ? `linear-gradient(135deg, #1C1C1C, #2A1A1A)`
                : `linear-gradient(135deg, ${BRAND}, #e04a1a)`,
              borderBottom: `1px solid ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(255,87,35,0.2)'}`,
            }}>
              <div>
                <h2 style={{
                  color: isDark ? colors.text : '#fff',
                  fontSize: 17,
                  fontWeight: 800,
                  margin: 0,
                  fontFamily: 'Georgia, serif'
                }}>Table {preview.tableNumber} — QR Code</h2>
                <p style={{
                  color: isDark ? colors.muted : 'rgba(255,255,255,0.8)',
                  fontSize: 11,
                  margin: '2px 0 0',
                  fontWeight: 600
                }}>{preview.zone} · {preview.outlet}</p>
              </div>
              <button onClick={() => setPreview(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)';
                }}>
                <X size={14} color={isDark ? colors.muted : '#fff'} />
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {/* QR image */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 20
              }}>
                <div style={{
                  width: 220,
                  height: 220,
                  background: colors.inputBg,
                  border: `1.5px solid ${colors.border}`,
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {genState === 'generating' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        border: `3px solid ${BRAND}`,
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      <p style={{ fontSize: 12, color: colors.muted }}>Generating QR code…</p>
                    </div>
                  )}
                  {genState === 'done' && previewImg && (
                    <Image
                      src={previewImg}
                      alt={`Table ${preview.tableNumber}`}
                      width={200}
                      height={200}
                      style={{
                        width: 200,
                        height: 200,
                        borderRadius: 14,
                        objectFit: 'contain',
                      }}
                    />
                  )}
                  {genState === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 16px', textAlign: 'center' }}>
                      <AlertCircle size={28} color={colors.danger} />
                      <p style={{ fontSize: 12, color: colors.danger }}>{genError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Meta grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginBottom: 14
              }}>
                {[
                  { label: 'Table ID', val: preview.tableId },
                  { label: 'Zone', val: preview.zone },
                  { label: 'Restaurant ID', val: `${preview.restaurantId.slice(0, 8)}…` },
                  { label: 'Created', val: new Date(preview.createdAt).toLocaleDateString() },
                ].map(m => (
                  <div key={m.label} style={{
                    background: colors.inputBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: '10px 12px'
                  }}>
                    <p style={{
                      fontSize: 10,
                      color: colors.subtle,
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      margin: '0 0 3px'
                    }}>{m.label}</p>
                    <p style={{
                      fontSize: 12,
                      color: colors.text,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{m.val}</p>
                  </div>
                ))}
              </div>

              {/* Encoded URL */}
              <div style={{ marginBottom: 12 }}>
                <p style={{
                  fontSize: 10,
                  color: colors.subtle,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  margin: '0 0 6px'
                }}>Encoded URL</p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: colors.inputBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                  flexWrap: 'wrap',
                }}>
                  <p style={{
                    fontSize: 11,
                    color: BRAND,
                    fontFamily: 'monospace',
                    flex: 1,
                    overflowWrap: 'anywhere',
                    margin: 0
                  }}>{preview.encodedUrl}</p>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => copyUrl(preview)} style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: colors.imageBg,
                      border: `1px solid ${colors.imageBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}>
                      {copiedId === preview.id ? <CheckCheck size={12} color={colors.success} /> : <Copy size={12} color={colors.text} />}
                    </button>
                    <a href={preview.encodedUrl} target="_blank" rel="noopener noreferrer" style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: colors.imageBg,
                      border: `1px solid ${colors.imageBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ExternalLink size={12} color={colors.text} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => previewImg && downloadQR(preview)} disabled={!previewImg}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    background: previewImg ? BRAND : colors.border,
                    color: previewImg ? '#fff' : colors.muted,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: previewImg ? 'pointer' : 'not-allowed',
                    boxShadow: previewImg ? `0 4px 12px ${isDark ? 'rgba(255,87,35,0.2)' : 'rgba(225,37,27,0.25)'}` : 'none',
                    minWidth: 120,
                  }}>
                  <Download size={15} /> Download PNG
                </button>
                <button onClick={() => {
                  if (previewImg) {
                    const w = window.open('', '_print');
                    w?.document.write(`<img src="${previewImg}" style="width:100%;max-width:400px;"/>`);
                    w?.print();
                  }
                }} disabled={!previewImg}
                  style={{
                    height: 44,
                    padding: '0 16px',
                    borderRadius: 12,
                    background: colors.imageBg,
                    border: `1.5px solid ${colors.imageBorder}`,
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: previewImg ? 'pointer' : 'not-allowed',
                    opacity: previewImg ? 1 : 0.5
                  }}>
                  <Printer size={15} /> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}