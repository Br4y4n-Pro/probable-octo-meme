import type { PieceKind } from '@battlenaval/shared';

export type ShipPalette = {
  light: string;
  mid: string;
  dark: string;
  glow: string;
  /** Display class/family name for UI hints. */
  klass: string;
};

const DEFAULT: ShipPalette = {
  light: '#b6c4dc',
  mid: '#6c7e9c',
  dark: '#3a4866',
  glow: '#94a3b8',
  klass: 'Barco',
};

export const SUNK_PALETTE: ShipPalette = {
  light: '#fda4af',
  mid: '#dc2626',
  dark: '#7f1d1d',
  glow: '#f87171',
  klass: 'Hundido',
};

const STRAIGHT_BY_LENGTH: Record<number, ShipPalette> = {
  2: { light: '#67e8f9', mid: '#0891b2', dark: '#155e75', glow: '#22d3ee', klass: 'Lancha' },
  3: { light: '#86efac', mid: '#059669', dark: '#064e3b', glow: '#10b981', klass: 'Submarino' },
  4: { light: '#fcd34d', mid: '#d97706', dark: '#78350f', glow: '#f59e0b', klass: 'Destructor' },
  5: { light: '#c4b5fd', mid: '#7c3aed', dark: '#4c1d95', glow: '#a855f7', klass: 'Crucero' },
  6: { light: '#fda4af', mid: '#be123c', dark: '#881337', glow: '#f43f5e', klass: 'Acorazado' },
};

const L_BY_LENGTH: Record<number, ShipPalette> = {
  4: { light: '#93c5fd', mid: '#2563eb', dark: '#1e3a8a', glow: '#3b82f6', klass: 'Plataforma L' },
  5: { light: '#a5b4fc', mid: '#4f46e5', dark: '#312e81', glow: '#6366f1', klass: 'Plataforma L+' },
};

const T_BY_LENGTH: Record<number, ShipPalette> = {
  4: { light: '#7dd3fc', mid: '#0284c7', dark: '#0c4a6e', glow: '#0ea5e9', klass: 'Comando T' },
  5: { light: '#fdba74', mid: '#ea580c', dark: '#7c2d12', glow: '#fb923c', klass: 'Comando T+' },
};

export function paletteForShip(kind: PieceKind, length: number): ShipPalette {
  if (kind === 'straight') return STRAIGHT_BY_LENGTH[length] ?? DEFAULT;
  if (kind === 'L') return L_BY_LENGTH[length] ?? DEFAULT;
  if (kind === 'T') return T_BY_LENGTH[length] ?? DEFAULT;
  return DEFAULT;
}

export function shipGradient(p: ShipPalette): string {
  return `linear-gradient(165deg, ${p.light} 0%, ${p.mid} 45%, ${p.dark} 100%)`;
}
