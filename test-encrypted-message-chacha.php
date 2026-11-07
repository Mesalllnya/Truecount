<?php

require_once __DIR__ .
    '/backend/services/crypto/EncryptedMessageService.php';

echo "=== CHACHA20 DATABASE INTEGRATION TEST ===\n\n";

$userId = 1;
$message = "Pesan ChaCha20 dari TrueCount";

try {
    // Encrypt dan simpan.
    $messageId = EncryptedMessageService::encryptAndStore(
        $userId,
        $message,
        'chacha20'
    );

    echo "Message ID: " . $messageId . "\n";
    echo "Status penyimpanan: BERHASIL\n";

    // Ambil dan decrypt.
    $decrypted = EncryptedMessageService::decryptById(
        $messageId,
        $userId
    );

    echo "\nHasil dekripsi: " . $decrypted . "\n";

    if ($decrypted !== $message) {
        throw new RuntimeException(
            'Hasil dekripsi tidak cocok.'
        );
    }

    echo "\nStatus: PASS\n";

} catch (Throwable $e) {
    echo "\nERROR: " . $e->getMessage() . "\n";
}
