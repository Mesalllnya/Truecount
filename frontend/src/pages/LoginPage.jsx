import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './AuthPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ identifier: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
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
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login gagal.'); return }
      localStorage.setItem('tc_token', data.token)
      navigate('/dasbor')
    } catch (err) {
      setError('Tidak dapat terhubung ke server. (' + (err?.message || 'network error') + ')')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
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
