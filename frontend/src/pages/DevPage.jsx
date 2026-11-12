import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuthSession'
import { Code2, Workflow, ShieldCheck, ArrowLeft } from 'lucide-react'
import IsometricFlow from '../components/IsometricFlow'
import IsometricCrypto from '../components/IsometricCrypto'
import './DevPage.css'

/**
 * DevPage.jsx
 * Halaman eksklusif Admin + Developer (dijaga RoleGuard di App.jsx).
 * Dua section: Flow Aplikasi + Algoritma Kriptografi, sebagai dokumentasi
 * teknis interaktif & materi pitch deck.
 */
const SECTIONS = [
  { id: 'flow', label: 'Flow Aplikasi', icon: Workflow },
  { id: 'crypto', label: 'Algoritma Kriptografi', icon: ShieldCheck },
]

export default function DevPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState('flow')
  const tabRefs = useRef({ flow: null, crypto: null })

  // Navigasi keyboard antar tab (arrow keys) sesuai pola ARIA tabs.
  const onTabKeyDown = (e, currentId) => {
    const idx = SECTIONS.findIndex((s) => s.id === currentId)
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = SECTIONS[(idx + 1) % SECTIONS.length].id
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = SECTIONS[(idx - 1 + SECTIONS.length) % SECTIONS.length].id
    }
    if (next) {
      e.preventDefault()
      setActiveSection(next)
      tabRefs.current[next]?.focus()
    }
  }

  return (
    <div className="dev-shell">
      <main className="dev-main">
        <header className="dev-page-head">
          <div className="dev-page-title">
            <span className="dev-page-icon" aria-hidden="true">
              <Code2 size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1>Halaman Dev</h1>
              <p>
                Dokumentasi teknis interaktif & materi pitch deck — alur aplikasi dan
                algoritma kriptografi TrueCount.
              </p>
            </div>
          </div>
          <span className="dev-role-badge">{user?.role}</span>
        </header>

        <div className="dev-tabs" role="tablist" aria-label="Pilih section dev">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el
              }}
              type="button"
              role="tab"
              id={`dev-tab-${id}`}
              aria-selected={activeSection === id}
              aria-controls={`dev-panel-${id}`}
              tabIndex={activeSection === id ? 0 : -1}
              className={`dev-tab ${activeSection === id ? 'dev-tab--active' : ''}`}
              onClick={() => setActiveSection(id)}
              onKeyDown={(e) => onTabKeyDown(e, id)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Kedua panel tetap ter-mount supaya state (node terpilih) terjaga saat pindah tab */}
        <div
          role="tabpanel"
          id="dev-panel-flow"
          aria-labelledby="dev-tab-flow"
          hidden={activeSection !== 'flow'}
        >
          <IsometricFlow />
        </div>
        <div
          role="tabpanel"
          id="dev-panel-crypto"
          aria-labelledby="dev-tab-crypto"
          hidden={activeSection !== 'crypto'}
        >
          <IsometricCrypto />
        </div>

        <footer className="dev-footer">
          <p>
            <strong>Catatan:</strong> Halaman ini bersifat read-only dan hanya berisi
            informasi teknis internal. Semua akses dicatat untuk audit. Role Anda:{' '}
            <strong>{user?.role}</strong>.
          </p>
          <button type="button" onClick={() => navigate('/dasbor')} className="dev-btn-back">
            <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            Kembali ke Dasbor
          </button>
        </footer>
      </main>
    </div>
  )
}
