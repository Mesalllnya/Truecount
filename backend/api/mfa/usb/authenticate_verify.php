<?php

/**
 * POST /mfa/usb/authenticate/verify
 *
 * Verifikasi USB token signature (MFA login).
 *
 * Body JSON:
 *   {
 *     "challenge_id": 123,
 *     "credential_id": "base64url",
 *     "signature": "base64url" (raw r||s 64 bytes),
 *     "auth_photo": "data:image/jpeg;base64,..." (opsional)
 *   }
 *
 * Response 200:
 *   { "message": "Login dengan USB token berhasil.", "token": "...", "user": { id, username, email, role } }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../helpers/jwt.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
$challengeId = (int)($body['challenge_id'] ?? 0);
$credentialIdB64 = (string)($body['credential_id'] ?? '');
$signatureB64 = (string)($body['signature'] ?? '');
$authPhoto = $body['auth_photo'] ?? null;

if ($challengeId <= 0 || $credentialIdB64 === '' || $signatureB64 === '') {
    jsonResponse(['error' => 'Data tidak lengkap.'], 422);
}

// ── Save photo if provided ─────────────────────────────────────────
$photoPath = null;
if ($authPhoto && str_starts_with($authPhoto, 'data:image/')) {
    try {
        $parts = explode(',', $authPhoto, 2);
        if (count($parts) === 2) {
            $base64 = $parts[1];
            $imageData = base64_decode($base64);
            if ($imageData !== false) {
                $uploadDir = __DIR__ . '/../../../../storage/auth_photos/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                $filename = 'usb_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.jpg';
                $filepath = $uploadDir . $filename;
                if (file_put_contents($filepath, $imageData) !== false) {
                    $photoPath = 'storage/auth_photos/' . $filename;
                }
            }
        }
    } catch (Throwable $e) {
        error_log('[USB Auth] Photo save error: ' . $e->getMessage());
    }
}

$db = getDB();

// ── Log helper (inline) ────────────────────────────────────────────
$logAttempt = function ($identifier, $method, $success, $error) use ($db, $photoPath) {
    try {
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
        $stmt->execute([$identifier, $identifier]);
        $user = $stmt->fetch();
        $userId = $user ? (int)$user['id'] : null;

        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $stmt = $db->prepare(
            'INSERT INTO auth_attempts (user_id, identifier, method, success, error, ip_address, user_agent, photo_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $identifier, $method, $success ? 1 : 0, $error, $ip, $userAgent, $photoPath]);
    } catch (Throwable $e) {
        error_log('[USB Auth Attempt Log] ' . $e->getMessage());
    }
};

// ── 1. Validasi challenge ──────────────────────────────────────────
$stmt = $db->prepare(
    'SELECT id, user_id, challenge, expires_at
       FROM usb_challenges
      WHERE id = ? AND challenge_type = "authenticate" AND status = "pending"
      LIMIT 1'
);
$stmt->execute([$challengeId]);
$challengeRow = $stmt->fetch();

if (!$challengeRow) {
    $logAttempt('', 'dongle', false, 'Challenge not found');
    jsonResponse(['error' => 'Challenge tidak ditemukan atau sudah kedaluwarsa.'], 400);
}

if (strtotime($challengeRow['expires_at']) < time()) {
    $db->prepare('UPDATE usb_challenges SET status = "expired" WHERE id = ?')->execute([$challengeId]);
    $logAttempt('', 'dongle', false, 'Challenge expired');
    jsonResponse(['error' => 'Challenge sudah kedaluwarsa. Silakan coba lagi.'], 400);
}

$challengeBytes = $challengeRow['challenge']; // sudah binary dari DB (VARBINARY)
$userId = (int)$challengeRow['user_id'];

// ── 2. Ambil credential dari database ──────────────────────────────
$credentialId = base64_decode(strtr($credentialIdB64, '-_', '+/'));
$stmt = $db->prepare(
    'SELECT id, public_key, sign_count
       FROM usb_token_credentials
      WHERE user_id = ? AND credential_id = ? AND revoked_at IS NULL
      LIMIT 1'
);
$stmt->execute([$userId, $credentialId]);
$credential = $stmt->fetch();

if (!$credential) {
    $logAttempt('', 'dongle', false, 'Invalid credential');
    jsonResponse(['error' => 'USB token tidak valid atau sudah dinonaktifkan.'], 400);
}

$storedSignCount = (int)$credential['sign_count'];
$publicKeyDer = $credential['public_key'];

// ── 3. Verifikasi signature ────────────────────────────────────────
// Data yang ditandatangi: challenge (32 bytes)
// Signature format: raw r||s (64 bytes) dari frontend
$signature = base64_decode(strtr($signatureB64, '-_', '+/'));

if (strlen($signature) !== 64) {
    $logAttempt('', 'dongle', false, 'Invalid signature format');
    jsonResponse(['error' => 'Format signature tidak valid (harus 64 bytes raw r||s).'], 400);
}

// Convert SPKI DER public key ke PEM untuk openssl_verify
$publicKeyPem = "-----BEGIN PUBLIC KEY-----\n"
    . chunk_split(base64_encode($publicKeyDer), 64, "\n")
    . "-----END PUBLIC KEY-----\n";

$pubKeyResource = openssl_pkey_get_public($publicKeyPem);
if ($pubKeyResource === false) {
    $logAttempt('', 'dongle', false, 'Public key invalid');
    jsonResponse(['error' => 'Public key tidak valid.'], 500);
}

// Verifikasi ECDSA signature (raw r||s -> DER format untuk openssl)
// OpenSSL butuh signature dalam format DER, bukan raw r||s
// Convert raw r||s (64 bytes) ke DER
$r = substr($signature, 0, 32);
$s = substr($signature, 32, 32);

// Remove leading zeros dari r dan s untuk DER encoding
$r = ltrim($r, "\x00");
$s = ltrim($s, "\x00");

// Jika byte pertama >= 0x80, tambah 0x00 prefix (positive integer)
if (strlen($r) > 0 && ord($r[0]) >= 0x80) $r = "\x00" . $r;
if (strlen($s) > 0 && ord($s[0]) >= 0x80) $s = "\x00" . $s;

// DER encoding: 0x30 [total_len] 0x02 [r_len] [r] 0x02 [s_len] [s]
$derSignature = "\x02" . chr(strlen($r)) . $r . "\x02" . chr(strlen($s)) . $s;
$derSignature = "\x30" . chr(strlen($derSignature)) . $derSignature;

$verified = openssl_verify($challengeBytes, $derSignature, $pubKeyResource, OPENSSL_ALGO_SHA256);
openssl_free_key($pubKeyResource);

if ($verified !== 1) {
    $logAttempt('', 'dongle', false, 'Signature verification failed');
    jsonResponse(['error' => 'Verifikasi signature gagal. PIN salah atau token tidak valid.'], 400);
}

// ── 4. Update sign count & tandai challenge used ───────────────────
$newSignCount = $storedSignCount + 1;
$db->prepare(
    'UPDATE usb_token_credentials SET sign_count = ?, last_used_at = NOW() WHERE id = ?'
)->execute([$newSignCount, $credential['id']]);

$db->prepare(
    'UPDATE usb_challenges SET status = "used", used_at = NOW() WHERE id = ?'
)->execute([$challengeId]);

// ── 5. Get user info ───────────────────────────────────────────────
$stmt = $db->prepare(
    'SELECT id, username, email, role, is_active FROM users WHERE id = ? LIMIT 1'
);
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user || !(bool)$user['is_active']) {
    $logAttempt($user['username'] ?? '', 'dongle', false, 'Account inactive');
    jsonResponse(['error' => 'Akun tidak aktif.'], 403);
}

// ── 6. Log successful attempt with photo ───────────────────────────
$logAttempt($user['username'], 'dongle', true, null);

// ── 7. Generate JWT token ──────────────────────────────────────────
$token = generateJwt([
    'sub' => $user['id'],
    'username' => $user['username'],
    'email' => $user['email'],
    'role' => $user['role'],
]);

jsonResponse([
    'message' => 'Login dengan USB token berhasil.',
    'token' => $token,
    'user' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role'],
    ],
]);