<?php

/**
 * TrueCount - Bulk Import Calon Paslon & Pemilihan
 *
 * Script CLI untuk memasukkan data pemilihan dan calon paslon sekaligus
 * (termasuk proses foto melalui steganografi + enkripsi file) sehingga dev
 * tidak perlu menambah satu per satu lewat UI admin.
 *
 * Pemrosesan foto mengikuti alaman yang sama dengan
 * backend/api/elections/candidates/upload_photo.php:
 *   1. Gambar dikonversi ke PNG via GD.
 *   2. Metadata pemilu + identitas paslon disisipkan lewat SteganographyService (LSB).
 *   3. Hasilnya disimpan sebagai PNG biasa di storage/private/candidate-photos/
 *      (masih bisa dibuka langsung dari disk), path dicatat ke candidates.photo_path.
 *
 * Penggunaan:
 *   php scripts/bulk_import_paslon.php <path-ke-folder-template>
 *
 * Contoh:
 *   php scripts/bulk_import_paslon.php docs/dev/template/tempBulk_paslon
 *
 * Persyaratan:
 *   - File .env sudah diisi (termasuk ENCRYPTION_KEY_B64 & CHACHA20_KEY_B64).
 *   - Ekstensi PHP gd dan fileinfo aktif.
 *   - Tabel database sudah dijalankan migrasi (termasuk 009 photo_file_id).
 */

// ── Muat konfigurasi & helper ─────────────────────────────────────────────
require_once __DIR__ . '/../backend/config/env.php';
require_once __DIR__ . '/../backend/helpers/storage.php';
require_once __DIR__ . '/../backend/config/database.php';

require_once __DIR__ . '/../backend/services/crypto/SteganographyService.php';
require_once __DIR__ . '/../backend/services/crypto/FileEncryptionService.php';

date_default_timezone_set('Asia/Jakarta');

// ── Argumen CLI ───────────────────────────────────────────────────────────
$templateDir = $argv[1] ?? null;

if (!$templateDir || !is_dir($templateDir)) {
    fwrite(STDERR, "Usage: php $argv[0] <path-ke-folder-template>\n");
    fwrite(STDERR, "Contoh: php $argv[0] docs/dev/template/tempBulk_paslon\n");
    exit(1);
}

$dataPaslonPath = rtrim($templateDir, '/\\') . '/dataPaslon.json';
$imgDir         = rtrim($templateDir, '/\\') . '/img';

if (!is_file($dataPaslonPath)) {
    fwrite(STDERR, "File dataPaslon.json tidak ditemukan di $templateDir\n");
    exit(1);
}

if (!is_dir($imgDir)) {
    fwrite(STDERR, "Folder img/ tidak ditemukan di $templateDir\n");
    exit(1);
}

// ── Baca dataPaslon.json ──────────────────────────────────────────────────
$json = json_decode(file_get_contents($dataPaslonPath), true);

if (!is_array($json)) {
    fwrite(STDERR, "dataPaslon.json tidak valid.\n");
    exit(1);
}

$adminUserId = (int)($json['admin_user_id'] ?? 0);
if ($adminUserId <= 0) {
    fwrite(STDERR, "admin_user_id wajib diisi di dataPaslon.json.\n");
    exit(1);
}

$electionData = $json['election'] ?? [];
$candidates   = $json['candidates'] ?? [];

if (!is_array($candidates) || count($candidates) === 0) {
    fwrite(STDERR, "Tidak ada calon paslon di dataPaslon.json.\n");
    exit(1);
}

$db = getDB();

// ── Validasi admin ada ────────────────────────────────────────────────────
$stmt = $db->prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$adminUserId]);
$admin = $stmt->fetch();
if (!$admin) {
    fwrite(STDERR, "Admin user id $adminUserId tidak ditemukan.\n");
    exit(1);
}
if ($admin['role'] !== 'admin') {
    fwrite(STDERR, "User id $adminUserId bukan role admin.\n");
    exit(1);
}

// ── Buat atau ambil pemilihan ─────────────────────────────────────────────
$electionId = isset($electionData['election_id']) ? (int)$electionData['election_id'] : 0;

