<?php

/**
 * POST /auth/security-status
 *
 * Cek status keamanan user berdasarkan identifier (publik, tanpa auth).
 * Dipakai halaman login untuk memutuskan apakah metode Kata Sandi
 * boleh tampil — hanya untuk user yang BELUM memasang Windows Hello/Dongle
 * (alur onboarding pertama kali).
 *
 * Body JSON:
 *   { "identifier": "username_atau_email" }
 *
 * Response 200:
 *   {
 *     "found": true|false,
 *     "has_webauthn": true|false,
 *     "has_dongle": true|false,
 *     "requires_setup": true|false
 *   }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$body       = json_decode(file_get_contents('php://input') ?: '{}', true);
$identifier = trim($body['identifier'] ?? '');

if ($identifier === '') {
    jsonResponse(['error' => 'Identifier wajib diisi.'], 422);
}

$db = getDB();

$stmt = $db->prepare(
    'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1'
);
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

if (!$user) {
    jsonResponse([
        'found'          => false,
        'has_webauthn'   => false,
        'has_dongle'     => false,
        'requires_setup' => false,
    ]);
}

$userId = (int)$user['id'];

$stmt = $db->prepare('SELECT COUNT(*) FROM biometric_credentials WHERE user_id = ?');
$stmt->execute([$userId]);
$hasWebAuthn = (int)$stmt->fetchColumn() > 0;

$stmt = $db->prepare('SELECT COUNT(*) FROM usb_token_credentials WHERE user_id = ? AND revoked_at IS NULL');
$stmt->execute([$userId]);
$hasDongle = (int)$stmt->fetchColumn() > 0;

jsonResponse([
    'found'          => true,
    'has_webauthn'   => $hasWebAuthn,
    'has_dongle'     => $hasDongle,
    'requires_setup' => !$hasWebAuthn && !$hasDongle,
]);
