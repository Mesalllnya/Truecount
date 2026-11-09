<?php

/**
 * GET /users/voters - Daftar semua user dengan role voter (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Response 200:
 *   {
 *     "users": [
 *       { "id": 2, "username": "pemilih1", "email": "pemilih1@truecount.local" }
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

$db = getDB();
$stmt = $db->query(
    'SELECT id, username, email FROM users WHERE role = "voter" AND is_active = 1 ORDER BY username ASC'
);
$users = $stmt->fetchAll();

jsonResponse([
    'users' => array_map(fn($u) => [
        'id'       => (int)$u['id'],
        'username' => $u['username'],
        'email'    => $u['email'],
    ], $users)
]);

