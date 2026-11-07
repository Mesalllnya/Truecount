import { useState, useEffect } from 'react'
import { useUsbToken } from '../hooks/useUsbToken'
import './UsbTokenTestPage.css'

export default function UsbTokenTestPage() {
  const {
    detectedTokens,
    pendingToken,
    isDecrypting,
    error,
    decryptPrivateKey,
    importPrivateKey,
    signChallenge,
    bytesToBase64url,
    generateChallenge,
    base64urlToBytes,
    clearPending,
    removeToken,
  } = useUsbToken()

  const [selectedDrive, setSelectedDrive] = useState('')
  const [pin, setPin] = useState('')
  const [decryptedKey, setDecryptedKey] = useState(null)
  const [publicKeySpki, setPublicKeySpki] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [signature, setSignature] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)

  // Auto-select drive saat pendingToken muncul
  useEffect(() => {
    if (pendingToken && !selectedDrive) {
      setSelectedDrive(pendingToken.drive)
    }
  }, [pendingToken, selectedDrive])

  const handleDecrypt = async () => {
    if (!selectedDrive || !pin) return
    const result = await decryptPrivateKey(selectedDrive, pin)
    if (result) {
      const privateKey = await importPrivateKey(result.private_key_jwk)
      setDecryptedKey(privateKey)
      setPublicKeySpki(result.public_key_spki)
      setCredentialId(result.credential_id)
      setPin('') // clear PIN setelah berhasil
      clearPending()
    }
  }

  const handleGenerateChallenge = () => {
    const c = generateChallenge()
    setChallenge(c)
    setVerifyResult(null)
  }

  const handleSign = async () => {
    if (!decryptedKey || !challenge) return
    try {
      const sig = await signChallenge(decryptedKey, challenge)
      setSignature(bytesToBase64url(sig))
    } catch (err) {
      setVerifyResult({ ok: false, msg: `Sign error: ${err}` })
    }
  }

  const handleVerifyLocal = async () => {
    if (!signature || !challenge || !publicKeySpki) return
    try {
      // Import public key dari SPKI
      const pubKey = await crypto.subtle.importKey(
        'spki',
        base64urlToBytes(publicKeySpki),
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      )
      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        pubKey,
        base64urlToBytes(signature),
        challenge
      )
      setVerifyResult({ ok, msg: ok ? '✅ Signature VALID (local verify)' : '❌ Signature INVALID' })
    } catch (err) {
      setVerifyResult({ ok: false, msg: `Verify error: ${err}` })
    }
  }

  const handleClear = () => {
    setSelectedDrive('')
    setPin('')
    setDecryptedKey(null)
    setPublicKeySpki('')
    setCredentialId('')
    setChallenge(null)
    setSignature('')
    setVerifyResult(null)
  }

  return (
    <div className="usb-test-page">
      <header className="page-header">
        <h1>🔐 USB Token Test</h1>
        <p>Halaman testing deteksi & dekripsi USB token — <strong>belum terintegrasi ke auth</strong></p>
      </header>

      {/* Pending Notification */}
      {pendingToken && (
        <div className="pending-toast">
          <span>🔔 USB Token terdeteksi di <strong>{pendingToken.drive}</strong> untuk user <strong>#{pendingToken.user_id}</strong></span>
          <div className="toast-actions">
            <button onClick={() => setSelectedDrive(pendingToken.drive)}>Gunakan Ini</button>
            <button className="secondary" onClick={clearPending}>Abaikan</button>
          </div>
        </div>
      )}

      <main className="test-grid">
        {/* Panel 1: Detected Tokens */}
        <section className="panel">
          <h2>📱 Token Terdeteksi</h2>
          {detectedTokens.length === 0 ? (
            <p className="empty">Belum ada USB token terdeteksi.<br/>Colokkan USB yang berisi file <code>.truecount_token</code></p>
          ) : (
            <ul className="token-list">
              {detectedTokens.map((t) => (
                <li key={t.drive} className={selectedDrive === t.drive ? 'selected' : ''}>
                  <div className="token-info">
                    <span className="drive">{t.drive}</span>
                    <span className="user">User: #{t.user_id}</span>
                    <span className="cred">Cred: {t.credential_id.slice(0, 16)}…</span>
                  </div>
                  <div className="token-actions">
                    <button
                      onClick={() => setSelectedDrive(t.drive)}
                      disabled={selectedDrive === t.drive}
                    >
                      {selectedDrive === t.drive ? '✓ Dipilih' : 'Pilih'}
                    </button>
                    <button className="danger" onClick={() => removeToken(t.drive)}>
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Panel 2: Decrypt & Key Info */}
        <section className="panel">
          <h2>🔓 Dekripsi Private Key</h2>
          {decryptedKey ? (
            <div className="key-info">
              <div className="success-badge">✅ Private Key Berhasil Didekripsi</div>
              <div className="field">
                <label>Credential ID</label>
                <code>{credentialId}</code>
              </div>
              <div className="field">
                <label>Public Key (SPKI, base64url)</label>
                <code className="long">{publicKeySpki}</code>
              </div>
              <button className="secondary" onClick={handleClear}>
                Reset / Ganti Token
              </button>
            </div>
          ) : (
            <div className="decrypt-form">
              <div className="field">
                <label>Drive USB</label>
                <select value={selectedDrive} onChange={(e) => setSelectedDrive(e.target.value)} disabled={!selectedDrive}>
                  <option value="">-- Pilih drive --</option>
                  {detectedTokens.map((t) => (
                    <option key={t.drive} value={t.drive}>
                      {t.drive} (User #{t.user_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>PIN / Password MFA</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan PIN untuk dekripsi"
                  autoFocus
                />
              </div>
              {error && <div className="error-msg">❌ {error}</div>}
              <button className="primary" onClick={handleDecrypt} disabled={isDecrypting || !selectedDrive || !pin}>
                {isDecrypting ? '⏳ Mendekripsi…' : '🔓 Dekripsi & Import Key'}
              </button>
            </div>
          )}
        </section>

        {/* Panel 3: Challenge-Response Test */}
        <section className="panel">
          <h2>🧪 Challenge-Response Test</h2>
          {decryptedKey ? (
            <div className="challenge-test">
              <div className="field">
                <label>Challenge (32 bytes, base64url)</label>
                <div className="input-with-btn">
                  <input
                    type="text"
                    value={challenge ? bytesToBase64url(challenge) : ''}
                    readOnly
                    placeholder="Generate challenge dulu"
                  />
                  <button onClick={handleGenerateChallenge} disabled={!!challenge}>
                    🎲 Generate
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Signature (base64url)</label>
                <div className="input-with-btn">
                  <input
                    type="text"
                    value={signature}
                    readOnly
                    placeholder="Sign challenge dulu"
                  />
                  <button onClick={handleSign} disabled={!!signature || !challenge}>
                    ✍️ Sign
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Verifikasi Lokal (Public Key)</label>
                <button className="verify" onClick={handleVerifyLocal} disabled={!signature || !challenge}>
                  ✅ Verifikasi Signature
                </button>
                {verifyResult && (
                  <div className={`verify-result ${verifyResult.ok ? 'success' : 'fail'}`}>
                    {verifyResult.msg}
                  </div>
                )}
              </div>

              <button className="secondary" onClick={() => { setChallenge(null); setSignature(''); setVerifyResult(null); }}>
                Reset Challenge
              </button>
            </div>
          ) : (
            <p className="empty">Dekripsi private key dulu di panel kiri untuk menjalankan test challenge-response.</p>
          )}
        </section>
      </main>

      {/* Info Box */}
      <aside className="info-box">
        <h3>ℹ️ Cara Pakai</h3>
        <ol>
          <li>Siapkan USB flashdisk dengan file <code>.truecount_token</code> di root (format JSON sesuai spec)</li>
          <li>Colokkan USB → sistem akan auto-deteksi (max 2 detik delay)</li>
          <li>Klik "Gunakan Ini" pada notifikasi toast atau pilih drive di panel kiri</li>
          <li>Masukkan PIN → klik "Dekripsi & Import Key"</li>
          <li>Generate Challenge → Sign → Verifikasi Lokal</li>
          <li>Semua operasi kriptografi pakai <strong>Web Crypto API</strong> (ECDSA P-256 / SHA-256)</li>
        </ol>
        <p className="note"><strong>Catatan:</strong> Halaman ini hanya untuk testing. Integrasi ke auth MFA akan ditambahkan nanti.</p>
      </aside>
    </div>
  )
}