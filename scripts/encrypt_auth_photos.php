<?php

/**
 * One-time migrasi: enkripsi foto log keamanan yang masih plain (belum punya
 * file sampingan .meta.json) di backend/storage/auth_photos/.
 *
 * Path/file lama TIDAK diubah (nama file tetap sama), sehingga kolom
 * `photo_path` di tabel `auth_attempts` tetap valid dan database tidak ancur.
 * Hanya isi file yang diganti dengan ciphertext AES-256-GCM, ditambah
 * file sampingan <nama>.jpg.meta.json yang berisi nonce + auth tag.
 *
 * Penggunaan: php scripts/encrypt_auth_photos.php
 * (Pastikan ENCRYPTION_KEY_B64 sudah diisi di .env)
 */

require_once __DIR__ . '/../backend/config/env.php';
require_once __DIR__ . '/../backend/helpers/storage.php';
require_once __DIR__ . '/../backend/services/crypto/AESGCMService.php';

const META_SUFFIX = '.meta.json';

$dir = storagePath('auth_photos');
if (!is_dir($dir)) {
    echo "Folder $dir tidak ada. Tidak ada foto untuk di-migrasi.\n";
    exit(0);
}

$files = glob($dir . DIRECTORY_SEPARATOR . '*.jpg');
if (!$files) {
    echo "Tidak ada file .jpg di $dir.\n";
    exit(0);
}

$encrypted = 0;
$skipped = 0;
$errors = [];

foreach ($files as $file) {
    $metaPath = $file . META_SUFFIX;

    // Sudah terenkripsi (punya metadata), lewati (idempotent).
    if (is_file($metaPath)) {
        $skipped++;
        continue;
    }

    $plaintext = @file_get_contents($file);
    if ($plaintext === false) {
        $errors[] = $file . ': gagal membaca';
        continue;
    }

    try {
        $encryptedData = AESGCMService::encrypt($plaintext);
        $cipherRaw = base64_decode($encryptedData['ciphertext'], true);
        if ($cipherRaw === false) {
            throw new RuntimeException('ciphertext invalid');
        }

        // Tulis ulang ke file yang SAMA (path tidak berubah).
        if (file_put_contents($file, $cipherRaw, LOCK_EX) === false) {
            throw new RuntimeException('gagal menulis file');
        }
        @chmod($file, 0600);

        $meta = [
            'algorithm' => 'AES-256-GCM',
            'nonce'     => $encryptedData['nonce'],
            'tag'       => $encryptedData['tag'],
        ];
        if (file_put_contents($metaPath, json_encode($meta), LOCK_EX) === false) {
            throw new RuntimeException('gagal menulis metadata');
        }
        @chmod($metaPath, 0600);

        $encrypted++;
        echo "[OK] " . basename($file) . "\n";
    } catch (Throwable $e) {
        $errors[] = basename($file) . ': ' . $e->getMessage();
    }
}

echo "\n=== Hasil migrasi ===\n";
echo "Terkonversi : $encrypted\n";
echo "Dilewati    : $skipped (sudah terenkripsi)\n";
echo "Error       : " . count($errors) . "\n";
foreach ($errors as $e) {
    echo "  - $e\n";
}
