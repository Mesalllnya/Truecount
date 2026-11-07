<?php

/**
 * POST /mfa/usb/{id}/label
 *
 * Update label USB token milik user.
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Body:
 *   { "label": "USB Kantor" }
 *
 * Response 200:
 *   { "message": "Label berhasil diperbarui.", "label": "USB Kantor" }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();

// ID dari URL: /mfa/usb/{id}/label
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!preg_match('#^/mfa/usb/(\d+)/label$#', $uri, $m)) {
    jsonResponse(['error' => 'Endpoint tidak ditemukan.'], 404);
}
$credentialRowId = (int)$m[1];

$body  = json_decode(file_get_contents('php://input') ?: '{}', true);
$label = trim((string)($body['label'] ?? ''));

if ($label === '') {
    jsonResponse(['error' => 'Label tidak boleh kosong.'], 422);
}

if (mb_strlen($label) > 100) {
    jsonResponse(['error' => 'Label maksimal 100 karakter.'], 422);
}

$db = getDB();
$stmt = $db->prepare(
    'SELECT id FROM usb_token_credentials
      WHERE id = ? AND user_id = ?
      LIMIT 1'
);
$stmt->execute([$credentialRowId, $authUser['sub']]);
$row = $stmt->fetch();

if (!$row) {
    jsonResponse(['error' => 'USB token tidak ditemukan.'], 404);
}

$db->prepare(
    'UPDATE usb_token_credentials SET label = ? WHERE id = ?'
)->execute([$label, $credentialRowId]);

jsonResponse([
    'message' => 'Label berhasil diperbarui.',
    'label'   => $label,
]);