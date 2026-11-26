<?php

/**
 * TrueCount - Migrasi foto paslon: dari file terenkripsi ke PNG steganografi
 *
 * Sebelumnya foto paslon disimpan sebagai file .enc (ChaCha20) sehingga TIDAK
 * bisa dilihat dari disk. Sejak perubahan "steganografi", foto paslon disimpan
 * sebagai PNG biasa yang sudah disisipi metadata (nama paslon, visi, misi,
 * judul pemilihan, dll) di pikselnya.
 *
 * Script ini:
 *   1. Membaca foto lama dari encrypted_files (didekripsi).
 *   2. Menyisipkan ulang metadata lengkap (termasuk NAMA PASLON).
 *   3. Menyimpan hasilnya sebagai PNG di storage/private/candidate-photos/.
 *   4. Memperbarui candidates.photo_path, mengosongkan photo_file_id.
 *   5. Menghapus file .enc lama + baris encrypted_files.
 *
 * Idempoten: kandidat yang sudah photo_path-nya terisi akan dilewati.
 *
 * Penggunaan:
 *   php scripts/migrate_photos_to_stego.php           # dry-run
 *   php scripts/migrate_photos_to_stego.php --apply   # eksekusi
 *
 * Di Docker (scripts/ tidak ikut ke image, copy dulu):
 *   docker compose --env-file .env.docker cp scripts/migrate_photos_to_stego.php backend:/var/www/html/scripts/
 *   docker compose --env-file .env.docker exec backend php scripts/migrate_photos_to_stego.php --apply
 */

require_once __DIR__ . '/../backend/config/env.php';
require_once __DIR__ . '/../backend/helpers/storage.php';
require_once __DIR__ . '/../backend/config/database.php';
require_once __DIR__ . '/../backend/services/crypto/FileEncryptionService.php';
require_once __DIR__ . '/../backend/services/crypto/SteganographyService.php';

date_default_timezone_set('Asia/Jakarta');

$apply = in_array('--apply', array_slice($argv, 1), true);

$db = getDB();

// Kandidat yang masih memakai jalur terenkripsi (photo_file_id terisi).
$stmt = $db->query(
    'SELECT c.id AS candidate_id,
            c.election_id,
            c.name,
            c.vision,
            c.mission,
            c.photo_file_id,
            e.title AS election_title,
            ef.user_id AS owner_id
       FROM candidates c
       JOIN elections e ON e.id = c.election_id
       INNER JOIN encrypted_files ef ON ef.id = c.photo_file_id
      ORDER BY c.id ASC'
);
$rows = $stmt->fetchAll();

if (!$rows) {
    echo "Tidak ada foto paslon lama yang perlu dimigrasi.\n";
    exit(0);
}

$photoDir = storagePath('private', 'candidate-photos');

if (!is_dir($photoDir) && !mkdir($photoDir, 0700, true) && !is_dir($photoDir)) {
    fwrite(STDERR, "Gagal membuat folder $photoDir\n");
    exit(1);
}

$migrated = 0;
$failed   = 0;

foreach ($rows as $row) {
    $label = sprintf(
        "kandidat #%d (%s), file #%d",
        $row['candidate_id'],
        $row['name'],
        $row['photo_file_id']
    );

    try {
        // 1. Dekripsi foto lama → bytes PNG (yang sudah berisi stego lama).
        $decrypted = FileEncryptionService::decryptById(
            (int) $row['photo_file_id'],
            (int) $row['owner_id']
        );

        $pngContent = $decrypted['content'];

        $imageInfo = getimagesizefromstring($pngContent);

        if ($imageInfo === false || $imageInfo[2] !== IMAGETYPE_PNG) {
            throw new RuntimeException('Hasil dekripsi bukan PNG valid.');
        }

        if (!$apply) {
            echo "[DRY]  $label - akan dimigrasi\n";
            $migrated++;
            continue;
        }

        // 2. Tulis PNG sementara lalu sisipkan metadata BARU
        //    (memuat nama paslon, visi, misi, judul pemilihan).
        $tmpIn  = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tc_mig_in_' . bin2hex(random_bytes(8)) . '.png';
        $tmpOut = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tc_mig_out_' . bin2hex(random_bytes(8)) . '.png';

        if (file_put_contents($tmpIn, $pngContent) === false) {
            throw new RuntimeException('Gagal menulis PNG sementara.');
        }

        $metadata = json_encode([
            'application'    => 'TrueCount',
            'version'        => 1,
            'election_id'    => (int) $row['election_id'],
            'election_title' => (string) $row['election_title'],
            'candidate_id'   => (int) $row['candidate_id'],
            'candidate_name' => (string) $row['name'],
            'vision'         => (string) ($row['vision'] ?? ''),
            'mission'        => (string) ($row['mission'] ?? ''),
            'uploaded_by'    => (int) $row['owner_id'],
            'uploaded_at'    => gmdate('c'),
        ], JSON_THROW_ON_ERROR);

        try {
            SteganographyService::embedMessage(
                $metadata,
                $tmpIn,
                $tmpOut,
                (int) $row['owner_id']
            );

            // 3. Simpan sebagai PNG biasa.
            $storedName = bin2hex(random_bytes(16)) . '.png';
            $finalPath  = $photoDir . DIRECTORY_SEPARATOR . $storedName;

            if (!copy($tmpOut, $finalPath)) {
                throw new RuntimeException('Gagal menyimpan PNG hasil stego.');
            }

            @chmod($finalPath, 0644);

            $photoPathValue = 'private/candidate-photos/' . $storedName;

            // 4. Perbarui kandidat.
            $upd = $db->prepare(
                'UPDATE candidates SET photo_path = ?, photo_file_id = NULL WHERE id = ?'
            );
            $upd->execute([$photoPathValue, (int) $row['candidate_id']]);

            // 5. Hapus file .enc lama + baris encrypted_files.
            $sel = $db->prepare(
                'SELECT stored_path, storage_dir FROM encrypted_files WHERE id = ? LIMIT 1'
            );
            $sel->execute([(int) $row['photo_file_id']]);
            $enc = $sel->fetch();

            if ($enc) {
                $dir = ($enc['storage_dir'] ?? '') !== ''
                    ? $enc['storage_dir']
                    : 'encrypted-files';

                $encAbs = storagePath('private', $dir, basename($enc['stored_path']));

                if (is_file($encAbs)) {
                    @unlink($encAbs);
                }

                $db->prepare('DELETE FROM encrypted_files WHERE id = ?')
                    ->execute([(int) $row['photo_file_id']]);
            }

            echo "[OK]   $label → $photoPathValue\n";
            $migrated++;
        } finally {
            foreach ([$tmpIn, $tmpOut] as $tmp) {
                if (is_file($tmp)) {
                    @unlink($tmp);
                }
            }
        }

    } catch (Throwable $e) {
        echo "[FAIL] $label - " . $e->getMessage() . "\n";
        $failed++;
    }
}

echo "\nRingkasan: $migrated dimigrasi, $failed gagal.\n";

if (!$apply && $migrated > 0) {
    echo "Ini dry-run. Jalankan dengan --apply untuk eksekusi.\n";
}

exit($failed > 0 ? 1 : 0);
