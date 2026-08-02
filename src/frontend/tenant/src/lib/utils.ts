import { clsx, type ClassValue } from 'clsx';

/** Tailwind class merger */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format price in PKR */
export function formatPrice(amount: number): string {
  return 'Rs ' + amount.toLocaleString('en-PK');
}

/** Format seconds to MM:SS */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Return timer colour class based on elapsed vs max */
export function timerColorClass(elapsed: number, max: number): string {
  const pct = elapsed / max;
  if (pct < 0.5)  return 'timer-green';
  if (pct < 0.85) return 'timer-amber';
  return 'timer-red';
}

/** Return timer bar hex based on elapsed vs max */
export function timerBarColor(elapsed: number, max: number): string {
  const pct = elapsed / max;
  if (pct < 0.5)  return '#4caf7d';
  if (pct < 0.85) return '#ffb74d';
  return '#ef6e6b';
}

/** Tag display config */
export const TAG_CONFIG = {
  veg:     { label: 'Veg',     cls: 'bg-green-500/10 border border-green-500/20 text-green-400' },
  spicy:   { label: 'Spicy',   cls: 'bg-red-500/10 border border-red-500/20 text-red-400' },
  new:     { label: 'New',     cls: 'bg-gold-400/12 border border-gold-400/25 text-gold-400' },
  popular: { label: 'Popular', cls: 'bg-violet-400/12 border border-violet-400/20 text-violet-300' },
  chef:    { label: "Chef's Pick", cls: 'bg-gold-400/90 text-surface' },
} as const;

/** Generate random order ID */
export function generateOrderId(): string {
  const num = Math.floor(2800 + Math.random() * 200);
  return `LM-${num}`;
}

/** Play new-order audio beep using Web Audio API */
export function playNewOrderBeep(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext not supported — silent fail
  }
}
