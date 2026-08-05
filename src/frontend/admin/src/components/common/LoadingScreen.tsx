'use client';

import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12, color: '#687780',
    }}>
      <Loader2 size={26} style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ fontSize: 14, margin: 0 }}>{message}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
