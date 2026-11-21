<?php

/**
 * GET /users/profile?id=<user_id>
 *
 * Mengambil data profil pengguna termasuk foto ID.
 * Memerlukan JWT Bearer token.
 *
 * Query:
 *   id: ID pengguna (opsional jika user sendiri, wajib untuk admin melihat user lain)
 *
 * Response 200:
 *   {
 *     "user": {
 *       "id": 1,
 *       "username": "johndoe",
 *       "email": "john@example.com",
 *       "role": "voter",
 *       "phone": null,
 *       "address": null,
 *       "id_photo_path": "storage/id_photos/id_ktp_1_20260115_abc123.jpg",
 *       "id_photo_type": "ktp",
 *       "created_at": "2026-01-15 10:30:00",
 *       "updated_at": "2026-01-15 10:30:00"
 *     }
 *   }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Ambil user dari JWT
$currentUser = requireAuth();
$currentUserId = $currentUser['sub'];
$currentUserRole = $currentUser['role'];

// Tentukan target user ID
$targetId = isset($_GET['id']) ? (int)$_GET['id'] : $currentUserId;

// Validasi akses: user hanya bisa lihat profil sendiri, admin bisa lihat semua
if ($targetId !== $currentUserId && $currentUserRole !== 'admin') {
    jsonResponse(['error' => 'Tidak diizinkan melihat profil pengguna lain.'], 403);
}

$db = getDB();

$stmt = $db->prepare('
    SELECT id, username, email, role, phone, address,
           id_photo_path, id_photo_type,
           created_at, updated_at
    FROM users
    WHERE id = ? LIMIT 1
');
$stmt->execute([$targetId]);
$user = $stmt->fetch();

if (!$user) {
    jsonResponse(['error' => 'Pengguna tidak ditemukan.'], 404);
}

jsonResponse(['user' => $user]);