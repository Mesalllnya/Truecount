
<?php

require_once __DIR__ . '/backend/services/crypto/EncryptedMessageService.php';

try {
    // Ganti dengan ID user yang benar-benar ada di tabel users.
    $userId = 1;

    $message = "Pesan rahasia TrueCount";

    echo "=== ENCRYPT AND STORE ===\n";

    $messageId = EncryptedMessageService::encryptAndStore(
        $userId,
        $message
    );

    echo "Message ID: " . $messageId . "\n";
    echo "Status: BERHASIL DISIMPAN\n";

    echo "\n=== DECRYPT FROM DATABASE ===\n";

    $decrypted = EncryptedMessageService::decryptById(
        $messageId,
        $userId
    );

    echo "Hasil dekripsi: " . $decrypted . "\n";

    echo "\nStatus: ";

    echo ($message === $decrypted)
        ? "BERHASIL\n"
        : "GAGAL\n";

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}


echo "\n=== UNAUTHORIZED ACCESS TEST ===\n";

try {
    // Simulasikan user lain mencoba membaca pesan user 1
    $unauthorizedUserId = 999;

    EncryptedMessageService::decryptById(
        3,
        $unauthorizedUserId
    );

    echo "GAGAL: Akses tidak sah berhasil!\n";

} catch (RuntimeException $e) {
    echo "BERHASIL: Akses ditolak!\n";
    echo $e->getMessage() . "\n";
}