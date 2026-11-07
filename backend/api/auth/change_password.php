<?php

/**
 * POST /auth/change-password
 *
 * Ganti password user yang sedang login.
 * Memerlukan JWT Bearer token.
 *
 * Body JSON:
 *   {
 *     "current_password": "password_lama",
 *     "new_password": "password_baru"
 *   }
 *
 * Response 200:
 *   { "message": "Password berhasil diubah." }
 *
 * Response 401: Token invalid/expired
 * Response 400: Password lama salah / validasi gagal
 * Response 422: Body tidak valid
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Ambil user dari JWT
$user = requireAuth();
$userId = $user['sub'];

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
$currentPassword = (string)($body['current_password'] ?? '');
$newPassword = (string)($body['new_password'] ?? '');

if ($currentPassword === '' || $newPassword === '') {
    jsonResponse(['error' => 'Password lama dan baru wajib diisi.'], 422);
}

// Validasi password baru
if (strlen($newPassword) < 8) {
    jsonResponse(['error' => 'Password baru minimal 8 karakter.'], 422);
}
if ($currentPassword === $newPassword) {
    jsonResponse(['error' => 'Password baru harus berbeda dari password lama.'], 422);
}

// Ambil hash password saat ini
$db = getDB();
$stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$userId]);
$userRow = $stmt->fetch();

if (!$userRow) {
    jsonResponse(['error' => 'User tidak ditemukan.'], 404);
}

// Verifikasi password lama
if (!password_verify($currentPassword, $userRow['password_hash'])) {
    jsonResponse(['error' => 'Password lama tidak benar.'], 400);
}

// Hash password baru dengan Argon2id
$newHash = password_hash($newPassword, PASSWORD_ARGON2ID, [
    'memory_cost' => 65536,
    'time_cost'   => 4,
    'threads'     => 2,
]);

// Update password
$stmt = $db->prepare('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?');
$stmt->execute([$newHash, $userId]);

jsonResponse(['message' => 'Password berhasil diubah.']);