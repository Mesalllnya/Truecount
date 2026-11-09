<?php

/**
 * POST /auth/webauthn/login/verify
 *
 * Verifikasi WebAuthn assertion (Windows Hello).
 *
 * Body JSON:
 *   {
 *     "challenge_id": 123,
 *     "credential_id": "base64url",
 *     "authenticator_data": "base64url",
 *     "client_data_json": "base64url",
 *     "signature": "base64url",
 *     "user_handle": "base64url" (opsional)
 *   }
 *
 * Response 200:
 *   { "message": "Login berhasil.", "token": "...", "user": { id, username, email, role } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/webauthn.php';
require_once __DIR__ . '/../../helpers/jwt.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
$challengeId = (int)($body['challenge_id'] ?? 0);
$credentialIdB64 = (string)($body['credential_id'] ?? '');
$authenticatorDataB64 = (string)($body['authenticator_data'] ?? '');
$clientDataJsonB64 = (string)($body['client_data_json'] ?? '');
$signatureB64 = (string)($body['signature'] ?? '');

if ($challengeId <= 0 || $credentialIdB64 === '' || $authenticatorDataB64 === '' || $clientDataJsonB64 === '' || $signatureB64 === '') {
    jsonResponse(['error' => 'Data tidak lengkap.'], 422);
}

$db = getDB();

// ── 1. Validasi challenge ──────────────────────────────────────────
$stmt = $db->prepare(
    'SELECT id, user_id, challenge, expires_at
       FROM webauthn_challenges
      WHERE id = ? AND status = "pending"
      LIMIT 1'
);
$stmt->execute([$challengeId]);
$challengeRow = $stmt->fetch();

if (!$challengeRow) {
    jsonResponse(['error' => 'Challenge tidak ditemukan atau sudah kedaluwarsa.'], 400);
}

if (strtotime($challengeRow['expires_at']) < time()) {
    $db->prepare('UPDATE webauthn_challenges SET status = "expired" WHERE id = ?')->execute([$challengeId]);
    jsonResponse(['error' => 'Challenge sudah kedaluwarsa. Silakan coba lagi.'], 400);
}

$challengeBytes = $challengeRow['challenge']; // sudah binary dari DB (VARBINARY)
$userId = (int)$challengeRow['user_id'];

// ── 2. Ambil credential dari database ──────────────────────────────
$credentialId = base64_decode(strtr($credentialIdB64, '-_', '+/'));
$stmt = $db->prepare(
    'SELECT id, public_key, sign_count
       FROM biometric_credentials
      WHERE user_id = ? AND credential_id = ?
      LIMIT 1'
);
$stmt->execute([$userId, $credentialId]);
$credential = $stmt->fetch();

if (!$credential) {
    jsonResponse(['error' => 'Credential tidak valid.'], 400);
}

$storedSignCount = (int)$credential['sign_count'];
$publicKeyDer = $credential['public_key'];

// ── 3. Decode client data JSON ─────────────────────────────────────
$clientDataJson = base64_decode(strtr($clientDataJsonB64, '-_', '+/'));
$clientData = json_decode($clientDataJson, true);

if (!$clientData || !isset($clientData['type']) || $clientData['type'] !== 'webauthn.get') {
    jsonResponse(['error' => 'Client data tidak valid.'], 400);
}

if (!isset($clientData['challenge'])) {
    jsonResponse(['error' => 'Challenge tidak ada di client data.'], 400);
}

$clientChallenge = base64_decode(strtr($clientData['challenge'], '-_', '+/'));

// Verifikasi challenge cocok
if (!hash_equals($challengeBytes, $clientChallenge)) {
    jsonResponse(['error' => 'Challenge tidak cocok.'], 400);
}

// Verifikasi origin (opsional tapi direkomendasikan untuk production)
$expectedOrigin = 'http://localhost:5173'; // Sesuaikan dengan frontend URL
if (isset($clientData['origin']) && $clientData['origin'] !== $expectedOrigin) {
    // Di production, verifikasi origin dengan ketat
    // Untuk development, kita lewati tapi log warning
    error_log("[WebAuthn] Origin mismatch: expected $expectedOrigin, got {$clientData['origin']}");
}

// ── 4. Parse authenticatorData ─────────────────────────────────────
$authenticatorData = base64_decode(strtr($authenticatorDataB64, '-_', '+/'));
$parsedAuthData = parseAuthenticatorData($authenticatorData);

if ($parsedAuthData === false) {
    jsonResponse(['error' => 'Authenticator data tidak valid.'], 400);
}

// Verifikasi user presence (UP bit) dan user verification (UV bit)
$flags = $parsedAuthData['flags'];
if (($flags & 0x01) === 0) { // UP bit
    jsonResponse(['error' => 'User presence tidak terverifikasi.'], 400);
}
if (($flags & 0x04) === 0) { // UV bit - Windows Hello harus punya UV
    jsonResponse(['error' => 'User verification tidak terverifikasi.'], 400);
}

// Verifikasi sign count (counter rollover protection)
$newSignCount = $parsedAuthData['signCount'];
if ($newSignCount <= $storedSignCount && $storedSignCount > 0) {
    jsonResponse(['error' => 'Sign count tidak valid (kemungkinan replay attack).'], 400);
}

// ── 5. Verifikasi signature ────────────────────────────────────────
// Data yang ditandatangi: authenticatorData || SHA-256(clientDataJSON)
$clientDataHash = hash('sha256', $clientDataJson, true);
$signedData = $authenticatorData . $clientDataHash;

$signature = base64_decode(strtr($signatureB64, '-_', '+/'));

// Convert SPKI DER public key ke PEM untuk openssl_verify
$publicKeyPem = "-----BEGIN PUBLIC KEY-----\n"
    . chunk_split(base64_encode($publicKeyDer), 64, "\n")
    . "-----END PUBLIC KEY-----\n";

$pubKeyResource = openssl_pkey_get_public($publicKeyPem);
if ($pubKeyResource === false) {
    jsonResponse(['error' => 'Public key tidak valid.'], 500);
}

$verified = openssl_verify($signedData, $signature, $pubKeyResource, OPENSSL_ALGO_SHA256);
openssl_free_key($pubKeyResource);

if ($verified !== 1) {
    jsonResponse(['error' => 'Verifikasi signature gagal.'], 400);
}

// ── 6. Update sign count & tandai challenge used ───────────────────
$db->prepare(
    'UPDATE biometric_credentials SET sign_count = ?, last_used_at = NOW() WHERE id = ?'
)->execute([$newSignCount, $credential['id']]);

$db->prepare(
    'UPDATE webauthn_challenges SET status = "used", used_at = NOW() WHERE id = ?'
)->execute([$challengeId]);

// ── 7. Generate JWT token ──────────────────────────────────────────
$stmt = $db->prepare(
    'SELECT id, username, email, role, is_active FROM users WHERE id = ? LIMIT 1'
);
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user || !(bool)$user['is_active']) {
    jsonResponse(['error' => 'Akun tidak aktif.'], 403);
}

$token = generateJwt([
    'sub' => $user['id'],
    'username' => $user['username'],
    'email' => $user['email'],
    'role' => $user['role'],
]);

jsonResponse([
    'message' => 'Login dengan Windows Hello berhasil.',
    'token' => $token,
    'user' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role'],
    ],
]);

/**
 * Parse authenticatorData (binary format).
 * Returns array with: rpIdHash, flags, signCount, attestedCredentialData (optional), extensions (optional)
 */
