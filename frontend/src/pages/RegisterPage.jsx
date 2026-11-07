import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

/* ── Ikon kunci — SVG stroke konsisten ───────────────────── */
function LockIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

const ROLE_LABEL = { voter: 'Pemilih', admin: 'Admin' }

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = (searchParams.get('undangan') ?? '').trim()

  // verifikasi | valid | invalid | missing
  const [inviteState, setInviteState] = useState('verifying')
  const [inviteError, setInviteError] = useState('')
  const [invite, setInvite]       = useState(null)

  const [form, setForm]   = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ── Verifikasi undangan saat halaman dibuka ──────────────
  useEffect(() => {
    if (!inviteToken) {
      setInviteState('missing')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res  = await fetch(
          `http://localhost:8000/invites/verify?token=${encodeURIComponent(inviteToken)}`
        )
        const data = await readJson(res)
        if (cancelled) return
        if (!res.ok) {
          setInviteState('invalid')
          setInviteError(data.error || 'Undangan tidak valid.')
          return
        }
        setInvite(data.invite)
        setInviteState('valid')
        // Email terikat undangan → prefill + kunci field
        if (data.invite?.email) {
          setForm(prev => ({ ...prev, email: data.invite.email }))
        }
      } catch (err) {
        if (cancelled) return
        setInviteState('invalid')
        setInviteError(
          err?.message && err.message !== 'Failed to fetch'
            ? err.message
            : 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
        )
      }
    })()
    return () => { cancelled = true }
  }, [inviteToken])

  function handleBack() {
    navigate('/')
  }

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
          username:     form.username,
          email:        form.email,
          password:     form.password,
          invite_token: inviteToken,
        }),
      })
      const data = await readJson(res)
      if (!res.ok) { setError(data.error || 'Pendaftaran gagal.'); return }
      navigate('/masuk', {
        state: { registered: true, username: form.username },
      })
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

  // ── State: memeriksa undangan ────────────────────────────
  if (inviteState === 'verifying') {
    return (
      <div className="auth-shell">
        <div className="auth-brand">
          <Link to="/" className="brand-link">TrueCount</Link>
        </div>
        <div className="auth-state">
          <span className="auth-state-spinner" aria-hidden="true" />
          <h1>Memeriksa undangan…</h1>
        </div>
      </div>
    )
  }

  // ── State: tidak ada undangan (halaman dibuka langsung) ──
  if (inviteState === 'missing') {
    return (
      <div className="auth-shell">
        <div className="auth-brand">
          <button type="button" className="back-btn" onClick={handleBack} aria-label="Kembali ke beranda" title="Kembali">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Link to="/" className="brand-link">TrueCount</Link>
        </div>
        <div className="auth-state">
          <div className="auth-state-icon" aria-hidden="true"><LockIcon /></div>
          <h1>Pendaftaran hanya melalui undangan</h1>
          <p>
            Untuk menjaga integritas pemilihan, akun TrueCount dibuat lewat
            tautan undangan yang dikirim admin. Kalau Anda belum menerimanya,
            hubungi administrator pemilihan Anda.
          </p>
          <Link to="/masuk" className="btn-submit auth-state-cta">Masuk dengan akun yang ada</Link>
        </div>
        <div className="auth-mosaic" aria-hidden="true" />
      </div>
    )
  }

  // ── State: undangan tidak valid / kedaluwarsa / terpakai ─
  if (inviteState === 'invalid') {
    return (
      <div className="auth-shell">
        <div className="auth-brand">
          <button type="button" className="back-btn" onClick={handleBack} aria-label="Kembali ke beranda" title="Kembali">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Link to="/" className="brand-link">TrueCount</Link>
        </div>
        <div className="auth-state">
          <div className="auth-state-icon auth-state-icon--error" aria-hidden="true"><LockIcon /></div>
          <h1>Undangan tidak berlaku</h1>
          <p>{inviteError}</p>
          <Link to="/masuk" className="btn-submit auth-state-cta">Masuk dengan akun yang ada</Link>
        </div>
        <div className="auth-mosaic" aria-hidden="true" />
      </div>
    )
  }

  // ── State: undangan valid → form pendaftaran ─────────────
  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <button type="button" className="back-btn" onClick={handleBack} aria-label="Kembali ke halaman sebelumnya" title="Kembali">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Link to="/" className="brand-link">TrueCount</Link>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <h1>Klaim undangan</h1>
          <p>Selesaikan detail akun Anda untuk bergabung dengan TrueCount</p>
        </div>

        {/* ── Chip info undangan ── */}
        <div className="invite-chip" role="status">
          <span className="invite-chip-dot" aria-hidden="true" />
          <span className="invite-chip-text">
            Undangan terverifikasi
            {invite?.role ? ` · peran: ${ROLE_LABEL[invite.role] ?? invite.role}` : ''}
          </span>
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
              disabled={Boolean(invite?.email)}
              title={invite?.email ? 'Email mengikuti undangan' : undefined}
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
