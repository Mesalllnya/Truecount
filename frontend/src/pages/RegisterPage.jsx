import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import './AuthPage.css'
import { SkeletonText, SkeletonCircle } from '../components/ui/Skeleton'
import Icon from '../components/Icon'
import { apiUrl } from '../lib/appConfig'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import IdPhotoCapture from '../components/IdPhotoCapture'

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

/** Ekstrak token undangan dari input user - bisa link lengkap
 *  (`…/daftar?undangan=<token>`), potongan query, atau kode/token mentah.
 *  Return string token (trimmed), atau '' kalau tidak ada isinya. */
function extractInviteToken(input) {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return ''

  const marker = 'undangan='
  const idx = trimmed.toLowerCase().indexOf(marker)
  if (idx === -1) return trimmed // kode/token mentah → pakai seluruh input

  // Ada param undangan → ambil nilai setelahnya sampai `&`/`#`/spasi berikutnya
  const value = trimmed.slice(idx + marker.length)
  const cut = value.search(/[&#\s]/)
  return (cut === -1 ? value : value.slice(0, cut)).trim()
}

/** Token undangan = kode hex tanpa karakter URL/spasi. Kalau hasil ekstraksi
 *  masih mengandung karakter tersebut, input-nya bukan link/kode undangan.
 *  Validasi sesungguhnya tetap di backend (GET /invites/verify). */
function isPlausibleInviteToken(token) {
  return !/[\s:/?#&=]/.test(token)
}

/* ── Ikon kunci - SVG stroke konsisten ───────────────────── */
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

const ACCOUNT_FIELDS = ['username', 'email', 'password', 'confirm']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validasi satu field form akun. Dipakai untuk cek saat blur dan saat submit. */
function validateAccountField(name, values, usernameStatus) {
  const value = values[name] ?? ''

  switch (name) {
    case 'username':
      if (!value.trim()) return 'Username wajib diisi.'
      if (value.length < 3) return 'Username minimal 3 karakter.'
      if (!/^[a-z0-9_]+$/.test(value)) return 'Username hanya huruf kecil, angka, dan underscore.'
      if (usernameStatus === 'taken') return 'Username sudah dipakai. Pilih username lain.'
      return ''

    case 'email':
      if (!value.trim()) return 'Email wajib diisi.'
      if (!EMAIL_PATTERN.test(value.trim())) return 'Format email tidak valid.'
      return ''

    case 'password':
      if (!value) return 'Kata sandi wajib diisi.'
      if (value.length < 8) return 'Kata sandi minimal 8 karakter.'
      if (!/[0-9]/.test(value)) return 'Kata sandi wajib mengandung minimal 1 angka.'
      if (!/[^a-zA-Z0-9]/.test(value)) {
        return 'Kata sandi wajib mengandung minimal 1 karakter khusus (mis. !@#$%^&*).'
      }
      return ''

    case 'confirm':
      if (!value) return 'Konfirmasi kata sandi wajib diisi.'
      if (value !== values.password) return 'Konfirmasi kata sandi tidak cocok.'
      return ''

    default:
      return ''
  }
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inviteToken = (searchParams.get('undangan') ?? '').trim()

  // verifikasi | valid | invalid | missing
  const [inviteState, setInviteState] = useState('verifying')
  const [inviteError, setInviteError] = useState('')
  const [invite, setInvite]       = useState(null)

  // Input manual link/kode undangan (state missing, alur desktop)
  const [inviteInput, setInviteInput]           = useState('')
  const [inviteInputError, setInviteInputError] = useState('')
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const inviteInputRef = useRef(null)

  const [form, setForm]   = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Field yang sudah pernah kehilangan fokus → boleh menampilkan pesan validasi.
  const [touched, setTouched] = useState({
    username: false, email: false, password: false, confirm: false,
  })
  // Password field visible by default; confirm field masked by default
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [usernameMessage, setUsernameMessage] = useState('')
  const usernameDebounceRef = useRef(null)
  const usernameAbortRef = useRef(null)

  // ID Photo capture step (after invite verified, before account form)
  // State: 'idle' | 'capturing' | 'captured' | 'skipped'
  const [idPhotoStep, setIdPhotoStep] = useState('idle')
  const [idPhotoData, setIdPhotoData] = useState({ dataUrl: null, type: 'ktp' }) // type: 'ktp' | 'sim'
  const [idPhotoError, setIdPhotoError] = useState('')

  // Determine if ID photo is required based on invite role
  // Admin invites also need KTP (per issue #32: "Admin juga perlu foto KTP")
  const isIdPhotoRequired = invite?.role === 'admin' || invite?.role === 'voter'

  // ── Verifikasi undangan saat halaman dibuka ──────────────
  useEffect(() => {
    if (!inviteToken) {
      setInviteState('missing')
      setSubmittingInvite(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res  = await fetch(
          apiUrl(`/invites/verify?token=${encodeURIComponent(inviteToken)}`)
        )
        const data = await readJson(res)
        if (cancelled) return
        if (res.status >= 500) {
          // Server hidup tapi database mati
          navigate('/server-error')
          return
        }
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
        // Server tidak respons / tidak bisa nyambung ke database
        if (err?.message === 'Failed to fetch' || !err?.message) {
          navigate('/server-error')
          return
        }
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
    const { name, value } = e.target
    if (name === 'username') {
      // Auto-lowercase, remove spaces
      const clean = value.toLowerCase().replace(/\s+/g, '')
      setForm(prev => ({ ...prev, username: clean }))
      setError('')
      debouncedCheckUsername(clean)
      return
    }
    setForm(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  /** Tandai field sebagai touched saat blur → validasi inline mulai tampil. */
  function handleBlur(e) {
    const { name } = e.target
    if (!ACCOUNT_FIELDS.includes(name)) return
    setTouched(prev => (prev[name] ? prev : { ...prev, [name]: true }))
  }

  // Pesan error per field hanya muncul setelah field disentuh (blur/submit).
  const fieldErrors = ACCOUNT_FIELDS.reduce((acc, name) => {
    acc[name] = touched[name] ? validateAccountField(name, form, usernameStatus) : ''
    return acc
  }, {})

  const usernameFeedback = fieldErrors.username
    || (usernameStatus === 'available' ? usernameMessage : '')
  const usernameFeedbackError = Boolean(fieldErrors.username)

  // ── Debounced username availability check ─────────────────
  function debouncedCheckUsername(username) {
    // Cancel previous
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current)
    if (usernameAbortRef.current) usernameAbortRef.current.abort()

    // Reset status
    if (username.length < 3) {
      setUsernameStatus('idle')
      setUsernameMessage('')
      return
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      setUsernameStatus('invalid')
      setUsernameMessage('Huruf kecil, angka, dan underscore saja.')
      return
    }

    setUsernameStatus('checking')
    setUsernameMessage('')

    // Debounce 500ms
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const controller = new AbortController()
        usernameAbortRef.current = controller
        const res = await fetch(
          apiUrl(`/auth/check-username?username=${encodeURIComponent(username)}`),
          { signal: controller.signal }
        )
        const data = await res.json()
        if (controller.signal.aborted) return
        if (res.ok) {
          setUsernameStatus(data.available ? 'available' : 'taken')
          setUsernameMessage(data.message)
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setUsernameStatus('idle')
        }
      }
    }, 500)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current)
      if (usernameAbortRef.current) usernameAbortRef.current.abort()
    }
  }, [])

  // ── Input manual link/kode undangan ──────────────────────
  function handleInviteInputChange(e) {
    setInviteInput(e.target.value)
    setInviteInputError('')
  }

  async function handleInvitePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      setInviteInput(text)
      setInviteInputError('')
    } catch {
      // Clipboard tidak tersedia / permission ditolak → diam-diam fokus
      // ke input supaya user bisa tempel manual (Ctrl+V)
      inviteInputRef.current?.focus()
    }
  }

  function handleInviteSubmit(e) {
    e.preventDefault()
    if (submittingInvite) return // tolak submit ganda saat verifikasi berjalan

    const raw = inviteInput
    const token = extractInviteToken(raw)

    if (!token) {
      setInviteInputError(
        raw.toLowerCase().includes('undangan=')
          ? 'Link undangan tidak lengkap — kode undangan tidak ditemukan di dalamnya.'
          : 'Masukkan link atau kode undangan Anda terlebih dahulu.'
      )
      return
    }
    if (!isPlausibleInviteToken(token)) {
      setInviteInputError(
        'Link atau kode undangan tidak dikenali. Tempel link undangan lengkap (…/daftar?undangan=…) atau masukkan kode undangan.'
      )
      return
    }

    setInviteInputError('')
    setSubmittingInvite(true)
    // Seragamkan URL ke /daftar?undangan=<token> (replace) → biarkan efek
    // verifikasi existing yang memanggil GET /invites/verify
    setInviteState('verifying')
    setInviteError('')
    setSearchParams({ undangan: token }, { replace: true })
  }

  function handleResetInvite() {
    setInviteInput('')
    setInviteInputError('')
    setSubmittingInvite(false)
    setInviteState('missing')
    setSearchParams({}, { replace: true })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Submit menandai semua field tersentuh → semua pesan validasi tampil.
    setTouched({ username: true, email: true, password: true, confirm: true })

    const firstInvalid = ACCOUNT_FIELDS
      .map(name => ({ name, message: validateAccountField(name, form, usernameStatus) }))
      .find(item => item.message)

    if (firstInvalid) {
      setError('')
      // Tunggu render agar pesan error muncul, lalu fokus ke field invalid pertama.
      requestAnimationFrame(() => {
        const el = document.querySelector(`[name="${firstInvalid.name}"]`)
        if (el && !el.disabled) el.focus()
      })
      return
    }

    // ID photo is optional for voters, required for admin (validated on backend)
    // But we should at least warn if missing for admin
    if (invite?.role === 'admin' && !idPhotoData.dataUrl) {
      setError('Foto KTP wajib untuk akun admin.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:      form.username,
          email:         form.email,
          password:      form.password,
          invite_token:  inviteToken,
          id_photo:      idPhotoData.dataUrl,
          id_photo_type: idPhotoData.type,
        }),
      })
      const data = await readJson(res)
      if (res.status >= 500) {
        navigate('/server-error')
        return
      }
      if (!res.ok) { setError(data.error || 'Pendaftaran gagal.'); return }
      navigate('/masuk', {
        state: { registered: true, username: form.username },
      })
    } catch (err) {
      // Server tidak respons / tidak bisa nyambung ke database
      if (err?.message === 'Failed to fetch' || !err?.message) {
        navigate('/server-error')
        return
      }
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
          <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
            <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
          </Link>
        </div>
        <div className="auth-state">
          <div className="skeleton-pane">
            <SkeletonCircle className="skeleton-pane-circle" />
            <SkeletonText variant="title" />
            <SkeletonText variant="text" />
            <SkeletonText variant="text" />
          </div>
        </div>
      </div>
    )
  }

  // ── State: tidak ada undangan → form input link/kode ─────
  if (inviteState === 'missing') {
    return (
      <div className="auth-shell">
        <div className="auth-brand">
          <button type="button" className="back-btn" onClick={handleBack} aria-label="Kembali ke beranda" title="Kembali">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
            <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
          </Link>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <h1>Punya undangan?</h1>
            <p>Tempel link undangan atau masukkan kode undangan Anda untuk mulai mendaftar.</p>
          </div>

          <form className="invite-form" onSubmit={handleInviteSubmit} noValidate>
            <div className="field">
              <label htmlFor="invite-code">Link atau kode undangan</label>
              <div className="invite-input-row">
                <input
                  id="invite-code"
                  name="invite-code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Tempel link atau kode undangan"
                  className={inviteInputError ? 'invite-input-error' : undefined}
                  value={inviteInput}
                  onChange={handleInviteInputChange}
                  disabled={submittingInvite}
                  aria-invalid={inviteInputError ? 'true' : undefined}
                  aria-describedby={inviteInputError ? 'invite-code-error' : undefined}
                  ref={inviteInputRef}
                  autoFocus
                />
                <button
                  type="button"
                  className="invite-paste-btn"
                  onClick={handleInvitePaste}
                  disabled={submittingInvite}
                  title="Tempel dari papan klip"
                >
                  <Icon name="clipboard" size={15} />
                  Tempel
                </button>
              </div>
            </div>

            {inviteInputError && (
              <p id="invite-code-error" className="field-error" role="alert">{inviteInputError}</p>
            )}

            <button
              type="submit"
              className="btn-submit"
              disabled={submittingInvite || !inviteInput.trim()}
            >
              {submittingInvite
                ? <span className="btn-loading"><span className="spinner" />Memeriksa…</span>
                : 'Lanjutkan'}
            </button>
          </form>

          <p className="auth-footer-text">
            Pendaftaran hanya melalui undangan — belum punya?{' '}
            <span className="auth-footer-note">Hubungi administrator pemilihan Anda.</span>
            <br />
            Sudah punya akun? <Link to="/masuk">Masuk di sini</Link>
          </p>
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
          <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
            <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
          </Link>
        </div>
        <div className="auth-state">
          <div className="auth-state-icon auth-state-icon--error" aria-hidden="true"><LockIcon /></div>
          <h1>Undangan tidak berlaku</h1>
          <p>{inviteError}</p>
          <Link to="/masuk" className="btn-submit auth-state-cta">Masuk dengan akun yang ada</Link>
          <button type="button" className="invite-retry-link" onClick={handleResetInvite}>
            Masukkan kode undangan lain
          </button>
        </div>
        <div className="auth-mosaic" aria-hidden="true" />
      </div>
    )
  }

  // ── State: undangan valid → step 1: foto ID (jika diperlukan), step 2: form akun ─────────────
  const renderAccountForm = () => (
    <>
      {/* ID Photo Preview + Back Button */}
      {idPhotoData.dataUrl && (
        <div className="id-photo-preview-card">
          <div className="id-photo-preview-thumb">
            <img src={idPhotoData.dataUrl} alt={`Foto ${idPhotoData.type === 'ktp' ? 'KTP' : 'SIM'}`} />
            <span className="id-photo-preview-badge">{idPhotoData.type === 'ktp' ? 'KTP' : 'SIM'} ✓</span>
          </div>
          <button
            type="button"
            className="btn-submit--secondary btn-small"
            onClick={() => {
              setIdPhotoStep('capturing')
              setIdPhotoData(prev => ({ ...prev, dataUrl: null }))
            }}
          >
            <Icon name="arrow-left" size={16} />
            Ubah Foto ID
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="username">Username</label>
        <div className="username-input-wrapper">
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="huruf kecil, tanpa spasi"
            value={form.username}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={usernameFeedbackError || undefined}
            aria-describedby={usernameFeedback ? 'username-status-msg' : undefined}
            className={
              usernameFeedbackError || usernameStatus === 'taken'
                ? 'input-error'
                : usernameStatus === 'available' && !fieldErrors.username
                  ? 'input-success'
                  : ''
            }
            required
          />
          <span className={`username-status ${usernameStatus}`}>
            {usernameStatus === 'checking' && <span className="status-spinner" />}
            {usernameStatus === 'available' && '✓'}
            {usernameStatus === 'taken' && '✗'}
            {usernameStatus === 'invalid' && '!'}
          </span>
        </div>
        {usernameFeedback && (
          <p
            id="username-status-msg"
            className={`username-status-msg ${usernameFeedbackError ? 'taken' : usernameStatus}`}
            role={usernameFeedbackError ? 'alert' : undefined}
          >
            {usernameFeedback}
          </p>
        )}
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
          onBlur={handleBlur}
          disabled={Boolean(invite?.email)}
          title={invite?.email ? 'Email mengikuti undangan' : undefined}
          aria-invalid={Boolean(fieldErrors.email) || undefined}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          className={fieldErrors.email ? 'input-invalid' : ''}
          required
        />
        {fieldErrors.email && (
          <p id="email-error" className="field-inline-error" role="alert">{fieldErrors.email}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="password">Kata sandi</label>
        <div className="password-input-wrapper">
          <input
            id="password"
            name="password"
            type={showPass ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Min. 8 karakter, 1 angka, 1 karakter khusus"
            value={form.password}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={Boolean(fieldErrors.password) || undefined}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            className={fieldErrors.password ? 'input-invalid' : ''}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPass(v => !v)}
            aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {showPass ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
          </button>
        </div>
        {fieldErrors.password && (
          <p id="password-error" className="field-inline-error" role="alert">{fieldErrors.password}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="confirm">Konfirmasi kata sandi</label>
        <div className="password-input-wrapper">
          <input
            id="confirm"
            name="confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Ulangi kata sandi"
            value={form.confirm}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={Boolean(fieldErrors.confirm) || undefined}
            aria-describedby={fieldErrors.confirm ? 'confirm-error' : undefined}
            className={fieldErrors.confirm ? 'input-invalid' : ''}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowConfirm(v => !v)}
            aria-label={showConfirm ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {showConfirm ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
          </button>
        </div>
        {fieldErrors.confirm && (
          <p id="confirm-error" className="field-inline-error" role="alert">{fieldErrors.confirm}</p>
        )}
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      <button type="submit" className="btn-submit" disabled={loading}>
        {loading
          ? <span className="btn-loading"><span className="spinner" />Memproses…</span>
          : 'Buat akun'}
      </button>
      </form>
    </>
  )

  const renderIdPhotoStep = () => {
    const label = idPhotoData.type === 'ktp' ? 'KTP' : 'SIM'
    return (
      <div className="id-photo-step-page">
        <div className="id-photo-step-header">
          <h2>Verifikasi Identitas</h2>
          <p>Ambil foto {label} Anda untuk melengkapi pendaftaran.</p>
        </div>

        {/* Type toggle - always visible when not captured */}
        {idPhotoStep !== 'captured' && (
          <div className="id-photo-type-toggle" role="group" aria-label="Pilih jenis identitas">
            <button
              type="button"
              className={`type-btn ${idPhotoData.type === 'ktp' ? 'active' : ''}`}
              onClick={() => {
                setIdPhotoData(prev => ({ ...prev, type: 'ktp', dataUrl: null }))
                setIdPhotoStep('capturing')
                setIdPhotoError('')
              }}
            >
              KTP
            </button>
            <button
              type="button"
              className={`type-btn ${idPhotoData.type === 'sim' ? 'active' : ''}`}
              onClick={() => {
                setIdPhotoData(prev => ({ ...prev, type: 'sim', dataUrl: null }))
                setIdPhotoStep('capturing')
                setIdPhotoError('')
              }}
            >
              SIM
            </button>
          </div>
        )}

        {/* Panduan format foto - satu sumber aturan untuk step ini:
            contoh visual + checklist, sebelum kamera. */}
        {idPhotoStep !== 'captured' && (
          <div className="id-photo-guide-card">
            <div className="id-photo-guide-head">
              <Icon name="info" size={16} aria-hidden="true" />
              <div>
                <strong>Panduan foto {label}</strong>
                <span>Dua format yang bisa dipakai — pilih yang paling mudah.</span>
              </div>
            </div>

            <div className="id-photo-guide-examples">
              <figure className="guide-example">
                <img
                  src="/formatFotoWebcam.png"
                  width="1672"
                  height="941"
                  alt={`Contoh foto ${label} format webcam: wajah dan ${label} sejajar menghadap kamera`}
                  loading="lazy"
                />
                <figcaption>
                  <span className="guide-example-tag">Webcam</span>
                  <span className="guide-example-desc">Kamera laptop/PC</span>
                </figcaption>
              </figure>
              <figure className="guide-example">
                <img
                  src="/formatFotoSelfie.png"
                  width="1024"
                  height="1536"
                  alt={`Contoh foto ${label} format selfie: wajah dan ${label} dalam satu frame`}
                  loading="lazy"
                />
                <figcaption>
                  <span className="guide-example-tag">Selfie</span>
                  <span className="guide-example-desc">Kamera depan ponsel</span>
                </figcaption>
              </figure>
            </div>

            <ul className="id-photo-guide-rules">
              <li>Wajah dan {label} terlihat jelas, tidak buram</li>
              <li>Wajah dan {label} muat dalam satu frame</li>
              <li>Cahaya cukup — hindari bayangan di {label}</li>
            </ul>
          </div>
        )}

        <IdPhotoCapture
          key={idPhotoData.type}  // Force remount when type changes
          type={idPhotoData.type}
          required={isIdPhotoRequired}
          onCapture={(dataUrl) => {
            setIdPhotoData(prev => ({ ...prev, dataUrl }))
            setIdPhotoStep('captured')
            setIdPhotoError('')
          }}
          onCancel={() => {
            // Reset to type selection state
            setIdPhotoData(prev => ({ ...prev, dataUrl: null }))
            setIdPhotoStep('idle')
            setIdPhotoError('')
          }}
        />

        {isIdPhotoRequired && idPhotoStep !== 'captured' && (
          <p className="id-photo-required-note" role="status">
            <Icon name="info" size={16} aria-hidden="true" />
            Foto {label} wajib diambil untuk melanjutkan.
          </p>
        )}

        {idPhotoError && <p className="field-error" role="alert">{idPhotoError}</p>}

        {idPhotoStep === 'captured' && (
          <div className="id-photo-step-actions">
            <button
              type="button"
              className="btn-submit"
              onClick={() => setIdPhotoStep('account')}
              disabled={loading}
            >
              Lanjutkan ke Detail Akun
            </button>
          </div>
        )}

        {!isIdPhotoRequired && idPhotoStep !== 'captured' && (
          <div className="id-photo-step-actions">
            <button
              type="button"
              className="btn-submit--secondary"
              onClick={() => setIdPhotoStep('account')}
              disabled={loading}
            >
              Lewati Foto ID
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <button type="button" className="back-btn" onClick={handleBack} aria-label="Kembali ke halaman sebelumnya" title="Kembali">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
          <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
        </Link>
      </div>

      <div className={`auth-card${idPhotoStep !== 'account' ? ' auth-card--wide' : ''}`}>
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

        {/* ── Progress indicator ── */}
        <div className="register-progress" role="status" aria-label="Langkah pendaftaran">
          <span className={`progress-step ${idPhotoStep === 'capturing' || idPhotoStep === 'captured' ? 'active' : idPhotoStep === 'account' || idPhotoStep === 'skipped' ? 'completed' : ''}`}>
            <span className="step-number">{idPhotoStep === 'account' || idPhotoStep === 'skipped' ? '✓' : '1'}</span>
            <span className="step-label">Foto ID</span>
          </span>
          <span className="progress-separator" />
          <span className={`progress-step ${idPhotoStep === 'account' ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Detail Akun</span>
          </span>
        </div>

        {idPhotoStep !== 'account' ? renderIdPhotoStep() : renderAccountForm()}

        <p className="auth-footer-text">
          Sudah punya akun?{' '}
          <Link to="/masuk">Masuk di sini</Link>
        </p>
      </div>

      <div className="auth-mosaic" aria-hidden="true" />
    </div>
  )
}
