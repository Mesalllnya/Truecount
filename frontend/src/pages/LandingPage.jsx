import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './LandingPage.css'

/* ── Generative pixel mosaic (pure canvas, no images needed) ── */
const COLORS = ['#e8231a', '#2a7a3b', '#3468b0', '#d4c4a0', '#7a4a2a', '#0d0d0d', '#ffffff']
const COLS = 22
const ROWS = 14

function seedRandom(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function buildGrid(seed) {
  const rng = seedRandom(seed)
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      color: COLORS[Math.floor(rng() * COLORS.length)],
      h: rng() > 0.45 ? (rng() > 0.5 ? 2 : 1) : 1,
      w: rng() > 0.55 ? (rng() > 0.5 ? 2 : 1) : 1,
      visible: rng() > 0.28,
    }))
  )
}

function MosaicCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width  = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const cellW = W / COLS
    const cellH = H / ROWS
    const gap = 3

    ctx.clearRect(0, 0, W, H)

    const grid = buildGrid(42)
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell.visible) return
        const x = c * cellW + gap / 2
        const y = r * cellH + gap / 2
        const w = cellW * cell.w - gap
        const h = cellH * cell.h - gap
        ctx.fillStyle = cell.color
        ctx.fillRect(x, y, w, h)
      })
    })
  }, [])

  return <canvas ref={canvasRef} className="mosaic-canvas" aria-hidden="true" />
}

export default function LandingPage() {
  return (
    <div className="landing">
      {/* ── Nav ── */}
      <header className="nav">
        <span className="nav-brand">TrueCount</span>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#security">Security</a>
        </nav>
        <div className="nav-actions">
          <Link to="/login" className="btn-ghost">Log in</Link>
          <Link to="/register" className="btn-solid">Get started</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="hero" aria-label="Hero section">
        <div className="hero-text">
          <h1>
            Voting you<br />can trust.
          </h1>
          <p className="hero-sub">
            A secure, transparent e-voting platform for academic elections —
            built with end-to-end encryption and verifiable ballot integrity.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn-solid btn-lg">Start voting →</Link>
            <a href="#how-it-works" className="btn-ghost btn-lg">See how it works</a>
          </div>
        </div>
        <div className="hero-mosaic" aria-hidden="true">
          <MosaicCanvas />
        </div>
      </main>

      {/* ── How it works ── */}
      <section id="how-it-works" className="section">
        <h2 className="section-label">How it works</h2>
        <div className="steps">
          {[
            { n: '01', title: 'Register your account', body: 'Sign up with your institutional email. Your identity is verified once — then kept separate from your vote.' },
            { n: '02', title: 'Cast your ballot',       body: 'Select your candidate. Your vote is encrypted client-side before it ever leaves your device.' },
            { n: '03', title: 'Verify the result',      body: 'Every ballot is recorded on an append-only blockchain. The tally is public and auditable.' },
          ].map(s => (
            <div className="step" key={s.n}>
              <span className="step-num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="section section-alt">
        <h2 className="section-label">Features</h2>
        <div className="feature-grid">
          {[
            { icon: '🔐', title: 'Argon2id passwords',   body: 'Passwords are hashed with Argon2id — resistant to GPU and side-channel attacks.' },
            { icon: '🗳️', title: 'Encrypted ballots',    body: 'AES-256-GCM encryption ensures no one can read your vote, even the server.' },
            { icon: '⛓️', title: 'Blockchain audit log', body: 'Every election event is chained and signed. Tampering is mathematically detectable.' },
            { icon: '👁️', title: 'Privacy by design',    body: 'Voter participation and ballot contents are stored in separate, unlinked tables.' },
            { icon: '🪪', title: 'Multi-factor auth',    body: 'WebAuthn biometrics and USB token support for high-assurance identities (Sprint 4).' },
            { icon: '📊', title: 'Real-time results',    body: 'Admins can publish tallies instantly once an election closes, with full audit trail.' },
          ].map(f => (
            <div className="feature-card" key={f.title}>
              <span className="feature-icon" aria-hidden="true">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Security callout ── */}
      <section id="security" className="section security-strip">
        <div className="security-inner">
          <h2>Built secure from day&nbsp;one.</h2>
          <p>
            TrueCount is an academic simulation of a production-grade e-voting system.
            Every design decision — from ballot anonymity to key management — follows
            security-first principles.
          </p>
          <Link to="/register" className="btn-solid btn-lg">Create an account</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <span className="nav-brand">TrueCount</span>
        <p>Secure E-Voting System — Academic Project</p>
      </footer>
    </div>
  )
}
