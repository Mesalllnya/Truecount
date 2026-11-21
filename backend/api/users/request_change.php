<?php

/**
 * POST /users/request-change
 *
 * User mengajukan permintaan perubahan data ke admin.
 * Memerlukan JWT Bearer token.
 *
 * Body JSON:
 *   {
 *     "user_id": 1,           // ID user yang datanya mau diubah (bisa beda dengan current user untuk admin)
 *     "field": "username|email|phone|address",
 *     "new_value": "nilai baru",
 *     "reason": "alasan perubahan"
 *   }
 *
 * Response 200:
 *   { "message": "Permintaan perubahan berhasil dikirim ke admin." }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Ambil user dari JWT
$currentUser = requireAuth();
$currentUserId = $currentUser['sub'];
$currentUserRole = $currentUser['role'];

$body = json_decode(file_get_contents('php://input'), true);

$targetUserId = (int)($body['user_id'] ?? 0);
$field = $body['field'] ?? '';
$newValue = trim($body['new_value'] ?? '');
$reason = trim($body['reason'] ?? '');

$validFields = ['username', 'email', 'phone', 'address'];
if (!in_array($field, $validFields, true)) {
    jsonResponse(['error' => 'Field tidak valid.'], 422);
}

if ($newValue === '') {
    jsonResponse(['error' => 'Nilai baru wajib diisi.'], 422);
}

if ($reason === '') {
    jsonResponse(['error' => 'Alasan perubahan wajib diisi.'], 422);
}

// Validasi akses: user hanya bisa request perubahan untuk diri sendiri, admin untuk semua
if ($targetUserId !== $currentUserId && $currentUserRole !== 'admin') {
    jsonResponse(['error' => 'Tidak diizinkan mengajukan perubahan untuk pengguna lain.'], 403);
}

// Validasi target user exists
$db = getDB();
$stmt = $db->prepare('SELECT id, username, email FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$targetUserId]);
$targetUser = $stmt->fetch();

if (!$targetUser) {
    jsonResponse(['error' => 'Pengguna target tidak ditemukan.'], 404);
}

// Validasi field-specific
if ($field === 'email' && !filter_var($newValue, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Format email tidak valid.'], 422);
}

if ($field === 'username') {
    if (strlen($newValue) < 3 || strlen($newValue) > 50) {
        jsonResponse(['error' => 'Username harus 3–50 karakter.'], 422);
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $newValue)) {
        jsonResponse(['error' => 'Username hanya boleh huruf, angka, dan underscore.'], 422);
    }
}

// Cek duplikat untuk username/email
if (in_array($field, ['username', 'email'], true)) {
    $stmt = $db->prepare('SELECT id FROM users WHERE ' . $field . ' = ? AND id != ? LIMIT 1');
    $stmt->execute([$newValue, $targetUserId]);
    if ($stmt->fetch()) {
        jsonResponse(['error' => ucfirst($field) . ' sudah digunakan.'], 409);
    }
}

// Simpan request ke tabel change_requests (buat tabel jika belum ada)
$stmt = $db->prepare('
    CREATE TABLE IF NOT EXISTS `change_requests` (
        `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        `user_id` INT UNSIGNED NOT NULL,
        `requested_by` INT UNSIGNED NOT NULL,
        `field` VARCHAR(50) NOT NULL,
        `current_value` TEXT NULL,
        `new_value` TEXT NOT NULL,
        `reason` TEXT NOT NULL,
        `status` ENUM("pending","approved","rejected") NOT NULL DEFAULT "pending",
        `admin_note` TEXT NULL,
        `processed_by` INT UNSIGNED NULL,
        `processed_at` DATETIME NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        CONSTRAINT `fk_cr_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
        CONSTRAINT `fk_cr_requester` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
        CONSTRAINT `fk_cr_processor` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
');
$stmt->execute();

// Ambil current value
$currentValue = $targetUser[$field] ?? null;

// Insert request
$stmt = $db->prepare('
    INSERT INTO change_requests (user_id, requested_by, field, current_value, new_value, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, "pending")
');
$stmt->execute([$targetUserId, $currentUserId, $field, $currentValue, $newValue, $reason]);

jsonResponse(['message' => 'Permintaan perubahan berhasil dikirim ke admin.']);