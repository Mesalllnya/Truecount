<?php

/**
 * Re-migrasi: ubah foto terenkripsi format lama (ciphertext-only +
 * file sampingan .meta.json) ke format baru single-file
 * [nonce 12B][tag 16B][ciphertext] dalam satu .jpg, lalu hapus .meta.json.
 *
 * Path/nama file TIDAK berubah, kolom photo_path di database tetap utuh.
 * Idempotent: aman dijalankan berulang.
 *
 * Sinyal format lama = ada file .meta.json di samping .jpg.
 *
 * Penggunaan: php scripts/reencrypt_auth_photos.php
 */

require_once __DIR__ . '/../backend/config/env.php';
require_once __DIR__ . '/../backend/helpers/storage.php';
require_once __DIR__ . '/../backend/services/crypto/AESGCMService.php';

const META_SUFFIX = '.meta.json';
const NONCE_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = NONCE_LEN + TAG_LEN; // 28

$dir = storagePath('auth_photos');
if (!is_dir($dir)) {
    echo "Folder $dir tidak ada.\n";
    exit(0);
}

$files = glob($dir . DIRECTORY_SEPARATOR . '*.jpg');
if (!$files) {
    echo "Tidak ada file .jpg di $dir.\n";
    exit(0);
}

$converted = 0;
$skipped = 0;
$errors = [];

foreach ($files as $file) {
    $metaPath = $file . META_SUFFIX;
    $raw = @file_get_contents($file);
    if ($raw === false) {
        $errors[] = basename($file) . ': gagal membaca';
        continue;
    }

    // Format lama (ada metadata sampingan): perlu dikonversi ke single-file.
    if (is_file($metaPath) && is_readable($metaPath)) {
        $meta = json_decode(@file_get_contents($metaPath), true);
        if (!is_array($meta) || !isset($meta['nonce'], $meta['tag'])) {
            $errors[] = basename($file) . ': metadata tidak valid';
            continue;
        }

        $nonceRaw = base64_decode((string)$meta['nonce'], true);
        $tagRaw   = base64_decode((string)$meta['tag'], true);

        if ($nonceRaw === false || $tagRaw === false ||
            strlen($nonceRaw) !== NONCE_LEN || strlen($tagRaw) !== TAG_LEN) {
            $errors[] = basename($file) . ': nonce/tag tidak valid';
            continue;
        }

        // Susun ulang menjadi satu file: [nonce][tag][ciphertext]
        $newContent = $nonceRaw . $tagRaw . $raw;
        if (file_put_contents($file, $newContent, LOCK_EX) === false) {
            $errors[] = basename($file) . ': gagal menulis ulang';
            continue;
        }
        @chmod($file, 0600);

        // Hapus sidecar lama.
        @unlink($metaPath);

        $converted++;
        echo "[OK] " . basename($file) . "\n";
        continue;
    }

    // Tidak ada metadata sampingan.
    if (strlen($raw) >= 3 && substr($raw, 0, 3) === "\xff\xd8\xff") {
        // Foto asli (legacy plain JPEG), biarkan utuh.
        $skipped++;
        continue;
    }

    // Tidak ada meta dan bukan awalan JPEG -> sudah format single-file baru.
    $skipped++;
    continue;
}

echo "\n=== Hasil re-migrasi ===\n";
echo "Dikonversi  : $converted\n";
echo "Dilewati    : $skipped\n";
echo "Error       : " . count($errors) . "\n";
foreach ($errors as $e) {
    echo "  - $e\n";
}
