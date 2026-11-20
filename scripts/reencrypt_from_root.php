<?php

/**
 * Re-encrypt ulang semua foto dari root storage (plain JPEG) ke backend storage
 * dengan format single-file [nonce][tag][ciphertext] yang benar.
 *
 * Digunakan setelah migrasi format enkripsi berubah.
 */

require_once __DIR__ . '/../backend/config/env.php';
require_once __DIR__ . '/../backend/helpers/storage.php';
require_once __DIR__ . '/../backend/helpers/auth_photo.php';

$rootDir  = __DIR__ . '/../storage/auth_photos';      // JPEG asli
$targetDir = storagePath('auth_photos');              // backend storage (target)

if (!is_dir($rootDir)) {
    echo "Root dir $rootDir tidak ada.\n";
    exit(1);
}

if (!is_dir($targetDir)) {
    echo "Target dir $targetDir tidak ada.\n";
    exit(1);
}

$files = glob($rootDir . DIRECTORY_SEPARATOR . '*.jpg');
if (!$files) {
    echo "Tidak ada file .jpg di $rootDir\n";
    exit(0);
}

$converted = 0;
$skipped = 0;
$errors = [];

foreach ($files as $srcFile) {
    $filename = basename($srcFile);
    $targetFile = $targetDir . DIRECTORY_SEPARATOR . $filename;

    // Baca JPEG asli
    $plain = @file_get_contents($srcFile);
    if ($plain === false) {
        $errors[] = $filename . ': gagal membaca file asli';
        continue;
    }

    // Validasi itu JPEG asli (header FF D8 FF)
    if (strlen($plain) < 3 || substr($plain, 0, 3) !== "\xff\xd8\xff") {
        $errors[] = $filename . ': bukan JPEG valid (header: ' . bin2hex(substr($plain, 0, 3)) . ')';
        continue;
    }

    try {
        // Enkripsi ulang dengan format benar
        $saved = encryptAuthPhoto($plain, $targetDir);

        // Verifikasi file target ada dan bisa didekripsi
        $actualTarget = $targetDir . DIRECTORY_SEPARATOR . basename($saved);
        $decrypted = decryptAuthPhoto($actualTarget);
        if (strlen($decrypted) < 3 || substr($decrypted, 0, 3) !== "\xff\xd8\xff") {
            throw new RuntimeException('Verifikasi dekripsi gagal');
        }

        $converted++;
        echo "[OK] $filename\n";
    } catch (Throwable $e) {
        $errors[] = $filename . ': ' . $e->getMessage();
    }
}

echo "\n=== Hasil re-encrypt ===\n";
echo "Berhasil    : $converted\n";
echo "Dilewati    : $skipped\n";
echo "Error       : " . count($errors) . "\n";
foreach ($errors as $e) {
    echo "  - $e\n";
}