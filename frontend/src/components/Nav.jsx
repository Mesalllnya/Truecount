import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { useAuth } from '../hooks/useAuthSession'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import { ChevronDown, ClipboardList, LayoutDashboard, LogIn, LogOut, Menu, Settings, User, X } from 'lucide-react'
import './Nav.css'

/* ── Scroll-reveal hook ─────────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

/* ── Default brand (logo) ─────────────────────────────────── */
function DefaultBrand() {
  return (
    <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
      <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
    </Link>
  )
}

/* ── Identitas akun: avatar inisial + badge role ──────────── */
const ROLE_LABELS = { admin: 'Admin', dev: 'Dev', voter: 'Pemilih' }

const roleLabel = (role) => ROLE_LABELS[role] ?? role ?? ''

function UserAvatar({ username }) {
  const initial = (username || '').trim().charAt(0).toUpperCase() || '?'
  return <span className="nav-avatar" aria-hidden="true">{initial}</span>
}

/* ── Menu akun: tombol identitas + dropdown ───────────────── */
function AccountMenu({ user, onLogout }) {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])

  /* Tutup saat klik di luar */
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  /* Tutup saat tekan Esc (kembalikan fokus ke tombol) */
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  /* Pindahkan fokus ke item pertama saat terbuka */
  useEffect(() => {
    if (!open) return
    const firstItem = menuRef.current?.querySelector('[role="menuitem"]')
    firstItem?.focus()
  }, [open])

  /* Tutup bila fokus keluar dari blok akun (Tab ke luar) */
  const handleBlur = (e) => {
    if (!rootRef.current?.contains(e.relatedTarget)) setOpen(false)
  }

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      else {
        const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])]
        const target = e.key === 'ArrowDown' ? items[0] : items[items.length - 1]
        target?.focus()
      }
    }
  }

  const handleMenuKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])]
    if (!items.length) return
    e.preventDefault()
    const current = items.indexOf(document.activeElement)
    let next
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length
    else next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const role = roleLabel(user.role)
  const roleTone = user.role === 'admin' || user.role === 'dev' ? 'nav-account-role--accent' : ''

  return (
    <div className="nav-account" ref={rootRef} onBlur={handleBlur}>
      <button
        type="button"
        ref={triggerRef}
        className={`nav-account-btn${open ? ' nav-account-btn--open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
      >
        <UserAvatar username={user.username} />
        <span className="nav-account-info">
          <span className="nav-account-name" title={user.username}>{user.username}</span>
          <span className={`nav-account-role ${roleTone}`}>{role}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.5} className="nav-account-chevron" aria-hidden="true" />
      </button>

      <div
        className="nav-account-dropdown"
        id={menuId}
        role="menu"
        aria-label="Menu akun"
        data-open={open}
        ref={menuRef}
        onKeyDown={handleMenuKeyDown}
      >
        <p className="nav-account-email" title={user.email}>{user.email}</p>

        <Link to="/pengaturan" role="menuitem" className="nav-account-item" onClick={close}>
          <Settings size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Pengaturan</span>
        </Link>

        <Link to="/profil" role="menuitem" className="nav-account-item" onClick={close}>
          <User size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Profil</span>
        </Link>

        {/* Endpoint log & pencarian user dibungkus requireAdmin() di backend,
            jadi item ini hanya untuk role admin agar tidak error 403 */}
        {user.role === 'admin' && (
          <Link
            to={`/log-keamanan/${user.id}`}
            role="menuitem"
            className="nav-account-item"
            onClick={close}
          >
            <ClipboardList size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Log Keamanan Saya</span>
          </Link>
        )}

        <div className="nav-account-sep" role="separator" />

        <button
          type="button"
          role="menuitem"
          className="nav-account-item nav-account-item--exit"
          onClick={() => { close(); onLogout() }}
        >
          <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  )
}

/* ── Komponen navbar seragam (digunakan seluruh aplikasi) ─── */
export default function Nav({
  className = '',
  brand = <DefaultBrand />,
  links,
  onLogout,
  user: userProp,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, isAuthenticated, user: authUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  /* Prioritas: konteks autentikasi, prop `user` sebagai fallback */
  const user = authUser ?? userProp ?? null

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const defaultLinks = [
    { href: '/', label: 'Beranda' },
    { href: '/tentang', label: 'Tentang' },
  ]

  const navLinks = links ?? defaultLinks

  const isActive = (href) => location.pathname === href || (href !== '/' && location.pathname.startsWith(href))

  const handleLogoutClick = () => {
    if (onLogout) onLogout()
    else if (logout) { logout(); navigate('/masuk') }
    setMenuOpen(false)
  }

  /* Tombol cepat ke halaman user (dasbor): hanya di halaman publik yang
     nav-nya belum memuat link /dasbor (mis. landing page setelah login). */
  const showDashboardShortcut =
    isAuthenticated && !!user && !navLinks.some((l) => l.href === '/dasbor')

  return (
    <header className={`nav ${isScrolled ? 'nav--scrolled' : ''} ${className}`} role="banner">
      {brand}

      <div className={`nav-menu${menuOpen ? ' nav-menu--open' : ''}`}>
        <nav className="nav-links" aria-label="Navigasi utama">
          {navLinks.map((link, i) => (
            <Link
              key={i}
              to={link.href || '#'}
              className={`nav-link ${isActive(link.href || '/') ? 'nav-link--active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          {isAuthenticated && user ? (
            <>
              {showDashboardShortcut && (
                <Link to="/dasbor" className="nav-masuk nav-dasbor" onClick={() => setMenuOpen(false)}>
                  <LayoutDashboard size={17} strokeWidth={1.5} />
                  <span>Dasbor</span>
                </Link>
              )}
              {/* key per route: menu akun ikut tertutup saat navigasi */}
              <AccountMenu key={location.pathname} user={user} onLogout={handleLogoutClick} />
            </>
          ) : (
            <Link to="/masuk" className="nav-masuk" onClick={() => setMenuOpen(false)}>
              <LogIn size={17} strokeWidth={1.5} className="door-icon" />
              <span>Masuk</span>
            </Link>
          )}
        </div>
      </div>

      <button
        type="button"
        className="nav-hamburger"
        aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {menuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
      </button>
    </header>
  )
}
