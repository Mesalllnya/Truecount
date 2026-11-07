<?php

/**
 * POST /mfa/usb/register/verify
 *
 * Verifikasi signature dari USB token dan simpan credential ke DB.
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Body:
 *   {
 *     "challenge_id": 1,
 *     "signature": "base64url",        // ECDSA P-256 raw signature (r||s, 64 bytes)
 *     "public_key": "base64url",       // SPKI DER public key dari file token
 *     "label": "USB Kantor"            // opsional
 *   }
 *
 * Response 201:
 *   { "message": "...", "credential": { id, credential_id, label, created_at } }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
$challengeId = (int)($body['challenge_id'] ?? 0);
$signatureB64 = (string)($body['signature'] ?? '');
$publicKeyB64 = (string)($body['public_key'] ?? '');
$label = trim((string)($body['label'] ?? ''));

if ($challengeId <= 0 || $signatureB64 === '' || $publicKeyB64 === '') {
    jsonResponse(['error' => 'Data tidak lengkap. challenge_id, signature, dan public_key wajib diisi.'], 422);
}

if ($label !== '' && mb_strlen($label) > 100) {
    jsonResponse(['error' => 'Label maksimal 100 karakter.'], 422);
}

// ── 1. Validasi challenge ───────────────────────────────────
$db = getDB();
$stmt = $db->prepare(
    'SELECT id, challenge, status, expires_at
       FROM usb_challenges
      WHERE id = ? AND user_id = ?
      LIMIT 1'
);
$stmt->execute([$challengeId, $authUser['sub']]);
$challengeRow = $stmt->fetch();

if (!$challengeRow) {
    jsonResponse(['error' => 'Challenge tidak ditemukan.'], 404);
}

if ($challengeRow['status'] !== 'pending') {
    jsonResponse(['error' => 'Challenge sudah dipakai atau kedaluwarsa.'], 400);
}

if (strtotime($challengeRow['expires_at']) < time()) {
    // Tandai expired
    $db->prepare('UPDATE usb_challenges SET status = "expired" WHERE id = ?')
       ->execute([$challengeId]);
    jsonResponse(['error' => 'Challenge sudah kedaluwarsa. Silakan mulai ulang.'], 400);
}

// ── 2. Decode data ──────────────────────────────────────────
$challengeBytes = $challengeRow['challenge']; // sudah binary dari DB
$signatureRaw   = base64_decode(strtr($signatureB64, '-_', '+/'));
$publicKeyDer   = base64_decode(strtr($publicKeyB64, '-_', '+/'));

if ($signatureRaw === false || strlen($signatureRaw) !== 64) {
    jsonResponse(['error' => 'Format signature tidak valid. Harus 64 byte (r||s).'], 422);
}

if ($publicKeyDer === false || $publicKeyDer === '') {
    jsonResponse(['error' => 'Format public key tidak valid.'], 422);
}

// ── 3. Convert raw signature (r||s) ke DER ──────────────────
$r = substr($signatureRaw, 0, 32);
$s = substr($signatureRaw, 32, 32);

$derSignature = derEncodeSignature($r, $s);

// ── 4. Verifikasi ECDSA signature ───────────────────────────
// PHP 8.4: openssl_pkey_get_public tidak menerima DER binary langsung,
// harus di-wrap sebagai PEM.
$publicKeyPem = "-----BEGIN PUBLIC KEY-----\n"
    . chunk_split(base64_encode($publicKeyDer), 64, "\n")
    . "-----END PUBLIC KEY-----\n";

$pubKeyResource = openssl_pkey_get_public($publicKeyPem);
if ($pubKeyResource === false) {
    jsonResponse(['error' => 'Public key tidak valid.'], 422);
}

$verified = openssl_verify($challengeBytes, $derSignature, $pubKeyResource, OPENSSL_ALGO_SHA256);

if ($verified !== 1) {
    jsonResponse(['error' => 'Verifikasi signature gagal. Pastikan USB token sesuai.'], 400);
}

// ── 5. Hitung credential_id = SHA-256(public key) ───────────
$credentialId = hash('sha256', $publicKeyDer, true);

// ── 6. Cek duplikat ─────────────────────────────────────────
$stmt = $db->prepare(
    'SELECT id, revoked_at FROM usb_token_credentials
      WHERE user_id = ? AND credential_id = ?
      LIMIT 1'
);
$stmt->execute([$authUser['sub'], $credentialId]);
$existing = $stmt->fetch();

if ($existing) {
    if ($existing['revoked_at'] === null) {
        jsonResponse(['error' => 'Token ini sudah terdaftar.'], 409);
    }
    // Reactivate revoked token
    $db->prepare(
        'UPDATE usb_token_credentials
            SET label = ?, revoked_at = NULL, last_used_at = NULL
          WHERE id = ?'
    )->execute([$label !== '' ? $label : null, $existing['id']]);
    $newId = (int)$existing['id'];
} else {
    // Simpan credential baru
    $stmt = $db->prepare(
        'INSERT INTO usb_token_credentials (user_id, credential_id, public_key, label)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([
        $authUser['sub'],
        $credentialId,
        $publicKeyDer,
        $label !== '' ? $label : null,
    ]);
    $newId = (int)$db->lastInsertId();
}

// ── 7. Tandai challenge sebagai used ────────────────────────
$db->prepare(
    'UPDATE usb_challenges SET status = "used", used_at = NOW() WHERE id = ?'
)->execute([$challengeId]);

jsonResponse([
    'message' => 'USB token berhasil didaftarkan.',
    'credential' => [
        'id'            => $newId,
        'credential_id' => bin2hex($credentialId),
        'label'         => $label !== '' ? $label : null,
    ],
], 201);

/**
 * Encode signature ECDSA raw (r||s) ke DER format.
 * DER: SEQUENCE { INTEGER r, INTEGER s }
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
    // Prepend 0x00 jika most significant bit set (negative integer protection)
    if ((ord($value[0]) & 0x80) !== 0) {
        $value = "\x00" . $value;
    }
    return "\x02" . derLength(strlen($value)) . $value;
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