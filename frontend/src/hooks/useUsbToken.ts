import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState, useCallback } from 'react'

/** Payload event dari Rust saat USB token terdeteksi */
export interface UsbTokenDetected {
  drive: string
  user_id: number
  credential_id: string
  label?: string
  /** Empty string = token corrupt/invalid format */
  is_valid?: boolean
}

/** Response decrypt private key */
export interface DecryptResponse {
  private_key_jwk: JsonWebKey
  public_key_spki: string
  credential_id: string
}

/** File token di USB (raw dari scan) */
export interface UsbTokenFile {
  v: number
  uid: number
  alg: string
  pk: string
  sk_enc: string
  salt: string
  iv: string
}

/** Detect apakah berjalan di dalam Tauri */
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Info drive removable */
export interface UsbDriveInfo {
  drive: string
  has_token: boolean
}

/** Daftar SEMUA drive removable (termasuk tanpa token) - untuk UI buat token */
export async function listUsbDrives(): Promise<UsbDriveInfo[]> {
  if (!IS_TAURI) return []
  try {
    return await invoke<UsbDriveInfo[]>('list_usb_drives')
  } catch (err) {
    console.warn('[TrueCount] list_usb_drives gagal:', err)
    return []
  }
}

/** Buat file token baru di USB (tanpa registrasi) */
export async function createTokenFile(
  drive: string,
  userId: number,
  pin: string
): Promise<{ credential_id: string; drive: string } | null> {
  if (!IS_TAURI) return null
  try {
    return await invoke('create_usb_token_file', { drive, user_id: userId, pin })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(msg)
  }
}

