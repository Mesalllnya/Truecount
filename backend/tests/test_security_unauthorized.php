<?php

/**
 * TrueCount - Unauthorized Access Test
 *
 * Memastikan dekripsi file terenkripsi DITOLAK ketika dipanggil dengan
 * user ID yang bukan pemiliknya. File diambil dinamis dari database
 * (voice message / file lain yang masih memakai jalur terenkripsi).
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/crypto/FileEncryptionService.php';

echo "=== UNAUTHORIZED ACCESS TEST ===\n\n";

$db = getDB();

$file = $db->query(
    'SELECT id, user_id FROM encrypted_files ORDER BY id ASC LIMIT 1'
)->fetch(PDO::FETCH_ASSOC);

if (!$file) {
    echo "[SKIP] Tidak ada encrypted file di database.\n";
    exit(0);
}

$fileId        = (int) $file['id'];
$wrongUserId   = 999999;

echo "File uji: #{$fileId} (pemilik user #{$file['user_id']})\n\n";

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
