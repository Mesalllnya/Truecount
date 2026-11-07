import { useEffect, useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUsbToken, startUsbAuthenticate, verifyUsbAuthenticate, base64urlToBytes, bytesToBase64url } from '../hooks/useUsbToken'
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

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
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

  // ── USB Token Auth (MFA Login) ───────────────────────────────
  // scanForTokens sudah di-destructuring di atas (line ~116)
  const {
    decryptPrivateKey,
    importPrivateKey,
    signChallenge,
    isDecrypting: usbDecrypting,
    error: usbHookError,
  } = useUsbToken()

  const [usbAuthStep, setUsbAuthStep] = useState('idle') // idle | waiting-usb | waiting-pin | signing | done | error
  const [usbAuthError, setUsbAuthError] = useState('')
  const [usbAuthChallengeData, setUsbAuthChallengeData] = useState(null)
  const [usbAuthPin, setUsbAuthPin] = useState('')
  const [usbAuthSelectedDrive, setUsbAuthSelectedDrive] = useState('')
  const [usbAuthPinShow, setUsbAuthPinShow] = useState(false)

  // Auto-detect USB saat step waiting-usb
  useEffect(() => {
    if (usbAuthStep !== 'waiting-usb') return
    let cancelled = false
    const poll = async () => {
      const tokens = await scanForTokens()
      if (!cancelled && tokens.length > 0) {
        setUsbAuthSelectedDrive(tokens[0].drive)
        setUsbAuthStep('waiting-pin')
      }
    }
    poll()
    const intervalId = window.setInterval(poll, 2000)
    return () => { cancelled = true; window.clearInterval(intervalId) }
  }, [usbAuthStep, scanForTokens])

  // Detect USB removal
  useEffect(() => {
    if (usbAuthStep !== 'waiting-pin' && usbAuthStep !== 'signing') return
    let cancelled = false
    const poll = async () => {
      const tokens = await scanForTokens()
      if (!cancelled) {
        const stillThere = tokens.some(t => t.drive === usbAuthSelectedDrive)
        if (!stillThere) {
          setUsbAuthSelectedDrive('')
          setUsbAuthPin('')
          setUsbAuthError('USB dicabut. Colokkan kembali untuk melanjutkan.')
          setUsbAuthStep('waiting-usb')
        }
      }
    }
    const intervalId = window.setInterval(poll, 2000)
    return () => { cancelled = true; window.clearInterval(intervalId) }
  }, [usbAuthStep, usbAuthSelectedDrive, scanForTokens])

  const handleUsbAuthStart = async () => {
    if (!form.identifier.trim()) {
      setError('Masukkan username atau email terlebih dahulu')
      return
    }
    setUsbAuthStep('idle')
    setUsbAuthError('')
    setUsbAuthPin('')
    setUsbAuthSelectedDrive('')
    setUsbAuthChallengeData(null)

    const data = await startUsbAuthenticate(form.identifier.trim())
    if (!data) {
      setUsbAuthStep('error')
      setUsbAuthError('Gagal memulai autentikasi. Coba lagi.')
      return
    }
    setUsbAuthChallengeData(data)
    setUsbAuthStep('waiting-usb')
  }

  const handleUsbAuthSubmitPin = async () => {
    if (!usbAuthSelectedDrive || !usbAuthPin || !usbAuthChallengeData) return
    setUsbAuthStep('signing')
    setUsbAuthError('')

    try {
      // 1. Decrypt private key dari USB
      const decryptResult = await decryptPrivateKey(usbAuthSelectedDrive, usbAuthPin)
      if (!decryptResult) {
        const msg = usbHookError || ''
        if (msg.includes('not found') || msg.includes('tidak ditemukan') || msg.includes('Read file')) {
          setUsbAuthSelectedDrive('')
          setUsbAuthPin('')
          setUsbAuthError('USB dicabut. Colokkan kembali untuk melanjutkan.')
          setUsbAuthStep('waiting-usb')
        } else {
          setUsbAuthStep('error')
          setUsbAuthError(msg || 'Gagal mendekripsi. PIN salah?')
        }
        return
      }

      // 2. Import private key ke Web Crypto
      const privateKey = await importPrivateKey(decryptResult.private_key_jwk)

      // 3. Sign challenge
      const challengeBytes = base64urlToBytes(usbAuthChallengeData.challenge)
      const signature = await signChallenge(privateKey, challengeBytes)
      const signatureB64 = bytesToBase64url(signature)

      // 4. Kirim ke backend untuk verifikasi
      const result = await verifyUsbAuthenticate(
        usbAuthChallengeData.challenge_id,
        usbAuthChallengeData.allowCredentials[0]?.id || '', // credential_id dari allowCredentials
        signatureB64
      )

      if (!result) {
        setUsbAuthStep('error')
        setUsbAuthError('Verifikasi gagal di server.')
        return
      }

      // Success!
      localStorage.setItem('tc_token', result.token)
      navigate('/dasbor')
    } catch (err) {
      setUsbAuthStep('error')
      setUsbAuthError(err?.message || 'Terjadi kesalahan.')
    }
  }

  const handleUsbAuthCancel = () => {
    setUsbAuthStep('idle')
    setUsbAuthError('')
    setUsbAuthPin('')
    setUsbAuthSelectedDrive('')
    setUsbAuthChallengeData(null)
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

        {/* ── Form Dongle (USB Token MFA) ────────────────────────────── */}
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
                disabled={usbAuthStep !== 'idle' && usbAuthStep !== 'error'}
              />
            </div>

            {usbAuthStep === 'idle' && (
              <>
                <div className="field">
                  <label htmlFor="dongle-pin">PIN Dongle</label>
                  <div className="password-input-wrapper">
                    <input
                      id="dongle-pin"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Masukkan PIN dongle (opsional untuk memulai)"
                      value={form.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setUsbAuthPinShow(p => !p)}
                      aria-label={usbAuthPinShow ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                    >
                      {usbAuthPinShow ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {error && <p className="field-error" role="alert"><AlertIcon />{error}</p>}
                {usbAuthError && <p className="field-error" role="alert"><AlertIcon />{usbAuthError}</p>}

                <button
                  type="button"
                  className="btn-submit btn-submit--dongle"
                  onClick={handleUsbAuthStart}
                  disabled={loading || !form.identifier.trim()}
                >
                  {loading ? (
                    <span className="btn-loading"><span className="spinner" />Memulai…</span>
                  ) : (
                    <>
                      <KeyIcon />
                      Mulai Autentikasi Dongle
                    </>
                  )}
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
              </>
            )}

            {usbAuthStep === 'waiting-usb' && (
              <div className="usb-auth-waiting">
                <div className="usb-waiting-icon">
                  <KeyIcon className="usb-pulse" />
                </div>
                <h3>Menunggu Dongle…</h3>
                <p>Colokkan dongle TrueCount ke port USB. Sistem akan mendeteksi otomatis.</p>
                {dongleStatus.connected && dongleStatus.formatValid !== false && (
                  <div className="usb-drive-badge">
                    <KeyIcon /> {dongleStatus.drive} <span className="detected-badge">Terdeteksi</span>
                  </div>
                )}
                {usbAuthError && <p className="field-error inline-error"><AlertIcon />{usbAuthError}</p>}
                <button type="button" className="btn-submit btn-submit--secondary" onClick={handleUsbAuthCancel}>
                  Batal
                </button>
              </div>
            )}

            {(usbAuthStep === 'waiting-pin' || usbAuthStep === 'signing') && (
              <div className="usb-auth-pin">
                <div className="field">
                  <label htmlFor="dongle-auth-pin">PIN Dongle</label>
                  <div className="password-input-wrapper">
                    <input
                      id="dongle-auth-pin"
                      type="password"
                      value={usbAuthPin}
                      onChange={e => setUsbAuthPin(e.target.value)}
                      placeholder="Masukkan PIN untuk dekripsi"
                      autoFocus
                      disabled={usbAuthStep === 'signing'}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setUsbAuthPinShow(p => !p)}
                      aria-label={usbAuthPinShow ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                      disabled={usbAuthStep === 'signing'}
                    >
                      {usbAuthPinShow ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {usbAuthError && <p className="field-error" role="alert"><AlertIcon />{usbAuthError}</p>}

                <button
                  type="button"
                  className="btn-submit btn-submit--dongle"
                  onClick={handleUsbAuthSubmitPin}
                  disabled={!usbAuthPin || usbAuthStep === 'signing' || usbDecrypting}
                >
                  {usbAuthStep === 'signing' || usbDecrypting ? (
                    <span className="btn-loading"><span className="spinner" />Memverifikasi…</span>
                  ) : (
                    <>
                      <KeyIcon />
                      Verifikasi & Masuk
                    </>
                  )}
                </button>
                <button type="button" className="btn-submit btn-submit--secondary" onClick={handleUsbAuthCancel} disabled={usbAuthStep === 'signing'}>
                  Batal
                </button>
              </div>
            )}

            {usbAuthStep === 'error' && (
              <div className="usb-auth-error">
                <div className="error-icon"><AlertIcon /></div>
                <h3>Autentikasi Gagal</h3>
                <p>{usbAuthError || 'Terjadi kesalahan saat autentikasi dongle.'}</p>
                <button type="button" className="btn-submit btn-submit--dongle" onClick={handleUsbAuthStart}>
                  <KeyIcon /> Coba Lagi
                </button>
                <button type="button" className="btn-submit btn-submit--secondary" onClick={handleUsbAuthCancel}>
                  Kembali
                </button>
              </div>
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