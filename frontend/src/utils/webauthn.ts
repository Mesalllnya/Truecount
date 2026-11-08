/**
 * WebAuthn utilities
 * Shared between frontend modules to avoid duplication
 */

/**
 * Get WebAuthn RP ID that matches the origin hostname.
 * IP addresses (127.0.0.1, etc.) are not valid RP IDs per WebAuthn spec.
 * Falls back to 'localhost' for IP-based origins.
 */
export function getRpId(): string {
  const hostname = window.location.hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return 'localhost';
  return hostname;
}

/**
 * Convert base64url string to Uint8Array
 */
export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert Uint8Array to base64url string
 */
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode base64url string to Uint8Array (alias for base64urlToBuffer with Uint8Array return)
 */
export function base64urlDecode(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/**
 * Encode Uint8Array to base64url string (alias for bufferToBase64url with Uint8Array input)
 */
export function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}