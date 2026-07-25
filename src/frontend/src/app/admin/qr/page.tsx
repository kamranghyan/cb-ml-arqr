'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Download, Printer, Eye, X, Plus,
  Copy, CheckCheck, QrCode, MapPin,
  ExternalLink, Trash2, AlertCircle, Loader2,
} from 'lucide-react';

interface QrRecord {
  id: string; restaurantId: string; tableId: string; tableNumber: string;
  zone: string; outlet: string; encodedUrl: string; s3Key: string; s3Url: string;
  createdAt: string; linked: boolean; qrDataUrl?: string;
}

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? 'eea190fd-b8dd-470d-aff1-7d75be5c2efb';
const DEFAULT_BASE  = process.env.NEXT_PUBLIC_BASE_URL      ?? 'https://ar-view-menulay.vercel.app';
const ZONES = ['All Zones', 'Main Hall', 'Garden Terrace', 'Private Dining'];
const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };

type GenState = 'idle' | 'generating' | 'done' | 'error';

function buildQrUrl(baseUrl: string, restaurantId: string, tableId: string) {
  const url = new URL('/guest', baseUrl);
  url.searchParams.set('rid', restaurantId);
  url.searchParams.set('tid', tableId);
  return url.toString();
}
function buildS3Key(restaurantId: string, tableId: string) { return `qr-codes/${restaurantId}/${tableId}.png`; }
function buildS3Url(s3Key: string) { return `https://lamaison-assets.s3.ap-south-1.amazonaws.com/${s3Key}`; }

function makeSeeds(): QrRecord[] {
  const base = typeof window !== 'undefined' ? window.location.origin : DEFAULT_BASE;
  const mainHall = Array.from({ length: 8 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0'); const tableId = `T${num}`; const s3Key = buildS3Key(RESTAURANT_ID, tableId);
    return { id: `seed-${tableId}`, restaurantId: RESTAURANT_ID, tableId, tableNumber: num, zone: 'Main Hall', outlet: 'Main Hall', encodedUrl: buildQrUrl(base, RESTAURANT_ID, tableId), s3Key, s3Url: buildS3Url(s3Key), createdAt: new Date().toISOString(), linked: true };
  });
  const other = Array.from({ length: 4 }, (_, i) => {
    const num = String(i + 9).padStart(2, '0'); const tableId = `T${num}`; const zone = i < 2 ? 'Garden Terrace' : 'Private Dining'; const s3Key = buildS3Key(RESTAURANT_ID, tableId);
    return { id: `seed-${tableId}`, restaurantId: RESTAURANT_ID, tableId, tableNumber: num, zone, outlet: zone, encodedUrl: buildQrUrl(base, RESTAURANT_ID, tableId), s3Key, s3Url: buildS3Url(s3Key), createdAt: new Date().toISOString(), linked: true };
  });
  return [...mainHall, ...other];
}

