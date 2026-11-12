import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useUsbToken, fetchUsbCredentials, revokeUsbCredential, updateUsbLabel, listUsbDrives, createTokenFile, startUsbRegister, verifyUsbRegister } from '../hooks/useUsbToken'
import { useChangePassword } from '../hooks/useAuth'
import { useWebAuthnRegister, useWebAuthnList, useWebAuthnRevoke, isPlatformAuthenticatorAvailable } from '../hooks/useAuth'
import { getRpId, base64urlEncode, base64urlDecode } from '../utils/webauthn'
import Icon from '../components/Icon'
import './ProfileSettingsPage.css'

/* ── Constants & Helpers ─────────────────────────────────── */
const API_BASE = 'http://localhost:8000'

/* ── Helpers ─────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(String(iso).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(ta)
    return ok
  }
}

const TABS = [
  { id: 'password', label: 'Password', icon: <Icon name="lock" /> },
  { id: 'webauthn', label: 'Windows Hello', icon: <Icon name="fingerprint" /> },
  { id: 'usb', label: 'USB Token', icon: <Icon name="usb" /> },
]

/* ── Toast Notification ──────────────────────────────────── */
function Toast({ message, onClose }) {
  return (
    <div className="settings-toast" role="status" aria-live="polite" onClick={onClose}>
      {message}
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────── */
export default function ProfileSettingsPage() {
  const navigate = useNavigate()

  // Auth guard
  if (!localStorage.getItem('tc_token')) {
    return <Navigate to="/masuk" replace />
  }

  // User info dari JWT
  const [user, setUser] = useState(null)
  useEffect(() => {
    try {
      const token = localStorage.getItem('tc_token')
      if (!token) return
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser({
        username: payload.username ?? 'User',
        email: payload.email ?? '-',
        role: payload.role ?? 'voter',
      })
    } catch {
      setUser({ username: 'User', email: '-', role: 'voter' })
    }
  }, [])

  // Active tab state
  const [activeTab, setActiveTab] = useState('password')

  // Toast state
  const [toast, setToast] = useState(null)
  const [toastTimerRef, setToastTimerRef] = useState(null)

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  /* ── Change Password Hook ── */
  const { isLoading: pwdLoading, error: pwdError, changePassword, clearError: clearPwdError } = useChangePassword()
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' })
  const [pwdShow, setPwdShow] = useState({ current: false, new: false, confirm: false })

  const handlePwdChange = (field, value) => {
    setPwdForm(prev => ({ ...prev, [field]: value }))
    clearPwdError()
  }

  const handlePwdSubmit = async (e) => {
    e.preventDefault()
    if (pwdForm.new !== pwdForm.confirm) {
      setPwdForm(prev => ({ ...prev, confirm: '' }))
      return
    }
    const ok = await changePassword(pwdForm.current, pwdForm.new)
    if (ok) {
      showToast('✅ Password berhasil diubah')
      setPwdForm({ current: '', new: '', confirm: '' })
      setPwdShow({ current: false, new: false, confirm: false })
    }
  }

  /* ── WebAuthn (Windows Hello) ── */
  const { isLoading: waLoading, error: waError, register: waRegister, clearError: clearWaError } = useWebAuthnRegister()
  const { credentials: waCredentials, isLoading: waListLoading, fetchList: fetchWaList, clearError: clearWaListError } = useWebAuthnList()
  const { isLoading: waRevokeLoading, revoke: waRevoke, clearError: clearWaRevokeError } = useWebAuthnRevoke()
  const [waPlatformAvailable, setWaPlatformAvailable] = useState(false)
  const [waRegistering, setWaRegistering] = useState(false)
  const [waDisplayName, setWaDisplayName] = useState('')

  useEffect(() => {
    fetchWaList()
    isPlatformAuthenticatorAvailable().then(setWaPlatformAvailable)
  }, [fetchWaList])

  /* ── WebAuthn Register Modal State ── */
  const [showWaRegister, setShowWaRegister] = useState(false)
  const [waRegisterStep, setWaRegisterStep] = useState('idle') // idle | creating | verifying | done | error
  const [waRegisterError, setWaRegisterError] = useState('')
  const [waRegisterChallenge, setWaRegisterChallenge] = useState(null)
  const [waRegisterCredId, setWaRegisterCredId] = useState('')

  const handleOpenWaRegister = () => {
    setShowWaRegister(true)
    setWaRegisterStep('idle')
    setWaRegisterError('')
    setWaDisplayName(user?.username || 'Windows Hello')
    setWaRegisterChallenge(null)
    setWaRegisterCredId('')
  }

  const handleCloseWaRegister = () => {
    setShowWaRegister(false)
    setWaRegisterStep('idle')
    setWaRegisterError('')
    setWaDisplayName('')
    setWaRegisterChallenge(null)
    setWaRegisterCredId('')
  }

  const handleWaRegister = useCallback(async () => {
    setWaRegisterStep('creating')
    clearWaError()
    try {
      // 1. Minta challenge dari server
      const token = localStorage.getItem('tc_token')
      const res = await fetch(`${API_BASE}/auth/webauthn/register/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ display_name: waDisplayName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memulai registrasi')

      setWaRegisterChallenge(data)

      // 2. Buat credential baru via WebAuthn API
      const challenge = base64urlDecode(data.challenge)
      const userId = base64urlDecode(data.user.id)

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: data.rp.name, id: getRpId() },
          user: {
            id: userId,
            name: data.user.name,
            displayName: data.user.displayName,
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            requireResidentKey: false,
          },
          timeout: 60000,
          attestation: 'none',
        },
      })

      // TypeScript type assertion handled via comment for JSX compatibility
      const assertionResponse = credential.response
      const verifyRes = await fetch(`${API_BASE}/auth/webauthn/register/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challenge_id: data.challenge_id,
          credential_id: base64urlEncode(new Uint8Array(credential.rawId)),
          attestation_object: base64urlEncode(new Uint8Array(assertionResponse.attestationObject)),
          client_data_json: base64urlEncode(new Uint8Array(assertionResponse.clientDataJSON)),
        }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verifikasi registrasi gagal')

      setWaRegisterCredId(verifyData.credential_id)
      setWaRegisterStep('done')
      showToast('✅ Windows Hello berhasil didaftarkan')
      fetchWaList()
    } catch (err) {
      setWaRegisterStep('error')
      setWaRegisterError(err instanceof Error ? err.message : 'Registrasi Windows Hello gagal')
    }
  }, []) // Empty deps: handleWaRegister is stable, only calls setState and API

  // Saat modal WebAuthn dibuka dan masih di step idle, langsung mulai registrasi
  // agar navigator.credentials.create() dipanggil dan jendela Windows Hello muncul.
  useEffect(() => {
    if (showWaRegister && waRegisterStep === 'idle') {
      handleWaRegister()
    }
  }, [showWaRegister, waRegisterStep])

  const handleWaRevoke = async (id) => {
    if (!window.confirm('Hapus Windows Hello ini? Anda tidak bisa login dengan Windows Hello yang dihapus.')) return
    const ok = await waRevoke(id)
    if (ok) {
      showToast('✅ Windows Hello dihapus')
      fetchWaList()
    }
  }

  /* ── USB Token ── */
  const {
    detectedTokens,
    decryptPrivateKey,
    importPrivateKey,
    signChallenge,
    base64urlToBytes,
    bytesToBase64url,
    isDecrypting,
    error: usbHookError,
    scanForTokens,
    clearPending,
  } = useUsbToken()

  const [usbCredentials, setUsbCredentials] = useState([])
  const [usbLoading, setUsbLoading] = useState(true)
  const [usbListError, setUsbListError] = useState('')

  // Register flow state
  const [showUsbRegister, setShowUsbRegister] = useState(false)
  const [usbRegisterStep, setUsbRegisterStep] = useState('idle')
  const [usbRegisterError, setUsbRegisterError] = useState('')
  const [usbChallengeData, setUsbChallengeData] = useState(null)
  const [usbPin, setUsbPin] = useState('')
  const [usbLabel, setUsbLabel] = useState('')
  const [selectedUsbDrive, setSelectedUsbDrive] = useState('')
  const [usbPinShow, setUsbPinShow] = useState(false)

  // Create token flow state
  const [showUsbCreate, setShowUsbCreate] = useState(false)
  const [usbCreateStep, setUsbCreateStep] = useState('select-drive')
  const [usbDrives, setUsbDrives] = useState([])
  const [usbCreateDrive, setUsbCreateDrive] = useState('')
  const [usbCreatePin, setUsbCreatePin] = useState('')
  const [usbCreatePinConfirm, setUsbCreatePinConfirm] = useState('')
  const [usbCreateError, setUsbCreateError] = useState('')
  const [usbCreatedCredentialId, setUsbCreatedCredentialId] = useState('')
  const [usbOverwriteConfirm, setUsbOverwriteConfirm] = useState(false)
  const [usbCreatePinShow, setUsbCreatePinShow] = useState(false)
  const [usbCreatePinConfirmShow, setUsbCreatePinConfirmShow] = useState(false)

  // Edit/Revoke state
  const [usbRevokingId, setUsbRevokingId] = useState(null)
  const [usbEditingId, setUsbEditingId] = useState(null)
  const [usbEditLabel, setUsbEditLabel] = useState('')

  // Load USB credentials
  const loadUsbCredentials = useCallback(async () => {
    setUsbLoading(true)
    setUsbListError('')
    const data = await fetchUsbCredentials()
    if (data !== null) {
      setUsbCredentials(data)
    } else {
      setUsbListError('Gagal memuat daftar USB token.')
    }
    setUsbLoading(false)
  }, [])

  useEffect(() => { loadUsbCredentials() }, [loadUsbCredentials])

  // Polling drive saat modal buat token terbuka
  useEffect(() => {
    if (!showUsbCreate) return
    let cancelled = false
    const poll = async () => {
      const drives = await listUsbDrives()
      if (!cancelled) setUsbDrives(drives)
    }
    poll()
    const intervalId = window.setInterval(poll, 2000)
    return () => { cancelled = true; window.clearInterval(intervalId) }
  }, [showUsbCreate])

  // Auto-select drive saat USB terdeteksi di flow register
  useEffect(() => {
    if (usbRegisterStep === 'waiting-usb' && detectedTokens.length > 0) {
      setSelectedUsbDrive(detectedTokens[0].drive)
      setUsbRegisterStep('waiting-pin')
    }
  }, [detectedTokens, usbRegisterStep])

  // Polling aktif saat menunggu USB
  useEffect(() => {
    if (usbRegisterStep !== 'waiting-usb') return
    let cancelled = false
    const poll = async () => {
      const tokens = await scanForTokens()
      if (!cancelled && tokens.length > 0) {
        showToast(`✅ USB terdeteksi di ${tokens[0].drive}`)
        setSelectedUsbDrive(tokens[0].drive)
        setUsbRegisterStep('waiting-pin')
      }
    }
    poll()
    const intervalId = window.setInterval(poll, 2000)
    return () => { cancelled = true; window.clearInterval(intervalId) }
  }, [usbRegisterStep, scanForTokens, showToast])

  // Deteksi USB dicabut
  useEffect(() => {
    if (usbRegisterStep !== 'waiting-pin' && usbRegisterStep !== 'signing') return
    let cancelled = false
    const poll = async () => {
      const tokens = await scanForTokens()
      if (!cancelled) {
        const masihAda = tokens.some(t => t.drive === selectedUsbDrive)
        if (!masihAda) {
          showToast('🔌 USB dicabut. Colokkan kembali untuk melanjutkan.')
          setSelectedUsbDrive('')
          setUsbPin('')
          setUsbRegisterError('USB dicabut. Colokkan kembali untuk melanjutkan.')
          setUsbRegisterStep('waiting-usb')
        }
      }
    }
    const intervalId = window.setInterval(poll, 2000)
    return () => { cancelled = true; window.clearInterval(intervalId) }
  }, [usbRegisterStep, selectedUsbDrive, scanForTokens, showToast])

  /* ── USB Register Flow ── */
  const handleStartUsbRegister = async () => {
    setShowUsbCreate(false)
    setShowUsbRegister(true)
    setUsbRegisterStep('idle')
    setUsbRegisterError('')
    setUsbPin('')
    setUsbLabel('')
    setSelectedUsbDrive('')
    setUsbChallengeData(null)

    const data = await startUsbRegister()
    if (!data) {
      setUsbRegisterStep('error')
      setUsbRegisterError('Gagal memulai registrasi. Coba lagi.')
      return
    }
    setUsbChallengeData(data)
    setUsbRegisterStep('waiting-usb')
  }

  const handleSubmitUsbPin = async () => {
    if (!selectedUsbDrive || !usbPin || !usbChallengeData) return
    setUsbRegisterStep('signing')
    setUsbRegisterError('')

    try {
      const decryptResult = await decryptPrivateKey(selectedUsbDrive, usbPin)
      if (!decryptResult) {
        const msg = usbHookError || ''
        if (msg.includes('not found') || msg.includes('tidak ditemukan') || msg.includes('Read file')) {
          showToast('🔌 USB dicabut. Colokkan kembali untuk melanjutkan.')
          setSelectedUsbDrive('')
          setUsbPin('')
          setUsbRegisterStep('waiting-usb')
          setUsbRegisterError('USB dicabut. Colokkan kembali untuk melanjutkan.')
        } else {
          setUsbRegisterStep('error')
          setUsbRegisterError(msg || 'Gagal mendekripsi. PIN salah?')
        }
        return
      }

      const privateKey = await importPrivateKey(decryptResult.private_key_jwk)
      const challengeBytes = base64urlToBytes(usbChallengeData.challenge)
      const signature = await signChallenge(privateKey, challengeBytes)
      const signatureB64 = bytesToBase64url(signature)

      const result = await verifyUsbRegister(
        usbChallengeData.challenge_id,
        signatureB64,
        decryptResult.public_key_spki,
        usbLabel || undefined
      )

      if (!result) {
        setUsbRegisterStep('error')
        setUsbRegisterError('Verifikasi gagal di server.')
        return
      }

      setUsbRegisterStep('done')
      setUsbPin('')
      showToast('✅ USB token berhasil didaftarkan!')
      loadUsbCredentials()
    } catch (err) {
      setUsbRegisterStep('error')
      setUsbRegisterError(err?.message || 'Terjadi kesalahan.')
    }
  }

  const handleCloseUsbRegister = () => {
    setShowUsbRegister(false)
    setUsbRegisterStep('idle')
    setUsbRegisterError('')
    setUsbPin('')
    setUsbLabel('')
    setSelectedUsbDrive('')
    setUsbChallengeData(null)
    clearPending()
  }

  /* ── USB Create Token Flow ── */
  const handleOpenUsbCreate = () => {
    setShowUsbCreate(true)
    setUsbCreateStep('select-drive')
    setUsbCreateDrive('')
    setUsbCreatePin('')
    setUsbCreatePinConfirm('')
    setUsbCreateError('')
    setUsbCreatedCredentialId('')
    setUsbOverwriteConfirm(false)
    setShowUsbRegister(false)
  }

  const handleCloseUsbCreate = () => {
    setShowUsbCreate(false)
    setUsbCreateStep('select-drive')
    setUsbCreatePin('')
    setUsbCreatePinConfirm('')
    setUsbCreateError('')
    setUsbOverwriteConfirm(false)
  }

  const handleSubmitUsbCreate = async () => {
    setUsbCreateError('')

    if (!usbCreateDrive) {
      setUsbCreateError('Pilih drive USB terlebih dahulu.')
      return
    }
    if (usbCreatePin.length < 4) {
      setUsbCreateError('PIN minimal 4 karakter.')
      return
    }
    if (usbCreatePin !== usbCreatePinConfirm) {
      setUsbCreateError('PIN dan konfirmasi PIN tidak sama.')
      return
    }

    const selectedUsb = usbDrives.find(d => d.drive === usbCreateDrive)
    if (selectedUsb?.has_token && !usbOverwriteConfirm) {
      setUsbCreateError('Centang konfirmasi bahwa Anda paham token lama akan ditimpa.')
      return
    }

    setUsbCreateStep('creating')
    try {
      let userId = 0
      try {
        const token = localStorage.getItem('tc_token')
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]))
          userId = payload.sub ?? 0
        }
      } catch { /* biarkan 0 */ }

      const result = await createTokenFile(usbCreateDrive, userId, usbCreatePin)
      if (!result) {
        setUsbCreateStep('error')
        setUsbCreateError('Fitur ini hanya tersedia di aplikasi desktop.')
        return
      }
      setUsbCreatedCredentialId(result.credential_id)
      setUsbCreateStep('done')
      showToast('✅ Token berhasil dibuat di ' + usbCreateDrive)
    } catch (err) {
      setUsbCreateStep('error')
      setUsbCreateError(err?.message || 'Gagal membuat token.')
    }
  }

  /* ── USB Revoke ── */
  const handleUsbRevoke = async (cred) => {
    if (!window.confirm(`Nonaktifkan token "${cred.label ?? 'tanpa label'}"?\nToken ini tidak akan bisa dipakai lagi untuk MFA.`)) {
      return
    }
    setUsbRevokingId(cred.id)
    const ok = await revokeUsbCredential(cred.id)
    setUsbRevokingId(null)
    if (ok) loadUsbCredentials()
    else alert('Gagal menonaktifkan token.')
  }

  /* ── USB Edit Label ── */
  const handleUsbSaveLabel = async (cred) => {
    const ok = await updateUsbLabel(cred.id, usbEditLabel.trim())
    setUsbEditingId(null)
    if (ok) loadUsbCredentials()
    else alert('Gagal memperbarui label.')
  }

  const usbActiveCount = usbCredentials.filter(c => c.is_active).length

  /* ── Render ── */
  return (
    <div className="settings-shell">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <header className="settings-header">
        <button className="settings-back" onClick={() => navigate('/dasbor')}>
          <Icon name="arrow-left" size={16} />
          Kembali ke Dasbor
        </button>
        <div className="settings-title">
          <h1><Icon name="settings" /> Pengaturan Profil</h1>
          <p>Kelola password, Windows Hello, dan USB token autentikasi</p>
        </div>
        <div className="settings-user-badge">
          <span className="badge-role">{user?.role === 'admin' ? 'Admin' : 'Pemilih'}</span>
          <span className="badge-name">{user?.username}</span>
        </div>
      </header>

      <main className="settings-main">
        <nav className="settings-tabs" role="tablist" aria-label="Pengaturan profil">
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-panels">
          {/* ── Password Panel ── */}
          <section
            role="tabpanel"
            id="panel-password"
            aria-labelledby="tab-password"
            className={`settings-panel${activeTab !== 'password' ? ' hidden' : ''}`}
          >
            <div className="settings-card">
              <h2>Ubah Password</h2>
              <p className="settings-card-desc">Password Anda di-hash dengan Argon2id dan tidak pernah disimpan sebagai plain text.</p>

              <form onSubmit={handlePwdSubmit} className="settings-form" noValidate>
                <div className="form-field">
                  <label htmlFor="pwd-current">Password Saat Ini</label>
                  <div className="password-input-wrapper">
                    <input
                      id="pwd-current"
                      type={pwdShow.current ? 'text' : 'password'}
                      value={pwdForm.current}
                      onChange={e => handlePwdChange('current', e.target.value)}
                      placeholder="Masukkan password lama"
                      required
                      disabled={pwdLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setPwdShow(p => ({ ...p, current: !p.current }))}
                      aria-label={pwdShow.current ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {pwdShow.current ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="pwd-new">Password Baru</label>
                  <div className="password-input-wrapper">
                    <input
                      id="pwd-new"
                      type={pwdShow.new ? 'text' : 'password'}
                      value={pwdForm.new}
                      onChange={e => handlePwdChange('new', e.target.value)}
                      placeholder="Minimal 8 karakter"
                      required
                      disabled={pwdLoading}
                      autoComplete="new-password"
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setPwdShow(p => ({ ...p, new: !p.new }))}
                      aria-label={pwdShow.new ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {pwdShow.new ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
                    </button>
                  </div>
                  <span className="field-hint">Minimal 8 karakter, kombinasi huruf & angka direkomendasikan.</span>
                </div>

                <div className="form-field">
                  <label htmlFor="pwd-confirm">Konfirmasi Password Baru</label>
                  <div className="password-input-wrapper">
                    <input
                      id="pwd-confirm"
                      type={pwdShow.confirm ? 'text' : 'password'}
                      value={pwdForm.confirm}
                      onChange={e => handlePwdChange('confirm', e.target.value)}
                      placeholder="Ketik ulang password baru"
                      required
                      disabled={pwdLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setPwdShow(p => ({ ...p, confirm: !p.confirm }))}
                      aria-label={pwdShow.confirm ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {pwdShow.confirm ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
                    </button>
                  </div>
                </div>

                {pwdError && <p className="form-error" role="alert">❌ {pwdError}</p>}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={pwdLoading}>
                    {pwdLoading ? 'Menyimpan…' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* ── Windows Hello Panel ── */}
          <section
            role="tabpanel"
            id="panel-webauthn"
            aria-labelledby="tab-webauthn"
            className={`settings-panel${activeTab !== 'webauthn' ? ' hidden' : ''}`}
          >
            <div className="settings-card">
              <h2>Windows Hello (WebAuthn)</h2>
              <p className="settings-card-desc">
                Login menggunakan Face ID, Touch ID, Windows Hello, atau PIN perangkat.
                Kredensial disimpan lokal di perangkat Anda (platform authenticator).
              </p>

              {!waPlatformAvailable && (
                <div className="platform-notice">
                  <Icon name="fingerprint" />
                  <div>
                    <strong>Windows Hello tidak terdeteksi</strong>
                    <p>Perangkat ini tidak mendukung platform authenticator, atau browser tidak mengizinkan akses.
                       Pastikan menggunakan Windows 10/11 dengan Windows Hello aktif, atau macOS dengan Touch ID.</p>
                  </div>
                </div>
              )}

              {waPlatformAvailable && waCredentials.length === 0 && (
                <div className="wa-empty">
                  <div className="wa-empty-icon">
                    <Icon name="fingerprint" />
                  </div>
                  <h3>Belum ada Windows Hello terdaftar</h3>
                  <p>Daftarkan Windows Hello untuk login cepat tanpa password menggunakan Face ID, Touch ID, atau PIN perangkat.</p>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleOpenWaRegister}
                    disabled={waLoading}
                  >
                    <Icon name="plus" size={14} /> Daftarkan Windows Hello
                  </button>
                </div>
              )}

              {waCredentials.length > 0 && (
                <>
                  <div className="wa-list-header">
                    <h3>Windows Hello Terdaftar ({waCredentials.length})</h3>
                    {waPlatformAvailable && (
                      <button
                        className="btn btn-secondary"
                        onClick={handleOpenWaRegister}
                        disabled={waLoading}
                      >
                        <Icon name="plus" size={14} /> Tambah Baru
                      </button>
                    )}
                  </div>

                  <div className="wa-list">
                    {waListLoading && <p className="wa-list-note">Memuat…</p>}
                    {waCredentials.map(cred => (
                      <div key={cred.id} className="wa-row">
                        <div className="wa-row-main">
                          <Icon name="fingerprint" className="wa-row-icon" />
                          <div className="wa-row-info">
                            <span className="wa-row-label">Windows Hello</span>
                            <span className="wa-row-meta">
                              <code>{cred.credential_id.slice(0, 20)}…</code>
                              <span>•</span>
                              <span>Terdaftar: {formatDate(cred.created_at)}</span>
                              {cred.last_used_at && (
                                <>
                                  <span>•</span>
                                  <span>Terakhir: {formatDate(cred.last_used_at)}</span>
                                </>
                              )}
                              {cred.sign_count > 0 && (
                                <>
                                  <span>•</span>
                                  <span>Digunakan: {cred.sign_count}x</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="wa-row-actions">
                          <button
                            className="btn btn-danger btn-icon"
                            onClick={() => handleWaRevoke(cred.id)}
                            disabled={waRevokeLoading}
                            title="Hapus Windows Hello"
                          >
                            <Icon name="revoke" size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── USB Token Panel ── */}
          <section
            role="tabpanel"
            id="panel-usb"
            aria-labelledby="tab-usb"
            className={`settings-panel${activeTab !== 'usb' ? ' hidden' : ''}`}
          >
            <div className="settings-card">
              <h2>USB Token (MFA)</h2>
              <p className="settings-card-desc">
                Kelola USB flashdisk yang terdaftar sebagai faktor autentikasi kedua (ECDSA P-256).
                <br />Token dibuat di flashdisk, lalu didaftarkan ke akun ini.
              </p>

              <div className="usb-panel-actions">
                <button className="btn btn-secondary" onClick={handleOpenUsbCreate} disabled={showUsbCreate}>
                  <Icon name="plus" size={14} /> Buat Token di USB
                </button>
                <button className="btn btn-primary" onClick={handleStartUsbRegister} disabled={showUsbRegister}>
                  ＋ Daftarkan USB Baru
                </button>
              </div>

              {/* Create Token Modal */}
              {showUsbCreate && (
                <div className="usb-modal-overlay" onClick={handleCloseUsbCreate}>
                  <div className="usb-modal" onClick={e => e.stopPropagation()}>
                    <h3>Buat Token Baru di USB</h3>

                    {usbCreateStep === 'select-drive' && (
                      <div className="usb-create-form">
                        <div className="form-field">
                          <label htmlFor="usb-create-drive">Pilih drive USB</label>
                          <select
                            id="usb-create-drive"
                            value={usbCreateDrive}
                            onChange={e => setUsbCreateDrive(e.target.value)}
                          >
                            <option value="">-- Pilih flashdisk --</option>
                            {usbDrives.map(d => (
                              <option key={d.drive} value={d.drive}>
                                {d.drive}{d.has_token ? ' (sudah ada token)' : ''}
                              </option>
                            ))}
                          </select>
                          {usbDrives.length === 0 && (
                            <span className="field-hint">Tidak ada flashdisk terdeteksi. Colokkan flashdisk lalu tunggu ±2 detik.</span>
                          )}
                          {(() => {
                            const sel = usbDrives.find(d => d.drive === usbCreateDrive)
                            return sel?.has_token ? (
                              <div className="overwrite-warning" role="alert">
                                ⚠️ Flashdisk ini <strong>sudah berisi token</strong>. Membuat token baru akan{' '}
                                <strong>menimpa token lama</strong> dan token lama tidak bisa dipakai lagi.
                                <label className="overwrite-confirm">
                                  <input
                                    type="checkbox"
                                    checked={usbOverwriteConfirm}
                                    onChange={e => setUsbOverwriteConfirm(e.target.checked)}
                                  />
                                  Saya paham, timpa token lama
                                </label>
                              </div>
                            ) : null
                          })()}
                        </div>
                        <div className="form-field">
                          <label htmlFor="usb-create-pin">PIN MFA baru</label>
                          <input
                            id="usb-create-pin"
                            type="password"
                            value={usbCreatePin}
                            onChange={e => setUsbCreatePin(e.target.value)}
                            placeholder="Minimal 4 karakter"
                          />
                        </div>
                        <div className="form-field">
                          <label htmlFor="usb-create-pin-confirm">Ulangi PIN</label>
                          <input
                            id="usb-create-pin-confirm"
                            type="password"
                            value={usbCreatePinConfirm}
                            onChange={e => setUsbCreatePinConfirm(e.target.value)}
                            placeholder="Ketik ulang PIN"
                          />
                        </div>
                        {usbCreateError && <p className="form-error" role="alert">❌ {usbCreateError}</p>}
                        <div className="form-actions">
                          <button className="btn btn-primary" onClick={handleSubmitUsbCreate}>
                            🔑 Buat Token
                          </button>
                          <button className="btn btn-secondary" onClick={handleCloseUsbCreate}>Batal</button>
                        </div>
                        <p className="field-hint">
                          Membuat file token TIDAK otomatis mendaftarkannya. Setelah dibuat,
                          gunakan tombol <strong>"Daftarkan USB Baru"</strong> untuk mengikatnya ke akun ini.
                        </p>
                      </div>
                    )}

                    {usbCreateStep === 'creating' && <p className="wa-list-note">⏳ Membuat token…</p>}

                    {usbCreateStep === 'done' && (
                      <div className="success-state">
                        <p className="success-icon">✅</p>
                        <p><strong>Token berhasil dibuat di flashdisk!</strong></p>
                        <p className="field-hint">Credential ID: <code>{usbCreatedCredentialId.slice(0, 20)}…</code></p>
                        <p className="field-hint">Simpan PIN baik-baik. Sekarang daftarkan dengan tombol <strong>"Daftarkan USB Baru"</strong>.</p>
                        <button className="btn btn-primary" onClick={handleCloseUsbCreate}>Tutup</button>
                      </div>
                    )}

                    {usbCreateStep === 'error' && (
                      <div className="error-state">
                        <p>❌ {usbCreateError}</p>
                        <div className="form-actions">
                          <button className="btn btn-secondary" onClick={() => { setUsbCreateStep('select-drive'); setUsbCreateError('') }}>
                            Coba Lagi
                          </button>
                          <button className="btn btn-secondary" onClick={handleCloseUsbCreate}>Tutup</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Register USB Modal */}
              {showUsbRegister && (
                <div className="usb-modal-overlay" onClick={handleCloseUsbRegister}>
                  <div className="usb-modal" onClick={e => e.stopPropagation()}>
                    <h3>Daftarkan USB Token Baru</h3>

                    {usbRegisterStep === 'idle' && <p className="wa-list-note">Menyiapkan challenge…</p>}

                    {usbRegisterStep === 'waiting-usb' && (
                      <div className="register-step">
                        <p className="step-icon">🔌</p>
                        <p><strong>Colokkan USB token</strong> yang ingin didaftarkan.</p>
                        <p className="step-sub">Sistem akan mendeteksi otomatis dalam 2 detik.</p>
                        {detectedTokens.length > 0 && (
                          <p className="step-detected">✅ Terdeteksi: {detectedTokens[0].drive}</p>
                        )}
                        {usbRegisterError && (
                          <p className="step-removed">⚠️ {usbRegisterError}</p>
                        )}
                      </div>
                    )}

                    {(usbRegisterStep === 'waiting-pin' || usbRegisterStep === 'signing') && (
                      <div className="register-form">
                        <div className="form-field">
                          <label htmlFor="usb-pin">PIN / Password MFA</label>
                          <input
                            id="usb-pin"
                            type="password"
                            value={usbPin}
                            onChange={e => setUsbPin(e.target.value)}
                            placeholder="Masukkan PIN untuk dekripsi"
                            autoFocus
                            disabled={usbRegisterStep === 'signing'}
                          />
                        </div>
                        <div className="form-field">
                          <label htmlFor="usb-label">Label (opsional)</label>
                          <input
                            id="usb-label"
                            type="text"
                            value={usbLabel}
                            onChange={e => setUsbLabel(e.target.value)}
                            placeholder="contoh: USB Kantor"
                            disabled={usbRegisterStep === 'signing'}
                          />
                        </div>
                        <div className="form-actions">
                          <button
                            className="btn btn-primary"
                            onClick={handleSubmitUsbPin}
                            disabled={!usbPin || usbRegisterStep === 'signing'}
                          >
                            {usbRegisterStep === 'signing' ? '⏳ Memproses…' : (
                              <>
                                <Icon name="lock" />
                                Daftarkan Token
                              </>
                            )}
                          </button>
                          <button className="btn btn-secondary" onClick={handleCloseUsbRegister}>Batal</button>
                        </div>
                      </div>
                    )}

                    {usbRegisterStep === 'done' && (
                      <div className="success-state">
                        <p className="success-icon">✅</p>
                        <p><strong>USB token berhasil didaftarkan!</strong></p>
                        <button className="btn btn-primary" onClick={handleCloseUsbRegister}>Tutup</button>
                      </div>
                    )}

                    {usbRegisterStep === 'error' && (
                      <div className="error-state">
                        <p>❌ {usbRegisterError}</p>
                        <div className="form-actions">
                          <button className="btn btn-secondary" onClick={handleStartUsbRegister}>Coba Lagi</button>
                          <button className="btn btn-secondary" onClick={handleCloseUsbRegister}>Tutup</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {usbListError && <p className="form-error" role="alert">{usbListError}</p>}

              {/* USB Token List */}
              <div className="usb-list">
                {usbLoading && <p className="wa-list-note">Memuat token…</p>}

                {!usbLoading && usbCredentials.length === 0 && (
                  <p className="wa-list-note">
                    Belum ada USB token terdaftar. Daftarkan USB flashdisk sebagai faktor autentikasi kedua.
                  </p>
                )}

                {!usbLoading && usbCredentials.length > 0 && (
                  <>
                    <p className="wa-list-count">
                      {usbActiveCount} token aktif dari {usbCredentials.length} total
                    </p>
                    {usbCredentials.map(cred => (
                      <div key={cred.id} className={`usb-row${cred.is_active ? '' : ' usb-row--revoked'}`}>
                        <div className="usb-row-main">
                          <Icon name="usb" className="usb-row-icon" />
                          <div className="usb-row-info">
                            {usbEditingId === cred.id ? (
                              <div className="usb-edit-inline">
                                <input
                                  type="text"
                                  value={usbEditLabel}
                                  onChange={e => setUsbEditLabel(e.target.value)}
                                  autoFocus
                                  maxLength={100}
                                />
                                <button className="btn btn-primary btn-sm" onClick={() => handleUsbSaveLabel(cred)}>Simpan</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setUsbEditingId(null)}>Batal</button>
                              </div>
                            ) : (
                              <span className="usb-row-label">
                                {cred.label ?? 'Token tanpa label'}
                              </span>
                            )}
                            <span className="usb-row-meta">
                              <code>{cred.credential_id.slice(0, 20)}…</code>
                              <span>•</span>
                              <span>Terdaftar: {formatDate(cred.created_at)}</span>
                              {cred.last_used_at && (
                                <>
                                  <span>•</span>
                                  <span>Terakhir: {formatDate(cred.last_used_at)}</span>
                                </>
                              )}
                            </span>
                          </div>
                          <span className={`usb-badge ${cred.is_active ? 'usb-badge--active' : 'usb-badge--revoked'}`}>
                            {cred.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <div className="usb-row-actions">
                          {cred.is_active && usbEditingId !== cred.id && (
                            <>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setUsbEditingId(cred.id); setUsbEditLabel(cred.label ?? '') }}
                                title="Ubah label"
                              >
                                Ubah Label
                              </button>
                              <button
                                className="btn btn-danger btn-icon"
                                onClick={() => handleUsbRevoke(cred)}
                                title="Nonaktifkan token"
                                disabled={usbRevokingId === cred.id}
                              >
                                {usbRevokingId === cred.id ? '⏳' : <Icon name="revoke" size={13} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ── Windows Hello Register Modal ── */}
      {showWaRegister && (
        <div className="modal-overlay" onClick={handleCloseWaRegister} role="dialog" aria-modal="true" aria-labelledby="wa-modal-title">
          <div className="modal modal--webauthn" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseWaRegister} aria-label="Tutup">
              <Icon name="close" size={20} />
            </button>

            <div className="modal-header">
              <div className="modal-icon">
                <Icon name="fingerprint" />
              </div>
              <h2 id="wa-modal-title">Daftarkan Windows Hello</h2>
              <p className="modal-subtitle">Gunakan Face ID, Touch ID, atau PIN perangkat untuk login tanpa password.</p>
            </div>

            {waRegisterStep === 'idle' && (
              <div className="modal-body">
                <div className="wa-step-waiting">
                  <div className="wa-pulse-rings">
                    <div className="wa-pulse-ring"></div>
                    <div className="wa-pulse-ring"></div>
                    <div className="wa-pulse-ring"></div>
                    <Icon name="fingerprint" className="wa-pulse-center" />
                  </div>
                </div>
                <p className="wa-step-title">Menyiapkan registrasi…</p>
                <p className="wa-step-desc">Meminta challenge dari server dan mempersiapkan WebAuthn.</p>
              </div>
            )}

            {waRegisterStep === 'creating' && (
              <div className="modal-body">
                <div className="wa-step-waiting">
                  <div className="wa-spinner"></div>
                </div>
                <p className="wa-step-title">Menunggu autentikasi Windows Hello…</p>
                <p className="wa-step-desc">Silakan verifikasi wajah, sidik jari, atau PIN di jendela yang muncul.</p>
              </div>
            )}

            {waRegisterStep === 'verifying' && (
              <div className="modal-body">
                <div className="wa-step-waiting">
                  <div className="wa-spinner"></div>
                </div>
                <p className="wa-step-title">Memverifikasi kredensial…</p>
                <p className="wa-step-desc">Mengirim data ke server untuk verifikasi.</p>
              </div>
            )}

            {waRegisterStep === 'done' && (
              <div className="modal-body modal-success">
                <div className="success-checkmark">
                  <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path d="M14 27l8 8 16-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3>Windows Hello Berhasil Didaftarkan!</h3>
                <p>Anda sekarang bisa login menggunakan Face ID, Touch ID, atau PIN perangkat.</p>
                <div className="credential-badge">
                  <code>{waRegisterCredId.slice(0, 24)}…</code>
                  <span className="credential-label">Credential ID</span>
                </div>
                <div className="form-actions">
                  <button className="btn btn-primary btn-full" onClick={handleCloseWaRegister}>Selesai</button>
                </div>
              </div>
            )}

            {waRegisterStep === 'error' && (
              <div className="modal-body modal-error">
                <div className="error-icon">
                  <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path d="M16 16l20 20M36 16l-20 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                </div>
                <h3>Registrasi Gagal</h3>
                <p>{waRegisterError || 'Terjadi kesalahan saat mendaftarkan Windows Hello.'}</p>
                <div className="form-actions">
                  <button className="btn btn-primary" onClick={handleWaRegister}>Coba Lagi</button>
                  <button className="btn btn-secondary" onClick={handleCloseWaRegister}>Batal</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── USB Create Token Modal ── */}
      {showUsbCreate && (
        <div className="modal-overlay" onClick={handleCloseUsbCreate} role="dialog" aria-modal="true" aria-labelledby="usb-create-modal-title">
          <div className="modal modal--usb" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseUsbCreate} aria-label="Tutup">
              <Icon name="close" size={20} />
            </button>

            <div className="modal-header">
              <div className="modal-icon">
                <Icon name="usb" />
              </div>
              <h2 id="usb-create-modal-title">Buat Token Baru di USB</h2>
              <p className="modal-subtitle">Generate kunci ECDSA P-256 terenkripsi dan simpan ke flashdisk.</p>
            </div>

            {usbCreateStep === 'select-drive' && (
              <div className="modal-body">
                <div className="form-field">
                  <label htmlFor="usb-create-drive">Pilih Drive USB</label>
                  <div className="drive-selector">
                    <select
                      id="usb-create-drive"
                      value={usbCreateDrive}
                      onChange={e => setUsbCreateDrive(e.target.value)}
                    >
                      <option value="">-- Pilih flashdisk --</option>
                      {usbDrives.map(d => (
                        <option key={d.drive} value={d.drive}>
                          {d.drive} {d.has_token && <span className="drive-badge">sudah ada token</span>}
                        </option>
                      ))}
                    </select>
                    {usbDrives.length === 0 && (
                      <div className="drive-empty">
                        <Icon name="usb" className="drive-empty-icon" />
                        <p>Tidak ada flashdisk terdeteksi</p>
                        <span>Colokkan flashdisk lalu tunggu ±2 detik</span>
                      </div>
                    )}
                  </div>
                  {(() => {
                    const sel = usbDrives.find(d => d.drive === usbCreateDrive)
                    return sel?.has_token ? (
                      <div className="overwrite-warning" role="alert">
                        <Icon name="alert" size={18} />
                        <div>
                          <strong>Flashdisk ini sudah berisi token.</strong>
                          <p>Membuat token baru akan <strong>menimpa token lama</strong> dan token lama tidak bisa dipakai lagi.</p>
                        </div>
                        <label className="overwrite-confirm">
                          <input
                            type="checkbox"
                            checked={usbOverwriteConfirm}
                            onChange={e => setUsbOverwriteConfirm(e.target.checked)}
                          />
                          <span>Saya paham, timpa token lama</span>
                        </label>
                      </div>
                    ) : null
                  })()}
                </div>

                <div className="form-field">
                  <label htmlFor="usb-create-pin">PIN MFA Baru</label>
                  <div className="password-input-wrapper">
                    <input
                      id="usb-create-pin"
                      type="password"
                      value={usbCreatePin}
                      onChange={e => setUsbCreatePin(e.target.value)}
                      placeholder="Minimal 4 karakter"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setUsbCreatePinShow(p => !p)}
                      aria-label="Toggle PIN visibility"
                    >
                      {usbCreatePinShow ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="usb-create-pin-confirm">Konfirmasi PIN</label>
                  <div className="password-input-wrapper">
                    <input
                      id="usb-create-pin-confirm"
                      type="password"
                      value={usbCreatePinConfirm}
                      onChange={e => setUsbCreatePinConfirm(e.target.value)}
                      placeholder="Ketik ulang PIN"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setUsbCreatePinConfirmShow(p => !p)}
                      aria-label="Toggle PIN visibility"
                    >
                      {usbCreatePinConfirmShow ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
                    </button>
                  </div>
                </div>

                {usbCreateError && <p className="form-error" role="alert">❌ {usbCreateError}</p>}

                <div className="form-actions">
                  <button className="btn btn-primary btn-full" onClick={handleSubmitUsbCreate}>
                    <span className="btn-loader" aria-hidden="true">
                      {usbCreateStep === 'creating' && <span className="spinner-sm"></span>}
                    </span>
                    {usbCreateStep === 'creating' ? 'Membuat…' : '🔑 Buat Token'}
                  </button>
                  <button className="btn btn-secondary btn-full" onClick={handleCloseUsbCreate} disabled={usbCreateStep === 'creating'}>Batal</button>
                </div>

                <p className="modal-hint">
                  <Icon name="info" size={16} />
                  Membuat file token <strong>TIDAK</strong> otomatis mendaftarkannya. Setelah dibuat, gunakan tombol <strong>"Daftarkan USB Baru"</strong> untuk mengikatnya ke akun ini.
                </p>
              </div>
            )}

            {usbCreateStep === 'done' && (
              <div className="modal-body modal-success">
                <div className="success-checkmark">
                  <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path d="M14 27l8 8 16-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3>Token Berhasil Dibuat!</h3>
                <p>File token tersimpan di flashdisk <code>{usbCreateDrive}</code></p>
                <div className="credential-badge">
                  <code>{usbCreatedCredentialId.slice(0, 24)}…</code>
                  <span className="credential-label">Credential ID</span>
                </div>
                <p className="modal-hint">Simpan PIN dengan aman. Sekarang daftarkan dengan tombol <strong>"Daftarkan USB Baru"</strong>.</p>
                <button className="btn btn-primary btn-full" onClick={handleCloseUsbCreate}>Selesai</button>
              </div>
            )}

            {usbCreateStep === 'error' && (
              <div className="modal-body modal-error">
                <div className="error-icon">
                  <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path d="M16 16l20 20M36 16l-20 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                </div>
                <h3>Gagal Membuat Token</h3>
                <p>{usbCreateError || 'Terjadi kesalahan.'}</p>
                <div className="form-actions">
                  <button className="btn btn-primary" onClick={() => { setUsbCreateStep('select-drive'); setUsbCreateError('') }}>Coba Lagi</button>
                  <button className="btn btn-secondary" onClick={handleCloseUsbCreate}>Tutup</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── USB Register Modal ── */}
      {showUsbRegister && (
        <div className="modal-overlay" onClick={handleCloseUsbRegister} role="dialog" aria-modal="true" aria-labelledby="usb-reg-modal-title">
          <div className="modal modal--usb" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={handleCloseUsbRegister} aria-label="Tutup">
              <Icon name="close" size={20} />
            </button>

            <div className="modal-header">
              <div className="modal-icon">
                <Icon name="usb" />
              </div>
              <h2 id="usb-reg-modal-title">Daftarkan USB Token Baru</h2>
              <p className="modal-subtitle">Colokkan flashdisk yang sudah berisi token, masukkan PIN, dan ikat ke akun ini.</p>
            </div>

            {usbRegisterStep === 'idle' && (
              <div className="modal-body">
                <div className="wa-step-waiting">
                  <div className="wa-spinner"></div>
                </div>
                <p className="wa-step-title">Menyiapkan challenge…</p>
                <p className="wa-step-desc">Meminta challenge dari server untuk registrasi.</p>
              </div>
            )}

            {usbRegisterStep === 'waiting-usb' && (
              <div className="modal-body">
                <div className="usb-waiting-card">
                  <div className="usb-waiting-icon">
                    {detectedTokens.length > 0 ? (
                      <span className="usb-detected-pulse">🔌</span>
                    ) : (
                      <Icon name="usb" className="usb-pulse" />
                    )}
                  </div>
                  <h3>{detectedTokens.length > 0 ? 'USB Terdeteksi!' : 'Menunggu USB…'}</h3>
                  <p>{detectedTokens.length > 0
                    ? `Terdeteksi di <strong>${detectedTokens[0].drive}</strong>. Lanjutkan ke langkah berikutnya.`
                    : 'Colokkan flashdisk yang berisi token. Sistem akan mendeteksi otomatis dalam 2 detik.'}</p>
                  {detectedTokens.length > 0 && (
                    <div className="usb-drive-badge">
                      <Icon name="usb" /> {detectedTokens[0].drive}
                    </div>
                  )}
                  {usbRegisterError && (
                    <div className="form-error inline-error">⚠️ {usbRegisterError}</div>
                  )}
                </div>
              </div>
            )}

            {(usbRegisterStep === 'waiting-pin' || usbRegisterStep === 'signing') && (
              <div className="modal-body">
                <div className="form-field">
                  <label htmlFor="usb-pin">PIN / Password MFA</label>
                  <div className="password-input-wrapper">
                    <input
                      id="usb-pin"
                      type="password"
                      value={usbPin}
                      onChange={e => setUsbPin(e.target.value)}
                      placeholder="Masukkan PIN untuk dekripsi token"
                      autoFocus
                      disabled={usbRegisterStep === 'signing'}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setUsbPinShow(p => !p)}
                      aria-label="Toggle PIN visibility"
                      disabled={usbRegisterStep === 'signing'}
                    >
                      {usbPinShow ? <Icon name="eye-off" size={16} /> : <Icon name="eye" size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="usb-label">Label Token (opsional)</label>
                  <input
                    id="usb-label"
                    type="text"
                    value={usbLabel}
                    onChange={e => setUsbLabel(e.target.value)}
                    placeholder="contoh: USB Kantor, USB Pribadi"
                    disabled={usbRegisterStep === 'signing'}
                  />
                </div>

                <div className="form-actions">
                  <button
                    className="btn btn-primary btn-full"
                    onClick={handleSubmitUsbPin}
                    disabled={!usbPin || usbRegisterStep === 'signing'}
                  >
                    <span className="btn-loader" aria-hidden="true">
                      {usbRegisterStep === 'signing' && <span className="spinner-sm"></span>}
                    </span>
                    {usbRegisterStep === 'signing' ? 'Memproses…' : (
                      <>
                        <Icon name="lock" />
                        Daftarkan Token
                      </>
                    )}
                  </button>
                  <button className="btn btn-secondary btn-full" onClick={handleCloseUsbRegister} disabled={usbRegisterStep === 'signing'}>Batal</button>
                </div>
              </div>
            )}

            {usbRegisterStep === 'done' && (
              <div className="modal-body modal-success">
                <div className="success-checkmark">
                  <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path d="M14 27l8 8 16-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <h3>USB Token Berhasil Didaftarkan!</h3>
                <p>Token sekarang terikat ke akun Anda dan siap digunakan untuk MFA.</p>
                <button className="btn btn-primary btn-full" onClick={handleCloseUsbRegister}>Selesai</button>
              </div>
            )}

            {usbRegisterStep === 'error' && (
              <div className="modal-body modal-error">
                <div className="error-icon">
                  <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="none"/><path d="M16 16l20 20M36 16l-20 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                </div>
                <h3>Registrasi Gagal</h3>
                <p>{usbRegisterError || 'Terjadi kesalahan saat mendaftarkan token.'}</p>
                <div className="form-actions">
                  <button className="btn btn-primary" onClick={handleStartUsbRegister}>Coba Lagi</button>
                  <button className="btn btn-secondary" onClick={handleCloseUsbRegister}>Tutup</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}