if ($electionId > 0) {
    $stmt = $db->prepare('SELECT id, status FROM elections WHERE id = ? LIMIT 1');
    $stmt->execute([$electionId]);
    $election = $stmt->fetch();
    if (!$election) {
        fwrite(STDERR, "Pemilihan id $electionId tidak ditemukan.\n");
        exit(1);
    }
    echo "Gunakan pemilihan id #$electionId (status: {$election['status']})\n";
} else {
    $title       = trim($electionData['title'] ?? '');
    $description = trim($electionData['description'] ?? '');
    $startTime   = $electionData['start_time'] ?? '';
    $endTime     = $electionData['end_time'] ?? '';
    $status      = $electionData['status'] ?? 'draft';

    if ($title === '' || $startTime === '' || $endTime === '') {
        fwrite(STDERR, "title, start_time, dan end_time wajib diisi di election.\n");
        exit(1);
    }

    $stmt = $db->prepare(
        'INSERT INTO elections (title, description, start_time, end_time, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$title, $description === '' ? null : $description, $startTime, $endTime, $status, $adminUserId]);
    $electionId = (int)$db->lastInsertId();
    echo "Pemilihan baru dibuat: id #$electionId - $title\n";
}

// Judul pemilihan untuk metadata steganografi foto paslon.
$stmt = $db->prepare('SELECT title FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$electionId]);
$electionTitle = (string) ($stmt->fetchColumn() ?: '');

// ── Proses setiap calon ───────────────────────────────────────────────────
$imported = 0;
$skipped  = 0;
$errors   = [];

foreach ($candidates as $index => $c) {
    $name       = trim($c['name'] ?? '');
    $vision     = trim($c['vision'] ?? '');
    $mission    = trim($c['mission'] ?? '');
    $imageFile  = trim($c['image_file'] ?? '');

    if ($name === '') {
        $skipped++;
        $errors[] = "Baris #" . ($index + 1) . ": nama kosong, dilewati.";
        continue;
    }

    if (strlen($name) > 150) {
        $skipped++;
        $errors[] = "Baris #" . ($index + 1) . ": nama terlalu panjang (>150), dilewati.";
        continue;
    }

    // Simpan calon ke tabel candidates.
    $stmt = $db->prepare(
        'INSERT INTO candidates (election_id, name, vision, mission, photo_file_id, created_at)
         VALUES (?, ?, ?, ?, NULL, UTC_TIMESTAMP())'
    );
    $stmt->execute([
        $electionId,
        $name,
        $vision === '' ? null : $vision,
        $mission === '' ? null : $mission,
    ]);
    $candidateId = (int)$db->lastInsertId();
    echo "  [+] Calon #$candidateId: $name\n";

    // Proses foto jika ada file gambar.
    if ($imageFile !== '') {
        $imagePath = $imgDir . '/' . $imageFile;

        if (!is_file($imagePath) || !is_readable($imagePath)) {
            $errors[] = "Calon #$candidateId ($name): gambar '$imageFile' tidak ditemukan di img/, foto dilewati.";
            continue;
        }

        try {
            $photoPathValue = processCandidatePhoto(
                $db,
                $imagePath,
                $electionId,
                $candidateId,
                $adminUserId,
                $electionTitle,
                $name,
                $vision,
                $mission
            );

            $stmt = $db->prepare(
                'UPDATE candidates SET photo_path = ?, photo_file_id = NULL WHERE id = ? AND election_id = ?'
            );
            $stmt->execute([$photoPathValue, $candidateId, $electionId]);

            echo "       Foto disimpan (steganografi): $photoPathValue\n";
        } catch (Throwable $e) {
            $errors[] = "Calon #$candidateId ($name): gagal proses foto - " . $e->getMessage();
        }
    }

    $imported++;
}

// ── Ringkasan ─────────────────────────────────────────────────────────────
echo "\n=== Hasil impor ===\n";
echo "Berhasil    : $imported\n";
echo "Dilewati    : $skipped\n";
echo "Error       : " . count($errors) . "\n";
foreach ($errors as $e) {
    echo "  - $e\n";
}

exit(count($errors) > 0 ? 1 : 0);

/**
 * Proses foto paslon melalui pipeline yang sama dengan upload_photo.php:
 * GD → PNG → steganografi embed (metadata nama paslon dll) → simpan PNG biasa
 * di storage/private/candidate-photos/ sehingga masih bisa dibuka dari disk.
 *
 * @return string Path relatif terhadap storage root.
 */
function processCandidatePhoto(
    PDO $db,
    string $imagePath,
    int $electionId,
    int $candidateId,
    int $adminUserId,
    string $electionTitle,
    string $name,
    string $vision,
    string $mission
): string {
    $finfo    = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($imagePath);

    $allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!in_array($mimeType, $allowed, true)) {
        throw new RuntimeException('Format foto tidak didukung (JPEG/PNG/WebP).');
    }

    if (filesize($imagePath) > 2 * 1024 * 1024) {
        throw new RuntimeException('Ukuran file maksimal 2 MB.');
    }

    // Konversi ke PNG via GD (carrier).
    $carrierPath = sys_get_temp_dir()
        . DIRECTORY_SEPARATOR . 'tc_bulk_carrier_'
        . bin2hex(random_bytes(12)) . '.png';

    $stegoPath = sys_get_temp_dir()
        . DIRECTORY_SEPARATOR . 'tc_bulk_stego_'
        . bin2hex(random_bytes(12)) . '.png';

    $image = null;

    try {
        switch ($mimeType) {
            case 'image/jpeg':
                $image = imagecreatefromjpeg($imagePath);
                break;
            case 'image/png':
                $image = imagecreatefrompng($imagePath);
                break;
            case 'image/webp':
                if (!function_exists('imagecreatefromwebp')) {
                    throw new RuntimeException('GD WebP belum tersedia.');
                }
                $image = imagecreatefromwebp($imagePath);
                break;
        }

        if (!$image) {
            throw new RuntimeException('Gagal membaca gambar.');
        }

        if (!imagepng($image, $carrierPath, 6)) {
            throw new RuntimeException('Gagal mengonversi gambar ke PNG.');
        }
        imagedestroy($image);
        $image = null;

        // Metadata yang disisipkan lewat steganografi.
        $metadata = json_encode([
            'application'    => 'TrueCount',
            'version'        => 1,
            'election_id'    => $electionId,
            'election_title' => $electionTitle,
            'candidate_id'   => $candidateId,
            'candidate_name' => $name,
            'vision'         => $vision,
            'mission'        => $mission,
            'uploaded_by'    => $adminUserId,
            'uploaded_at'    => gmdate('c'),
        ], JSON_THROW_ON_ERROR);

        SteganographyService::embedMessage($metadata, $carrierPath, $stegoPath, $adminUserId);

        // Simpan hasil stego sebagai PNG biasa (bukan file terenkripsi).
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

        return 'private/candidate-photos/' . $storedName;
    } finally {
        if ($image) {
            imagedestroy($image);
        }
        foreach ([$carrierPath, $stegoPath] as $tmp) {
            if (is_file($tmp)) {
                @unlink($tmp);
            }
        }
    }
}
