<?php

require_once __DIR__ . '/../../backend/services/crypto/FileEncryptionService.php';

function test(string $name, bool $condition): void
{
    echo ($condition ? "[PASS] " : "[FAIL] ") . $name . PHP_EOL;
}

$userId = 1;
$originalContent = "Ini adalah file rahasia TrueCount.\n";
$originalName = "secret-test.txt";

$tmpPath = tempnam(sys_get_temp_dir(), 'truecount_');
file_put_contents($tmpPath, $originalContent);

echo "=== FILE ENCRYPTION TEST ===\n";

try {
    // 1. Enkripsi dan simpan file.
    $fileId = FileEncryptionService::encryptAndStore(
        $userId,
        $tmpPath,
        $originalName
    );

    test("File berhasil dienkripsi dan disimpan", $fileId > 0);

    echo "File ID: " . $fileId . PHP_EOL;

    // 2. Dekripsi file.
    $decrypted = FileEncryptionService::decryptById(
        $fileId,
        $userId
    );

    test(
        "Nama file sesuai",
        $decrypted['original_name'] === $originalName
    );

    test(
        "Ukuran file sesuai",
        $decrypted['file_size'] === strlen($originalContent)
    );

    test(
        "Isi file hasil dekripsi sesuai",
        $decrypted['content'] === $originalContent
    );

    echo "MIME Type: " . $decrypted['mime_type'] . PHP_EOL;

    // 3. Uji akses user lain.
    try {
        FileEncryptionService::decryptById($fileId, 999);
        test("Akses user lain ditolak", false);
    } catch (RuntimeException $e) {
        test("Akses user lain ditolak", true);
    }

} catch (Throwable $e) {
    echo "[ERROR] " . $e->getMessage() . PHP_EOL;

} finally {
    if (is_file($tmpPath)) {
        unlink($tmpPath);
    }
}

echo "\n=== TEST SELESAI ===\n";
