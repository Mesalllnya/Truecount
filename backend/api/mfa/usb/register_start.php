<?php

/**
 * POST /mfa/usb/register/start
 *
 * Generate challenge untuk registrasi USB token.
 * Challenge disimpan di DB (TTL 5 menit, single-use).
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response 200:
 *   { "challenge_id": 1, "challenge": "base64url" }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();

// Generate random 32-byte challenge
$challenge = random_bytes(32);

// Simpan ke DB dengan TTL 5 menit
$db = getDB();
$stmt = $db->prepare(
    'INSERT INTO usb_challenges (user_id, challenge, challenge_type, status, expires_at)
     VALUES (?, ?, ?, ?, ?)'
);
$stmt->execute([
    $authUser['sub'],
    $challenge,
    'register',
    'pending',
    date('Y-m-d H:i:s', time() + 300),
]);

$challengeId = (int)$db->lastInsertId();

jsonResponse([
    'challenge_id' => $challengeId,
    'challenge'    => rtrim(strtr(base64_encode($challenge), '+/', '-_'), '='),
]);