function parseAuthenticatorData(string $data): ?array
{
    $offset = 0;
    $len = strlen($data);
    
    if ($len < 37) { // min: 32 (rpIdHash) + 1 (flags) + 4 (signCount)
        return false;
    }
    
    $rpIdHash = substr($data, $offset, 32);
    $offset += 32;
    
    $flags = ord($data[$offset]);
    $offset += 1;
    
    $signCount = unpack('N', substr($data, $offset, 4))[1];
    $offset += 4;
    
    // AT (attested credential data) flag
    $hasAttestedCredentialData = ($flags & 0x40) !== 0;
    
    $attestedCredentialData = null;
    if ($hasAttestedCredentialData) {
        if ($offset + 16 > $len) return false; // AAGUID (16 bytes)
        $aaguid = substr($data, $offset, 16);
        $offset += 16;
        
        if ($offset + 2 > $len) return false; // credentialId length (2 bytes)
        $credIdLen = unpack('n', substr($data, $offset, 2))[1];
        $offset += 2;
        
        if ($offset + $credIdLen > $len) return false;
        $credentialId = substr($data, $offset, $credIdLen);
        $offset += $credIdLen;
        
        // COSE public key (variable length, CBOR encoded) - we skip parsing
        $attestedCredentialData = [
            'aaguid' => $aaguid,
            'credential_id' => $credentialId,
        ];
    }
    
    // ED (extensions) flag
    $hasExtensions = ($flags & 0x80) !== 0;
    $extensions = null;
    if ($hasExtensions) {
        // CBOR parsing required - skip for now
    }
    
    return [
        'rpIdHash' => $rpIdHash,
        'flags' => $flags,
        'signCount' => $signCount,
        'attestedCredentialData' => $attestedCredentialData,
        'extensions' => $extensions,
    ];
}