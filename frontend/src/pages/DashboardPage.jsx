import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './DashboardPage.css'

/* ── Icon components ─────────────────────────────────────── */
function BallotIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2"/>
      <line x1="8" y1="9"  x2="16" y2="9"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  )
}

function ExitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* door frame */}
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      {/* arrow out */}
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

/* ── Web Audio beep ──────────────────────────────────────── */
function playBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type      = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => ctx.close()
  } catch {
    // AudioContext tidak tersedia — skip
  }
}

/* ── Easter Egg Overlay ──────────────────────────────────── */
function EasterEgg({ username, onClose }) {
  return (
    <div
      className="egg-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Easter egg — tutup dengan klik di mana saja"
    >
      {/* ripple circles */}
      <span className="egg-ripple egg-ripple--1" aria-hidden="true" />
      <span className="egg-ripple egg-ripple--2" aria-hidden="true" />
      <span className="egg-ripple egg-ripple--3" aria-hidden="true" />

      {/* notification card */}
      <div className="egg-card" onClick={e => e.stopPropagation()}>
        <div className="egg-avatar" aria-hidden="true">
          {username?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <p className="egg-greeting">Hei, <strong>{username ?? 'Pengguna'}</strong>!</p>
        <p className="egg-sub">Kamu sudah menemukan easter egg tersembunyi.</p>
        <button className="egg-close" onClick={onClose}>Tutup</button>
      </div>
    </div>
  )
}

/* ── Main ────────────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate   = useNavigate()
  const [clicks, setClicks]   = useState(0)
  const [showEgg, setShowEgg] = useState(false)

  // Ambil username dari token yang tersimpan
  const getUsername = useCallback(() => {
    try {
      const token   = localStorage.getItem('tc_token')
      if (!token) return null
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.username ?? null
    } catch {
      return null
    }
  }, [])

  function handleBrandClick() {
    setClicks(prev => {
      const next = prev + 1
      if (next >= 5) {
        playBeep()
        setShowEgg(true)
        return 0   // reset counter
      }
      return next
    })
  }

  function handleLogout() {
    localStorage.removeItem('tc_token')
    navigate('/masuk')
  }

  return (
    <div className="dash-shell">

      {/* Easter egg overlay */}
      {showEgg && (
        <EasterEgg
          username={getUsername()}
          onClose={() => setShowEgg(false)}
        />
      )}

      <header className="dash-nav">
        {/* Brand — klik 5x untuk easter egg */}
        <button
          className="dash-brand"
          onClick={handleBrandClick}
          aria-label={`TrueCount — klik ${5 - clicks} kali lagi`}
          title="TrueCount"
        >
          TrueCount
          {clicks > 0 && clicks < 5 && (
            <span className="dash-brand-dots" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`dash-brand-dot${i < clicks ? ' active' : ''}`} />
              ))}
            </span>
          )}
        </button>

        <nav className="dash-nav-links" aria-label="Navigasi dasbor">
          <a href="#" className="dash-nav-item dash-nav-active">Dasbor</a>
          <a href="#" className="dash-nav-item">Pemilihan</a>
          <a href="#" className="dash-nav-item">Surat Suara Saya</a>
        </nav>

        <button className="dash-logout" onClick={handleLogout}>
          <ExitIcon />
          Keluar
        </button>
      </header>

      <main className="dash-main">
        <div className="dash-empty">
          <div className="dash-empty-icon" aria-hidden="true">
            <BallotIcon />
          </div>
          <h1>Belum ada pemilihan</h1>
          <p>Pemilihan yang sedang aktif akan muncul di sini setelah admin membukanya.</p>
        </div>
      </main>
    </div>
  )
}
