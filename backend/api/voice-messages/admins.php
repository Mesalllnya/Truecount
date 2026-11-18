<?php

/**
 * GET /voice-messages/admins
 *
 * Mengambil daftar admin aktif yang dapat menerima voice message.
 * Hanya admin yang sudah terautentikasi.
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();

$currentUserId = (int) ($authUser['sub'] ?? 0);

if ($currentUserId <= 0) {
    jsonResponse(['error' => 'Identitas pengguna tidak valid.'], 401);
}

$db = getDB();

$stmt = $db->prepare(
    "SELECT id, username
        FROM users
        WHERE role = 'admin'
        AND is_active = 1
        AND id <> :current_user_id
        ORDER BY username ASC"
);

$stmt->execute([
    ':current_user_id' => $currentUserId
]);

$admins = $stmt->fetchAll(PDO::FETCH_ASSOC);

jsonResponse([
    'admins' => array_map(fn($admin) => [
        'id'       => (int) $admin['id'],
        'username' => $admin['username']
    ], $admins)
]);
