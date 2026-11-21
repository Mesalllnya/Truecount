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
  // Password field visible by default; confirm field masked by default
  const [showConfirm, setShowConfirm] = useState(false)

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
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

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
    if (form.password !== form.confirm) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }
    if (form.password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }
    // Validate password complexity (matches backend)
    if (!/[0-9]/.test(form.password)) {
      setError('Kata sandi wajib mengandung minimal 1 angka.')
      return
    }
    if (!/[^a-zA-Z0-9]/.test(form.password)) {
      setError('Kata sandi wajib mengandung minimal 1 karakter khusus (mis. !@#$%^&*).')
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
          type="text"
          autoComplete="new-password"
          placeholder="Min. 8 karakter"
          value={form.password}
          onChange={handleChange}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="confirm">Konfirmasi kata sandi</label>
        <div className="password-input-wrapper">
          <input
            id="confirm"
            name="confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.confirm}
            onChange={handleChange}
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
