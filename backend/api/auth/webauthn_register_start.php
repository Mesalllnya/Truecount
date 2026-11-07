<?php

/**
 * POST /auth/webauthn/register/start
 *
 * Mulai registrasi WebAuthn (Windows Hello).
 * Memerlukan JWT Bearer token.
 *
 * Body JSON:
 *   { "display_name": "Nama tampilan (opsional)" }
 *
 * Response 200:
 *   {
 *     "challenge": "base64url",
 *     "challenge_id": 123,
 *     "user": { "id": 1, "username": "...", "display_name": "..." },
 *     "rp": { "name": "TrueCount", "id": "localhost" }
 *   }
 *
 * Response 401: Token invalid/expired
 * Response 400: User sudah punya Windows Hello / error lain
 * Response 422: Body tidak valid
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Ambil user dari JWT
$user = requireAuth();
$userId = $user['sub'];
$username = $user['username'];

$db = getDB();

// Cek apakah user sudah punya credential WebAuthn
$stmt = $db->prepare('SELECT COUNT(*) as cnt FROM biometric_credentials WHERE user_id = ?');
$stmt->execute([$userId]);
$row = $stmt->fetch();
if ((int)$row['cnt'] > 0) {
    // Izinkan mendaftarkan yang kedua? Untuk Windows Hello biasanya 1 per device/platform
    // Tapi biarkan register ulang (misal ganti device)
}

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
$displayName = trim($body['display_name'] ?? $username);

// Generate challenge
$challenge = random_bytes(32);
$challengeB64 = rtrim(strtr(base64_encode($challenge), '+/', '-_'), '='); // base64url

// Simpan challenge ke database
$stmt = $db->prepare(
    'INSERT INTO webauthn_challenges (user_id, challenge, type, expires_at)
     VALUES (?, ?, "registration", DATE_ADD(NOW(), INTERVAL 5 MINUTE))'
);
$stmt->execute([$userId, $challenge]);
$challengeId = (int)$db->lastInsertId();

// User ID untuk WebAuthn (base64url encoded)
$userIdBytes = random_bytes(16); // 16 bytes untuk user handle
$userIdB64 = rtrim(strtr(base64_encode($userIdBytes), '+/', '-_'), '=');

jsonResponse([
    'challenge' => $challengeB64,
    'challenge_id' => $challengeId,
    'user' => [
        'id' => $userIdB64,
        'name' => $username,
        'displayName' => $displayName,
    ],
    'rp' => [
        'name' => 'TrueCount',
        'id' => 'localhost', // Sesuaikan dengan domain production
    ],
]);