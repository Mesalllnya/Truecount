<?php

/**
 * POST /mfa/usb/{id}/revoke
 *
 * Revoke (nonaktifkan) USB token milik user.
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response 200:
 *   { "message": "USB token berhasil dinonaktifkan." }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();

// ID dari URL: /mfa/usb/{id}/revoke → $_SERVER['REQUEST_URI'] di-set oleh router
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!preg_match('#^/mfa/usb/(\d+)/revoke$#', $uri, $m)) {
    jsonResponse(['error' => 'Endpoint tidak ditemukan.'], 404);
}
$credentialRowId = (int)$m[1];

$db = getDB();
$stmt = $db->prepare(
    'SELECT id, revoked_at FROM usb_token_credentials
      WHERE id = ? AND user_id = ?
      LIMIT 1'
);
$stmt->execute([$credentialRowId, $authUser['sub']]);
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(['error' => 'USB token tidak ditemukan.'], 404);
}

if ($row['revoked_at'] !== null) {
    jsonResponse(['error' => 'Token ini sudah dinonaktifkan.'], 409);
}

$db->prepare(
    'UPDATE usb_token_credentials SET revoked_at = NOW() WHERE id = ?'
)->execute([$credentialRowId]);

jsonResponse(['message' => 'USB token berhasil dinonaktifkan.']);