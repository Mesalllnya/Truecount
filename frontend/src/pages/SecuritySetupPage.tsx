import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useWebAuthnRegister } from '../hooks/useWebAuthn';
import { useUsbToken, createTokenFile, listUsbDrives, startUsbRegister, verifyUsbRegister } from '../hooks/useUsbToken';
import { useCameraPermission } from '../hooks/useAuthSecurity';
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg';
import './AuthPage.css';

/* ── Ikon SVG ───────────────────────────────────────────────── */
function FingerprintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 16v-2a4 4 0 0 1 4-4h1v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4h1a4 4 0 0 1 4 4v2" />
      <path d="M8 8c0-1.5.5-3 2-3s2 1.5 2 3" />
      <path d="M12 12v8" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10.5 12.5 20 3M17 6l3 3M14 9l3 3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

export default function SecuritySetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo || '/dasbor';

  // ── State ─────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState<'choose' | 'webauthn' | 'dongle' | 'complete'>('choose');
  const [webauthnName, setWebauthnName] = useState('');
  const [donglePin, setDonglePin] = useState('');
  const [dongleConfirmPin, setDongleConfirmPin] = useState('');
  const [selectedDrive, setSelectedDrive] = useState('');
  const [availableDrives, setAvailableDrives] = useState<Array<{ drive: string; has_token: boolean }>>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ── WebAuthn Register Hook ───────────────────────────────────
  const {
    isLoading: webauthnLoading,
    error: webauthnError,
    register: registerWebAuthn,
    clearError: clearWebAuthnError,
  } = useWebAuthnRegister();

  // ── USB Token Hook ───────────────────────────────────────────
  const {
    scanForTokens,
    decryptPrivateKey,
    importPrivateKey,
    signChallenge,
    generateChallenge,
    isDecrypting: usbDecrypting,
    error: usbHookError,
  } = useUsbToken();

  // ── Camera Permission ────────────────────────────────────────
  const { hasPermission: cameraPermission, isChecking: cameraChecking, error: cameraError, requestPermission } = useCameraPermission();

  // ── Dongle State ─────────────────────────────────────────────
  const [dongleStep, setDongleStep] = useState<'select-drive' | 'enter-pin' | 'registering' | 'done'>('select-drive');
  const [dongleRegisterData, setDongleRegisterData] = useState<{ challenge_id: number; challenge: string } | null>(null);

  // ── Load available drives on mount ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadDrives = async () => {
      const drives = await listUsbDrives();
      if (!cancelled) setAvailableDrives(drives);
    };
    loadDrives();
    return () => { cancelled = true; };
  }, []);

  // ── Auto-detect USB token for registration ───────────────────
  useEffect(() => {
    if (activeStep !== 'dongle' || dongleStep !== 'select-drive') return;
    let cancelled = false;
    const poll = async () => {
      const tokens = await scanForTokens();
      if (!cancelled && tokens.length > 0) {
        const validToken = tokens.find(t => t.is_valid !== false);
        if (validToken) {
          setSelectedDrive(validToken.drive);
        }
      }
    };
    poll();
    const intervalId = window.setInterval(poll, 2000);
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, [activeStep, dongleStep, scanForTokens]);

  // ── Handlers ──────────────────────────────────────────────────
  function handleBack() {
    if (activeStep === 'choose') {
      navigate(-1);
    } else if (activeStep === 'webauthn') {
      setActiveStep('choose');
      setError('');
      clearWebAuthnError();
    } else if (activeStep === 'dongle') {
      setActiveStep('choose');
      setDongleStep('select-drive');
      setDonglePin('');
      setDongleConfirmPin('');
      setSelectedDrive('');
      setDongleRegisterData(null);
      setError('');
    }
  }

  function setStep(step: typeof activeStep) {
    setActiveStep(step);
    setError('');
    setSuccess('');
    clearWebAuthnError();
  }

  // ── WebAuthn Registration ────────────────────────────────────
  const handleWebAuthnRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webauthnName.trim()) {
      setError('Masukkan nama untuk Windows Hello (misal: "Laptop Kantor")');
      return;
    }
    if (cameraChecking) return;
    if (cameraPermission === false) {
      setError(cameraError || 'Izin kamera diperlukan untuk Windows Hello');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await registerWebAuthn(webauthnName.trim());
      if (result) {
        setSuccess('Windows Hello berhasil dikonfigurasi!');
        setTimeout(() => setStep('complete'), 1500);
      } else {
        setError(webauthnError || 'Registrasi Windows Hello gagal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Dongle Registration ──────────────────────────────────────
  const handleDongleSelectDrive = (drive: string) => {
    setSelectedDrive(drive);
    setDongleStep('enter-pin');
  };

  const handleDongleStartRegister = async () => {
    if (!selectedDrive) {
      setError('Pilih drive USB terlebih dahulu');
      return;
    }
    if (!donglePin || donglePin.length < 4) {
      setError('PIN minimal 4 karakter');
      return;
    }
    if (donglePin !== dongleConfirmPin) {
      setError('Konfirmasi PIN tidak cocok');
      return;
    }

    setDongleStep('registering');
    setError('');
    setIsLoading(true);

    try {
      // 1. Get challenge from server
      const startData = await startUsbRegister();
      if (!startData) throw new Error('Gagal memulai registrasi dongle');
      setDongleRegisterData(startData);

      // 2. Create token file on USB
      const tokenResult = await createTokenFile(selectedDrive, 0, donglePin); // user_id akan diisi server
      if (!tokenResult) throw new Error('Gagal membuat file token di USB');

      // 3. Decrypt private key to sign challenge
      const decryptResult = await decryptPrivateKey(selectedDrive, donglePin);
      if (!decryptResult) throw new Error(usbHookError || 'Gagal mendekripsi kunci privat');

      // 4. Import and sign
      const privateKey = await importPrivateKey(decryptResult.private_key_jwk);
      const challengeBytes = generateChallenge(); // We'll use the one from server
      // Actually use server challenge
      const serverChallengeBytes = new Uint8Array(
        atob(startData.challenge.replace(/-/g, '+').replace(/_/g, '/').padEnd(startData.challenge.length + (4 - (startData.challenge.length % 4)) % 4, '='))
          .split('').map(c => c.charCodeAt(0))
      );
      const signature = await signChallenge(privateKey, serverChallengeBytes);

      // 5. Convert signature to base64url
      const signatureB64 = btoa(String.fromCharCode(...signature))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      // 6. Verify with server
      const verifyResult = await verifyUsbRegister(
        startData.challenge_id,
        signatureB64,
        decryptResult.public_key_spki,
        `Dongle ${selectedDrive}`
      );

      if (!verifyResult) throw new Error('Verifikasi registrasi dongle gagal');

      setSuccess('Dongle keamanan berhasil dikonfigurasi!');
      setDongleStep('done');
      setTimeout(() => setStep('complete'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrasi dongle gagal');
      setDongleStep('enter-pin');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Complete & Navigate ──────────────────────────────────────
  const handleComplete = () => {
    navigate(returnTo, { replace: true });
  };

  // ── Render ────────────────────────────────────────────────────
  const loadingAny = isLoading || webauthnLoading || usbDecrypting;

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <button
          type="button"
          className="back-btn"
          onClick={handleBack}
          aria-label="Kembali"
          title="Kembali"
          disabled={activeStep !== 'choose' && loadingAny}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
          <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
        </Link>
      </div>

      <div className="auth-card">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="auth-header">
          <div className="setup-icon" aria-hidden="true">
            <ShieldIcon />
          </div>
          <h1>{activeStep === 'complete' ? 'Siap Digunakan' : 'Atur Keamanan Akun'}</h1>
          <p>
            {activeStep === 'choose'
              ? 'Pilih metode keamanan untuk melindungi akun Anda. Minimal satu wajib dikonfigurasi.'
              : activeStep === 'complete'
              ? 'Keamanan akun Anda sudah dikonfigurasi. Anda dapat mengakses TrueCount.'
              : 'Ikuti langkah-langkah di bawah untuk menyelesaikan pengaturan.'}
          </p>
        </div>

        {/* ── Messages ────────────────────────────────────────── */}
        {error && (
          <p className="field-error" role="alert"><AlertIcon />{error}</p>
        )}
        {success && (
          <p className="auth-success" role="status"><CheckIcon />{success}</p>
        )}

        {/* ── Camera Requirement Notice ───────────────────────── */}
        {(activeStep === 'choose' || activeStep === 'webauthn') && (
          <div 
            className={`camera-notice 
              ${cameraPermission === true ? 'camera-notice--success' : ''} 
              ${cameraPermission === false ? 'camera-notice--error' : ''}`}
            role="status"
          >
            <CameraIcon />
            <span>
              <strong>Kamera wajib aktif</strong> untuk Windows Hello (verifikasi wajah/sidik jari).
              {cameraChecking ? ' Memeriksa izin...' : cameraPermission === false ? ` ${cameraError}` : ' Kamera siap.'}
            </span>
            {cameraPermission === false && (
              <button type="button" className="camera-retry" onClick={requestPermission}>
                Coba Lagi
              </button>
            )}
          </div>
        )}

        {/* ── Step: Choose Method ─────────────────────────────── */}
        {activeStep === 'choose' && (
          <div className="setup-methods" role="radiogroup" aria-label="Pilih metode keamanan">
            <button
              type="button"
              className="setup-method-btn"
              onClick={() => setStep('webauthn')}
              disabled={loadingAny}
            >
              <span className="setup-method-icon"><FingerprintIcon /></span>
              <div className="setup-method-info">
                <span className="setup-method-label">Windows Hello</span>
                <span className="setup-method-desc">Sidik jari, wajah, atau PIN Windows</span>
              </div>
              <ChevronRightIcon />
              <span className="setup-method-require">Wajib: Kamera</span>
            </button>

            <button
              type="button"
              className="setup-method-btn"
              onClick={() => setStep('dongle')}
              disabled={loadingAny}
            >
              <span className="setup-method-icon"><KeyIcon /></span>
              <div className="setup-method-info">
                <span className="setup-method-label">Dongle Keamanan</span>
                <span className="setup-method-desc">USB token fisik (TrueCount Token)</span>
              </div>
              <ChevronRightIcon />
              <span className="setup-method-require">Wajib: Aplikasi Desktop</span>
            </button>

            <p className="setup-note">
              <AlertIcon /> Anda harus mengkonfigurasi <strong>minimal satu</strong> metode untuk masuk ke TrueCount.
            </p>
          </div>
        )}

        {/* ── Step: Windows Hello ─────────────────────────────── */}
        {activeStep === 'webauthn' && (
          <form onSubmit={handleWebAuthnRegister} noValidate>
            <div className="field">
              <label htmlFor="webauthn-name">Nama perangkat</label>
              <input
                id="webauthn-name"
                name="webauthn-name"
                type="text"
                autoComplete="off"
                placeholder="Contoh: Laptop Kantor, PC Rumah"
                value={webauthnName}
                onChange={e => { setWebauthnName(e.target.value); setError(''); }}
                required
                disabled={loadingAny}
              />
            </div>

            {webauthnError && <p className="field-error" role="alert"><AlertIcon />{webauthnError}</p>}

            <div className="webauthn-requirements">
              <h4>Persyaratan:</h4>
              <ul>
                <li><CheckIcon /> Windows 10/11 dengan Windows Hello sudah dikonfigurasi</li>
                <li><CheckIcon /> Kamera berfungsi untuk verifikasi wajah</li>
                <li><CheckIcon /> Atau sensor sidik jari / PIN Windows</li>
                <li><CheckIcon /> Browser mendukung WebAuthn (Chrome, Edge, Firefox terbaru)</li>
              </ul>
            </div>

            <button
              type="submit"
              className="btn-submit btn-submit--webauthn"
              disabled={loadingAny || !webauthnName.trim() || cameraPermission === false}
            >
              {loadingAny ? (
                <span className="btn-loading"><LoaderIcon />Mendaftarkan…</span>
              ) : (
                <>
                  <FingerprintIcon />
                  Daftarkan Windows Hello
                </>
              )}
            </button>
          </form>
        )}

        {/* ── Step: Dongle ────────────────────────────────────── */}
        {activeStep === 'dongle' && (
          <div className="dongle-setup">
            {dongleStep === 'select-drive' && (
              <>
                <div className="dongle-drive-select">
                  <h3>Pilih Drive USB</h3>
                  <p>Colokkan dongle TrueCount ke port USB. Sistem akan mendeteksi drive yang tersedia.</p>
                  
                  {availableDrives.length === 0 ? (
                    <div className="dongle-no-drives">
                      <KeyIcon className="dongle-waiting-icon" />
                      <p>Tidak ada drive USB terdeteksi</p>
                      <span className="dongle-hint">Colokkan dongle dan tunggu beberapa detik…</span>
                    </div>
                  ) : (
                    <div className="drive-list" role="listbox" aria-label="Drive USB tersedia">
                      {availableDrives.map((drive) => (
                        <button
                          key={drive.drive}
                          type="button"
                          className={`drive-option ${drive.has_token ? 'drive-option--has-token' : ''}`}
                          onClick={() => handleDongleSelectDrive(drive.drive)}
                          disabled={loadingAny}
                          role="option"
                        >
                          <span className="drive-letter">{drive.drive}</span>
                          <span className="drive-desc">
                            {drive.has_token ? '✓ Token terdeteksi' : 'Drive kosong'}
                          </span>
                          <ChevronRightIcon />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-submit btn-submit--secondary"
                  onClick={() => setDongleStep('enter-pin')}
                  disabled={loadingAny}
                >
                  Lanjutkan Manual
                </button>
              </>
            )}

            {(dongleStep === 'enter-pin' || dongleStep === 'registering') && (
              <form onSubmit={e => { e.preventDefault(); handleDongleStartRegister(); }} noValidate>
                <div className="field">
                  <label htmlFor="dongle-drive-input">Drive USB</label>
                  <input
                    id="dongle-drive-input"
                    type="text"
                    value={selectedDrive || 'Belum dipilih'}
                    readOnly
                    disabled
                  />
                </div>

                <div className="field">
                  <label htmlFor="dongle-pin">PIN Dongle</label>
                  <input
                    id="dongle-pin"
                    name="dongle-pin"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimal 4 karakter"
                    value={donglePin}
                    onChange={e => { setDonglePin(e.target.value); setError(''); }}
                    required
                    minLength={4}
                    disabled={loadingAny || dongleStep === 'registering'}
                  />
                </div>

                <div className="field">
                  <label htmlFor="dongle-confirm-pin">Konfirmasi PIN</label>
                  <input
                    id="dongle-confirm-pin"
                    name="dongle-confirm-pin"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Ulangi PIN"
                    value={dongleConfirmPin}
                    onChange={e => { setDongleConfirmPin(e.target.value); setError(''); }}
                    required
                    disabled={loadingAny || dongleStep === 'registering'}
                  />
                </div>

                {error && <p className="field-error" role="alert"><AlertIcon />{error}</p>}

                <button
                  type="submit"
                  className="btn-submit btn-submit--dongle"
                  disabled={loadingAny || dongleStep === 'registering' || !donglePin || donglePin !== dongleConfirmPin}
                >
                  {dongleStep === 'registering' ? (
                    <span className="btn-loading"><LoaderIcon />Mendaftarkan Dongle…</span>
                  ) : (
                    <>
                      <KeyIcon />
                      Daftarkan Dongle
                    </>
                  )}
                </button>
              </form>
            )}

            {dongleStep === 'done' && (
              <div className="setup-complete">
                <div className="complete-icon"><CheckIcon /></div>
                <h3>Dongle Berhasil Didaftarkan</h3>
                <p>Dongle keamanan Anda siap digunakan untuk masuk ke TrueCount.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Step: Complete ──────────────────────────────────── */}
        {activeStep === 'complete' && (
          <div className="setup-complete">
            <div className="complete-icon"><CheckIcon /></div>
            <h3>Pengaturan Keamanan Selesai</h3>
            <p>Akun Anda sekarang dilindungi. Anda dapat masuk menggunakan metode yang dipilih.</p>
            <button
              type="button"
              className="btn-submit"
              onClick={handleComplete}
              disabled={loadingAny}
            >
              Lanjutkan ke Dasbor
            </button>
          </div>
        )}

        <p className="auth-footer-text">
          Butuh bantuan?{' '}
          <Link to="/tentang" style={{ color: 'var(--red)', textDecoration: 'underline' }}>Hubungi Panitia</Link>
        </p>
      </div>

      <div className="auth-mosaic" aria-hidden="true" />
    </div>
  );
}