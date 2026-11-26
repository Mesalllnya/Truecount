<?php
/**
 * Migrasi ekstensi: file audio video/mp4 yang masih berekstensi .enc
 * (akibat kelupaan 'video/mp4' di $mimeToExt) → ekstensi asli .m4a.
 *
 * Hanya menyentuh file yang mime_type-nya video/mp4/audio/mp4.
 * File ChaCha20 lama (video/webm .enc) TIDAK disentuh.
 *
 * Idempoten: file yang sudah .m4a dilewati.
 *
 * Penggunaan:
 *   php scripts/migrate_m4a_extension.php           # dry-run
 *   php scripts/migrate_m4a_extension.php --apply   # eksekusi
 */

require __DIR__ . '/../backend/config/env.php';
require __DIR__ . '/../backend/helpers/storage.php';
require __DIR__ . '/../backend/config/database.php';

$apply = in_array('--apply', array_slice($argv, 1), true);
$db    = getDB();

$rows = $db->query(
    "SELECT id, stored_path, mime_type, file_size
       FROM encrypted_files
      WHERE mime_type IN ('video/mp4','audio/mp4')
      ORDER BY id"
)->fetchAll();

if (!$rows) {
    echo "Tidak ada file MP4/M4A di database.\n";
    exit(0);
}

$moved = 0;
$skip  = 0;
$fail  = 0;

foreach ($rows as $row) {
    $current = $row['stored_path'];
    $ext     = pathinfo($current, PATHINFO_EXTENSION);

    if ($ext === 'm4a') {
        echo "[SKIP] #{$row['id']} $current - sudah .m4a\n";
        $skip++;
        continue;
    }

    $target = preg_replace('/\.[^.]+$/', '.m4a', $current);
    $dir    = storagePath('private', 'encrypted-files');
    $src    = $dir . DIRECTORY_SEPARATOR . $current;
    $dst    = $dir . DIRECTORY_SEPARATOR . $target;

    if (!is_file($src)) {
        echo "[FAIL] #{$row['id']} - file sumber tidak ada: $src\n";
        $fail++;
        continue;
    }

    if (is_file($dst)) {
        echo "[FAIL] #{$row['id']} - tujuan sudah ada: $target\n";
        $fail++;
        continue;
    }

    if (!$apply) {
        echo "[DRY]  #{$row['id']} $current → $target\n";
        $moved++;
        continue;
    }

    if (!rename($src, $dst)) {
        echo "[FAIL] #{$row['id']} - gagal rename\n";
        $fail++;
        continue;
    }

    @chmod($dst, 0600);

    $upd = $db->prepare('UPDATE encrypted_files SET stored_path = ? WHERE id = ?');
    $upd->execute([$target, $row['id']]);

    echo "[OK]   #{$row['id']} $current → $target\n";
    $moved++;
}

echo "\nRingkasan: $moved diproses, $skip sudah benar, $fail gagal.\n";
if (!$apply && $moved > 0) {
    echo "Dry-run. Jalankan dengan --apply untuk eksekusi.\n";
}

exit($fail > 0 ? 1 : 0);
