import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import raiseHand from '/raise_hand.jpg'
import Picture from '/Picture.jpg'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import './LandingPage.css'
import Icon from '../components/Icon'
import { apiUrl } from '../lib/appConfig'

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

/* ── Pointer FX ───────────────────────────────────────────
 * Menulis --mx/--my (posisi kursor, %) dan --rx/--ry (rotasi 3D
 * halus) ke elemen lewat CSS custom props. Hanya untuk pointer
 * presisi; nonaktif di touch & reduced-motion. Throttle per frame. */
let heroFxFrame = 0

function heroPointerMove(e) {
  if (e.pointerType === 'touch') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  cancelAnimationFrame(heroFxFrame)
  heroFxFrame = requestAnimationFrame(() => {
    el.style.setProperty('--mx', `${(x * 100).toFixed(2)}%`)
    el.style.setProperty('--my', `${(y * 100).toFixed(2)}%`)
    el.style.setProperty('--ry', `${((x - 0.5) * 6).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`)
  })
}

function heroPointerLeave(e) {
  cancelAnimationFrame(heroFxFrame)
  const el = e.currentTarget
  el.style.setProperty('--rx', '0deg')
  el.style.setProperty('--ry', '0deg')
}

/* ── Cahaya kursor per kartu fitur ─────────────────────── */
function cardGlowMove(e) {
  if (e.pointerType === 'touch') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`)
  el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`)
}

/* ── Main ────────────────────────────────────────────────── */
export default function LandingPage() {
  const [stepRef, stepVis] = useReveal()
  const [featRef, featVis] = useReveal()
  const [secRef,  secVis]  = useReveal()
  const [stepHeadRef, stepHeadVis] = useReveal()
  const [featHeadRef, featHeadVis] = useReveal()

  const features = [
    { icon: 'lock',   title: 'Kata Sandi Argon2id',      body: 'Kata sandi di-hash dengan Argon2id - tahan terhadap serangan GPU dan side-channel.' },
    { icon: 'ballot', title: 'Surat Suara Terenkripsi',   body: 'Enkripsi AES-256-GCM memastikan tidak ada yang bisa membaca suara Anda, bahkan server.' },
    { icon: 'chain',  title: 'Audit Blockchain',           body: 'Setiap kejadian pemilihan dicatat dan dirantai. Manipulasi dapat dideteksi secara matematis.' },
    { icon: 'eye',    title: 'Privasi by Design',          body: 'Partisipasi pemilih dan isi suara disimpan di tabel terpisah yang tidak terhubung.' },
    { icon: 'shield', title: 'Autentikasi Multi-Faktor',   body: 'Dukungan biometrik WebAuthn dan token USB untuk identitas berkeamanan tinggi.' },
    { icon: 'chart',  title: 'Hasil Real-Time',            body: 'Admin dapat mempublikasikan hasil secara instan setelah pemilihan ditutup.' },
  ]

  /* ── Cek server saat tombol Masuk diklik ──
   * Jika backend mati, arahkan ke /server-error tanpa melewati /masuk dulu. */
  const navigate = useNavigate()

  async function handleMasukClick(e) {
    e.preventDefault() // hentikan navigasi bawaan Link ke /masuk
    try {
      const res = await fetch(apiUrl('/health'), {
        method: 'GET',
        signal: AbortSignal.timeout(3500),
      })
      if (!res.ok) {
        navigate('/server-error')
      } else {
        navigate('/masuk')
      }
    } catch {
      navigate('/server-error')
    }
  }

  return (
    <div className="landing">

            {/* ══ HERO ═════════════════════════════════════════════ */}
      <main className="hero">

        {/* Left - text */}
        <div className="hero-text">
          <p className="hero-eyebrow">Platform E-Voting</p>
          <h1>
            <span className="hero-line"><span className="hero-line-inner">Suara</span></span>
            <span className="hero-line" style={{ '--delay': '140ms' }}>
              <span className="hero-line-inner"><em>kamu</em></span>
            </span>
            <span className="hero-line" style={{ '--delay': '280ms' }}>
              <span className="hero-line-inner">terhitung.</span>
            </span>
          </h1>
          <p className="hero-sub">
            TrueCount adalah platform e-voting yang aman dan transparan -
            dibangun dengan enkripsi ujung-ke-ujung dan integritas surat suara
            yang dapat diverifikasi.
          </p>
          <div className="hero-cta">
            <Link to="/masuk" className="btn-solid btn-lg" onClick={handleMasukClick}>
              <Icon name="login" size={20} />
              Masuk sekarang <Icon name="arrow" size={16} className="btn-arrow" />
            </Link>
            <Link to="/daftar" className="btn-ghost btn-lg">
              <Icon name="clipboard" size={20} />
              Daftar dengan undangan
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
        <div
          className="hero-visual"
          aria-hidden="true"
          onPointerMove={heroPointerMove}
          onPointerLeave={heroPointerLeave}
        >
          {/* accent bar */}
          <div className="hero-visual-accent" />
          <div className="hero-visual-frame">
            <img
              src={raiseHand}
              alt="Tangan terangkat - simbol partisipasi demokratis"
              className="hero-img"
            />
            {/* spotlight mengikuti kursor */}
            <div className="hero-visual-glow" />
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
        <div
          ref={stepHeadRef}
          className={`section-head${stepHeadVis ? ' section-head--visible' : ''}`}
        >
          <p className="section-label">Cara Kerja</p>
          <h2 className="section-title">
            <span className="title-line"><span className="title-line-inner">Tiga langkah</span></span>
            <span className="title-line" style={{ '--delay': '110ms' }}>
              <span className="title-line-inner">sederhana.</span>
            </span>
          </h2>
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
        <div
          ref={featHeadRef}
          className={`section-head section-head--light${featHeadVis ? ' section-head--visible' : ''}`}
        >
          <p className="section-label">Fitur Unggulan</p>
          <h2 className="section-title">
            <span className="title-line"><span className="title-line-inner">Keamanan berlapis,</span></span>
            <span className="title-line" style={{ '--delay': '110ms' }}>
              <span className="title-line-inner">bukan sekadar klaim.</span>
            </span>
          </h2>
        </div>
        <div
          ref={featRef}
          className={`feature-grid${featVis ? ' feature-grid--visible' : ''}`}
        >
          {features.map((f, i) => (
            <div
              className="feature-card"
              key={f.title}
              style={{ '--delay': `${i * 80}ms` }}
              onPointerMove={cardGlowMove}
            >
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
          <h2>
            <span className="title-line"><span className="title-line-inner">Dirancang aman</span></span>
            <span className="title-line" style={{ '--delay': '110ms' }}>
              <span className="title-line-inner">sejak awal.</span>
            </span>
          </h2>
          <p>
            TrueCount adalah simulasi akademik dari sistem e-voting tingkat produksi.
            Setiap keputusan desain - dari anonimitas suara hingga manajemen kunci -
            mengikuti prinsip keamanan yang ketat.
          </p>
          <Link to="/masuk" className="btn-solid btn-lg" onClick={handleMasukClick}>
            <Icon name="login" size={20} />
            Masuk ke TrueCount <Icon name="arrow" size={16} className="btn-arrow" />
          </Link>
        </div>
        <div className="security-visual" aria-hidden="true">
          <img src={Picture} alt="" className="security-img" />
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

