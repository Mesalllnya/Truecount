import { useState, useCallback, useEffect } from 'react'
import { getRpId } from '../utils/webauthn'

/** WebAuthn credential interface */
export interface WebAuthnCredential {
  id: string              // base64url encoded credential ID
  type: 'public-key'
  transports?: AuthenticatorTransport[]
}

/** Response dari /auth/webauthn/login/start */
export interface WebAuthnLoginStartResponse {
  challenge: string              // base64url encoded challenge
  challenge_id: number
  allowCredentials: WebAuthnCredential[]
  user: {
    id: number
    username: string
    email: string
    role: string
  }
}

/** Hasil dari navigator.credentials.get() */
export interface WebAuthnAssertion {
  id: string                              // credential ID (base64url)
  rawId: ArrayBuffer                      // raw credential ID
  type: 'public-key'
  response: {
    authenticatorData: ArrayBuffer
    clientDataJSON: ArrayBuffer
    signature: ArrayBuffer
    userHandle?: ArrayBuffer
  }
  authenticatorAttachment?: 'platform' | 'cross-platform'
  clientExtensionResults: AuthenticationExtensionsClientOutputs
}

/** Payload untuk /auth/webauthn/login/verify */
export interface WebAuthnLoginVerifyRequest {
  challenge_id: number
  credential_id: string              // base64url
  authenticator_data: string         // base64url
  client_data_json: string           // base64url
  signature: string                  // base64url
  user_handle?: string               // base64url (opsional)
}

/** Response dari /auth/webauthn/login/verify */
export interface WebAuthnLoginVerifyResponse {
  message: string
  token: string
  user: {
    id: number
    username: string
    email: string
    role: string
  }
}

/** Helper: base64url encode */
function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/** Helper: base64url decode */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

/** Helper: convert base64url string to ArrayBuffer */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  return base64urlDecode(base64url).buffer as ArrayBuffer
}

/** Cek apakah WebAuthn didukung di browser */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'credentials' in navigator &&
    'create' in navigator.credentials &&
    'get' in navigator.credentials &&
    typeof PublicKeyCredential !== 'undefined'
  )
}