/** Convert base64url string ke Uint8Array (module-level, tanpa state) */
export function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** Convert Uint8Array ke base64url (module-level, tanpa state) */
export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** Hook utama: auto-detect + decrypt helper */
export function useUsbToken() {
  const [detectedTokens, setDetectedTokens] = useState<Map<string, UsbTokenDetected>>(new Map())
  const [pendingToken, setPendingToken] = useState<UsbTokenDetected | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Listen event dari Tauri
  useEffect(() => {
    if (!IS_TAURI) return // Browser mode: tidak ada Tauri API
    let unlisten: (() => void) | undefined

    const setupListener = async () => {
      try {
        const un = await listen<UsbTokenDetected>('usb-token-detected', (event) => {
          const token = event.payload
          setDetectedTokens((prev) => {
            const next = new Map(prev)
            next.set(token.drive, token)
            return next
          })
          // Set sebagai pending untuk notifikasi toast/modal
          setPendingToken(token)
          // Auto-clear pending setelah 30 detik
          setTimeout(() => setPendingToken((p) => (p?.drive === token.drive ? null : p)), 30_000)
        })
        unlisten = un
      } catch (err) {
        console.warn('[TrueCount] Gagal listen event Tauri:', err)
      }
    }
    setupListener()

    return () => {
      unlisten?.()
    }
  }, [])

  /** Decrypt private key dari USB via Tauri command (atau Web Crypto di browser) */
  const decryptPrivateKey = useCallback(
    async (drive: string, pin: string): Promise<DecryptResponse | null> => {
      setIsDecrypting(true)
      setError(null)
      try {
        if (IS_TAURI) {
          const response = await invoke<DecryptResponse>('decrypt_usb_token_private_key', {
            drive,
            pin,
          })
          return response
        } else {
          // Browser mode: decrypt langsung via Web Crypto
          // (drive berisi JSON token file - untuk testing di browser)
          return await browserDecrypt(drive, pin)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        return null
      } finally {
        setIsDecrypting(false)
      }
    },
    []
  )

  /** Browser-mode decrypt: baca token JSON dari drive string, decrypt via Web Crypto */
  const browserDecrypt = useCallback(
    async (tokenJson: string, pin: string): Promise<DecryptResponse | null> => {
      try {
        const token: UsbTokenFile = JSON.parse(tokenJson)
        const encoder = new TextEncoder()

        // PBKDF2 derive key
        const salt = base64urlToBytes(token.salt)
        const iv = base64urlToBytes(token.iv)
        const ciphertextWithTag = base64urlToBytes(token.sk_enc)

        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(pin),
          'PBKDF2',
          false,
          ['deriveKey']
        )
        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        )

        // Split ciphertext & tag (16 byte terakhir)
        const ciphertext = ciphertextWithTag.slice(0, -16)
        const tag = ciphertextWithTag.slice(-16)
        // Web Crypto AES-GCM menggabungkan ciphertext+tag
        const combined = new Uint8Array(ciphertext.length + tag.length)
        combined.set(ciphertext, 0)
        combined.set(tag, ciphertext.length)

        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          combined
        )

        // plaintext = PKCS#8 DER private key
        // Import sebagai PKCS8 → export ke JWK
        const privateKey = await crypto.subtle.importKey(
          'pkcs8',
          plaintext,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign']
        )
        const jwk = await crypto.subtle.exportKey('jwk', privateKey)

        // credential_id = SHA-256(SPKI)
        const spkiBytes = base64urlToBytes(token.pk)
        const digest = await crypto.subtle.digest('SHA-256', spkiBytes)
        const credentialId = Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')

        return {
          private_key_jwk: jwk,
          public_key_spki: token.pk,
          credential_id: credentialId,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`Browser decrypt gagal: ${msg}`)
      }
    },
    []
  )

  /** Import private key JWK ke Web Crypto API untuk signing */
  const importPrivateKey = useCallback(
    async (jwk: JsonWebKey): Promise<CryptoKey> => {
      return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
    },
    []
  )

  /** Sign challenge dengan private key */
  const signChallenge = useCallback(
    async (privateKey: CryptoKey, challenge: Uint8Array): Promise<Uint8Array> => {
      const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, challenge)
      return new Uint8Array(signature)
    },
    []
  )

  /** Generate random challenge (32 bytes) */
  const generateChallenge = useCallback((): Uint8Array => {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)
    return challenge
  }, [])

  /** Scan aktif semua drive (bukan cuma pasif event) */
  const scanForTokens = useCallback(async (): Promise<UsbTokenDetected[]> => {
    if (!IS_TAURI) return []
    try {
      const tokens = await invoke<UsbTokenDetected[]>('scan_usb_tokens')
      // Update state dari hasil scan
      setDetectedTokens((prev) => {
        const next = new Map(prev)
        tokens.forEach((t) => next.set(t.drive, t))
        return next
      })
      return tokens
    } catch (err) {
      console.warn('[TrueCount] scan_usb_tokens gagal:', err)
      return []
    }
  }, [])

  /** Clear pending token notification */
  const clearPending = useCallback(() => {
    setPendingToken(null)
  }, [])

  /** Remove token dari detected list (misal USB dicabut) */
  const removeToken = useCallback((drive: string) => {
    setDetectedTokens((prev) => {
      const next = new Map(prev)
      next.delete(drive)
      return next
    })
  }, [])

  return {
    // State
    detectedTokens: Array.from(detectedTokens.values()),
    pendingToken,
    isDecrypting,
    error,
    // Actions
    decryptPrivateKey,
    importPrivateKey,
    signChallenge,
    base64urlToBytes,
    bytesToBase64url,
    generateChallenge,
    scanForTokens,
    clearPending,
    removeToken,
  }
}

/** Helper: baca file token langsung dari drive (untuk test/manual) */
export async function readTokenFileFromDrive(drive: string): Promise<UsbTokenFile | null> {
  try {
    // Note: Ini butuh FS scope di tauri.conf.json
    // Untuk sekarang return null, nanti bisa pakai invoke('read_usb_token_file')
    return null
  } catch {
    return null
  }
}

/* ── API Helpers untuk register flow ─────────────────────── */

