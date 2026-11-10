<?php

/**
 * GET /auth/attempts/{id}/photo
 *
 * Melayani foto kamera milik satu percobaan login (khusus admin).
 * Dipakai halaman Log Keamanan Pengguna.
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Response 200: image/jpeg (binary)
 * Response 404: attempt tidak ditemukan / tidak ada foto
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

// Router menyimpan id attempt di REQUEST_URI: /auth/attempts/{id}/photo
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '';
if (!preg_match('#/auth/attempts/(\d+)/photo#', $uri, $m)) {
    jsonResponse(['error' => 'ID percobaan tidak valid.'], 400);
}
$attemptId = (int)$m[1];

$db = getDB();

$stmt = $db->prepare('SELECT photo_path FROM auth_attempts WHERE id = ? LIMIT 1');
$stmt->execute([$attemptId]);
$row = $stmt->fetch();

if (!$row || empty($row['photo_path'])) {
    jsonResponse(['error' => 'Foto tidak ditemukan untuk percobaan ini.'], 404);
}

// photo_path disimpan sebagai "storage/auth_photos/xxx.jpg"
$filename = basename($row['photo_path']);
$dir      = realpath(__DIR__ . '/../../../storage/auth_photos');
$file     = $dir ? realpath($dir . DIRECTORY_SEPARATOR . $filename) : false;

// Cegah path traversal: file harus benar-benar di dalam folder auth_photos
if ($file === false || !str_starts_with($file, $dir . DIRECTORY_SEPARATOR) || !is_file($file)) {
    jsonResponse(['error' => 'Foto tidak ditemukan di penyimpanan.'], 404);
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
$mimes = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'webp' => 'image/webp',
];

header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($file));
header('Cache-Control: private, max-age=300');
readfile($file);
exit;