/** Cek apakah platform authenticator (Windows Hello) tersedia */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Hook utama untuk WebAuthn login (Windows Hello) */
export function useWebAuthnLogin() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  const [isPlatformAvailable, setIsPlatformAvailable] = useState(false)

  // Cek support on mount
  useEffect(() => {
    const supported = isWebAuthnSupported()
    setIsSupported(supported)
    if (supported) {
      isPlatformAuthenticatorAvailable().then(setIsPlatformAvailable)
    }
  }, [])

  /** Step 1: Minta challenge dari server */
  const startLogin = useCallback(async (identifier: string): Promise<WebAuthnLoginStartResponse | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:8000/auth/webauthn/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memulai login Windows Hello')
      }
      return data as WebAuthnLoginStartResponse
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** Step 2: Panggil navigator.credentials.get() untuk autentikasi Windows Hello */
  const getAssertion = useCallback(async (options: WebAuthnLoginStartResponse): Promise<WebAuthnAssertion | null> => {
    if (!isSupported) {
      setError('WebAuthn tidak didukung di browser ini')
      return null
    }

    // Convert challenge base64url ke Uint8Array
    const challenge = base64urlDecode(options.challenge)

    // Convert allowCredentials
    const allowCredentials = options.allowCredentials.map(cred => ({
      type: 'public-key' as const,
      id: base64urlToBuffer(cred.id),
      transports: cred.transports,
    }))

    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials,
          timeout: 60000, // 60 detik
          rpId: getRpId(),
          userVerification: 'required', // Windows Hello butuh user verification
        },
      }) as PublicKeyCredential & { response: AuthenticatorAssertionResponse }

      return assertion as unknown as WebAuthnAssertion
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError') {
        throw new Error('Autentikasi dibatalkan atau gagal. Silakan coba lagi.')
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Windows Hello tidak didukung pada perangkat ini.')
      } else if (error.name === 'InvalidStateError') {
        throw new Error('Tidak ada kredensial Windows Hello yang terdaftar untuk akun ini.')
      } else if (error.name === 'SecurityError') {
        throw new Error('Kesalahan keamanan. Pastikan menggunakan HTTPS atau localhost.')
      } else {
        throw new Error(error.message || 'Autentikasi Windows Hello gagal.')
      }
    }
  }, [isSupported])

  /** Step 3: Kirim assertion ke server untuk verifikasi */
  const verifyAssertion = useCallback(async (
    assertion: WebAuthnAssertion,
    challengeId: number,
    authPhoto?: string | null
  ): Promise<WebAuthnLoginVerifyResponse | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const rawIdBytes = new Uint8Array(assertion.rawId)
      const authDataBytes = new Uint8Array(assertion.response.authenticatorData)
      const clientDataBytes = new Uint8Array(assertion.response.clientDataJSON)
      const signatureBytes = new Uint8Array(assertion.response.signature)

      const body: WebAuthnLoginVerifyRequest & { auth_photo?: string | null } = {
        challenge_id: challengeId,
        credential_id: base64urlEncode(rawIdBytes),
        authenticator_data: base64urlEncode(authDataBytes),
        client_data_json: base64urlEncode(clientDataBytes),
        signature: base64urlEncode(signatureBytes),
        auth_photo: authPhoto ?? null,
      }

      if (assertion.response.userHandle) {
        body.user_handle = base64urlEncode(new Uint8Array(assertion.response.userHandle))
      }

      const res = await fetch('http://localhost:8000/auth/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Verifikasi Windows Hello gagal')
      }
      return data as WebAuthnLoginVerifyResponse
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan'
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** Full flow: start -> get assertion -> verify */
  const loginWithWindowsHello = useCallback(async (
    identifier: string,
    authPhoto?: string | null
  ): Promise<WebAuthnLoginVerifyResponse | null> => {
    const startResult = await startLogin(identifier)
    if (!startResult) return null

    const assertion = await getAssertion(startResult)
    if (!assertion) return null

    return verifyAssertion(assertion, startResult.challenge_id, authPhoto)
  }, [startLogin, getAssertion, verifyAssertion])

  return {
    // State
    isLoading,
    error,
    isSupported,
    isPlatformAvailable,
    // Actions
    startLogin,
    getAssertion,
    verifyAssertion,
    loginWithWindowsHello,
    clearError: () => setError(null),
  }
}

/** Hook untuk registrasi Windows Hello (untuk halaman settings/MFA) */
export function useWebAuthnRegister() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const register = useCallback(async (
    username: string,
    displayName: string
  ): Promise<{ credentialId: string } | null> => {
    if (!isWebAuthnSupported()) {
      setError('WebAuthn tidak didukung di browser ini')
      return null
    }

    setIsLoading(true)
    setError(null)
    try {
      // 1. Minta challenge dari server (endpoint registrasi perlu dibuat)
      const res = await fetch('http://localhost:8000/auth/webauthn/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, display_name: displayName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal memulai registrasi')

      // 2. Buat credential baru
      const challenge = base64urlDecode(data.challenge)
      const userId = base64urlDecode(data.user_id)

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'TrueCount', id: getRpId() },
          user: {
            id: userId,
            name: username,
            displayName,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
          ],
          authenticatorSelection: {
            // Allow both platform (Windows Hello) AND cross-platform (USB security keys)
            authenticatorAttachment: 'cross-platform',
            userVerification: 'required',
            requireResidentKey: false,
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential & { response: AuthenticatorAttestationResponse }

      // 3. Kirim ke server untuk verifikasi
      const attestationRes = credential.response
      const verifyRes = await fetch('http://localhost:8000/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: data.challenge_id,
          credential_id: base64urlEncode(new Uint8Array(credential.rawId)),
          attestation_object: base64urlEncode(new Uint8Array(attestationRes.attestationObject)),
          client_data_json: base64urlEncode(new Uint8Array(attestationRes.clientDataJSON)),
        }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verifikasi registrasi gagal')

      return { credentialId: verifyData.credential_id }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registrasi Windows Hello gagal'
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isLoading, error, register, clearError: () => setError(null) }
}