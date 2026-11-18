/**
 * isoTheme.ts — palet peran, helper warna, dan konstanta layout diagram flow.
 * Dipisah dari IsoShared.tsx (komponen) supaya Fast Refresh tetap optimal.
 */

/* ── Warna & label peran (semantik, bukan brand) ─────────────────── */
export const ROLE_COLORS = {
  sistem: '#2e7d32',
  admin: '#ef6c00',
  pemilih: '#1565c0',
  'admin+pemilih': '#6a1b9a',
} as const

export type RoleKey = keyof typeof ROLE_COLORS

export const ROLE_LABELS: Record<RoleKey, string> = {
  sistem: 'Sistem',
  admin: 'Admin',
  pemilih: 'Pemilih',
  'admin+pemilih': 'Admin + Pemilih',
}

export function parseRole(role: string): RoleKey {
  const key = String(role).toLowerCase() as RoleKey
  return ROLE_COLORS[key] ? key : 'sistem'
}

export function roleColor(role: string): string {
  return ROLE_COLORS[parseRole(role)]
}

/** Ubah hex warna ke rgba dengan alpha (untuk tint / chip). */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* ── Layout kanvas flow (single source of truth, dipakai JS + inline) ── */
export const FLOW_NODE_W = 172
export const FLOW_NODE_H = 84
export const FLOW_LID_H = 14
export const FLOW_CELL_X = 240
export const FLOW_CELL_Y = 140
export const FLOW_PAD = 32
