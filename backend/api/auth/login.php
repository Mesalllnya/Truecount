<?php

/**
 * POST /auth/login
 *
 * Body JSON:
 *   { "identifier": "username_atau_email", "password": "..." }
 *
 * Response 200:
 *   { "message": "Login berhasil.", "token": "...", "user": { id, username, email, role } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/jwt.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// ── Parse body ────────────────────────────────────────────
$body       = json_decode(file_get_contents('php://input'), true);
$identifier = trim($body['identifier'] ?? '');
$password   = $body['password']        ?? '';

if ($identifier === '' || $password === '') {
    jsonResponse(['error' => 'Username/email dan kata sandi wajib diisi.'], 422);
}

// ── Cari user ─────────────────────────────────────────────
$db   = getDB();
$stmt = $db->prepare(
    'SELECT id, username, email, password_hash, role, is_active
       FROM users
      WHERE username = ? OR email = ?
      LIMIT 1'
);
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

// Gunakan password_verify agar tetap constant-time meski user tidak ada
$dummyHash = '$argon2id$v=19$m=65536,t=4,p=2$dummysalt123456789012$dummyhashvaluethatislong';
$hashToCheck = $user ? $user['password_hash'] : $dummyHash;

if (!$user || !password_verify($password, $hashToCheck)) {
    jsonResponse(['error' => 'Username/email atau kata sandi salah.'], 401);
}

if (!(bool)$user['is_active']) {
    jsonResponse(['error' => 'Akun Anda telah dinonaktifkan. Hubungi administrator.'], 403);
}

// ── Buat token JWT ────────────────────────────────────────
$token = generateJwt([
    'sub'      => $user['id'],
    'username' => $user['username'],
    'email'    => $user['email'],
    'role'     => $user['role'],
]);

jsonResponse([
    'message' => 'Login berhasil.',
    'token'   => $token,
    'user'    => [
        'id'       => (int)$user['id'],
        'username' => $user['username'],
        'email'    => $user['email'],
        'role'     => $user['role'],
    ],
]);
