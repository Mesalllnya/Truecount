import { Link } from 'react-router-dom'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'

/* ── Nav icons (stroke konsisten di seluruh aplikasi) ──────── */
function ExitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function VoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2"/>
      <line x1="8" y1="9"  x2="16" y2="9"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2.5"/>
      <path d="M12 4.5v1.5M12 18v1.5M4.5 12h1.5M18 12h1.5M6.34 6.34l1.06 1.06M17.66 17.66l1.06 1.06M6.34 17.66l1.06-1.06M17.66 6.34l1.06-1.06"/>
    </svg>
  )
}

function BallotNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="3" width="12" height="18" rx="1"/>
      <path d="M6 3 l6 4"/>
      <path d="M12 3 l6 4"/>
      <line x1="8" y1="7" x2="16" y2="7"/>
      <line x1="8" y1="10" x2="14" y2="10"/>
      <line x1="8" y1="13" x2="12" y2="13"/>
    </svg>
  )
}

export { BallotNavIcon }

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', marginRight: '0.5rem', verticalAlign: 'middle' }}>
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

/* ── Item standar navbar (urutan & label dipertahankan) ────── */
const DEFAULT_ITEMS = [
  { to: '/dasbor', label: 'Dasbor', icon: <DashboardIcon /> },
  { to: '/pilih', label: 'Pemilihan', icon: <VoteIcon /> },
  { to: '/pesan-terenkripsi', label: 'Pesan Terenkripsi', icon: <LockIcon /> },
  { to: '/pengaturan', label: 'Pengaturan', icon: <SettingsIcon /> },
]

/* ── Brand default (logo) ─────────────────────────────────── */
function DefaultBrand() {
  return (
    <Link to="/dasbor" className="dash-brand" title="TrueCount">
      <img src={navLogoLight} alt="TrueCount" className="dash-brand-logo" />
    </Link>
  )
}

/* ── Komponen navbar dasbor yang dapat digunakan ulang ─────── */
export default function DashNav({
  active = '/dasbor',
  brand = <DefaultBrand />,
  items = DEFAULT_ITEMS,
  extraNavItems,
  onLogout,
}) {
  if (!onLogout) {
    throw new Error('DashNav requires an onLogout prop')
  }

  return (
    <header className="dash-nav">
      {brand}

      <nav className="dash-nav-links" aria-label="Navigasi dasbor">
        {items.map((item, i) => {
          const isActive = item.active === true || (item.to && item.to === active)
          const Comp = item.to ? Link : 'span'
          return (
            <Comp
              key={i}
              {...(item.to ? { to: item.to } : {})}
              className={`dash-nav-item${isActive ? ' dash-nav-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </Comp>
          )
        })}
        {extraNavItems}
      </nav>

      <button className="dash-logout" onClick={onLogout}>
        <ExitIcon /> Keluar
      </button>
    </header>
  )
}
