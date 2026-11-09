
<?php

require_once __DIR__ . '/../../backend/services/crypto/EncryptedMessageService.php';
require_once __DIR__ . '/../../backend/config/database.php';

$messageId = 4;
$userId = 1;

$db = getDB();
$detected = false;

echo "=== DATABASE TAMPERING TEST ===\n";

try {
    // Mulai transaksi agar perubahan bisa dibatalkan
    $db->beginTransaction();

    // Ambil ciphertext asli
    $stmt = $db->prepare(
        "SELECT ciphertext FROM encrypted_messages WHERE id = :id AND user_id = :user_id"
    );

    $stmt->execute([
        ':id' => $messageId,
        ':user_id' => $userId
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        throw new RuntimeException('Pesan tidak ditemukan.');
    }

    // Modifikasi satu bit ciphertext
    $raw = base64_decode($row['ciphertext'], true);

    if ($raw === false || strlen($raw) === 0) {
        throw new RuntimeException('Ciphertext tidak valid.');
    }

    $raw[0] = chr(ord($raw[0]) ^ 1);
    $tampered = base64_encode($raw);

    // Simpan ciphertext yang telah dimodifikasi
    $update = $db->prepare(
        "UPDATE encrypted_messages
        SET ciphertext = :ciphertext
        WHERE id = :id"
    );

    $update->execute([
        ':ciphertext' => $tampered,
        ':id' => $messageId
    ]);

    echo "Ciphertext berhasil dimodifikasi.\n";

    // Coba dekripsi
    try {
        EncryptedMessageService::decryptById(
            $messageId,
            $userId
        );

        echo "GAGAL: Ciphertext yang dimodifikasi diterima!\n";

    } catch (RuntimeException $e) {
        $detected = true;

        echo "BERHASIL: Tampering terdeteksi!\n";
        echo "Pesan: " . $e->getMessage() . "\n";
    }

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";

} finally {
    // Batalkan perubahan ciphertext agar data asli tetap utuh
    if ($db->inTransaction()) {
        $db->rollBack();
        echo "Database di-rollback ke kondisi semula.\n";
    }
}

echo "\nStatus: " . ($detected ? "PASS" : "FAIL") . "\n";
