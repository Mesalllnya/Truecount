<?php

/**
 * Script pembersihan referensi foto log keamanan yang hilang.
 *
 * Masalah: beberapa baris di tabel `auth_attempts` memiliki `photo_path` yang
 * merujuk ke file gambar yang sudah tidak ada di storage (bukan di
 * `backend/storage/auth_photos/` dan bukan di root `storage/`). Akibatnya,
 * halaman Log Keamanan menampilkan error "Foto tidak ditemukan di penyimpanan."
 *
 * Script ini:
 *  1. Mengecek setiap `photo_path` di `auth_attempts`.
 *  2. Jika file fisik tidak ada di storage root, mengosongkan `photo_path`
 *     (NULL) di database sehingga frontend menampilkan placeholder kamera
 *     kosong alih-ang error alert.
 *  3. Tidak menghapus baris log itu sendiri — hanya menghapus referensi foto.
 *
 * Penggunaan:
 *   php scripts/cleanup_missing_auth_photos.php
 *
 * Opsi --apply diperlukan untuk benar-benar mengupdate database. Tanpa
 * opsi ini, script hanya menjalankan dry-run (menampilkan apa saja yang
 * akan diubah).
 */

require_once __DIR__ . '/../backend/config/env.php';
require_once __DIR__ . '/../backend/helpers/storage.php';
require_once __DIR__ . '/../backend/config/database.php';

$apply = in_array('--apply', $argv);

$db = getDB();

$stmt = $db->query('SELECT id, photo_path FROM auth_attempts WHERE photo_path IS NOT NULL ORDER BY id');

$checked = 0;
$missing = 0;
$updated = 0;

while ($r = $stmt->fetch()) {
    $checked++;
    $filename = basename($r['photo_path']);
    $file     = realpath(storagePath('auth_photos') . DIRECTORY_SEPARATOR . $filename);

    $exists = ($file !== false && is_file($file));

    if (!$exists) {
        $missing++;
        echo "MISSING: id={$r['id']} photo_path={$r['photo_path']}\n";

        if ($apply) {
            $upd = $db->prepare(
                'UPDATE auth_attempts SET photo_path = NULL WHERE id = ?'
            );
            $upd->execute([$r['id']]);
            $updated++;
            echo "  -> photo_path dikosongkan (id={$r['id']})\n";
        }
    }
}

echo "\n=== Ringkasan ===\n";
echo "Dicek       : $checked\n";
echo "File hilang : $missing\n";
if ($apply) {
    echo "Diupdate    : $updated\n";
} else {
    echo "Mode        : dry-run (gunakan --apply untuk update database)\n";
}

exit(0);
