import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingPage.css'

/* ── SVG Icon system ─────────────────────────────────────── */
function Icon({ name, size = 20 }) {
  const icons = {
    lock: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    ballot: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2"/>
        <line x1="8" y1="9"  x2="16" y2="9"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="12" y2="17"/>
      </svg>
    ),
    chain: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
    eye: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    shield: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    chart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
    arrow: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    ),
    check: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    menu: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="20" y2="6"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="18" x2="20" y2="18"/>
      </svg>
    ),
    close: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  }
  return icons[name] ?? null
}

/* ── Generative mosaic (animasi fade-in per sel) ─────────── */
const COLORS = ['#e8231a','#2a7a3b','#3468b0','#d4c4a0','#7a4a2a','#0d0d0d']
const COLS = 20
const ROWS = 13

function seedRng(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function MosaicCanvas() {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    function resize() {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
    }
    resize()

    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    const cellW = W / COLS
    const cellH = H / ROWS
    const GAP   = 3

    const rng   = seedRng(73)
    const cells = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const vis = rng() > 0.3
        if (!vis) continue
        cells.push({
          x: c * cellW + GAP / 2,
          y: r * cellH + GAP / 2,
          w: cellW * (rng() > 0.6 ? 2 : 1) - GAP,
          h: cellH * (rng() > 0.5 ? 2 : 1) - GAP,
          color: COLORS[Math.floor(rng() * COLORS.length)],
          delay: rng() * 1800,   // ms
          alpha: 0,
        })
      }
    }

    let start = null
    function draw(ts) {
      if (!start) start = ts
      const elapsed = ts - start
      ctx.clearRect(0, 0, W, H)
      cells.forEach(cell => {
        const t = Math.min(1, Math.max(0, (elapsed - cell.delay) / 600))
        cell.alpha = t * t * (3 - 2 * t)          // smoothstep
        ctx.globalAlpha = cell.alpha * 0.92
        ctx.fillStyle   = cell.color
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h)
      })
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return <canvas ref={canvasRef} className="mosaic-canvas" aria-hidden="true" />
}

/* ── Scroll-reveal hook ─────────────────────────────────── */
function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

