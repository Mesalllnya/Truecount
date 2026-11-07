<?php

/**
 * GET /auth/me
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response 200:
 *   { "user": { id, username, email, role } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();

// Ambil data terbaru dari DB (bukan hanya dari token)
$db   = getDB();
$stmt = $db->prepare(
    'SELECT id, username, email, role, is_active, created_at
       FROM users WHERE id = ? LIMIT 1'
);
$stmt->execute([$authUser['sub']]);
$user = $stmt->fetch();

if (!$user || !(bool)$user['is_active']) {
    jsonResponse(['error' => 'Akun tidak ditemukan atau tidak aktif.'], 404);
}

jsonResponse([
    'user' => [
        'id'         => (int)$user['id'],
        'username'   => $user['username'],
        'email'      => $user['email'],
        'role'       => $user['role'],
        'created_at' => $user['created_at'],
    ],
]);
