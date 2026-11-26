<?php

/**
 * TrueCount - Pindahkan foto paslon ke folder terpisah
 *
 * Sebelumnya SEMUA file terenkripsi (foto paslon, voice message, dsb)
 * disimpan rata-rata di: backend/storage/private/encrypted-files/
 *
 * Sejak perubahan "foto paslon di folder terpisah", foto paslon disimpan di:
 *   backend/storage/private/candidate-photos/
 *
 * Script ini memindahkan file .enc milik kandidat (candidates.photo_file_id)
 * dari folder lama ke folder baru, lalu memperbarui kolom storage_dir.
 * Idempoten: file yang sudah pindah akan dilewati.
 *
 * Penggunaan:
 *   php scripts/move_candidate_photos.php           # dry-run (laporan saja)
 *   php scripts/move_candidate_photos.php --apply   # eksekusi pemindahan
 *
 * Di Docker:
 *   docker compose --env-file .env.docker exec backend \
 *       php scripts/move_candidate_photos.php --apply
 */

require_once __DIR__ . '/../backend/config/env.php';
require_once __DIR__ . '/../backend/helpers/storage.php';
require_once __DIR__ . '/../backend/config/database.php';

date_default_timezone_set('Asia/Jakarta');

$apply = in_array('--apply', array_slice($argv, 1), true);

$oldDir = storagePath('private', 'encrypted-files');
$newDir = storagePath('private', 'candidate-photos');

$db = getDB();

// Semua file terenkripsi yang dipakai sebagai foto kandidat.
$stmt = $db->query(
    'SELECT ef.id, ef.stored_path, ef.storage_dir, c.id AS candidate_id
       FROM encrypted_files ef
       INNER JOIN candidates c ON c.photo_file_id = ef.id
      ORDER BY ef.id ASC'
);
$rows = $stmt->fetchAll();

if (!$rows) {
    echo "Tidak ada foto paslon yang tercatat di database.\n";
    exit(0);
}

$moved   = 0;
$skipped = 0;
$failed  = 0;

foreach ($rows as $row) {
    $label = sprintf(
        "file #%d (kandidat #%d, %s)",
        $row['id'],
        $row['candidate_id'],
        $row['stored_path']
    );

    // Baris pasca-migrasi 016 sudah punya storage_dir; baris lama = NULL.
    $currentDir = $row['storage_dir'] ?? 'encrypted-files';
    if ($currentDir === '' || $currentDir === null) {
        $currentDir = 'encrypted-files';
    }

    if ($currentDir === 'candidate-photos') {
        echo "[SKIP] $label - sudah di folder candidate-photos\n";
        $skipped++;
        continue;
    }

    $src = $oldDir . DIRECTORY_SEPARATOR . $row['stored_path'];
    $dst = $newDir . DIRECTORY_SEPARATOR . $row['stored_path'];

    if (!is_file($src)) {
        // Kalau file lama tidak ada tapi tujuan sudah ada, cukup sinkronkan DB.
        if (is_file($dst)) {
            if ($apply) {
                $upd = $db->prepare(
                    "UPDATE encrypted_files SET storage_dir = 'candidate-photos' WHERE id = ?"
                );
                $upd->execute([$row['id']]);
                echo "[OK]  $label - file sudah di folder baru, storage_dir disinkronkan\n";
                $moved++;
            } else {
                echo "[DRY] $label - file sudah di folder baru, storage_dir perlu disinkronkan\n";
                $moved++;
            }
            continue;
        }

        echo "[FAIL] $label - file sumber tidak ditemukan di $src\n";
        $failed++;
        continue;
    }

    if (!is_dir($newDir) && !mkdir($newDir, 0700, true) && !is_dir($newDir)) {
        echo "[FAIL] $label - gagal membuat folder $newDir\n";
        $failed++;
        continue;
    }

    if (!$apply) {
        echo "[DRY]  $label - akan dipindah ke $newDir\n";
        $moved++;
        continue;
    }

    if (!rename($src, $dst)) {
        echo "[FAIL] $label - gagal memindahkan file\n";
        $failed++;
        continue;
    }

    @chmod($dst, 0600);

    $upd = $db->prepare(
        "UPDATE encrypted_files SET storage_dir = 'candidate-photos' WHERE id = ?"
    );
    $upd->execute([$row['id']]);

    echo "[OK]   $label - dipindah + storage_dir diperbarui\n";
    $moved++;
}

echo "\nRingkasan: $moved diproses, $skipped sudah benar, $failed gagal.\n";

if (!$apply && $moved > 0) {
    echo "Ini dry-run. Jalankan dengan --apply untuk benar-benar memindah.\n";
}

exit($failed > 0 ? 1 : 0);
