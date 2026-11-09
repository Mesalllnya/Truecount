<?php

/**
 * POST /elections/{electionId}/candidates/{candidateId}/photo
 *
 * Upload/ganti foto paslon. Menggunakan multipart/form-data.
 * Field: photo (file, wajib) - JPEG/PNG/WebP, max 2MB
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Response 200:
 *   { "message": "Foto berhasil diunggah.", "photo_url": "/uploads/candidates/123_abc.jpg" }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

// ── Ambil ID dari URI ─────────────────────────────────────
preg_match('#^/elections/(\d+)/candidates/(\d+)/photo$#',
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$electionId  = isset($m[1]) ? (int)$m[1] : 0;
$candidateId = isset($m[2]) ? (int)$m[2] : 0;

if ($electionId <= 0 || $candidateId <= 0) {
    jsonResponse(['error' => 'ID tidak valid.'], 400);
}

$db = getDB();

// Verifikasi kandidat milik election ini dan pemilihan masih berstatus draft
$stmt = $db->prepare(
    'SELECT c.id FROM candidates c
     JOIN elections e ON e.id = c.election_id
     WHERE c.id = ? AND c.election_id = ? AND e.status = "draft"
     LIMIT 1'
);
$stmt->execute([$candidateId, $electionId]);
if (!$stmt->fetch()) {
    jsonResponse(['error' => 'Kandidat tidak ditemukan atau pemilihan sudah dimulai/ditutup.'], 404);
}

// ── Validasi upload ───────────────────────────────────────
if (empty($_FILES['photo'])) {
    jsonResponse(['error' => 'File foto wajib dikirim dengan field "photo".'], 422);
}

$file   = $_FILES['photo'];
$maxBytes = 2 * 1024 * 1024; // 2 MB

if ($file['error'] !== UPLOAD_ERR_OK) {
    $errMap = [
        UPLOAD_ERR_INI_SIZE   => 'File melebihi batas upload server.',
        UPLOAD_ERR_FORM_SIZE  => 'File terlalu besar.',
        UPLOAD_ERR_PARTIAL    => 'File upload tidak lengkap.',
        UPLOAD_ERR_NO_FILE    => 'Tidak ada file yang dikirim.',
    ];
    jsonResponse(['error' => $errMap[$file['error']] ?? 'Gagal upload file.'], 422);
}

if ($file['size'] > $maxBytes) {
    jsonResponse(['error' => 'Ukuran file maksimal 2 MB.'], 422);
}

// Cek MIME type nyata lewat finfo (bukan trust client Content-Type)
$finfo    = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);
$allowed  = ['image/jpeg', 'image/png', 'image/webp'];
$extMap   = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

if (!in_array($mimeType, $allowed, true)) {
    jsonResponse(['error' => 'Format foto tidak didukung. Gunakan JPEG, PNG, atau WebP.'], 422);
}

// ── Simpan file ───────────────────────────────────────────
$uploadDir = __DIR__ . '/../../../uploads/candidates/';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0777, true);
}
$ext       = $extMap[$mimeType];
$filename  = $candidateId . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$destPath  = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    jsonResponse(['error' => 'Gagal menyimpan file ke server.'], 500);
}

// Hapus foto lama jika ada
$stmt = $db->prepare('SELECT photo_path FROM candidates WHERE id = ? LIMIT 1');
$stmt->execute([$candidateId]);
$old = $stmt->fetchColumn();
if ($old) {
    $oldAbs = $uploadDir . basename($old);
    if (file_exists($oldAbs)) @unlink($oldAbs);
}

// Simpan path relatif ke DB
$photoUrl = '/uploads/candidates/' . $filename;
$db->prepare('UPDATE candidates SET photo_path = ? WHERE id = ?')
   ->execute([$photoUrl, $candidateId]);

jsonResponse([
    'message'   => 'Foto berhasil diunggah.',
    'photo_url' => $photoUrl,
]);
