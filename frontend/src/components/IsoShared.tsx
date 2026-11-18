import { type LucideIcon } from 'lucide-react'
import { memo } from 'react'

/* ── Loading spinner ─────────────────────────────────────────────── */
export function IsoLoading({ message = 'Memuat…' }: { message?: string }) {
  return (
    <div className="iso-loading" role="status" aria-live="polite">
      <div className="iso-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}

/* ── Error + retry ───────────────────────────────────────────────── */
export function IsoError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="iso-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="iso-retry" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  )
}

/* ── Section header ──────────────────────────────────────────────── */
interface SectionHeaderProps {
  icon: LucideIcon
  title: string
  description: string
}

export const SectionHeader = memo(function SectionHeader({ icon: Icon, title, description }: SectionHeaderProps) {
  const id = `${title.toLowerCase().replace(/\s+/g, '-')}-title`
  return (
    <>
      <h2 id={id} className="iso-section-title">
        <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
        {title}
      </h2>
      <p className="iso-section-desc">{description}</p>
    </>
  )
})
SectionHeader.displayName = 'SectionHeader'

/* ── Legend item ─────────────────────────────────────────────────── */
interface LegendItemProps {
  color: string
  label: string
}

export const LegendItem = memo(function LegendItem({ color, label }: LegendItemProps) {
  return (
    <span className="iso-legend-item" role="listitem">
      <span className="iso-legend-dot" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  )
})
LegendItem.displayName = 'LegendItem'
