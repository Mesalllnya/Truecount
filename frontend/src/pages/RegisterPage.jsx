import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './AuthPage.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }
    if (form.password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email:    form.email,
          password: form.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Pendaftaran gagal.'); return }
      navigate('/masuk')
    } catch {
      setError('Tidak dapat terhubung ke server.')
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
          <h1>Buat akun</h1>
          <p>Bergabung dengan TrueCount untuk ikut dalam pemilihan yang aman</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="johndoe"
              value={form.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="anda@contoh.com"
              value={form.email}
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
              autoComplete="new-password"
              placeholder="Min. 8 karakter"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="confirm">Konfirmasi kata sandi</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={handleChange}
              required
            />
          </div>

          {error && <p className="field-error" role="alert">{error}</p>}

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading
              ? <span className="btn-loading"><span className="spinner" />Memproses…</span>
              : 'Buat akun'}
          </button>
        </form>

        <p className="auth-footer-text">
          Sudah punya akun?{' '}
          <Link to="/masuk">Masuk di sini</Link>
        </p>
      </div>

      <div className="auth-mosaic" aria-hidden="true" />
    </div>
  )
}
