import './Skeleton.css'

/* ── Skeleton teks (baris placeholder) ───────────────────────── */
export function SkeletonText({ className = '', variant = 'text' }) {
  const map = {
    title: 'skeleton-text--title',
    small: 'skeleton-text--small',
    text: 'skeleton-text',
  }
  return (
    <div className={`skeleton ${map[variant]} ${className}`} aria-hidden="true" />
  )
}

/* ── Skeleton lingkaran (avatar) ─────────────────────────────── */
export function SkeletonCircle({ className = '' }) {
  return (
    <div className={`skeleton skeleton-circle ${className}`} aria-hidden="true" />
  )
}

/* ── Skeleton baris tabel / kartu (untuk daftar undangan) ────── */
export function SkeletonRow({ className = '' }) {
  return (
    <div className={`skeleton-row ${className}`} aria-hidden="true">
      <div className="skeleton skeleton-circle" />
      <div className="skeleton skeleton-text--title" />
      <div className="skeleton skeleton-text--small" />
      <div className="skeleton skeleton-text--small" />
      <div className="skeleton skeleton-text--small" />
    </div>
  )
}

/* ── Skeleton kotak statistik ────────────────────────────────── */
export function SkeletonStat({ className = '' }) {
  return (
    <div className={`skeleton-stat ${className}`} aria-hidden="true">
      <div className="skeleton skeleton-text--small" />
      <div className="skeleton skeleton-text" />
    </div>
  )
}

/* ── Skeleton panel lengkap (menutupi konten saat loading) ───── */
export function SkeletonPane({ rows = 4, className = '' }) {
  return (
    <div className={`skeleton-pane ${className}`} aria-hidden="true">
      <div className="skeleton skeleton-text--title" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeleton-text" />
      ))}
    </div>
  )
}

export default SkeletonText
