<?php

/**
 * GET /users/photo?id=<photo_path>
 *
 * Melayani foto ID (KTP/SIM) milik user yang sudah dienkripsi.
 * Dekripsi AES-256-GCM sebelum disajikan.
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Query:
 *   id: photo_path dari database (contoh: "storage/id_photos/id_ktp_xxx.jpg")
 *
 * Response 200: image/jpeg (binary, sudah didekripsi)
 * Response 404: foto tidak ditemukan
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/storage.php';
require_once __DIR__ . '/../../helpers/auth_photo.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// User harus login
requireAuth();

$photoPath = $_GET['id'] ?? '';
if ($photoPath === '') {
    jsonResponse(['error' => 'Parameter id diperlukan.'], 400);
}

// Validasi path: harus di folder id_photos
$filename = basename($photoPath);
$dir = realpath(storagePath('id_photos'));
$file = $dir ? realpath($dir . DIRECTORY_SEPARATOR . $filename) : false;

// Cegah path traversal: file harus benar-benar di dalam folder id_photos
if ($file === false || !str_starts_with($file, $dir . DIRECTORY_SEPARATOR) || !is_file($file)) {
    jsonResponse(['error' => 'Foto tidak ditemukan di penyimpanan.'], 404);
}

try {
    // Dekripsi foto ID (AES-256-GCM) sebelum disajikan
    $content = decryptAuthPhoto($file);

    header('Content-Type: image/jpeg');
    header('Content-Length: ' . strlen($content));
    header('Cache-Control: private, max-age=300');
    echo $content;
    exit;
} catch (Throwable $e) {
    error_log('[User ID Photo] Dekripsi gagal: ' . $e->getMessage());
    jsonResponse(['error' => 'Gagal mendekripsi foto ID.'], 500);
}