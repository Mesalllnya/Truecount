import { useState, useCallback } from 'react';
import { getRpId } from '../utils/webauthn';

const API_BASE = 'http://localhost:8000';

/** Hook untuk change password */
export function useChangePassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('tc_token');
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah password.');
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, changePassword, clearError: () => setError(null) };
}

/** Hook untuk WebAuthn register (Windows Hello) */
export function useWebAuthnRegister() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async (
    displayName: string
  ): Promise<{ credentialId: string } | null> => {
    if (!isWebAuthnSupported()) {
      setError('WebAuthn tidak didukung di browser ini');
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      // 1. Minta challenge dari server
      const token = localStorage.getItem('tc_token');
      const res = await fetch(`${API_BASE}/auth/webauthn/register/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulai registrasi');

      // 2. Buat credential baru
      const challenge = base64urlDecode(data.challenge);
      const userId = base64urlDecode(data.user.id);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: data.rp.name, id: getRpId() },
          user: {
            id: userId,
            name: data.user.name,
            displayName: data.user.displayName,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            requireResidentKey: false,
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential & { response: AuthenticatorAttestationResponse };

      // 3. Kirim ke server untuk verifikasi
      const attestationRes = credential.response;
      const verifyRes = await fetch(`${API_BASE}/auth/webauthn/register/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challenge_id: data.challenge_id,
          credential_id: base64urlEncode(new Uint8Array(credential.rawId)),
          attestation_object: base64urlEncode(new Uint8Array(attestationRes.attestationObject)),
          client_data_json: base64urlEncode(new Uint8Array(attestationRes.clientDataJSON)),
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verifikasi registrasi gagal');

      return { credentialId: verifyData.credential_id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registrasi Windows Hello gagal';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, register, clearError: () => setError(null) };
}

/** Hook untuk list WebAuthn credentials */
export function useWebAuthnList() {
  const [credentials, setCredentials] = useState<Array<{
    id: number;
    credential_id: string;
    aaguid: string | null;
    sign_count: number;
    created_at: string;
    last_used_at: string | null;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('tc_token');
      const res = await fetch(`${API_BASE}/auth/webauthn/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar Windows Hello.');
      setCredentials(data.credentials ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { credentials, isLoading, error, fetchList, clearError: () => setError(null) };
}

/** Hook untuk revoke WebAuthn credential */
export function useWebAuthnRevoke() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = useCallback(async (credentialId: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('tc_token');
      const res = await fetch(`${API_BASE}/auth/webauthn/${credentialId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus Windows Hello.');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, revoke, clearError: () => setError(null) };
}

/** Helper: base64url encode */
function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Helper: base64url decode */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/** Cek apakah WebAuthn didukung di browser */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'credentials' in navigator &&
    'create' in navigator.credentials &&
    'get' in navigator.credentials &&
    typeof PublicKeyCredential !== 'undefined'
  );
}

/** Cek apakah platform authenticator (Windows Hello) tersedia */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}