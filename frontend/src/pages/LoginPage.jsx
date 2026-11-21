import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUsbToken, startUsbAuthenticate, verifyUsbAuthenticate, base64urlToBytes, bytesToBase64url } from '../hooks/useUsbToken'
import { useWebAuthnLogin, isWebAuthnSupported } from '../hooks/useWebAuthn'
import { useFailedAttempts, useCameraPermission } from '../hooks/useAuthSecurity.tsx'
import { useAuth } from '../hooks/useAuthSession'
import navLogoLight from '/logo/TrueCount_navLogo_lightmode.svg'
import { apiUrl } from '../lib/appConfig'
import Icon from '../components/Icon'
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

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

/* ── Pesan standar: kamera wajib online untuk SEMUA metode masuk ── */
const CAMERA_BLOCKED_MSG =
  'Kamera tertutup atau terlalu gelap. Buka penutup kamera (shutter), nyalakan lampu, ubah posisi, atau ganti kamera.'

function LoaderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite" />
      </path>
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 4v6a6 6 0 0 0 6 6h6" />
      <path d="M23 20v-6a6 6 0 0 0 -6 -6h-6" />
      <polyline points="17 20 23 20 23 14" />
      <polyline points="7 4 1 4 1 10" />
    </svg>
  )
}

/* ── Komponen utama ─────────────────────────────────────────── */

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // ── Auth Session ──────────────────────────────────────────────
  const { login } = useAuth()

  // ── Failed Attempts Tracking ────────────────────────────────
  const { state: attemptsState, increment, reset } = useFailedAttempts()

  // ── Camera Permission (required for Windows Hello) ──────────
  const { hasPermission: cameraPermission, isChecking: cameraChecking, error: cameraError, requestPermission, stream, videoEl, capturePhoto, verifyCameraActive, stopCamera, startCamera, switchCamera, cameraCount } = useCameraPermission()

  // Video element for preview - use this for verification since it's the live one
  const [previewVideoElement, setPreviewVideoElement] = useState(null)

  // ── Start camera explicitly on LoginPage mount ──
  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [startCamera, stopCamera])

  // ── Toast untuk kamera (muncul setiap kali pemeriksaan kamera berjalan) ──
  const [toast, setToast] = useState(null)
  const [toastType, setToastType] = useState('success')

  const showAuthToast = useCallback((message, type = 'success') => {
    setToast(message)
    setToastType(type)
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Show toast when camera check completes (including periodic re-checks)
  useEffect(() => {
    if (cameraChecking) return
    if (cameraPermission === true) {
      showAuthToast('Kamera siap', 'success')
    } else if (cameraPermission === false) {
      showAuthToast(cameraError || CAMERA_BLOCKED_MSG, 'error')
    }
  }, [cameraPermission, cameraChecking, cameraError, showAuthToast])

  // ── State umum ──────────────────────────────────────────────
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordShow, setPasswordShow] = useState(false)
  const [authPhoto, setAuthPhoto] = useState(null)
  // True jika user (berdasarkan identifier) belum pasang Windows Hello/Dongle
  const [identifierNeedsSetup, setIdentifierNeedsSetup] = useState(false)
  const [identifierChecked, setIdentifierChecked] = useState(false)
  // Kata sandi tersedia setelah 5x percobaan gagal
  const showPasswordFallback = attemptsState.count >= 5
  // User tidak ditemukan di database saat dicek security-status
  const [userNotFound, setUserNotFound] = useState(false)

  // Reset hitungan percobaan gagal saat username/email diganti (per-identifier).
  // `syncServer=false` agar log keamanan di server tidak ikut terhapus saat mengetik.
  const prevIdentifierRef = useRef(form.identifier)
  useEffect(() => {
    if (prevIdentifierRef.current !== form.identifier) {
      prevIdentifierRef.current = form.identifier
      reset(form.identifier.trim(), false)
      setUserNotFound(false) // reset notifikasi user tidak ditemukan
    }
  }, [form.identifier, reset])

  // ── Capture photo before auth attempt ─────────────────────────
  const captureAuthPhoto = useCallback(async () => {
    if (!capturePhoto) return null;
    const photo = await capturePhoto(previewVideoElement);
    setAuthPhoto(photo);
    return photo;
  }, [capturePhoto, previewVideoElement]);

  // ── Log percobaan gagal yang terjadi DI PERANGKAT (Windows Hello) ─────────
  // Kegagalan pada langkah navigator.credentials.get() — user menekan Batal
  // atau PIN Windows salah sampai ditolak OS — tidak pernah mencapai backend
  // (/auth/webauthn/login/verify tidak terpanggil), sehingga backend tidak
  // mencatat baris log & foto kamera sama sekali. Dipanggil dari sini HANYA
  // untuk kasus itu; kegagalan tahap verify tetap dicatat oleh backend
  // (webauthn_login_verify.php) sehingga tidak ada duplikasi baris.
  const logDeviceSideFailure = useCallback(async ({ identifier, method, error, authPhoto }) => {
    try {
      await fetch(apiUrl('/auth/attempts/log'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          method,
          success: false,
          error,
          auth_photo: authPhoto || undefined,
          user_agent: navigator.userAgent,
        }),
      })
    } catch {
      // Logging tidak boleh menghalangi alur login.
    }
  }, []);

  // ── Gate kamera: WAJIB online untuk SEMUA metode masuk ────────
  // 'ok' = kamera siap, 'blocked' = kamera tertutup/gelap (harus dihitung
  // gagal), 'checking' = masih diperiksa (tunggu, tidak dihitung gagal).
  const checkCameraGate = useCallback(async () => {
    if (cameraChecking) return 'checking'
    if (cameraPermission === false) return 'blocked'
    const active = await verifyCameraActive(previewVideoElement)
    return active ? 'ok' : 'blocked'
  }, [cameraChecking, cameraPermission, verifyCameraActive, previewVideoElement])

  // Blokir login bila kamera tidak online. Mengembalikan true jika diblokir.
  const blockIfCameraOffline = useCallback(async (identifier, method) => {
    const gate = await checkCameraGate()
    if (gate === 'ok') return false
    if (gate === 'blocked') {
      const msg = cameraError || CAMERA_BLOCKED_MSG
      setError(msg)
      try {
        await increment(identifier, method, false, msg)
      } catch (incErr) {
        console.warn('[Login] Failed to log camera-blocked attempt:', incErr)
      }
    }
    return true
  }, [checkCameraGate, cameraError, increment])

  // ── Matikan kamera HANYA saat meninggalkan halaman login (unmount) ────────
  // Menggunakan ref agar pembaruan stream/previewVideoElement tidak mematikan
  // kamera yang baru saja menyala.
  const unmountCleanupRef = useRef({ stream: null, previewVideoElement: null, videoEl: null })
  useEffect(() => {
    unmountCleanupRef.current = { stream, previewVideoElement, videoEl }
  }, [stream, previewVideoElement, videoEl])

  // ── Pasang stream ke elemen video preview SEKALI SAJA ─────────────────────
  // Dulu srcObject di-assign di dalam ref inline — ref inline dibuat baru tiap
  // render, jadi React lepas/pasang ulang ref setiap ketikan dan srcObject
  // di-assign ulang → pipeline media restart → kamera "flicker" tiap ngetik.
  // Sekarang: ref stabil (hanya mount/unmount) + assignment diguard.
  useEffect(() => {
    if (previewVideoElement && stream && previewVideoElement.srcObject !== stream) {
      previewVideoElement.srcObject = stream
    }
  }, [previewVideoElement, stream])

  useEffect(() => {
    return () => {
      stopCamera() // paksa matikan semua track + interval dari hook
      const { stream: s, previewVideoElement: p, videoEl: v } = unmountCleanupRef.current
      if (s) {
        s.getTracks().forEach((track) => track.stop())
      }
      if (p) {
        p.srcObject = null
      }
      if (v) {
        v.srcObject = null
      }
    }
  }, [stopCamera]) // dependency: stopCamera agar cleanup selalu pakai versi terbaru

  // ── Notifikasi "akun baru dibuat" ───────────────────────────
  const [notice, setNotice] = useState(
    () => (location.state?.registered ? 'Akun berhasil dibuat. Silakan masuk.' : '')
  )
  useEffect(() => {
    if (location.state?.registered) {
      navigate('/masuk', { replace: true, state: null })
    }
  }, [navigate, location.state])

  // ── WebAuthn (Windows Hello + Security Key) ────────────────────────────────
  const {
    isSupported: webauthnSupported,
    isPlatformAvailable: webauthnPlatformAvailable,
    isLoading: webauthnLoading,
    error: webauthnError,
    loginWithWindowsHello,
    clearError: clearWebAuthnError,
  } = useWebAuthnLogin()

  // ── USB Token (Dongle) ───────────────────────────────────────────
  // Hanya di desktop app (Tauri) - deteksi USB asli via Rust monitor
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const { scanForTokens } = useUsbToken()
  const [dongleStatus, setDongleStatus] = useState({
    connected: false,
    drive: null,
    credentialId: null,
    formatValid: null,
  })

  // Poll USB token status every 2 seconds (only in Tauri)
  useEffect(() => {
    if (!isTauri) return
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
  }, [scanForTokens, isTauri])

  // ── USB Token Auth (MFA Login) ───────────────────────────────
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
    const identifier = form.identifier.trim()
    if (!identifier) {
      setError('Masukkan username atau email terlebih dahulu')
      return
    }
    setUsbAuthStep('idle')
    setUsbAuthError('')
    setUsbAuthPin('')
    setUsbAuthSelectedDrive('')
    setUsbAuthChallengeData(null)

    const data = await startUsbAuthenticate(identifier)
    if (!data) {
      setUsbAuthStep('error')
      setUsbAuthError('Gagal memulai autentikasi. Coba lagi.')
      return
    }
    setUsbAuthChallengeData(data)
    setUsbAuthStep('waiting-usb')
  }

  const handleUsbAuthSubmitPin = async () => {
    const identifier = form.identifier.trim()
    if (!usbAuthSelectedDrive || !usbAuthPin || !usbAuthChallengeData) return

    // Kamera WAJIB online — Dongle pun butuh kamera aktif
    if (await blockIfCameraOffline(identifier, 'dongle')) return

    setUsbAuthStep('signing')
    setUsbAuthError('')

    // Capture photo before auth (kamera sudah pasti online)
    const photo = await captureAuthPhoto()

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
        usbAuthChallengeData.allowCredentials[0]?.id || '',
        signatureB64,
        photo
      )

      if (!result) {
        setUsbAuthStep('error')
        setUsbAuthError('Verifikasi gagal di server.')
        try {
          await increment(identifier, 'dongle', false, 'Verifikasi gagal di server')
        } catch (incErr) {
          console.warn('[Login] Failed to log dongle attempt:', incErr)
        }
        return
      }

      // Success!
      login(result.token, result.user)
      try {
        await increment(identifier, 'dongle', true)
      } catch (incErr) {
        console.warn('[Login] Failed to log dongle attempt:', incErr)
      }
      navigate('/dasbor')
    } catch (err) {
      setUsbAuthStep('error')
      const errMsg = err?.message || 'Terjadi kesalahan.'
      setUsbAuthError(errMsg)
      try {
        await increment(identifier, 'dongle', false, errMsg)
      } catch (incErr) {
        console.warn('[Login] Failed to log dongle attempt:', incErr)
      }
    } finally {
      setAuthPhoto(null)
    }
  }

  const handleUsbAuthCancel = () => {
    setUsbAuthStep('idle')
    setUsbAuthError('')
    setUsbAuthPin('')
    setUsbAuthSelectedDrive('')
    setUsbAuthChallengeData(null)
  }

  // ── Handler umum ────────────────────────────────────────────
  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
    clearWebAuthnError()
  }

  function handleBack() {
    navigate('/')
  }

  // ── Cek status keamanan user saat identifier diketik ──────────
  // Jika user belum pasang Windows Hello/Dongle, tampilkan Kata Sandi
  // untuk alur onboarding (setelah login akan diarahkan ke /atur-keamanan).
  useEffect(() => {
    const identifier = form.identifier.trim()
    if (!identifier) {
      setIdentifierNeedsSetup(false)
      setIdentifierChecked(false)
      setUserNotFound(false)
      setError('')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl('/auth/security-status'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier }),
        })
        const data = await res.json()
        if (res.ok && data.found) {
          setIdentifierNeedsSetup(data.requires_setup === true)
          setIdentifierChecked(true)
          setUserNotFound(false)
          setError('')
        } else if (res.status >= 500) {
          // Server hidup tapi database mati (atau error server lain)
          navigate('/server-error')
        } else {
          setIdentifierNeedsSetup(false)
          setIdentifierChecked(true)
          setUserNotFound(true)
          setError('Pengguna tidak ditemukan. Silakan coba username atau email yang lain.')
        }
      } catch {
        // Server tidak respons / tidak bisa nyambung ke database
        navigate('/server-error')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [form.identifier, navigate])

  // ── Cek kesehatan server saat halaman login dimuat ──
  // Jika server sudah mati sebelum user mengetik apa pun, arahkan ke /server-error
  // segera agar user tidak menunggu pada halaman login yang tidak bisa diproses.
  useEffect(() => {
    let cancelled = false

    const checkServer = async () => {
      try {
        const res = await fetch(apiUrl('/health'), {
          method: 'GET',
          // Gagal cepat jika server mati, tidak menunggu timeout bawaan browser
          signal: AbortSignal.timeout(2000),
        })
        if (!cancelled && !res.ok) {
          navigate('/server-error')
        }
      } catch {
        // Server tidak bisa dihubungi sama sekali → redirect segera
        if (!cancelled) navigate('/server-error')
      }
    }

    checkServer()
    return () => { cancelled = true }
  }, [navigate])

  // ── Submit password ─────────────────────────────────────────
  async function handlePasswordSubmit(e) {
    e.preventDefault()
    const identifier = form.identifier.trim()
    if (!identifier) {
      setError('Masukkan username atau email terlebih dahulu')
      return
    }

    // Kamera WAJIB online — Kata Sandi pun butuh kamera aktif
    if (await blockIfCameraOffline(identifier, 'password')) return

    // Capture photo before auth (kamera sudah pasti online)
    const photo = await captureAuthPhoto()

    setLoading(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, auth_photo: photo }),
      })
      const data = await readJson(res)
      if (!res.ok) {
        const errMsg = data.error || 'Login gagal. Silakan coba lagi.'
        setError(errMsg)
        await increment(identifier, 'password', false, errMsg)
        return
      }
      login(data.token, data.user)
      try {
        await increment(identifier, 'password', true)
      } catch (incErr) {
        console.warn('[Login] Failed to log password attempt:', incErr)
      }
      navigate('/dasbor')
    } catch (err) {
      const errMsg =
        err instanceof Error && err.message !== 'Failed to fetch'
          ? err.message
          : 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
      setError(errMsg)
      try {
        await increment(identifier, 'password', false, errMsg)
      } catch (incErr) {
        console.warn('[Login] Failed to log password attempt:', incErr)
      }
    } finally {
      setLoading(false)
      setAuthPhoto(null)
    }
  }

  // ── Submit Windows Hello ────────────────────────────────────
  async function handleWebAuthnLogin() {
    const identifier = form.identifier.trim()
    if (!identifier) {
      setError('Masukkan username atau email terlebih dahulu')
      return
    }

    // Kamera WAJIB online — Windows Hello pun butuh kamera aktif
    if (await blockIfCameraOffline(identifier, 'webauthn')) return

    // Capture photo before auth
    const photo = await captureAuthPhoto()

    setLoading(true)
    setError('')
    try {
      const result = await loginWithWindowsHello(identifier, photo)
      if (result) {
        login(result.token, result.user)
        try {
          await increment(identifier, 'webauthn', true)
        } catch (incErr) {
          console.warn('[Login] Failed to log webauthn attempt:', incErr)
        }
        stopCamera() // matikan kamera sebelum pindah ke dasbor
        navigate('/dasbor')
      } else {
        const errMsg = webauthnError || 'Autentikasi Windows Hello gagal'
        setError(errMsg)
        // Jika gagal karena belum ada kredensial Windows Hello yang terdaftar,
        // otomatis alihkan ke metode Kata Sandi agar user masih bisa masuk.
        const isNoCredential = [
          'kredensial', 'credential',
          'belum mendaftarkan', 'belum terdaftar',
          'tidak terdaftar', 'tidak ada',
        ].some(k => errMsg.toLowerCase().includes(k))
        if (isNoCredential) {
          setSelectedMethod('password')
          setError('Windows Hello belum terdaftar untuk akun ini. Silakan masuk dengan kata sandi.')
        }
        try {
          await increment(identifier, 'webauthn', false, errMsg)
        } catch (incErr) {
          console.warn('[Login] Failed to log webauthn attempt:', incErr)
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      setError(errMsg)
      // Fallback ke Kata Sandi jika tidak ada kredensial Windows Hello
      const isNoCredential = [
        'kredensial', 'credential',
        'belum mendaftarkan', 'belum terdaftar',
        'tidak terdaftar', 'tidak ada',
      ].some(k => errMsg.toLowerCase().includes(k))
      if (isNoCredential) {
        setSelectedMethod('password')
        setError('Windows Hello belum terdaftar untuk akun ini. Silakan masuk dengan kata sandi.')
      }
      try {
        await increment(identifier, 'webauthn', false, errMsg)
      } catch (incErr) {
        console.warn('[Login] Failed to log webauthn attempt:', incErr)
      }
      // Gagal di perangkat (cancel / PIN Windows salah): backend tidak tahu,
      // jadi catat sendiri ke server beserta foto kamera yang tadi di-capture.
      await logDeviceSideFailure({
        identifier,
        method: 'webauthn',
        error: errMsg,
        authPhoto: photo,
      })
    } finally {
      setLoading(false)
      setAuthPhoto(null)
    }
  }

  // ── Konfigurasi metode auth ─────────────────────────────────
  // Alur baru: setelah username diketik, cek ke /auth/security-status.
  // - Belum punya WebAuthn/Dongle (identifierNeedsSetup) → hanya Kata Sandi
  // - Sudah punya WebActuhn atau Dongle → hanya opsi keamanan itu, tanpa Kata Sandi
  //   kecuali setelah 5x percobaan gagal (password fallback)
  const passwordAvailable = identifierNeedsSetup || showPasswordFallback

  const authMethods = useMemo(() => {
    // Belum mengecek status user → tidak tampilkan metode apa pun
    if (!identifierChecked) return []

    const methods = []

    // User tidak ditemukan di server → jangan tampilkan metode apa pun
    if (userNotFound) return []

    // Jika sudah punya WebAuthn/Dongle dan WebAuthn belum gagal → tampilkan hanya opsi keamanan (tanpa Kata Sandi)
    if (!passwordAvailable) {
      // Windows Hello (jika supported + platform available + kamera ok)
      if ((webauthnSupported && webauthnPlatformAvailable) && cameraPermission !== false) {
        methods.push({
          id: 'webauthn',
          label: 'Windows Hello',
          description: 'Sidik jari, wajah, atau PIN Windows (kamera wajib aktif)',
          icon: <FingerprintIcon />,
          available: true,
          requireCamera: true,
        })
      }
      // Dongle (jika di Tauri desktop)
      if (isTauri) {
        methods.push({
          id: 'dongle',
          label: 'Dongle Keamanan',
          description: 'USB token fisik (TrueCount Token, kamera wajib aktif)',
          icon: <KeyIcon />,
          available: true,
          requireCamera: true,
        })
      }
    } else {
      // Belum punya keamanan (onboarding), 5x gagal, atau WebAuthn gagal → hanya Kata Sandi
      methods.push({
        id: 'password',
        label: 'Kata Sandi',
        description: 'Username/email dan kata sandi (kamera wajib aktif)',
        icon: <PasswordIcon />,
        available: true,
        requireCamera: true,
      })
    }

    return methods
  }, [passwordAvailable, identifierChecked, userNotFound, webauthnSupported, webauthnPlatformAvailable, cameraPermission, isTauri])

  // Determine default method:
  // - identifierNeedsSetup (onboarding) atau showPasswordFallback (5x gagal) → Kata Sandi
  // - Lainnya → WebHello jika tersedia, kalau tidak Dongle
  useEffect(() => {
    if (!identifierChecked) return
    if (passwordAvailable) {
      setSelectedMethod('password')
    } else if ((webauthnSupported && webauthnPlatformAvailable) && cameraPermission !== false) {
      setSelectedMethod('webauthn')
    } else if (isTauri) {
      setSelectedMethod('dongle')
    } else if (authMethods.length > 0) {
      setSelectedMethod(authMethods[0].id)
    } else {
      setSelectedMethod('password')
    }
  }, [identifierChecked, passwordAvailable, webauthnSupported, webauthnPlatformAvailable, cameraPermission, isTauri, authMethods])

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
        <Link to="/" className="nav-brand" aria-label="TrueCount - Beranda">
          <img src={navLogoLight} alt="TrueCount" className="nav-logo" />
        </Link>
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

        {toast && (
          <p className={`auth-toast ${toastType === 'success' ? 'auth-success' : 'auth-warning'}`} role="status" aria-live="polite">
            {toastType === 'success' ? <CheckIcon /> : <AlertIcon />}
            {toast}
          </p>
        )}

        {/* ── Notifikasi user tidak ditemukan ───────────────────── */}
        {userNotFound && error && (
          <p className="auth-warning" role="alert" aria-live="polite">
            <AlertIcon />
            {error}
          </p>
        )}

        {/* ── Camera Requirement Notice (SEMUA metode butuh kamera online) ── */}
        {(
          <div 
            className={`camera-notice 
              ${cameraPermission === false ? 'camera-notice--error' : ''} 
              ${cameraPermission === true ? 'camera-notice--success' : ''}
              ${cameraChecking ? 'camera-notice--checking' : ''}`}
            role="status"
            aria-live="polite"
          >
            <div className="camera-notice-icon" aria-hidden="true">
              <CameraIcon />
            </div>
            <div className="camera-notice-content">
              <div className="camera-notice-title">
                {cameraPermission === false ? (
                  <strong>Kamera belum siap</strong>
                ) : (
                  <strong>Kamera aktif</strong>
                )} untuk verifikasi
              </div>
              <div className="camera-notice-subtitle">
                {cameraChecking ? (
                  <>
                    <span className="camera-notice-spinner" aria-hidden="true"></span>
                    Memeriksa kamera...
                  </>
                ) : cameraPermission === false ? (
                  <>
                    <span className="camera-notice-error-icon" aria-hidden="true">!</span>
                    {cameraError}
                  </>
                ) : (
                  <>
                    <span className="camera-notice-success-icon" aria-hidden="true">
                      <CheckIcon />
                    </span>
                    Kamera siap
                  </>
                )}
              </div>
            </div>
            <div className="camera-notice-actions">
              {cameraPermission === false && (
                <>
                  <button 
                    type="button" 
                    className="camera-retry camera-retry--primary" 
                    onClick={requestPermission}
                    disabled={cameraChecking}
                    aria-busy={cameraChecking}
                  >
                    <CameraIcon />
                    {cameraChecking ? 'Memeriksa...' : 'Periksa Lagi (Buka Shutter)'}
                  </button>
                  {cameraCount > 1 && (
                    <button 
                      type="button" 
                      className="camera-retry camera-retry--secondary" 
                      onClick={switchCamera}
                      disabled={cameraChecking}
                    >
                      Ganti Kamera
                    </button>
                  )}
                </>
              )}
              {cameraPermission === true && (
                <span className="camera-ok-badge" aria-hidden="true">
                  <span className="badge-ring"></span>
                  Kamera Aktif
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Live Camera Preview ────────────────────────────── */}
        {cameraPermission === true && stream && videoEl && (
          <div className="camera-preview" role="region" aria-label="Pratinjau kamera">
            <div className="camera-preview-container">
              <video
                ref={setPreviewVideoElement}
                autoPlay
                playsInline
                muted
                className="camera-preview-video"
                aria-hidden="true"
              />
              <div className="camera-preview-overlay">
                <div className="camera-status-indicator active">
                  <span className="status-dot" aria-hidden="true"></span>
                  <span>verifikasi kamera</span>
                </div>
              </div>
            </div>
            <p className="camera-preview-hint">
              Kamera merekam untuk verifikasi wajah saat login.
            </p>
          </div>
        )}

        {/* ── Captured Photo Preview ────────────────────────────── */}
        {authPhoto && (
          <div className="photo-preview">
            <div className="photo-preview-header">
              <span className="photo-badge">
                <CheckIcon />
                Foto Tangkap
              </span>
              <button
                type="button"
                className="photo-capture-btn"
                onClick={captureAuthPhoto}
                title="Ulangi tangkap foto"
                disabled={cameraChecking}
              >
                <RefreshIcon />
                Ulangi
              </button>
            </div>
            <img
              src={authPhoto}
              alt="Foto verifikasi wajah"
              className="photo-thumbnail"
              style={{ transform: 'scaleX(-1)' }}
              loading="eager"
              decoding="async"
            />
            <p className="photo-hint">
              Foto wajah telah ditangkap dan akan dikirimkan bersama verifikasi login.
            </p>
          </div>
        )}

        {/* ── Pilihan Metode Auth ────────────────────────────── */}
        <div className="auth-method-selector" role="radiogroup" aria-label="Pilih metode masuk">
          {authMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              className={`auth-method-btn ${selectedMethod === method.id ? 'auth-method-btn--active' : ''} ${!method.available ? 'auth-method-btn--disabled' : ''}`}
              onClick={() => {
                if (method.available) {
                  setSelectedMethod(method.id)
                } else {
                  showAuthToast(method.unavailableReason || 'Metode ini tidak tersedia di perangkat Anda.')
                }
              }}
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
                <span className="auth-method-badge">{method.requireCamera ? 'Butuh Kamera' : 'Tidak tersedia'}</span>
              )}
            </button>
          ))}
          {attemptsState.count > 0 && (
            <div className="attempts-counter" role="status" aria-live="polite">
              <LockIcon />
              <span>
                Percobaan gagal: <strong>{attemptsState.count}/5</strong>
                {attemptsState.lockedUntil && (
                  <> • Terkunci hingga {new Date(attemptsState.lockedUntil).toLocaleTimeString('id-ID')}</>
                )}
              </span>
              <ShieldIcon />
            </div>
          )}
          {showPasswordFallback && attemptsState.count >= 5 && (
            <div className="password-unlocked-notice" role="status">
              <LockIcon />
              <span>Kata sandi sekarang tersedia karena <strong>5 percobaan gagal</strong>.</span>
            </div>
          )}

        </div>

        {/* ── Input Username / Email (di bawah opsi metode masuk) ──────────────── */}
        <div className="field">
          <label htmlFor="identifier">Masukkan username atau email Anda</label>
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

        {/* ── Form Password ──────────────────────────────────── */}
        {selectedMethod === 'password' && (
          <form onSubmit={handlePasswordSubmit} noValidate>
            <div className="field">
              <label htmlFor="password">Kata sandi</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  name="password"
                  type={passwordShow ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Kata sandi Anda"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setPasswordShow(s => !s)}
                  aria-label={passwordShow ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {passwordShow ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && <p className="field-error" role="alert"><AlertIcon />{error}</p>}

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading
                ? <span className="btn-loading"><LoaderIcon />Memproses…</span>
                : 'Masuk'}
            </button>
          </form>
        )}

        {/* ── Form Windows Hello ─────────────────────────────── */}
        {selectedMethod === 'webauthn' && (
          <div className="webauthn-form">
            <div className="field">
            </div>

            {error && <p className="field-error" role="alert"><AlertIcon />{error}</p>}
            {webauthnError && <p className="field-error" role="alert"><AlertIcon />{webauthnError}</p>}

            <button
              type="button"
              className="btn-submit btn-submit--webauthn"
              onClick={handleWebAuthnLogin}
              disabled={loading || webauthnLoading || !form.identifier.trim() || cameraPermission === false || cameraChecking}
            >
              {loading || webauthnLoading ? (
                <span className="btn-loading"><LoaderIcon />Memverifikasi…</span>
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
            </div>

            {usbAuthStep === 'idle' && (
              <>
                {error && <p className="field-error" role="alert"><AlertIcon />{error}</p>}
                {usbAuthError && <p className="field-error" role="alert"><AlertIcon />{usbAuthError}</p>}

                <button
                  type="button"
                  className="btn-submit btn-submit--dongle"
                  onClick={handleUsbAuthStart}
                  disabled={loading || !form.identifier.trim()}
                >
                  {loading ? (
                    <span className="btn-loading"><LoaderIcon />Memulai…</span>
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
                    <span className="btn-loading"><LoaderIcon />Memverifikasi…</span>
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
                <div className="form-actions">
                  <button type="button" className="btn-submit btn-submit--dongle" onClick={handleUsbAuthStart}>
                    <KeyIcon /> Coba Lagi
                  </button>
                  <button type="button" className="btn-submit btn-submit--secondary" onClick={handleUsbAuthCancel}>
                    Kembali
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="auth-invite-cta">
          <Link to="/daftar" className="btn-submit btn-submit--secondary">
            <Icon name="clipboard" size={16} />
            Daftar dengan undangan
          </Link>
          <p className="auth-footer-text">
            Butuh akun?{' '}
            <span className="auth-footer-note">Minta tautan undangan dari Panitia</span>
          </p>
        </div>
      </div>

      <div className="auth-mosaic" aria-hidden="true" />
    </div>
  )
}