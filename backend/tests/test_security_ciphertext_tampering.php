<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/crypto/ChaCha20Poly1305Service.php';

echo "=== CIPHERTEXT TAMPERING TEST ===\n\n";

$fileId = 12;
$userId = 5;

$db = getDB();

$stmt = $db->prepare(
    'SELECT stored_path, file_hash, nonce, auth_tag
     FROM encrypted_files
     WHERE id = ? AND user_id = ?
     LIMIT 1'
);
$stmt->execute([$fileId, $userId]);
$file = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$file) {
    die("[ERROR] Encrypted file tidak ditemukan.\n");
}

$storageDir = __DIR__ . '/../storage/private/encrypted-files';
$originalPath = $storageDir . DIRECTORY_SEPARATOR . $file['stored_path'];

if (!is_file($originalPath)) {
    die("[ERROR] File asli tidak ditemukan.\n");
}

$originalCipher = file_get_contents($originalPath);

if ($originalCipher === false || strlen($originalCipher) === 0) {
    die("[ERROR] Gagal membaca ciphertext.\n");
}

// Buat salinan sementara
$tamperedCipher = $originalCipher;

// Ubah satu bit pada byte pertama
$tamperedCipher[0] = chr(ord($tamperedCipher[0]) ^ 0x01);

$tempPath = tempnam(sys_get_temp_dir(), 'tc_cipher_');

try {
    file_put_contents($tempPath, $tamperedCipher);

    echo "[1] Original SHA-256: "
        . hash('sha256', $originalCipher) . "\n";

    echo "[2] Tampered SHA-256: "
        . hash_file('sha256', $tempPath) . "\n";

    // Verifikasi hash
    $actualHash = hash_file('sha256', $tempPath);

    if (hash_equals($file['file_hash'], $actualHash)) {
        throw new RuntimeException(
            'Hash tetap cocok setelah ciphertext diubah.'
        );
    }

    echo "[PASS] SHA-256 mendeteksi perubahan ciphertext.\n";

    // Uji autentikasi AEAD secara langsung.
    // AAD sama dengan konteks file milik user 5.
    $decryptRejected = false;

    try {
        ChaCha20Poly1305Service::decrypt(
            base64_encode($tamperedCipher),
            $file['nonce'],
            $file['auth_tag'],
            'truecount:file:v1:user:' . $userId
        );
    } catch (Throwable $e) {
        $decryptRejected = true;
        echo "[PASS] AEAD menolak ciphertext yang dimodifikasi.\n";
        echo "Reason: " . $e->getMessage() . "\n";
    }

    if (!$decryptRejected) {
        throw new RuntimeException(
            'AEAD tidak menolak ciphertext yang dimodifikasi.'
        );
    }

    echo "\n=== CIPHERTEXT TAMPERING TEST PASSED ===\n";

} catch (Throwable $e) {
    echo "\n[FAIL] " . $e->getMessage() . "\n";
    exit(1);

} finally {
    if (is_file($tempPath)) {
        unlink($tempPath);
    }
}
