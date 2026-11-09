<?php

/**
 * WebAuthn Helper Functions
 * 
 * Fungsi-fungsi bantuan untuk WebAuthn/FIDO2.
 * Tidak bergantung pada library eksternal.
 */

/**
 * Encode bytes ke base64url (tanpa padding, -_ alih-alih +/)
 */
if (!function_exists('base64urlEncode')) {
    function base64urlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

/**
 * Decode base64url ke bytes
 */
if (!function_exists('base64urlDecode')) {
    function base64urlDecode(string $data): string
    {
        $data = strtr($data, '-_', '+/');
        $pad = strlen($data) % 4;
        if ($pad > 0) {
            $data .= str_repeat('=', 4 - $pad);
        }
        return base64_decode($data);
    }
}

/**
 * Generate random challenge (32 bytes)
 */
function generateChallenge(): string
{
    return random_bytes(32);
}

/**
 * Verify client data JSON origin
 */
function verifyOrigin(string $origin, array $allowedOrigins): bool
{
    return in_array($origin, $allowedOrigins, true);
}

/**
 * Parse COSE public key (untuk registrasi - opsional)
 */
function parseCosePublicKey(string $coseKey): ?array
{
    // CBOR parsing sederhana untuk COSE_Key
    // Format: { 1: kty, 3: alg, -1: crv, -2: x, -3: y }
    // Implementasi penuh butuh CBOR library, ini simplified
    return null;
}

/**
 * Convert COSE public key ke SPKI DER
 * COSE Key (EC2): kty=2 (EC2), alg=-7 (ES256), crv=1 (P-256), x, y
 * SPKI DER: SEQUENCE { algorithm, subjectPublicKey }
 */
function coseToSpkiDer(array $coseKey): ?string
{
    if (!isset($coseKey[1], $coseKey[3], $coseKey[-1], $coseKey[-2], $coseKey[-3])) {
        return null;
    }
    
    $kty = $coseKey[1];    // 2 = EC2
    $alg = $coseKey[3];    // -7 = ES256
    $crv = $coseKey[-1];   // 1 = P-256
    $x = $coseKey[-2];     // 32 bytes
    $y = $coseKey[-3];     // 32 bytes
    
    if ($kty !== 2 || $alg !== -7 || $crv !== 1) {
        return null;
    }
    
    if (strlen($x) !== 32 || strlen($y) !== 32) {
        return null;
    }
    
    // Uncompressed point: 0x04 || x || y
    $uncompressedPoint = "\x04" . $x . $y;
    
    // SubjectPublicKeyInfo for P-256 (OID 1.2.840.10045.2.1 with parameters 1.2.840.10045.3.1.7)
    // AlgorithmIdentifier: SEQUENCE { OID ecPublicKey (1.2.840.10045.2.1), OID prime256v1 (1.2.840.10045.3.1.7) }
    $algorithmIdentifier = "\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07";
    // subjectPublicKey: BIT STRING { uncompressedPoint }
    $subjectPublicKey = "\x03" . derLength(1 + strlen($uncompressedPoint)) . "\x00" . $uncompressedPoint;
    
    // SPKI: SEQUENCE { algorithmIdentifier, subjectPublicKey }
    $spki = "\x30" . derLength(strlen($algorithmIdentifier) + strlen($subjectPublicKey)) . $algorithmIdentifier . $subjectPublicKey;
    
    return $spki;
}

function derLength(int $length): string
{
    if ($length < 0x80) {
        return chr($length);
    }
    $bytes = '';
    $n = $length;
    while ($n > 0) {
        $bytes = chr($n & 0xFF) . $bytes;
        $n >>= 8;
    }
    return chr(0x80 | strlen($bytes)) . $bytes;
}

/**
 * Encode ECDSA raw signature (r||s, 64 bytes) ke DER format
 */
function derEncodeSignature(string $r, string $s): string
{
    $r = derEncodeInteger($r);
    $s = derEncodeInteger($s);
    $seq = $r . $s;
    return "\x30" . derLength(strlen($seq)) . $seq;
}

function derEncodeInteger(string $value): string
{
    // Strip leading zeros
    $value = ltrim($value, "\x00");
    if ($value === '') {
        $value = "\x00";
    }
    // Prepend 0x00 jika most significant bit set (negative integer protection)
    if ((ord($value[0]) & 0x80) !== 0) {
        $value = "\x00" . $value;
    }
    return "\x02" . derLength(strlen($value)) . $value;
}

/**
 * Verify WebAuthn assertion signature
 */
function verifyAssertionSignature(
    string $authenticatorData,
    string $clientDataJson,
    string $signature,
    string $publicKeyDer
): bool
{
    $clientDataHash = hash('sha256', $clientDataJson, true);
    $signedData = $authenticatorData . $clientDataHash;
    
    $publicKeyPem = "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode($publicKeyDer), 64, "\n")
        . "-----END PUBLIC KEY-----\n";
    
    $pubKeyResource = openssl_pkey_get_public($publicKeyPem);
    if ($pubKeyResource === false) {
        return false;
    }
    
    $verified = openssl_verify($signedData, $signature, $pubKeyResource, OPENSSL_ALGO_SHA256);
    openssl_free_key($pubKeyResource);
    
    return $verified === 1;
}

/**
 * Parse authenticator data untuk mendapatkan signCount dan flags
 */
function parseAuthenticatorDataForVerify(string $authenticatorData): ?array
{
    $offset = 0;
    $len = strlen($authenticatorData);
    
    if ($len < 37) {
        return null;
    }
    
    $rpIdHash = substr($authenticatorData, $offset, 32);
    $offset += 32;
    
    $flags = ord($authenticatorData[$offset]);
    $offset += 1;
    
    $signCount = unpack('N', substr($authenticatorData, $offset, 4))[1];
    $offset += 4;
    
    return [
        'rpIdHash' => $rpIdHash,
        'flags' => $flags,
        'signCount' => $signCount,
        'userPresent' => ($flags & 0x01) !== 0,
        'userVerified' => ($flags & 0x04) !== 0,
        'attestedCredentialData' => ($flags & 0x40) !== 0,
        'extensions' => ($flags & 0x80) !== 0,
    ];
}