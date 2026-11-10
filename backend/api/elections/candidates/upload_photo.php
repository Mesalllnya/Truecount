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
require_once __DIR__ . '/../../../services/crypto/SteganographyService.php';
require_once __DIR__ . '/../../../services/crypto/FileEncryptionService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();
$adminId  = (int) ($authUser['sub'] ?? 0);

if ($adminId <= 0) {
    jsonResponse(['error' => 'Identitas admin tidak valid.'], 401);
}

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

// Siapkan temporary file untuk PNG dan stego image
$carrierPath = sys_get_temp_dir()
    . DIRECTORY_SEPARATOR . 'tc_carrier_'
    . bin2hex(random_bytes(12)) . '.png';

$stegoPath = sys_get_temp_dir()
    . DIRECTORY_SEPARATOR . 'tc_stego_'
    . bin2hex(random_bytes(12)) . '.png';

$image = null;

try {
    // Baca gambar berdasarkan MIME yang sudah divalidasi
    switch ($mimeType) {
        case 'image/jpeg':
            $image = imagecreatefromjpeg($file['tmp_name']);
            break;

        case 'image/png':
            $image = imagecreatefrompng($file['tmp_name']);
            break;

        case 'image/webp':
            if (!function_exists('imagecreatefromwebp')) {
                throw new RuntimeException('GD WebP belum tersedia.');
            }

            $image = imagecreatefromwebp($file['tmp_name']);
            break;
    }

    if (!$image) {
        throw new RuntimeException('Gagal membaca gambar.');
    }

    // Konversi semua format menjadi PNG
    if (!imagepng($image, $carrierPath, 6)) {
        throw new RuntimeException('Gagal mengonversi gambar ke PNG.');
    }

    imagedestroy($image);
    $image = null;

    // Metadata yang akan disisipkan ke gambar
    $metadata = json_encode([
        'application' => 'TrueCount',
        'version'     => 1,
        'election_id' => $electionId,
        'candidate_id'=> $candidateId,
        'uploaded_by' => $adminId,
        'uploaded_at' => gmdate('c')
    ], JSON_THROW_ON_ERROR);

    // Steganography: enkripsi metadata dan sisipkan ke PNG
    SteganographyService::embedMessage(
        $metadata,
        $carrierPath,
        $stegoPath,
        $adminId
    );

    // File Encryption: enkripsi seluruh stego image
    $encryptedFileId = FileEncryptionService::encryptAndStore(
        $adminId,
        $stegoPath,
        'candidate_' . $candidateId . '.png'
    );

    // Ambil path foto lama untuk dibersihkan setelah update berhasil
    $stmt = $db->prepare(
        'SELECT photo_path FROM candidates WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$candidateId]);
    $oldPhotoPath = $stmt->fetchColumn();

    // Simpan ID file terenkripsi, kosongkan path publik
    $stmt = $db->prepare(
        'UPDATE candidates
            SET photo_file_id = ?, photo_path = NULL
            WHERE id = ? AND election_id = ?'
    );

    $stmt->execute([
        $encryptedFileId,
        $candidateId,
        $electionId
    ]);

    if ($stmt->rowCount() !== 1) {
        throw new RuntimeException('Gagal memperbarui foto kandidat.');
    }

    // Hapus foto lama dari folder publik jika sebelumnya ada
    if ($oldPhotoPath) {
        $oldAbs = __DIR__ . '/../../../uploads/candidates/'
            . basename($oldPhotoPath);

        if (is_file($oldAbs)) {
            @unlink($oldAbs);
        }
    }

} catch (Throwable $e) {
    error_log('[Candidate Photo Upload] ' . $e->getMessage());

    jsonResponse([
        'error' => 'Gagal memproses foto kandidat.'
    ], 500);

} finally {
    if ($image) {
        imagedestroy($image);
    }

    if (is_file($carrierPath)) {
        @unlink($carrierPath);
    }

    if (is_file($stegoPath)) {
        @unlink($stegoPath);
    }
}

jsonResponse([
    'message'        => 'Foto berhasil dienkripsi dan disimpan.',
    'photo_file_id'  => $encryptedFileId
]);