export default function AdminQRPage() {
  const [records,     setRecords]     = useState<QrRecord[]>(makeSeeds);
  const [zoneFilter,  setZoneFilter]  = useState('All Zones');
  const [preview,     setPreview]     = useState<QrRecord | null>(null);
  const [previewImg,  setPreviewImg]  = useState<string | null>(null);
  const [genState,    setGenState]    = useState<GenState>('idle');
  const [genError,    setGenError]    = useState('');
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [dlAll,       setDlAll]       = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTable,    setNewTable]    = useState({ number: '', zone: 'Main Hall', outlet: 'Main Hall' });
  const printRef = useRef<HTMLDivElement>(null);

  const generateQR = useCallback(async (record: QrRecord): Promise<string | null> => {
    try {
      const res  = await fetch('/api/qr/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId: record.restaurantId, tableId: record.tableId, tableNumber: record.tableNumber, zone: record.zone, outlet: record.outlet }) });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      return data.pngDataUrl ?? null;
    } catch (err: any) { console.error('QR gen error:', err); return null; }
  }, []);

  const openPreview = async (record: QrRecord) => {
    setPreview(record); setPreviewImg(null); setGenState('generating'); setGenError('');
    const img = await generateQR(record);
    if (img) { setPreviewImg(img); setRecords(prev => prev.map(r => r.id === record.id ? { ...r, qrDataUrl: img } : r)); setGenState('done'); }
    else { setGenState('error'); setGenError('Failed to generate QR — check API route'); }
  };

  const downloadQR = async (record: QrRecord) => {
    let img = record.qrDataUrl ?? null;
    if (!img) img = await generateQR(record);
    if (!img) return;
    const a = document.createElement('a'); a.href = img; a.download = `QR_Table${record.tableNumber}_${record.zone.replace(/\s/g, '_')}.png`; a.click();
  };

  const downloadAll = async () => {
    setDlAll(true);
    const updated = await Promise.all(records.map(async r => { if (r.qrDataUrl) return r; const img = await generateQR(r); return img ? { ...r, qrDataUrl: img } : r; }));
    setRecords(updated); setDlAll(false); setTimeout(() => window.print(), 300);
  };

  const copyUrl = (record: QrRecord) => { navigator.clipboard.writeText(record.encodedUrl); setCopiedId(record.id); setTimeout(() => setCopiedId(null), 2000); };

  const addTable = () => {
    if (!newTable.number.trim()) return;
    const tableId = `T${newTable.number.padStart(2, '0')}`; const base = window.location.origin; const s3Key = buildS3Key(RESTAURANT_ID, tableId);
    const record: QrRecord = { id: crypto.randomUUID(), restaurantId: RESTAURANT_ID, tableId, tableNumber: newTable.number.padStart(2, '0'), zone: newTable.zone, outlet: newTable.outlet, encodedUrl: buildQrUrl(base, RESTAURANT_ID, tableId), s3Key, s3Url: buildS3Url(s3Key), createdAt: new Date().toISOString(), linked: true };
    setRecords(prev => [...prev, record]); setShowNewForm(false); setNewTable({ number: '', zone: 'Main Hall', outlet: 'Main Hall' }); setTimeout(() => openPreview(record), 300);
  };

  const deleteRecord = (id: string) => { setRecords(prev => prev.filter(r => r.id !== id)); if (preview?.id === id) setPreview(null); };

  const filtered = records.filter(r => zoneFilter === 'All Zones' || r.zone === zoneFilter);
  const stats = { total: records.length, linked: records.filter(r => r.linked).length, generated: records.filter(r => r.qrDataUrl).length, zones: new Set(records.map(r => r.zone)).size };

  const inputStyle: React.CSSProperties = { width: '100%', height: 42, borderRadius: 10, padding: '0 12px', background: C.bg, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `@media print { body > * { display: none !important; } #print-sheet { display: flex !important; } } .animate-spin{animation:spin 0.8s linear infinite} @keyframes spin{to{transform:rotate(360deg)}}` }} />

      {/* Hidden print sheet */}
      <div id="print-sheet" ref={printRef} style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', padding: 32, flexWrap: 'wrap', gap: 24, alignContent: 'flex-start', overflow: 'auto' }}>
        {records.filter(r => r.qrDataUrl).map(r => (
          <div key={r.id} style={{ border: '1px solid #E5E7EB', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 200, breakInside: 'avoid' }}>
            <img src={r.qrDataUrl} alt={`Table ${r.tableNumber}`} style={{ width: 140, height: 140 }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#000' }}>Table {r.tableNumber}</p>
              <p style={{ fontSize: 11, color: '#6B7280' }}>{r.zone}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: C.white, borderBottom: `1.5px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>QR Code Management</h1>
          <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Encode restaurantId + tableId → generate PNG → store in S3</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={downloadAll} disabled={dlAll}
            style={{ height: 36, padding: '0 16px', borderRadius: 10, background: '#FFF3E0', border: '1.5px solid #FED7AA', color: C.dark, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: dlAll ? 0.5 : 1 }}>
            {dlAll ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {dlAll ? 'Generating…' : 'Print All'}
          </button>
          <button onClick={() => setShowNewForm(true)}
            style={{ height: 36, padding: '0 16px', borderRadius: 10, background: C.red, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,37,27,0.25)' }}>
            <Plus size={15} /> Add Table
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: C.bg, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Total Tables', val: stats.total,     icon: '🪑', color: C.text     },
            { label: 'Linked',       val: stats.linked,    icon: '🔗', color: C.red      },
            { label: 'QR Generated', val: stats.generated, icon: '📱', color: '#16a34a'  },
            { label: 'Zones',        val: stats.zones,     icon: '🏛️', color: '#7c3aed' },
          ].map(s => (
            <div key={s.label} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '16px' }}>
              <span style={{ fontSize: 22, display: 'block', marginBottom: 8 }}>{s.icon}</span>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Georgia, serif', margin: '0 0 4px', lineHeight: 1 }}>{s.val}</p>
              <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Zone filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ZONES.map(z => (
            <button key={z} onClick={() => setZoneFilter(z)}
              style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${zoneFilter === z ? C.red : C.border}`, background: zoneFilter === z ? '#FFF0EE' : C.white, color: zoneFilter === z ? C.red : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              {z}
            </button>
          ))}
        </div>

        {/* QR Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {filtered.map(record => (
            <div key={record.id} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(137,28,28,0.05)', transition: 'all 0.2s' }}
              onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = '#FED0CC'; d.style.boxShadow = '0 6px 20px rgba(225,37,27,0.1)'; }}
              onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = C.border; d.style.boxShadow = '0 2px 8px rgba(137,28,28,0.05)'; }}>

              {/* QR preview area */}
              <div style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => openPreview(record)}>
                {record.qrDataUrl
                  ? <img src={record.qrDataUrl} alt={`Table ${record.tableNumber}`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16 }} />
                  : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <QrCode size={40} color={C.border} />
                      <p style={{ fontSize: 10, color: C.subtle, fontWeight: 600 }}>Click to generate</p>
                    </div>
                }
                {/* Hover overlay */}
                <div style={{ position: 'absolute', inset: 0, background: `${C.red}CC`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0, transition: 'opacity 0.2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '0'}>
                  <Eye size={20} color="#fff" />
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Preview</span>
                </div>
              </div>

              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>Table {record.tableNumber}</p>
                    <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <MapPin size={10} />{record.zone}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700, background: record.linked ? '#F0FFF4' : C.bg, color: record.linked ? '#16a34a' : C.subtle, border: `1px solid ${record.linked ? '#BBF7D0' : C.border}` }}>
                    {record.linked ? 'Linked' : 'Unlinked'}
                  </span>
                </div>

                {/* URL copy row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '6px 10px', marginBottom: 10, cursor: 'pointer' }}
                  onClick={() => copyUrl(record)}>
                  <p style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{record.encodedUrl}</p>
                  {copiedId === record.id ? <CheckCheck size={11} color="#16a34a" style={{ flexShrink: 0 }} /> : <Copy size={11} color={C.subtle} style={{ flexShrink: 0 }} />}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openPreview(record)}
                    style={{ flex: 1, height: 32, borderRadius: 10, background: '#FFF0EE', border: '1.5px solid #FED0CC', color: C.red, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
                    <Eye size={11} /> View
                  </button>
                  <button onClick={() => downloadQR(record)}
                    style={{ flex: 1, height: 32, borderRadius: 10, background: '#FFF3E0', border: '1.5px solid #FED7AA', color: C.dark, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
                    <Download size={11} /> Save
                  </button>
                  <button onClick={() => deleteRecord(record.id)}
                    style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF0F0', border: '1.5px solid #FFD0D0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Trash2 size={11} color={C.red} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Preview Modal ──────────────────────────────────────────────────── */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 24, width: 500, boxShadow: '0 20px 60px rgba(137,28,28,0.15)', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: `linear-gradient(135deg, ${C.dark}, #B22222)` }}>
              <div>
                <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 800, margin: 0, fontFamily: 'Georgia, serif' }}>Table {preview.tableNumber} — QR Code</h2>
                <p style={{ color: 'rgba(255,199,44,0.75)', fontSize: 11, margin: '2px 0 0', fontWeight: 600 }}>{preview.zone} · {preview.outlet}</p>
              </div>
              <button onClick={() => setPreview(null)}
                style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color="#fff" />
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {/* QR image */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ width: 220, height: 220, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {genState === 'generating' && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, border: `3px solid ${C.red}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><p style={{ fontSize: 12, color: C.muted }}>Generating QR code…</p></div>}
                  {genState === 'done' && previewImg && <img src={previewImg} alt={`Table ${preview.tableNumber}`} style={{ width: 200, height: 200, borderRadius: 14 }} />}
                  {genState === 'error' && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 16px', textAlign: 'center' }}><AlertCircle size={28} color={C.red} /><p style={{ fontSize: 12, color: C.red }}>{genError}</p></div>}
                </div>
              </div>

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Table ID',      val: preview.tableId },
                  { label: 'Zone',          val: preview.zone },
                  { label: 'Restaurant ID', val: `${preview.restaurantId.slice(0, 8)}…` },
                  { label: 'Created',       val: new Date(preview.createdAt).toLocaleDateString() },
                ].map(m => (
                  <div key={m.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 3px' }}>{m.label}</p>
                    <p style={{ fontSize: 12, color: C.text, fontWeight: 600, fontFamily: 'monospace', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.val}</p>
                  </div>
                ))}
              </div>

              {/* Encoded URL */}
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, color: C.subtle, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 6px' }}>Encoded URL</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px' }}>
                  <p style={{ fontSize: 11, color: C.red, fontFamily: 'monospace', flex: 1, overflowWrap: 'anywhere', margin: 0 }}>{preview.encodedUrl}</p>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => copyUrl(preview)} style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF3E0', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {copiedId === preview.id ? <CheckCheck size={12} color="#16a34a" /> : <Copy size={12} color={C.dark} />}
                    </button>
                    <a href={preview.encodedUrl} target="_blank" rel="noopener noreferrer" style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF3E0', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ExternalLink size={12} color={C.dark} />
                    </a>
                  </div>
                </div>
              </div>

     

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => previewImg && downloadQR(preview)} disabled={!previewImg}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: previewImg ? C.red : '#ccc', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: previewImg ? 'pointer' : 'not-allowed', boxShadow: previewImg ? '0 4px 12px rgba(225,37,27,0.25)' : 'none' }}>
                  <Download size={15} /> Download PNG
                </button>
                <button onClick={() => { if (previewImg) { const w = window.open('', '_print'); w?.document.write(`<img src="${previewImg}" style="width:100%;max-width:400px;"/>`); w?.print(); }}} disabled={!previewImg}
                  style={{ height: 44, padding: '0 16px', borderRadius: 12, background: '#FFF3E0', border: '1.5px solid #FED7AA', color: C.dark, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: previewImg ? 'pointer' : 'not-allowed', opacity: previewImg ? 1 : 0.5 }}>
                  <Printer size={15} /> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Table Modal ────────────────────────────────────────────────── */}
      {showNewForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          onClick={e => e.target === e.currentTarget && setShowNewForm(false)}>
          <div style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 24, width: 400, padding: 24, boxShadow: '0 20px 60px rgba(137,28,28,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0, fontFamily: 'Georgia, serif' }}>Add New Table</h2>
              <button onClick={() => setShowNewForm(false)} style={{ width: 32, height: 32, borderRadius: 10, background: C.bg, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} color={C.muted} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Table Number</label>
              <input value={newTable.number} onChange={e => setNewTable(p => ({ ...p, number: e.target.value }))}
                placeholder="e.g. 13" type="number" min="1" max="99" style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.red}
                onBlur={e  => (e.target as HTMLInputElement).style.borderColor = C.border} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.subtle, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Zone</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Main Hall', 'Garden Terrace', 'Private Dining', 'Lounge Bar'].map(z => (
                  <button key={z} onClick={() => setNewTable(p => ({ ...p, zone: z, outlet: z }))}
                    style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${newTable.zone === z ? C.red : C.border}`, background: newTable.zone === z ? '#FFF0EE' : C.white, color: newTable.zone === z ? C.red : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                    {z}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview URL */}
            <div style={{ padding: '12px 14px', background: '#FFF3E0', border: '1px solid #FED7AA', borderRadius: 12, marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: C.dark, fontWeight: 700, margin: '0 0 4px' }}>QR will encode:</p>
              <p style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflowWrap: 'anywhere', margin: 0 }}>
                {typeof window !== 'undefined' ? window.location.origin : DEFAULT_BASE}
                {`/guest?rid=${RESTAURANT_ID.slice(0, 8)}…&tid=T${(newTable.number || '??').padStart(2, '0')}`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNewForm(false)}
                style={{ flex: 1, height: 42, borderRadius: 12, background: C.bg, border: `1.5px solid ${C.border}`, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={addTable} disabled={!newTable.number.trim()}
                style={{ flex: 2, height: 42, borderRadius: 12, background: !newTable.number.trim() ? '#ccc' : C.red, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: !newTable.number.trim() ? 'not-allowed' : 'pointer', boxShadow: !newTable.number.trim() ? 'none' : '0 4px 12px rgba(225,37,27,0.25)' }}>
                <Plus size={15} /> Create & Generate QR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}