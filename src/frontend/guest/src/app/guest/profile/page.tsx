'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, User, MapPin, Sun, Moon, FileText, Heart, QrCode } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useGuestProfileStore } from '@/lib/guest-profile-store';
import { clearGuestScope } from '@/lib/guest-scope';
import BottomNav from '@/components/guest/BottomNav';

/**
 * Profile page — no Figma was provided for this one either.
 *
 * There's no guest login/account system anywhere in this app (guests are
 * anonymous, scoped only by the QR code they scanned — see
 * guest-scope.ts), so a traditional account-style profile isn't something
 * that exists to build. Built this around what's actually real instead:
 * the name/phone a guest can optionally save (shared with Checkout via
 * guest-profile-store), their current table, theme, and a couple of
 * shortcuts — plus a genuine "switch table" action using the existing
 * clearGuestScope() helper.
 */

const BRAND = '#ff5723';

export default function ProfilePage() {
  const router = useRouter();
  const { isDark, toggle } = useTheme();
  const { fullName, phone, setFullName, setPhone } = useGuestProfileStore();

  const [nameInput,  setNameInput]  = useState(fullName);
  const [phoneInput, setPhoneInput] = useState(phone);
  const [saved,      setSaved]      = useState(false);
  const [tableNum,   setTableNum]   = useState('');

  useEffect(() => {
    setTableNum(sessionStorage.getItem('lm_table') ?? '');
  }, []);

  const handleSave = () => {
    setFullName(nameInput.trim());
    setPhone(phoneInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const handleSwitchTable = () => {
    clearGuestScope();
    sessionStorage.removeItem('lm_table');
    router.push('/guest');
  };

  const initials = nameInput.trim()
    ? nameInput.trim().split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : '';

  const D = isDark ? {
    bg: '#111111', card: '#1C1C1C', card2: '#242424', border: 'rgba(255,255,255,0.08)',
    text: '#F5F0E8', muted: '#9CA3AF',
  } : {
    bg: '#FFFFFF', card: '#FFFFFF', card2: '#F5F5F5', border: '#F0EBE6',
    text: '#000000', muted: '#6B6B6B',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 50, borderRadius: 12, padding: '0 16px', fontSize: 15,
    background: D.card2, border: `1.5px solid ${D.border}`, color: D.text, outline: 'none',
    boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif", marginBottom: 12,
  };

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, fontFamily: "'DM Sans',sans-serif", maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '52px 20px 16px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BRAND, padding: 4, display: 'flex' }} aria-label="Back">
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        <h1 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 700, color: BRAND, margin: '8px 0 0' }}>Profile</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 120px' }}>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '12px 0 32px' }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            {initials
              ? <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 30, fontWeight: 700, color: '#fff' }}>{initials}</span>
              : <User size={36} color="#fff" strokeWidth={1.75} />}
          </div>
          <p style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 600, color: D.text, margin: 0 }}>{fullName || 'Guest'}</p>
          {tableNum && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <MapPin size={12} color={D.muted} />
              <span style={{ fontSize: 12, color: D.muted }}>Table {tableNum}</span>
            </div>
          )}
        </div>

        {/* Your Details */}
        <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: D.text, margin: '0 0 12px' }}>Your Details</h2>
        <input className='searchInput' value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Full Name" style={inputStyle} />
        <input className='searchInput' value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="Phone Number" type="tel" style={{ ...inputStyle, marginBottom: 14 }} />
        <button onClick={handleSave}
          style={{ width: '100%', height: 46, borderRadius: 12, background: saved ? '#22c55e' : BRAND, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 28, transition: 'background 0.2s' }}>
          {saved ? '✓ Saved' : 'Save Details'}
        </button>

        {/* Preferences */}
        <h2 style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: D.text, margin: '0 0 12px' }}>Preferences</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          <button onClick={() => isDark && toggle()}
            style={{ flex: 1, height: 48, borderRadius: 12, border: `2px solid ${BRAND}`, background: !isDark ? BRAND : D.card, color: !isDark ? '#fff' : BRAND, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Sun size={16} /> Light
          </button>
          <button onClick={() => !isDark && toggle()}
            style={{ flex: 1, height: 48, borderRadius: 12, border: `2px solid ${BRAND}`, background: isDark ? BRAND : D.card, color: isDark ? '#fff' : BRAND, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Moon size={16} /> Dark
          </button>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          <button onClick={() => router.push('/guest/tracking')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
            <FileText size={18} color={BRAND} />
            <span style={{ flex: 1, fontSize: 15, color: D.text, fontWeight: 500 }}>My Orders</span>
            <ChevronRight size={16} color={D.muted} />
          </button>
          <button onClick={() => router.push('/guest/favorites')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: D.card, border: `1.5px solid ${D.border}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
            <Heart size={18} color={BRAND} />
            <span style={{ flex: 1, fontSize: 15, color: D.text, fontWeight: 500 }}>Favorites</span>
            <ChevronRight size={16} color={D.muted} />
          </button>
        </div>

        {/* Switch table — real action: clears QR scope, back to landing */}
        <button onClick={handleSwitchTable}
          style={{ width: '100%', height: 48, borderRadius: 14, background: D.card, border: `1.5px solid ${D.border}`, color: D.muted, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <QrCode size={16} /> Scan a Different Table
        </button>
      </div>

      <BottomNav />
    </div>
  );
}