/* ── Main component ─────────────────────────────────────── */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [stepRef, stepVis]   = useReveal()
  const [featRef, featVis]   = useReveal()
  const [secRef,  secVis]    = useReveal()

  const features = [
    { icon: 'lock',   title: 'Kata Sandi Argon2id',    body: 'Kata sandi di-hash dengan Argon2id — tahan terhadap serangan GPU dan side-channel.' },
    { icon: 'ballot', title: 'Surat Suara Terenkripsi', body: 'Enkripsi AES-256-GCM memastikan tidak ada yang bisa membaca suara Anda, bahkan server.' },
    { icon: 'chain',  title: 'Audit Blockchain',        body: 'Setiap kejadian pemilihan dicatat dan dirantai. Manipulasi dapat dideteksi secara matematis.' },
    { icon: 'eye',    title: 'Privasi by Design',       body: 'Partisipasi pemilih dan isi suara disimpan di tabel terpisah yang tidak terhubung.' },
    { icon: 'shield', title: 'Autentikasi Multi-Faktor', body: 'Dukungan biometrik WebAuthn dan token USB untuk identitas berkeamanan tinggi.' },
    { icon: 'chart',  title: 'Hasil Real-Time',         body: 'Admin dapat mempublikasikan hasil secara instan setelah pemilihan ditutup.' },
  ]

  return (
    <div className="landing">

      {/* ── Nav ── */}
      <header className="nav">
        <span className="nav-brand">TrueCount</span>

        <nav className={`nav-links ${menuOpen ? 'nav-links--open' : ''}`} aria-label="Navigasi utama">
          <a href="#cara-kerja"  onClick={() => setMenuOpen(false)}>Cara Kerja</a>
          <a href="#fitur"       onClick={() => setMenuOpen(false)}>Fitur</a>
          <a href="#keamanan"    onClick={() => setMenuOpen(false)}>Keamanan</a>
        </nav>

        <div className="nav-actions">
          <Link to="/masuk"   className="btn-ghost">Masuk</Link>
          <Link to="/daftar"  className="btn-solid">Daftar</Link>
        </div>

        <button
          className="nav-hamburger"
          aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
        </button>
      </header>

      {/* ── Hero ── */}
      <main className="hero">
        <div className="hero-text reveal-hero">
          <p className="hero-eyebrow">Platform E-Voting Akademik</p>
          <h1>
            Pemilihan yang<br />bisa dipercaya.
          </h1>
          <p className="hero-sub">
            TrueCount adalah platform e-voting yang aman dan transparan —
            dibangun dengan enkripsi ujung-ke-ujung dan integritas surat suara
            yang dapat diverifikasi.
          </p>
          <div className="hero-cta">
            <Link to="/daftar" className="btn-solid btn-lg">
              Mulai sekarang <Icon name="arrow" size={16} />
            </Link>
            <a href="#cara-kerja" className="btn-ghost btn-lg">Pelajari caranya</a>
          </div>
        </div>
        <div className="hero-mosaic" aria-hidden="true">
          <MosaicCanvas />
        </div>
      </main>

      {/* ── Cara Kerja ── */}
      <section id="cara-kerja" className="section">
        <p className="section-label">Cara Kerja</p>
        <div
          ref={stepRef}
          className={`steps ${stepVis ? 'steps--visible' : ''}`}
        >
          {[
            {
              n: '01',
              title: 'Daftarkan akun',
              body:  'Buat akun dengan email institusi Anda. Identitas diverifikasi sekali — lalu dipisahkan dari suara Anda.',
              icon:  'check',
            },
            {
              n: '02',
              title: 'Berikan suara',
              body:  'Pilih kandidat Anda. Suara dienkripsi di sisi klien sebelum meninggalkan perangkat Anda.',
              icon:  'ballot',
            },
            {
              n: '03',
              title: 'Verifikasi hasil',
              body:  'Setiap surat suara dicatat di blockchain. Rekapitulasi bersifat publik dan dapat diaudit.',
              icon:  'chain',
            },
          ].map((s, i) => (
            <div className="step" key={s.n} style={{ '--delay': `${i * 120}ms` }}>
              <span className="step-num">{s.n}</span>
              <div className="step-icon-wrap" aria-hidden="true">
                <Icon name={s.icon} size={18} />
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fitur ── */}
      <section id="fitur" className="section section-alt">
        <p className="section-label">Fitur Unggulan</p>
        <div
          ref={featRef}
          className={`feature-grid ${featVis ? 'feature-grid--visible' : ''}`}
        >
          {features.map((f, i) => (
            <div className="feature-card" key={f.title} style={{ '--delay': `${i * 80}ms` }}>
              <div className="feature-icon-wrap" aria-hidden="true">
                <Icon name={f.icon} size={20} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Keamanan ── */}
      <section
        id="keamanan"
        className={`section security-strip ${secVis ? 'security-strip--visible' : ''}`}
        ref={secRef}
      >
        <div className="security-inner">
          <div className="security-badge" aria-hidden="true">
            <Icon name="shield" size={28} />
          </div>
          <h2>Dirancang aman sejak awal.</h2>
          <p>
            TrueCount adalah simulasi akademik dari sistem e-voting tingkat produksi.
            Setiap keputusan desain — dari anonimitas suara hingga manajemen kunci —
            mengikuti prinsip keamanan yang ketat.
          </p>
          <Link to="/daftar" className="btn-solid btn-lg">
            Buat akun gratis <Icon name="arrow" size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <span className="nav-brand">TrueCount</span>
        <p>Sistem E-Voting Aman — Proyek Akademik</p>
      </footer>
    </div>
  )
}
