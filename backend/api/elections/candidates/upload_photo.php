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
 * Alur (steganografi, TANPA enkripsi file):
 *   1. Gambar divalidasi lalu dikonversi ke PNG.
 *   2. Metadata pemilu + identitas paslon disisipkan ke piksel (LSB)
 *      lewat SteganographyService — foto tetap terlihat normal.
 *   3. Hasilnya disimpan sebagai PNG biasa di
 *      storage/private/candidate-photos/ sehingga masih bisa dibuka
 *      langsung dari disk, lalu path-nya dicatat ke candidates.photo_path.
 *
 * Response 200:
 *   { "message": "...", "photo_path": "private/candidate-photos/xxx.png" }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/storage.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../services/crypto/SteganographyService.php';

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

// Verifikasi kandidat milik election ini dan pemilihan masih berstatus draft.
// Sekalian ambil data untuk metadata steganografi.
$stmt = $db->prepare(
    'SELECT c.id, c.name, c.vision, c.mission,
            e.title AS election_title
       FROM candidates c
       JOIN elections e ON e.id = c.election_id
      WHERE c.id = ? AND c.election_id = ? AND e.status = "draft"
      LIMIT 1'
);
$stmt->execute([$candidateId, $electionId]);
$candidate = $stmt->fetch();

if (!$candidate) {
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

    // Metadata yang akan disisipkan ke gambar.
    // Memuat identitas paslon sesuai syarat: nama, visi, misi,
    // judul pemilihan, serta referensi ID untuk verifikasi.
    $metadata = json_encode([
        'application'    => 'TrueCount',
        'version'        => 1,
        'election_id'    => $electionId,
        'election_title' => (string) $candidate['election_title'],
        'candidate_id'   => $candidateId,
        'candidate_name' => (string) $candidate['name'],
        'vision'         => (string) ($candidate['vision'] ?? ''),
        'mission'        => (string) ($candidate['mission'] ?? ''),
        'uploaded_by'    => $adminId,
        'uploaded_at'    => gmdate('c'),
    ], JSON_THROW_ON_ERROR);

    // Steganografi: enkripsi metadata lalu sisipkan ke piksel PNG.
    SteganographyService::embedMessage(
        $metadata,
        $carrierPath,
        $stegoPath,
        $adminId
    );

    // Simpan hasil stego sebagai PNG biasa (bukan file terenkripsi)
    // agar foto masih bisa dilihat langsung dari disk.
    $photoDir = storagePath('private', 'candidate-photos');

    if (
        !is_dir($photoDir) &&
        !mkdir($photoDir, 0700, true) &&
        !is_dir($photoDir)
    ) {
        throw new RuntimeException('Gagal membuat folder foto paslon.');
    }

    $storedName = bin2hex(random_bytes(16)) . '.png';
    $finalPath  = $photoDir . DIRECTORY_SEPARATOR . $storedName;

    if (!copy($stegoPath, $finalPath)) {
        throw new RuntimeException('Gagal menyimpan foto paslon.');
    }

    @chmod($finalPath, 0644);

    // Path relatif terhadap storage root (dibaca oleh show_photo.php).
    $photoPathValue = 'private/candidate-photos/' . $storedName;

    // ── Ambil referensi foto lama untuk dibersihkan ────────
    $stmt = $db->prepare(
        'SELECT photo_path, photo_file_id FROM candidates WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$candidateId]);
    $old = $stmt->fetch();

    $oldPhotoPath = $old['photo_path'] ?? null;
    $oldFileId    = $old['photo_file_id'] !== null ? (int) $old['photo_file_id'] : null;

    // Simpan path baru; foto lama tidak lagi memakai jalur terenkripsi.
    $stmt = $db->prepare(
        'UPDATE candidates
            SET photo_path = ?, photo_file_id = NULL
          WHERE id = ? AND election_id = ?'
    );

    $stmt->execute([$photoPathValue, $candidateId, $electionId]);

    if ($stmt->rowCount() !== 1) {
        throw new RuntimeException('Gagal memperbarui foto kandidat.');
    }

    // Bersihkan foto lama (file PNG publik lama, kalau ada)
    if ($oldPhotoPath) {
        $oldAbs = __DIR__ . '/../../../uploads/candidates/'
            . basename($oldPhotoPath);

        if (is_file($oldAbs)) {
            @unlink($oldAbs);
        }

        // Juga file lama di folder steganografi (jalur penyimpanan baru)
        $oldStegoAbs = storagePath(
            'private',
            'candidate-photos',
            basename($oldPhotoPath)
        );

        if (is_file($oldStegoAbs) && $oldStegoAbs !== $finalPath) {
            @unlink($oldStegoAbs);
        }
    }

    // Bersihkan encrypted file lama (foto sebelum migrasi)
    if ($oldFileId !== null) {
        try {
            $stmt = $db->prepare(
                'SELECT stored_path, storage_dir FROM encrypted_files WHERE id = ? LIMIT 1'
            );
            $stmt->execute([$oldFileId]);
            $oldEnc = $stmt->fetch();

            if ($oldEnc) {
                $dir = ($oldEnc['storage_dir'] ?? '') !== ''
                    ? $oldEnc['storage_dir']
                    : 'encrypted-files';

                $encAbs = storagePath('private', $dir, basename($oldEnc['stored_path']));

                if (is_file($encAbs)) {
                    @unlink($encAbs);
                }

                $db->prepare('DELETE FROM encrypted_files WHERE id = ?')
                    ->execute([$oldFileId]);
            }
        } catch (Throwable $cleanupError) {
            // Pembersihan file lama tidak boleh menggagalkan upload.
            error_log('[Candidate Photo Cleanup] ' . $cleanupError->getMessage());
        }
    }

} catch (Throwable $e) {
    error_log('[Candidate Photo Upload] ' . $e->getMessage());

    jsonResponse([
        'error' => 'Gagal memproses foto kandidat: ' . $e->getMessage()
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
    'message'    => 'Foto berhasil disisipi metadata dan disimpan.',
    'photo_path' => $photoPathValue,
]);
