import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import raiseHand from '/raise_hand.jpg'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import './LandingPage.css'

/* ── SVG Icons ───────────────────────────────────────────── */
function Icon({ name, size = 20 }) {
  const icons = {
    lock: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
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
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
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
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    ),
    login: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
        <polyline points="10 17 15 12 10 7"/>
        <line x1="15" y1="12" x2="3" y2="12"/>
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
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  }
  return icons[name] ?? null
}

/* Pintu yang terbuka saat tombol sign-in di-hover, tutup saat kursor keluar. */
function DoorIcon() {
  return (
    <svg className="door-signin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* pintu (bingkai) */}
      <rect x="2" y="4" width="20" height="16" rx="1" />
      {/* daun pintu yang berayun di sisi kiri (scharnir) */}
      <g className="door-panel">
        <rect x="3" y="5" width="13" height="14" rx="0.5" fill="currentColor" />
        {/* knop pintu warna kuning kebr (brass) */}
        <circle cx="15" cy="12" r="0.8" fill="#d97706" />
      </g>
    </svg>
  )
}

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

/* ── Main ────────────────────────────────────────────────── */
export default function LandingPage() {
  const [stepRef, stepVis] = useReveal()
  const [featRef, featVis] = useReveal()
  const [secRef,  secVis]  = useReveal()

  const features = [
    { icon: 'lock',   title: 'Kata Sandi Argon2id',      body: 'Kata sandi di-hash dengan Argon2id - tahan terhadap serangan GPU dan side-channel.' },
    { icon: 'ballot', title: 'Surat Suara Terenkripsi',   body: 'Enkripsi AES-256-GCM memastikan tidak ada yang bisa membaca suara Anda, bahkan server.' },
    { icon: 'chain',  title: 'Audit Blockchain',           body: 'Setiap kejadian pemilihan dicatat dan dirantai. Manipulasi dapat dideteksi secara matematis.' },
    { icon: 'eye',    title: 'Privasi by Design',          body: 'Partisipasi pemilih dan isi suara disimpan di tabel terpisah yang tidak terhubung.' },
    { icon: 'shield', title: 'Autentikasi Multi-Faktor',   body: 'Dukungan biometrik WebAuthn dan token USB untuk identitas berkeamanan tinggi.' },
    { icon: 'chart',  title: 'Hasil Real-Time',            body: 'Admin dapat mempublikasikan hasil secara instan setelah pemilihan ditutup.' },
  ]

  return (
    <div className="landing">

            {/* ══ HERO ═════════════════════════════════════════════ */}
      <main className="hero">

        {/* Left - text */}
        <div className="hero-text">
          <p className="hero-eyebrow">Platform E-Voting</p>
          <h1>
            Suara<br />
            <em>kamu</em><br />
            terhitung.
          </h1>
          <p className="hero-sub">
            TrueCount adalah platform e-voting yang aman dan transparan -
            dibangun dengan enkripsi ujung-ke-ujung dan integritas surat suara
            yang dapat diverifikasi.
          </p>
          <div className="hero-cta">
            <Link to="/masuk" className="btn-solid btn-lg">
              <DoorIcon />
              Masuk sekarang <Icon name="arrow" size={16} />
            </Link>
            <a href="#cara-kerja" className="btn-ghost btn-lg">Pelajari caranya</a>
          </div>

          {/* stat bar */}
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-num">100%</span>
              <span className="hero-stat-label">Terenkripsi</span>
            </div>
            <div className="hero-stat-divider" aria-hidden="true" />
            <div className="hero-stat">
              <span className="hero-stat-num">0</span>
              <span className="hero-stat-label">Data bocor</span>
            </div>
            <div className="hero-stat-divider" aria-hidden="true" />
            <div className="hero-stat">
              <span className="hero-stat-num">3×</span>
              <span className="hero-stat-label">Verifikasi berlapis</span>
            </div>
          </div>
        </div>

        {/* Right - artsy image panel */}
        <div className="hero-visual" aria-hidden="true">
          {/* accent bar */}
          <div className="hero-visual-accent" />
          <div className="hero-visual-frame">
            <img
              src={raiseHand}
              alt="Tangan terangkat - simbol partisipasi demokratis"
              className="hero-img"
            />
            {/* floating label */}
            <div className="hero-img-tag">
              <Icon name="check" size={12} />
              <span>Suara terverifikasi</span>
            </div>
          </div>
          {/* decorative type */}
          <p className="hero-deco-text" aria-hidden="true">VOTE · SECURE · TRUST</p>
        </div>
      </main>

      {/* ══ CARA KERJA ═══════════════════════════════════════ */}
      <section id="cara-kerja" className="section">
        <div className="section-head">
          <p className="section-label">Cara Kerja</p>
          <h2 className="section-title">Tiga langkah<br />sederhana.</h2>
        </div>
        <div
          ref={stepRef}
          className={`steps${stepVis ? ' steps--visible' : ''}`}
        >
          {[
            { n: '01', icon: 'check',  title: 'Terima undangan',    body: 'Admin mengirim tautan undangan. Klaim akun Anda - identitas diverifikasi sekali, lalu dipisahkan dari suara.' },
            { n: '02', icon: 'ballot', title: 'Berikan suara',      body: 'Pilih kandidat Anda. Suara dienkripsi di sisi klien sebelum meninggalkan perangkat Anda.' },
            { n: '03', icon: 'chain',  title: 'Verifikasi hasil',   body: 'Setiap surat suara dicatat di blockchain. Rekapitulasi bersifat publik dan dapat diaudit.' },
          ].map((s, i) => (
            <div className="step" key={s.n} style={{ '--delay': `${i * 140}ms` }}>
              <span className="step-num">{s.n}</span>
              <div className="step-icon-wrap"><Icon name={s.icon} size={18} /></div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FITUR ════════════════════════════════════════════ */}
      <section id="fitur" className="section section-dark">
        <div className="section-head section-head--light">
          <p className="section-label">Fitur Unggulan</p>
          <h2 className="section-title">Keamanan berlapis,<br />bukan sekadar klaim.</h2>
        </div>
        <div
          ref={featRef}
          className={`feature-grid${featVis ? ' feature-grid--visible' : ''}`}
        >
          {features.map((f, i) => (
            <div className="feature-card" key={f.title} style={{ '--delay': `${i * 80}ms` }}>
              <div className="feature-icon-wrap"><Icon name={f.icon} size={20} /></div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ KEAMANAN ═════════════════════════════════════════ */}
      <section
        id="keamanan"
        ref={secRef}
        className={`section security-strip${secVis ? ' security-strip--visible' : ''}`}
      >
        <div className="security-inner">
          <div className="security-badge"><Icon name="shield" size={24} /></div>
          <h2>Dirancang aman<br />sejak awal.</h2>
          <p>
            TrueCount adalah simulasi akademik dari sistem e-voting tingkat produksi.
            Setiap keputusan desain - dari anonimitas suara hingga manajemen kunci -
            mengikuti prinsip keamanan yang ketat.
          </p>
          <Link to="/masuk" className="btn-solid btn-lg">
            <DoorIcon />
            Masuk ke TrueCount <Icon name="arrow" size={16} />
          </Link>
        </div>
        <div className="security-visual" aria-hidden="true">
          <img src={raiseHand} alt="" className="security-img" />
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════ */}
      <footer className="footer">
        <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
          <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
        </Link>
        <p className="footer-reserve">All right reserve Tim Larisal</p>
        <nav className="footer-links">
          <Link to="/tentang">Tentang Kami</Link>
        </nav>
      </footer>

    </div>
  )
}

