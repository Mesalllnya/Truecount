<?php

/**
 * POST /mfa/usb/authenticate/start
 *
 * Mulai autentikasi USB token (MFA login).
 * Memerlukan JWT Bearer token (dari login password dulu, atau bisa juga identifier-based).
 * 
 * Untuk flow MFA: user login pakai password dulu -> dapat token akses -> lalu MFA USB
 * Atau: identifier-based (username/email) -> challenge -> verify -> JWT
 * 
 * Di sini pakai identifier-based (mirip WebAuthn login start)
 *
 * Body JSON:
 *   { "identifier": "username_atau_email" }
 *
 * Response 200:
 *   {
 *     "challenge": "base64url",
 *     "challenge_id": 123,
 *     "allowCredentials": [
 *       { "id": "base64url_credential_id", "type": "public-key" }
 *     ]
 *   }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../config/database.php';

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
    jsonResponse(['error' => 'User tidak ditemukan atau akun nonaktif.'], 404);
}

// Ambil USB token credentials user yang AKTIF (revoked_at IS NULL)
$stmt = $db->prepare(
    'SELECT id, credential_id, public_key, sign_count
       FROM usb_token_credentials
      WHERE user_id = ? AND revoked_at IS NULL
      ORDER BY created_at DESC'
);
$stmt->execute([$user['id']]);
$credentials = $stmt->fetchAll();

if (empty($credentials)) {
    jsonResponse(['error' => 'Tidak ada USB token aktif untuk user ini.'], 400);
}

// Generate challenge
$challenge = random_bytes(32);
$challengeB64 = rtrim(strtr(base64_encode($challenge), '+/', '-_'), '='); // base64url

// Simpan challenge ke database (untuk verifikasi nanti)
$stmt = $db->prepare(
    'INSERT INTO usb_challenges (user_id, challenge, challenge_type, expires_at)
     VALUES (?, ?, "authenticate", DATE_ADD(NOW(), INTERVAL 5 MINUTE))'
);
$stmt->execute([$user['id'], $challenge]);
$challengeId = (int)$db->lastInsertId();

// Format allowCredentials untuk frontend
$allowCredentials = [];
foreach ($credentials as $cred) {
    $credIdB64 = rtrim(strtr(base64_encode($cred['credential_id']), '+/', '-_'), '='); // base64url
    $allowCredentials[] = [
        'type' => 'public-key',
        'id' => $credIdB64,
        // transports tidak wajib untuk USB token (bukan WebAuthn)
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