const API_BASE = 'http://localhost:8000'

export interface RegisterStartResponse {
  challenge_id: number
  challenge: string // base64url
}

export interface UsbCredential {
  id: number
  credential_id: string // hex
  label: string | null
  sign_count: number
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  is_active: boolean
}

/** Mulai register: minta challenge dari backend */
export async function startUsbRegister(): Promise<RegisterStartResponse | null> {
  try {
    const token = localStorage.getItem('tc_token')
    const res = await fetch(`${API_BASE}/mfa/usb/register/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Gagal memulai registrasi.')
    return data
  } catch (err) {
    console.error('[TrueCount] startUsbRegister error:', err)
    return null
  }
}

/** Verifikasi register: kirim signature + public key */
export async function verifyUsbRegister(
  challengeId: number,
  signatureB64: string,
  publicKeySpki: string,
  label?: string
): Promise<{ message: string } | null> {
  try {
    const token = localStorage.getItem('tc_token')
    const res = await fetch(`${API_BASE}/mfa/usb/register/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        challenge_id: challengeId,
        signature: signatureB64,
        public_key: publicKeySpki,
        label: label || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Verifikasi gagal.')
    return data
  } catch (err) {
    console.error('[TrueCount] verifyUsbRegister error:', err)
    return null
  }
}

/** Ambil daftar USB token user */
export async function fetchUsbCredentials(): Promise<UsbCredential[] | null> {
  try {
    const token = localStorage.getItem('tc_token')
    const res = await fetch(`${API_BASE}/mfa/usb/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar token.')
    return data.credentials ?? []
  } catch (err) {
    console.error('[TrueCount] fetchUsbCredentials error:', err)
    return null
  }
}

/** Revoke (nonaktifkan) USB token */
export async function revokeUsbCredential(id: number): Promise<boolean> {
  try {
    const token = localStorage.getItem('tc_token')
    const res = await fetch(`${API_BASE}/mfa/usb/${id}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Gagal menonaktifkan token.')
    return true
  } catch (err) {
    console.error('[TrueCount] revokeUsbCredential error:', err)
    return false
  }
}

/** Update label USB token */
export async function updateUsbLabel(id: number, label: string): Promise<boolean> {
  try {
    const token = localStorage.getItem('tc_token')
    const res = await fetch(`${API_BASE}/mfa/usb/${id}/label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ label }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Gagal memperbarui label.')
    return true
  } catch (err) {
    console.error('[TrueCount] updateUsbLabel error:', err)
    return false
  }
}

/* ── API Helpers untuk authenticate (login MFA) flow ───────── */

export interface AuthenticateStartResponse {
  challenge_id: number
  challenge: string // base64url
  allowCredentials: Array<{ type: 'public-key'; id: string }>
  user: { id: number; username: string; email: string; role: string }
}

/** Mulai autentikasi USB token (MFA login) - identifier-based */
export async function startUsbAuthenticate(identifier: string): Promise<AuthenticateStartResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/mfa/usb/authenticate/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Gagal memulai autentikasi USB.')
    return data
  } catch (err) {
    console.error('[TrueCount] startUsbAuthenticate error:', err)
    return null
  }
}

/** Verifikasi autentikasi USB token (MFA login) */
export async function verifyUsbAuthenticate(
  challengeId: number,
  credentialId: string,
  signatureB64: string,
  authPhoto?: string | null
): Promise<{ message: string; token: string; user: { id: number; username: string; email: string; role: string } } | null> {
  try {
    const res = await fetch(`${API_BASE}/mfa/usb/authenticate/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_id: challengeId,
        credential_id: credentialId,
        signature: signatureB64,
        auth_photo: authPhoto ?? null,
      }),
    });
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Verifikasi USB token gagal.')
    return data
  } catch (err) {
    console.error('[TrueCount] verifyUsbAuthenticate error:', err)
    return null
  }
}