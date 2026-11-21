<?php

/**
 * GET /auth/check-username?username=...
 *
 * Cek apakah username sudah dipakai atau belum (real-time, untuk form registrasi).
 * Endpoint publik - tidak butuh auth.
 *
 * Query:
 *   username: username yang dicek
 *
 * Response 200:
 *   { "available": true, "message": "Username tersedia." }
 *   { "available": false, "message": "Username sudah dipakai." }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$username = trim($_GET['username'] ?? '');

if ($username === '') {
    jsonResponse(['error' => 'Username wajib diisi.'], 400);
}

// Validasi format dulu
if (strlen($username) < 3 || strlen($username) > 50) {
    jsonResponse(['available' => false, 'message' => 'Username harus 3-50 karakter.'], 200);
}
if (!preg_match('/^[a-z0-9_]+$/', $username)) {
    jsonResponse(['available' => false, 'message' => 'Username hanya huruf kecil, angka, dan underscore.'], 200);
}

$db = getDB();
$stmt = $db->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$exists = (bool) $stmt->fetch();

if ($exists) {
    jsonResponse(['available' => false, 'message' => 'Username sudah dipakai.'], 200);
}

jsonResponse(['available' => true, 'message' => 'Username tersedia.'], 200);