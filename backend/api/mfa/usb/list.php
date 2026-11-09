<?php

/**
 * GET /mfa/usb/list
 *
 * Daftar USB token milik user yang sedang login.
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response 200:
 *   { "credentials": [ { id, credential_id, label, created_at, last_used_at, revoked_at } ] }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();

$db = getDB();
$stmt = $db->prepare(
    'SELECT id, credential_id, label, sign_count, created_at, last_used_at, revoked_at
       FROM usb_token_credentials
      WHERE user_id = ?
      ORDER BY (revoked_at IS NULL) DESC, created_at DESC'
);
$stmt->execute([$authUser['sub']]);
$rows = $stmt->fetchAll();

$credentials = array_map(function ($row) {
    return [
        'id'            => (int)$row['id'],
        'credential_id' => bin2hex($row['credential_id']),
        'label'         => $row['label'],
        'sign_count'    => (int)$row['sign_count'],
        'created_at'    => $row['created_at'],
        'last_used_at'  => $row['last_used_at'],
        'revoked_at'    => $row['revoked_at'],
        'is_active'     => $row['revoked_at'] === null,
    ];
}, $rows);

jsonResponse(['credentials' => $credentials]);