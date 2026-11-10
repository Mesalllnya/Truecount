<?php

require_once __DIR__ . '/../../backend/services/crypto/FileEncryptionService.php';

function test(string $name, bool $condition): void
{
    echo ($condition ? "[PASS] " : "[FAIL] ") . $name . PHP_EOL;
}

$userId = 1;
$tmpPath = tempnam(sys_get_temp_dir(), 'truecount_');

file_put_contents($tmpPath, "File rahasia untuk pengujian tampering.");

$fileId = null;
$storedPath = null;
$originalCiphertext = null;

echo "=== FILE TAMPERING TEST ===\n";

try {
    // Enkripsi file.
    $fileId = FileEncryptionService::encryptAndStore(
        $userId,
        $tmpPath,
        'tampering-test.txt'
    );

    // Ambil metadata lokasi file dari database.
    $db = getDB();

    $stmt = $db->prepare(
        "SELECT stored_path FROM encrypted_files
         WHERE id = :id AND user_id = :user_id"
    );

    $stmt->execute([
        ':id' => $fileId,
        ':user_id' => $userId
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        throw new RuntimeException('Metadata file tidak ditemukan.');
    }

    $storageDirectory = dirname(__DIR__, 2)
        . DIRECTORY_SEPARATOR . 'backend'
        . DIRECTORY_SEPARATOR . 'storage'
        . DIRECTORY_SEPARATOR . 'private'
        . DIRECTORY_SEPARATOR . 'encrypted-files';

    $storedPath = $storageDirectory
        . DIRECTORY_SEPARATOR . $row['stored_path'];

    $originalCiphertext = file_get_contents($storedPath);

    if ($originalCiphertext === false || strlen($originalCiphertext) === 0) {
        throw new RuntimeException('Ciphertext tidak valid.');
    }

    // Ubah satu bit ciphertext.
    $tampered = $originalCiphertext;
    $tampered[0] = chr(ord($tampered[0]) ^ 1);

    file_put_contents($storedPath, $tampered, LOCK_EX);

    echo "Ciphertext berhasil dimodifikasi.\n";

    // Coba dekripsi file yang telah dimodifikasi.
    try {
        FileEncryptionService::decryptById($fileId, $userId);

        test("Tampering berhasil dideteksi", false);

    } catch (RuntimeException $e) {
        test("Tampering berhasil dideteksi", true);
        echo "Pesan: " . $e->getMessage() . PHP_EOL;
    }

} catch (Throwable $e) {
    echo "[ERROR] " . $e->getMessage() . PHP_EOL;

} finally {
    // Pulihkan ciphertext asli agar storage tidak rusak.
    if ($storedPath !== null && $originalCiphertext !== null) {
        file_put_contents($storedPath, $originalCiphertext, LOCK_EX);
        echo "Ciphertext asli berhasil dipulihkan.\n";
    }

    if (is_file($tmpPath)) {
        unlink($tmpPath);
    }
}

echo "\n=== TEST SELESAI ===\n";
