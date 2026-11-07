import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ identifier: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function handleBack() {
    // Kembali ke halaman sebelumnya; kalau dibuka langsung (tanpa riwayat), ke landing
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
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
          Belum punya akun?{' '}
          <Link to="/daftar">Daftar sekarang</Link>
        </p>
      </div>

      <div className="auth-mosaic" aria-hidden="true" />
    </div>
  )
}
