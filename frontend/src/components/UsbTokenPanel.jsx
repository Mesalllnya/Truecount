import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useUsbToken,
  startUsbRegister,
  verifyUsbRegister,
  fetchUsbCredentials,
  revokeUsbCredential,
  updateUsbLabel,
  listUsbDrives,
  createTokenFile,
} from '../hooks/useUsbToken'
import './UsbTokenPanel.css'

/* ── Icons ───────────────────────────────────────────────── */
function UsbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22a2 2 0 0 0 2-2V8a2 2 0 0 0-4 0v12a2 2 0 0 0 2 2Z"/>
      <circle cx="12" cy="8" r="1.5"/>
      <path d="M9 2h6l1 4H8l1-4Z"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function RevokeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

/* ── Helpers ─────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(String(iso).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Panel Utama ─────────────────────────────────────────── */
export default function UsbTokenPanel() {
  const {
    detectedTokens,
    decryptPrivateKey,
    importPrivateKey,
    signChallenge,
    base64urlToBytes,
    bytesToBase64url,
    isDecrypting,
    error: hookError,
    scanForTokens,
    clearPending,
  } = useUsbToken()

  const [credentials, setCredentials] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')

  // Register flow state
  const [showRegister, setShowRegister] = useState(false)
  const [registerStep, setRegisterStep] = useState('idle') // idle | waiting-usb | waiting-pin | signing | done | error
  const [registerError, setRegisterError] = useState('')
  const [challengeData, setChallengeData] = useState(null)
  const [pin, setPin] = useState('')
  const [label, setLabel] = useState('')
  const [selectedDrive, setSelectedDrive] = useState('')

  // Aksi state
  const [revokingId, setRevokingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')

  // Toast notification state
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Buat Token flow state ───────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState('select-drive') // select-drive | creating | done | error
  const [usbDrives, setUsbDrives] = useState([])
  const [createDrive, setCreateDrive] = useState('')
  const [createPin, setCreatePin] = useState('')
  const [createPinConfirm, setCreatePinConfirm] = useState('')
  const [createError, setCreateError] = useState('')
  const [createdCredentialId, setCreatedCredentialId] = useState('')
  const [overwriteConfirm, setOverwriteConfirm] = useState(false)

  // Polling daftar drive saat modal buat token terbuka
  useEffect(() => {
    if (!showCreate) return
    let cancelled = false
    const poll = async () => {
      const drives = await listUsbDrives()
      if (!cancelled) setUsbDrives(drives)
    }
    poll()
    const intervalId = window.setInterval(poll, 2000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [showCreate])

  const handleOpenCreate = () => {
    setShowCreate(true)
    setCreateStep('select-drive')
    setCreateDrive('')
    setCreatePin('')
    setCreatePinConfirm('')
    setCreateError('')
    setCreatedCredentialId('')
    setOverwriteConfirm(false)
    setShowRegister(false) // tutup modal register kalau kebuka
  }

  const handleCloseCreate = () => {
    setShowCreate(false)
    setCreateStep('select-drive')
    setCreatePin('')
    setCreatePinConfirm('')
    setCreateError('')
    setOverwriteConfirm(false)
  }

  const handleSubmitCreate = async () => {
    setCreateError('')

    if (!createDrive) {
      setCreateError('Pilih drive USB terlebih dahulu.')
      return
    }
    if (createPin.length < 4) {
      setCreateError('PIN minimal 4 karakter.')
      return
    }
    if (createPin !== createPinConfirm) {
      setCreateError('PIN dan konfirmasi PIN tidak sama.')
      return
    }

    // Kalau drive sudah ada token → wajib konfirmasi timpa
    const selectedUsb = usbDrives.find(d => d.drive === createDrive)
    if (selectedUsb?.has_token && !overwriteConfirm) {
      setCreateError('Centang konfirmasi bahwa Anda paham token lama akan ditimpa.')
      return
    }

    setCreateStep('creating')
    try {
      // Ambil user_id dari JWT (hanya untuk tampilan deteksi)
      let userId = 0
      try {
        const token = localStorage.getItem('tc_token')
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]))
          userId = payload.sub ?? 0
        }
      } catch { /* biarkan 0 */ }

      const result = await createTokenFile(createDrive, userId, createPin)
      if (!result) {
        setCreateStep('error')
        setCreateError('Fitur ini hanya tersedia di aplikasi desktop.')
        return
      }
      setCreatedCredentialId(result.credential_id)
      setCreateStep('done')
      showToast('✅ Token berhasil dibuat di ' + createDrive)
    } catch (err) {
      setCreateStep('error')
      setCreateError(err?.message || 'Gagal membuat token.')
    }
  }

  const loadCredentials = useCallback(async () => {
    setLoading(true)
    setListError('')
    const data = await fetchUsbCredentials()
    if (data !== null) {
      setCredentials(data)
    } else {
      setListError('Gagal memuat daftar USB token.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadCredentials() }, [loadCredentials])

  // Auto-select drive saat USB terdeteksi di flow register
  useEffect(() => {
    if (registerStep === 'waiting-usb' && detectedTokens.length > 0) {
      setSelectedDrive(detectedTokens[0].drive)
      setRegisterStep('waiting-pin')
    }
  }, [detectedTokens, registerStep])

  // Polling aktif saat menunggu USB (fix timing: event bisa terlewat kalau
  // USB sudah dicolok sebelum halaman dibuka)
  useEffect(() => {
    if (registerStep !== 'waiting-usb') return
    let cancelled = false
    const poll = async () => {
      const tokens = await scanForTokens()
      if (!cancelled && tokens.length > 0) {
        showToast(`✅ USB terdeteksi di ${tokens[0].drive}`)
        setSelectedDrive(tokens[0].drive)
        setRegisterStep('waiting-pin')
      }
    }
    poll() // scan langsung
    const intervalId = window.setInterval(poll, 2000) // lalu tiap 2 detik
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [registerStep, scanForTokens, showToast])

  // Deteksi USB dicabut saat menunggu PIN / sedang sign
  // → tampilkan toast "USB dicabut" + kembali ke state "waiting-usb"
  useEffect(() => {
    if (registerStep !== 'waiting-pin' && registerStep !== 'signing') return
    let cancelled = false
    const poll = async () => {
      const tokens = await scanForTokens()
      if (!cancelled) {
        const masihAda = tokens.some(t => t.drive === selectedDrive)
        if (!masihAda) {
          // USB dicabut - tampilkan toast + balik ke waiting-usb
          showToast('🔌 USB dicabut. Colokkan kembali untuk melanjutkan.')
          setSelectedDrive('')
          setPin('')
          setRegisterError('USB dicabut. Colokkan kembali untuk melanjutkan.')
          setRegisterStep('waiting-usb')
        }
      }
    }
    const intervalId = window.setInterval(poll, 2000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [registerStep, selectedDrive, scanForTokens, showToast])

  /* ── Register Flow ─────────────────────────────────────── */
  const handleStartRegister = async () => {
    setShowCreate(false) // tutup modal buat token kalau kebuka
    setShowRegister(true)
    setRegisterStep('idle')
    setRegisterError('')
    setPin('')
    setLabel('')
    setSelectedDrive('')
    setChallengeData(null)

    // Mulai challenge dulu
    const data = await startUsbRegister()
    if (!data) {
      setRegisterStep('error')
      setRegisterError('Gagal memulai registrasi. Coba lagi.')
      return
    }
    setChallengeData(data)
    setRegisterStep('waiting-usb')
  }

  const handleSubmitPin = async () => {
    if (!selectedDrive || !pin || !challengeData) return
    setRegisterStep('signing')
    setRegisterError('')

    try {
      // 1. Decrypt private key dari USB
      const decryptResult = await decryptPrivateKey(selectedDrive, pin)
      if (!decryptResult) {
        const msg = hookError || ''
        // Kalau USB dicabut / file hilang → kembali ke waiting-usb
        if (msg.includes('not found') || msg.includes('tidak ditemukan') || msg.includes('Read file')) {
          showToast('🔌 USB dicabut. Colokkan kembali untuk melanjutkan.')
          setSelectedDrive('')
          setPin('')
          setRegisterStep('waiting-usb')
          setRegisterError('USB dicabut. Colokkan kembali untuk melanjutkan.')
        } else {
          setRegisterStep('error')
          setRegisterError(msg || 'Gagal mendekripsi. PIN salah?')
        }
        return
      }

      // 2. Import private key ke Web Crypto
      const privateKey = await importPrivateKey(decryptResult.private_key_jwk)

      // 3. Sign challenge
      const challengeBytes = base64urlToBytes(challengeData.challenge)
      const signature = await signChallenge(privateKey, challengeBytes)
      const signatureB64 = bytesToBase64url(signature)

      // 4. Kirim ke backend untuk verifikasi
      const result = await verifyUsbRegister(
        challengeData.challenge_id,
        signatureB64,
        decryptResult.public_key_spki,
        label || undefined
      )

      if (!result) {
        setRegisterStep('error')
        setRegisterError('Verifikasi gagal di server.')
        return
      }

      setRegisterStep('done')
      setPin('')
      showToast('✅ USB token berhasil didaftarkan!')
      loadCredentials()
    } catch (err) {
      setRegisterStep('error')
      setRegisterError(err?.message || 'Terjadi kesalahan.')
    }
  }

  const handleCloseRegister = () => {
    setShowRegister(false)
    setRegisterStep('idle')
    setRegisterError('')
    setPin('')
    setLabel('')
    setSelectedDrive('')
    setChallengeData(null)
    clearPending()
  }

  /* ── Revoke ────────────────────────────────────────────── */
  const handleRevoke = async (cred) => {
    if (!window.confirm(`Nonaktifkan token "${cred.label ?? 'tanpa label'}"?\nToken ini tidak akan bisa dipakai lagi untuk MFA.`)) {
      return
    }
    setRevokingId(cred.id)
    const ok = await revokeUsbCredential(cred.id)
    setRevokingId(null)
    if (ok) loadCredentials()
    else alert('Gagal menonaktifkan token.')
  }

  /* ── Edit Label ────────────────────────────────────────── */
  const handleSaveLabel = async (cred) => {
    const ok = await updateUsbLabel(cred.id, editLabel.trim())
    setEditingId(null)
    if (ok) loadCredentials()
    else alert('Gagal memperbarui label.')
  }

  const activeCount = credentials.filter(c => c.is_active).length

  return (
    <section className="usb-panel" aria-label="USB Token MFA">
      {/* ── Toast notification ── */}
      {toast && (
        <div className="usb-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      <div className="usb-panel-head">
        <div className="usb-panel-title">
          <h2><UsbIcon /> USB Token (MFA)</h2>
          <p>Kelola USB flashdisk yang terdaftar sebagai faktor autentikasi kedua.</p>
        </div>
        <div className="usb-panel-actions">
          <button className="usb-create-btn" onClick={handleOpenCreate} disabled={showCreate}>
            ＋ Buat Token di USB
          </button>
          <button className="usb-add-btn" onClick={handleStartRegister} disabled={showRegister}>
            + Daftarkan USB Baru
          </button>
        </div>
      </div>

      {/* ── Buat Token Modal ── */}
      {showCreate && (
        <div className="usb-register-box">
          <h3>Buat Token Baru di USB</h3>

          {createStep === 'select-drive' && (
            <div className="usb-create-form">
              <div className="usb-form-field">
                <label htmlFor="create-drive">Pilih drive USB</label>
                <select
                  id="create-drive"
                  value={createDrive}
                  onChange={e => setCreateDrive(e.target.value)}
                >
                  <option value="">-- Pilih flashdisk --</option>
                  {usbDrives.map(d => (
                    <option key={d.drive} value={d.drive}>
                      {d.drive}{d.has_token ? ' (sudah ada token)' : ''}
                    </option>
                  ))}
                </select>
                {usbDrives.length === 0 && (
                  <span className="usb-create-hint">
                    Tidak ada flashdisk terdeteksi. Colokkan flashdisk lalu tunggu ±2 detik.
                  </span>
                )}
                {(() => {
                  const sel = usbDrives.find(d => d.drive === createDrive)
                  return sel?.has_token ? (
                    <div className="usb-overwrite-warning" role="alert">
                      ⚠️ Flashdisk ini <strong>sudah berisi token</strong>. Membuat token baru akan{' '}
                      <strong>menimpa token lama</strong> dan token lama tidak bisa dipakai lagi.
                      <label className="usb-overwrite-confirm">
                        <input
                          type="checkbox"
                          checked={overwriteConfirm}
                          onChange={e => setOverwriteConfirm(e.target.checked)}
                        />
                        Saya paham, timpa token lama
                      </label>
                    </div>
                  ) : null
                })()}
              </div>
              <div className="usb-form-field">
                <label htmlFor="create-pin">PIN MFA baru</label>
                <input
                  id="create-pin"
                  type="password"
                  value={createPin}
                  onChange={e => setCreatePin(e.target.value)}
                  placeholder="Minimal 4 karakter"
                />
              </div>
              <div className="usb-form-field">
                <label htmlFor="create-pin-confirm">Ulangi PIN</label>
                <input
                  id="create-pin-confirm"
                  type="password"
                  value={createPinConfirm}
                  onChange={e => setCreatePinConfirm(e.target.value)}
                  placeholder="Ketik ulang PIN"
                />
              </div>
              {createError && <p className="usb-create-error" role="alert">❌ {createError}</p>}
              <div className="usb-form-actions">
                <button className="usb-primary-btn" onClick={handleSubmitCreate}>
                  🔑 Buat Token
                </button>
                <button className="usb-secondary-btn" onClick={handleCloseCreate}>Batal</button>
              </div>
              <p className="usb-create-note">
                Membuat file token TIDAK otomatis mendaftarkannya. Setelah dibuat,
                gunakan tombol <strong>"Daftarkan USB Baru"</strong> untuk mengikatnya ke akun ini.
              </p>
            </div>
          )}

          {createStep === 'creating' && (
            <p className="usb-register-note">⏳ Membuat token…</p>
          )}

          {createStep === 'done' && (
            <div className="usb-register-done">
              <p className="usb-done-icon">✅</p>
              <p><strong>Token berhasil dibuat di flashdisk!</strong></p>
              <p className="usb-create-note">
                Credential ID: <code>{createdCredentialId.slice(0, 20)}…</code>
              </p>
              <p className="usb-create-note">
                Simpan PIN baik-baik. Sekarang daftarkan dengan tombol <strong>"Daftarkan USB Baru"</strong>.
              </p>
              <button className="usb-primary-btn" onClick={handleCloseCreate}>Tutup</button>
            </div>
          )}

          {createStep === 'error' && (
            <div className="usb-register-error">
              <p>❌ {createError}</p>
              <div className="usb-form-actions">
                <button className="usb-secondary-btn" onClick={() => { setCreateStep('select-drive'); setCreateError('') }}>
                  Coba Lagi
                </button>
                <button className="usb-secondary-btn" onClick={handleCloseCreate}>Tutup</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Register Flow Modal ── */}
      {showRegister && (
        <div className="usb-register-box">
          <h3>Daftarkan USB Token Baru</h3>

          {registerStep === 'idle' && (
            <p className="usb-register-note">Menyiapkan challenge…</p>
          )}

          {registerStep === 'waiting-usb' && (
            <div className="usb-register-step">
              <p className="usb-step-icon">🔌</p>
              <p><strong>Colokkan USB token</strong> yang ingin didaftarkan.</p>
              <p className="usb-step-sub">Sistem akan mendeteksi otomatis dalam 2 detik.</p>
              {detectedTokens.length > 0 && (
                <p className="usb-step-detected">✅ Terdeteksi: {detectedTokens[0].drive}</p>
              )}
              {registerError && (
                <p className="usb-step-removed">⚠️ {registerError}</p>
              )}
            </div>
          )}

          {(registerStep === 'waiting-pin' || registerStep === 'signing') && (
            <div className="usb-register-form">
              <div className="usb-form-field">
                <label htmlFor="usb-pin">PIN / Password MFA</label>
                <input
                  id="usb-pin"
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Masukkan PIN untuk dekripsi"
                  autoFocus
                  disabled={registerStep === 'signing'}
                />
              </div>
              <div className="usb-form-field">
                <label htmlFor="usb-label">Label (opsional)</label>
                <input
                  id="usb-label"
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="contoh: USB Kantor"
                  disabled={registerStep === 'signing'}
                />
              </div>
              <div className="usb-form-actions">
                <button
                  className="usb-primary-btn"
                  onClick={handleSubmitPin}
                  disabled={!pin || registerStep === 'signing'}
                >
                  {registerStep === 'signing' ? '⏳ Memproses…' : '🔐 Daftarkan Token'}
                </button>
                <button className="usb-secondary-btn" onClick={handleCloseRegister}>Batal</button>
              </div>
            </div>
          )}

          {registerStep === 'done' && (
            <div className="usb-register-done">
              <p className="usb-done-icon">✅</p>
              <p><strong>USB token berhasil didaftarkan!</strong></p>
              <button className="usb-primary-btn" onClick={handleCloseRegister}>Tutup</button>
            </div>
          )}

          {registerStep === 'error' && (
            <div className="usb-register-error">
              <p>❌ {registerError}</p>
              <div className="usb-form-actions">
                <button className="usb-secondary-btn" onClick={handleStartRegister}>Coba Lagi</button>
                <button className="usb-secondary-btn" onClick={handleCloseRegister}>Tutup</button>
              </div>
            </div>
          )}
        </div>
      )}

      {listError && <p className="usb-error" role="alert">{listError}</p>}

      {/* ── Daftar Token ── */}
      <div className="usb-list">
        {loading && <p className="usb-list-note">Memuat token…</p>}

        {!loading && credentials.length === 0 && (
          <p className="usb-list-note">
            Belum ada USB token terdaftar. Daftarkan USB flashdisk sebagai faktor autentikasi kedua.
          </p>
        )}

        {!loading && credentials.length > 0 && (
          <>
            <p className="usb-list-count">
              {activeCount} token aktif dari {credentials.length} total
            </p>
            {credentials.map(cred => (
              <div key={cred.id} className={`usb-row${cred.is_active ? '' : ' usb-row--revoked'}`}>
                <div className="usb-row-main">
                  <span className="usb-row-icon">🔑</span>
                  <div className="usb-row-info">
                    {editingId === cred.id ? (
                      <div className="usb-edit-inline">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          autoFocus
                          maxLength={100}
                        />
                        <button className="usb-save-btn" onClick={() => handleSaveLabel(cred)}>Simpan</button>
                        <button className="usb-secondary-btn" onClick={() => setEditingId(null)}>Batal</button>
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
                  {cred.is_active && editingId !== cred.id && (
                    <>
                      <button
                        className="usb-edit-btn"
                        onClick={() => { setEditingId(cred.id); setEditLabel(cred.label ?? '') }}
                        title="Ubah label"
                      >
                        Ubah Label
                      </button>
                      <button
                        className="usb-revoke-btn"
                        onClick={() => handleRevoke(cred)}
                        title="Nonaktifkan token"
                        disabled={revokingId === cred.id}
                      >
                        {revokingId === cred.id ? 'Memproses…' : <RevokeIcon />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  )
}