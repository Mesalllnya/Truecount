import { useEffect, useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUsbToken } from '../hooks/useUsbToken'
import { useWebAuthnLogin } from '../hooks/useWebAuthn'
import './AuthPage.css'

/** Baca response server sebagai JSON - kalau bukan JSON (error HTML PHP dsb),
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

/* ── Ikon SVG ───────────────────────────────────────────────── */

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10.5 12.5 20 3M17 6l3 3M14 9l3 3" />
    </svg>
  )
}

function FingerprintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 16v-2a4 4 0 0 1 4-4h1v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4h1a4 4 0 0 1 4 4v2" />
      <path d="M8 8c0-1.5.5-3 2-3s2 1.5 2 3" />
      <path d="M12 12v8" />
    </svg>
  )
}

function PasswordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

/* ── Komponen utama ─────────────────────────────────────────── */

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // ── State umum ──────────────────────────────────────────────
  const [selectedMethod, setSelectedMethod] = useState('password')
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ── Notifikasi "akun baru dibuat" ───────────────────────────
  const [notice, setNotice] = useState(
    () => (location.state?.registered ? 'Akun berhasil dibuat. Silakan masuk.' : '')
  )
  useEffect(() => {
    if (location.state?.registered) {
      navigate('/masuk', { replace: true, state: null })
    }
  }, [navigate, location.state])

  // ── Dongle status (deteksi USB asli) ────────────────────────
  const { scanForTokens } = useUsbToken()
  const [dongleStatus, setDongleStatus] = useState({
    connected: false,
    drive: null,
    credentialId: null,
    formatValid: null,
  })

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      const tokens = await scanForTokens()
      if (cancelled) return
      if (tokens.length > 0) {
        const t = tokens[0]
        setDongleStatus({
          connected: true,
          drive: t.drive,
          credentialId: t.credential_id,
          formatValid: t.is_valid === true ? true : false,
        })
      } else {
        setDongleStatus({ connected: false, drive: null, credentialId: null, formatValid: null })
      }
    }
    poll()
    const intervalId = window.setInterval(poll, 2000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [scanForTokens])

  // ── WebAuthn (Windows Hello) ────────────────────────────────
  const {
    isSupported: webauthnSupported,
    isPlatformAvailable: webauthnPlatformAvailable,
    isLoading: webauthnLoading,
    error: webauthnError,
    loginWithWindowsHello,
    clearError: clearWebAuthnError,
  } = useWebAuthnLogin()

  // ── Handler umum ────────────────────────────────────────────
  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
    clearWebAuthnError()
  }

  function handleBack() {
    navigate('/')
  }

  // ── Submit password ─────────────────────────────────────────
  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:8000/auth/login', {
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
        err instanceof Error && err.message !== 'Failed to fetch'
          ? err.message
          : 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
      )
    } finally {
      setLoading(false)
    }
  }

  // ── Submit Windows Hello ────────────────────────────────────
  async function handleWebAuthnLogin() {
    if (!form.identifier.trim()) {
      setError('Masukkan username atau email terlebih dahulu')
      return
    }
    setLoading(true)
    setError('')
    const result = await loginWithWindowsHello(form.identifier.trim())
    if (result) {
      localStorage.setItem('tc_token', result.token)
      navigate('/dasbor')
    }
    setLoading(false)
  }

  // ── Konfigurasi metode auth ─────────────────────────────────
  const authMethods = [
    {
      id: 'webauthn',
      label: 'Windows Hello',
      description: 'Sidik jari, wajah, atau PIN Windows',
      icon: <FingerprintIcon />,
      available: webauthnSupported && webauthnPlatformAvailable,
      unavailableReason: webauthnSupported ? 'Windows Hello tidak tersedia di perangkat ini' : 'Browser tidak mendukung WebAuthn',
    },
    {
      id: 'dongle',
      label: 'Dongle Keamanan',
      description: 'USB token fisik (TrueCount Token)',
      icon: <KeyIcon />,
      available: true,
      unavailableReason: undefined,
    },
    {
      id: 'password',
      label: 'Kata Sandi',
      description: 'Username/email dan kata sandi',
      icon: <PasswordIcon />,
      available: true,
      unavailableReason: undefined,
    },
  ]

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
          <h1>Selamat Datang</h1>
          <p>Masuk ke akun TrueCount Anda</p>
        </div>

        {notice && (
          <p className="auth-success" role="status">
            <CheckIcon />
            {notice}
          </p>
        )}

        {/* ── Pilihan Metode Auth ────────────────────────────── */}
        <div className="auth-method-selector" role="radiogroup" aria-label="Pilih metode masuk">
          {authMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              className={`auth-method-btn ${selectedMethod === method.id ? 'auth-method-btn--active' : ''} ${!method.available ? 'auth-method-btn--disabled' : ''}`}
              onClick={() => method.available && setSelectedMethod(method.id)}
              disabled={!method.available}
              role="radio"
              aria-checked={selectedMethod === method.id}
              aria-disabled={!method.available}
            >
              <span className="auth-method-icon" aria-hidden="true">{method.icon}</span>
              <div className="auth-method-info">
                <span className="auth-method-label">{method.label}</span>
                <span className="auth-method-desc">{method.description}</span>
              </div>
              <ChevronRightIcon />
              {!method.available && (
                <span className="auth-method-badge">Tidak tersedia</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Status Dongle (real-time) ──────────────────────── */}
        {selectedMethod === 'dongle' && (
          <div
            className={`dongle-status
              ${dongleStatus.connected
                ? (dongleStatus.formatValid === false ? ' dongle-status--warn' : ' dongle-status--ok')
                : ''}`}
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
                  ? (dongleStatus.formatValid === false
                      ? `Format token tidak valid · ${dongleStatus.drive}`
                      : `TrueCount Token · ${dongleStatus.drive}`)
                  : 'Colokkan dongle TrueCount untuk masuk'}
              </span>
            </span>
          </div>
        )}

        {/* ── Form Password ──────────────────────────────────── */}
        {selectedMethod === 'password' && (
          <form onSubmit={handlePasswordSubmit} noValidate>
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

            {error && <p className="field-error" role="alert"><AlertIcon />{error}</p>}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading
                ? <span className="btn-loading"><span className="spinner" />Memproses…</span>
                : 'Masuk'}
            </button>
          </form>
        )}

        {/* ── Form Windows Hello ─────────────────────────────── */}
        {selectedMethod === 'webauthn' && (
          <div className="webauthn-form">
            <div className="field">
              <label htmlFor="webauthn-identifier">Username atau email</label>
              <input
                id="webauthn-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                placeholder="anda@contoh.com"
                value={form.identifier}
                onChange={handleChange}
                required
              />
            </div>

            {error && <p className="field-error" role="alert"><AlertIcon />{error}</p>}
            {webauthnError && <p className="field-error" role="alert"><AlertIcon />{webauthnError}</p>}

            <button
              type="button"
              className="btn-submit btn-submit--webauthn"
              onClick={handleWebAuthnLogin}
              disabled={loading || webauthnLoading || !form.identifier.trim()}
            >
              {loading || webauthnLoading ? (
                <span className="btn-loading"><span className="spinner" />Memverifikasi…</span>
              ) : (
                <>
                  <FingerprintIcon />
                  Masuk dengan Windows Hello
                </>
              )}
            </button>

            <p className="webauthn-hint">
              <span className="hint-icon" aria-hidden="true"><FingerprintIcon /></span>
              Pastikan Windows Hello (sidik jari/wajah/PIN) sudah dikonfigurasi di Windows Settings
            </p>
          </div>
        )}

        {/* ── Form Dongle ────────────────────────────────────── */}
        {selectedMethod === 'dongle' && (
          <div className="dongle-form">
            <div className="field">
              <label htmlFor="dongle-identifier">Username atau email</label>
              <input
                id="dongle-identifier"
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
              <label htmlFor="dongle-pin">PIN Dongle</label>
              <input
                id="dongle-pin"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Masukkan PIN dongle"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            {error && <p className="field-error" role="alert"><AlertIcon />{error}</p>}

            <button type="button" className="btn-submit" onClick={handlePasswordSubmit} disabled={loading || !dongleStatus.connected}>
              {loading
                ? <span className="btn-loading"><span className="spinner" />Memproses…</span>
                : 'Masuk dengan Dongle'}
            </button>

            {!dongleStatus.connected && (
              <p className="dongle-hint">
                <span className="hint-icon" aria-hidden="true"><AlertIcon /></span>
                Dongle tidak terdeteksi. Colokkan dongle TrueCount ke port USB.
              </p>
            )}
            {dongleStatus.connected && dongleStatus.formatValid === false && (
              <p className="dongle-hint dongle-hint--warn">
                <span className="hint-icon" aria-hidden="true"><AlertIcon /></span>
                Format token tidak valid. Gunakan dongle TrueCount yang benar.
              </p>
            )}
          </div>
        )}

        <p className="auth-footer-text">
          Butuh akun?{' '}
          <span className="auth-footer-note">Minta tautan undangan dari Panitia</span>
        </p>
      </div>

      <div className="auth-mosaic" aria-hidden="true" />
    </div>
  )
}