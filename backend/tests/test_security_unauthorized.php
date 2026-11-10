<?php

require_once __DIR__ . '/../services/crypto/FileEncryptionService.php';

echo "=== UNAUTHORIZED ACCESS TEST ===\n\n";

$fileId = 12;
$wrongUserId = 999999;

try {
    FileEncryptionService::decryptById($fileId, $wrongUserId);

    echo "[FAIL] User tidak berhak berhasil mendekripsi file!\n";
    exit(1);

} catch (RuntimeException $e) {
    echo "[PASS] Unauthorized access ditolak.\n";
    echo "Reason: " . $e->getMessage() . "\n";

} catch (Throwable $e) {
    echo "[ERROR] " . $e->getMessage() . "\n";
    exit(1);
}
