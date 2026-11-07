import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './AuthPage.css'

/** Baca response server sebagai JSON — kalau bukan JSON (error HTML PHP dsb),
 *  jangan pernah tampilkan mentah ke user. */
async function readJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    console.error('[TrueCount] Respons server bukan JSON:', text.slice(0, 400))
    throw new Error('Server sedang mengalami gangguan. Silakan coba lagi sebentar.')
  }
}

/* ── Ikon dongle — SVG stroke konsisten ──────────────────── */
function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10.5 12.5 20 3M17 6l3 3M14 9l3 3" />
    </svg>
  )
}

export default function LoginPage() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const [form, setForm]       = useState({ identifier: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  // ── Notifikasi "akun baru dibuat" dari halaman pendaftaran ──────────
  const [notice, setNotice] = useState(
    () => (location.state?.registered ? 'Akun berhasil dibuat. Silakan masuk.' : '')
  )
  useEffect(() => {
    // Bersihkan state riwayat agar banner tidak muncul lagi saat refresh
    if (location.state?.registered) {
      navigate('/masuk', { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Dongle status (dummy — nanti diganti deteksi WebAuthn/USB real) ────────
  const [dongleStatus, setDongleStatus] = useState({
    connected: false,           // true kalau dongle terdeteksi
    name: 'TrueCount Key',      // nama dongle
    lastSeen: null,             // timestamp terakhir terdeteksi
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function handleBack() {
    // Selalu ke landing — jangan pakai history.back()/navigate(-1):
    // setelah logout, riwayat masih berisi /dasbor dan user bisa "masuk" lagi tanpa token.
    navigate('/')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await readJson(res)
      if (!res.ok) { setError(data.error || 'Login gagal. Silakan coba lagi.'); return }
      localStorage.setItem('tc_token', data.token)
      navigate('/dasbor')
    } catch (err) {
      setError(
        err?.message && err.message !== 'Failed to fetch'
          ? err.message
          : 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <button
          type="button"
          className="back-btn"
          onClick={handleBack}
          aria-label="Kembali ke halaman sebelumnya"
          title="Kembali"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3.5 5.5 8 10 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <Link to="/" className="brand-link">TrueCount</Link>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h1>Selamat datang</h1>
          <p>Masuk ke akun TrueCount Anda</p>
        </div>

        {notice && (
          <p className="auth-success" role="status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {notice}
          </p>
        )}

        {/* ── Status Dongle (dummy — Sprint 4: deteksi USB/WebAuthn asli) ── */}
        <div
          className={`dongle-status${dongleStatus.connected ? ' dongle-status--ok' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span className="dongle-dot" aria-hidden="true" />
          <span className="dongle-icon" aria-hidden="true">
            <KeyIcon />
          </span>
          <span className="dongle-info">
            <span className="dongle-name">
              {dongleStatus.connected ? 'Dongle terpasang' : 'Dongle tidak terdeteksi'}
            </span>
            <span className="dongle-sub">
              {dongleStatus.connected
                ? 'TrueCount Key · terverifikasi'
                : 'Colokkan dongle TrueCount untuk pengamanan tambahan'}
            </span>
          </span>
          <button
            type="button"
            className="dongle-demo-btn"
            onClick={() => setDongleStatus(prev => ({ ...prev, connected: !prev.connected }))}
            title="Simulasikan pasang/cabut dongle (demo)"
          >
            Demo
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="identifier">Username atau email</label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="anda@contoh.com"
              value={form.identifier}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Kata sandi</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <p className="field-error" role="alert">{error}</p>}

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading
              ? <span className="btn-loading"><span className="spinner" />Memproses…</span>
              : 'Masuk'}
          </button>
        </form>

        <p className="auth-footer-text">
          Butuh akun?{' '}
          <span className="auth-footer-note">Minta tautan undangan dari admin TrueCount.</span>
        </p>
      </div>

      <div className="auth-mosaic" aria-hidden="true" />
    </div>
  )
}
