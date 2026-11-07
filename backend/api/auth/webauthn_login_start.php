<?php

/**
 * POST /auth/webauthn/login/start
 *
 * Mulai autentikasi WebAuthn (Windows Hello).
 * Mengembalikan challenge dan daftar credential_id yang diizinkan untuk user.
 *
 * Body JSON:
 *   { "identifier": "username_atau_email" }
 *
 * Response 200:
 *   {
 *     "challenge": "base64url",
 *     "challenge_id": 123,
 *     "allowCredentials": [
 *       { "type": "public-key", "id": "base64url", "transports": ["internal"] }
 *     ],
 *     "user": { "id": 1, "username": "...", "email": "..." }
 *   }
 *
 * Response 404: User tidak ditemukan atau belum mendaftarkan Windows Hello
 * Response 400: User tidak memiliki Windows Hello terdaftar
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/webauthn.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
$identifier = trim($body['identifier'] ?? '');

if ($identifier === '') {
    jsonResponse(['error' => 'Username/email wajib diisi.'], 422);
}

$db = getDB();

// Cari user
$stmt = $db->prepare(
    'SELECT id, username, email, role, is_active
       FROM users
      WHERE username = ? OR email = ?
      LIMIT 1'
);
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

if (!$user || !(bool)$user['is_active']) {
    // Response sama untuk user tidak ditemukan & tidak aktif (security)
    jsonResponse(['error' => 'User tidak ditemukan atau belum mendaftarkan Windows Hello.'], 404);
}

// Ambil credential WebAuthn user
$stmt = $db->prepare(
    'SELECT credential_id, public_key, sign_count, aaguid
       FROM biometric_credentials
      WHERE user_id = ?
      ORDER BY created_at DESC'
);
$stmt->execute([$user['id']]);
$credentials = $stmt->fetchAll();

if (empty($credentials)) {
    jsonResponse(['error' => 'User belum mendaftarkan Windows Hello. Silakan gunakan metode lain.'], 400);
}

// Generate challenge
$challenge = random_bytes(32);
$challengeB64 = rtrim(strtr(base64_encode($challenge), '+/', '-_'), '='); // base64url

// Simpan challenge ke database (untuk verifikasi nanti)
$stmt = $db->prepare(
    'INSERT INTO webauthn_challenges (user_id, challenge, type, expires_at)
     VALUES (?, ?, "authentication", DATE_ADD(NOW(), INTERVAL 5 MINUTE))'
);
$stmt->execute([$user['id'], $challenge]);
$challengeId = (int)$db->lastInsertId();

// Format allowCredentials untuk WebAuthn API
$allowCredentials = [];
foreach ($credentials as $cred) {
    $credIdB64 = rtrim(strtr(base64_encode($cred['credential_id']), '+/', '-_'), '='); // base64url
    $allowCredentials[] = [
        'type' => 'public-key',
        'id' => $credIdB64,
        'transports' => ['internal'], // Windows Hello = platform authenticator
    ];
}

jsonResponse([
    'challenge' => $challengeB64,
    'challenge_id' => $challengeId,
    'allowCredentials' => $allowCredentials,
    'user' => [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role'],
    ],
]);