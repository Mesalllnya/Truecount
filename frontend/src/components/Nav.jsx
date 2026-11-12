import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuthSession'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import { LogIn, LogOut, Menu, X } from 'lucide-react'
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

/* ── Komponen navbar seragam (digunakan seluruh aplikasi) ─── */
export default function Nav({
  className = '',
  brand = <DefaultBrand />,
  links,
  onLogout,
  user,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, isAuthenticated } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

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

  return (
    <header className={`nav ${isScrolled ? 'nav--scrolled' : ''} ${className}`} role="banner">
      {brand}

      <nav className={`nav-links${menuOpen ? ' nav-links--open' : ''}`} aria-label="Navigasi utama">
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
        {isAuthenticated ? (
          <div className="nav-user-menu">
            {user && <span className="nav-user-name">{user.username}</span>}
            <button
              type="button"
              className="nav-logout"
              onClick={handleLogoutClick}
              aria-label="Keluar"
            >
              <LogOut size={17} strokeWidth={1.5} className="door-icon" />
              <span>Keluar</span>
            </button>
          </div>
        ) : (
          <Link to="/masuk" className="nav-masuk" onClick={() => setMenuOpen(false)}>
            <LogIn size={17} strokeWidth={1.5} className="door-icon" />
            <span>Masuk</span>
          </Link>
        )}
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
