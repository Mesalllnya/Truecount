<?php

/**
 * GET /users/search?q=...
 *
 * Cari pengguna berdasarkan username/email (khusus admin).
 * Dipakai panel "Log Keamanan Pengguna" di dashboard admin.
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Response 200:
 *   {
 *     "users": [
 *       { "id": 1, "username": "admin", "email": "admin@truecount.local", "role": "admin", "is_active": true }
 *     ]
 *   }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

$q      = trim($_GET['q'] ?? '');
$id     = (int)($_GET['id'] ?? 0);
$limit  = min(50, max(1, (int)($_GET['limit'] ?? 25)));

$db = getDB();

// Lookup spesifik by id (dipakai halaman log keamanan user)
if ($id > 0) {
    $stmt = $db->prepare('SELECT id, username, email, role, is_active FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) {
        jsonResponse(['users' => []]);
    }
    jsonResponse([
        'users' => [[
            'id'        => (int)$user['id'],
            'username'  => $user['username'],
            'email'     => $user['email'],
            'role'      => $user['role'],
            'is_active' => (bool)$user['is_active'],
        ]],
    ]);
}

if ($q === '') {
    jsonResponse(['users' => []]);
}

$like = '%' . $q . '%';
$stmt = $db->prepare(
    'SELECT id, username, email, role, is_active
       FROM users
      WHERE username LIKE ? OR email LIKE ?
      ORDER BY username ASC
      LIMIT ' . $limit
);
$stmt->execute([$like, $like]);
$users = $stmt->fetchAll();

jsonResponse([
    'users' => array_map(fn($u) => [
        'id'        => (int)$u['id'],
        'username'  => $u['username'],
        'email'     => $u['email'],
        'role'      => $u['role'],
        'is_active' => (bool)$u['is_active'],
    ], $users),
]);
