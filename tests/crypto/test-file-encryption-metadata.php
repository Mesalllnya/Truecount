<?php

/**
 * DB-06 Integration Test
 * FileEncryption Metadata and Integrity
 *
 * Test cases:
 * 1. Enkripsi dan penyimpanan metadata
 * 2. Dekripsi normal dan validasi file_size
 * 3. Unauthorized user access
 * 4. Ciphertext tampering
 * 5. File size metadata tampering
 * 6. User ID tampering / AAD validation
 *
 * Jalankan dari root project:
 * php tests/crypto/test-file-encryption-metadata.php
 */

require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/services/crypto/ChaCha20Poly1305Service.php';
require_once __DIR__ . '/../../backend/services/crypto/FileEncryptionService.php';

function assertTest(string $name, bool $condition): void
{
    if (!$condition) {
        throw new RuntimeException('[FAIL] ' . $name);
    }

    echo '[PASS] ' . $name . PHP_EOL;
}

function assertThrows(
    string $name,
    callable $callback,
    string $expectedText = ''
): void {
    try {
        $callback();
    } catch (Throwable $e) {
        if (
            $expectedText !== '' &&
            stripos($e->getMessage(), $expectedText) === false
        ) {
            throw new RuntimeException(
                '[FAIL] ' . $name .
                ' — error tidak sesuai: ' . $e->getMessage()
            );
        }

        echo '[PASS] ' . $name . PHP_EOL;
        echo '       Rejected: ' . $e->getMessage() . PHP_EOL;
        return;
    }

    throw new RuntimeException(
        '[FAIL] ' . $name . ' — operasi seharusnya ditolak.'
    );
}

$db = getDB();

$ownerId = 1;
$otherUserId = 3;

$tempPlaintextPath = tempnam(sys_get_temp_dir(), 'tc_db06_');

$storedCipherPath = null;
$testFileId = null;

$testFailed = false;
$passed = 0;

echo "=== DB-06 FILE ENCRYPTION METADATA & INTEGRITY TEST ===" . PHP_EOL;

try {

    /*
     * Persiapan file pengujian.
     */
    if ($tempPlaintextPath === false) {
        throw new RuntimeException(
            'Gagal membuat temporary file.'
        );
    }

    $plaintext = "TrueCount DB-06 metadata integrity test.\n"
        . "Testing ChaCha20-Poly1305, AAD, SHA-256, and file_size.";

    if (file_put_contents($tempPlaintextPath, $plaintext) === false) {
        throw new RuntimeException(
            'Gagal menulis temporary file.'
        );
    }

    /*
     * Pastikan akun testing tersedia.
     */
    $usersStmt = $db->prepare(
        'SELECT id FROM users WHERE id IN (:owner_id, :other_id)'
    );

    $usersStmt->execute([
        ':owner_id' => $ownerId,
        ':other_id' => $otherUserId
    ]);

    $users = array_map(
        'intval',
        $usersStmt->fetchAll(PDO::FETCH_COLUMN)
    );

    if (
        !in_array($ownerId, $users, true) ||
        !in_array($otherUserId, $users, true)
    ) {
        throw new RuntimeException(
            'Akun testing ID 1 dan ID 3 harus tersedia.'
        );
    }

    /*
     * Seluruh perubahan database di-rollback.
     */
    $db->beginTransaction();

    // ==========================================
    // TEST 1: ENCRYPTION AND METADATA
    // ==========================================

    echo PHP_EOL . "--- TEST 1: ENCRYPTION AND METADATA ---" . PHP_EOL;

    $testFileId = FileEncryptionService::encryptAndStore(
        $ownerId,
        $tempPlaintextPath,
        'db06-test.txt'
    );

    $metadataStmt = $db->prepare(
        'SELECT
            stored_path,
            file_size,
            file_hash,
            algorithm
         FROM encrypted_files
         WHERE id = :id'
    );

    $metadataStmt->execute([
        ':id' => $testFileId
    ]);

    $metadata = $metadataStmt->fetch(PDO::FETCH_ASSOC);

    if (!$metadata) {
        throw new RuntimeException(
            'Metadata file test tidak ditemukan.'
        );
    }

    /*
     * Lokasi private storage:
     * backend/storage/private/encrypted-files/
     */
    $storageDirectory = dirname(__DIR__, 2)
        . DIRECTORY_SEPARATOR . 'backend'
        . DIRECTORY_SEPARATOR . 'storage'
        . DIRECTORY_SEPARATOR . 'private'
        . DIRECTORY_SEPARATOR . 'encrypted-files';

    $storedCipherPath = $storageDirectory
        . DIRECTORY_SEPARATOR . $metadata['stored_path'];

    assertTest(
        'File terenkripsi tersimpan dengan metadata konsisten',
        (int) $metadata['file_size'] === strlen($plaintext)
            && preg_match(
                '/^[a-f0-9]{64}$/i',
                $metadata['file_hash']
            ) === 1
            && $metadata['algorithm'] === 'chacha20'
            && is_file($storedCipherPath)
    );

    $passed++;

    // ==========================================
    // TEST 2: NORMAL DECRYPTION AND SIZE
    // ==========================================

    echo PHP_EOL . "--- TEST 2: NORMAL DECRYPTION AND SIZE ---" . PHP_EOL;

    $decrypted = FileEncryptionService::decryptById(
        $testFileId,
        $ownerId
    );

    assertTest(
        'Dekripsi berhasil dan ukuran plaintext cocok dengan file_size',
        hash_equals($plaintext, $decrypted['content'])
            && $decrypted['file_size'] === strlen($plaintext)
            && $decrypted['original_name'] === 'db06-test.txt'
    );

    $passed++;

    // ==========================================
    // TEST 3: UNAUTHORIZED USER
    // ==========================================

    echo PHP_EOL . "--- TEST 3: UNAUTHORIZED USER ---" . PHP_EOL;

    assertThrows(
        'User lain tidak dapat mengakses file',
        function () use ($testFileId, $otherUserId): void {
            FileEncryptionService::decryptById(
                $testFileId,
                $otherUserId
            );
        },
        'tidak ditemukan atau tidak memiliki akses'
    );

    $passed++;

    // ==========================================
    // TEST 4: CIPHERTEXT TAMPERING
    // ==========================================

    echo PHP_EOL . "--- TEST 4: CIPHERTEXT TAMPERING ---" . PHP_EOL;

    $originalCiphertext = file_get_contents($storedCipherPath);

    if (
        $originalCiphertext === false ||
        strlen($originalCiphertext) === 0
    ) {
        throw new RuntimeException(
            'Ciphertext test tidak dapat dibaca.'
        );
    }

    // Ubah satu bit pada ciphertext.
    $tamperedCiphertext = $originalCiphertext;

    $tamperedCiphertext[0] = chr(
        ord($tamperedCiphertext[0]) ^ 1
    );

    if (
        file_put_contents(
            $storedCipherPath,
            $tamperedCiphertext,
            LOCK_EX
        ) === false
    ) {
        throw new RuntimeException(
            'Gagal membuat simulasi ciphertext tampering.'
        );
    }

    try {
        assertThrows(
            'Modifikasi ciphertext terdeteksi oleh SHA-256',
            function () use ($testFileId, $ownerId): void {
                FileEncryptionService::decryptById(
                    $testFileId,
                    $ownerId
                );
            },
            'ciphertext telah dimodifikasi'
        );

        $passed++;

    } finally {
        // Pulihkan ciphertext asli.
        if (
            file_put_contents(
                $storedCipherPath,
                $originalCiphertext,
                LOCK_EX
            ) === false
        ) {
            throw new RuntimeException(
                'Gagal memulihkan ciphertext asli.'
            );
        }
    }

    // ==========================================
    // TEST 5: FILE SIZE METADATA TAMPERING
    // ==========================================

    echo PHP_EOL . "--- TEST 5: FILE SIZE METADATA TAMPERING ---" . PHP_EOL;

    $tamperSizeStmt = $db->prepare(
        'UPDATE encrypted_files
         SET file_size = :size
         WHERE id = :id'
    );

    $tamperSizeStmt->execute([
        ':size' => strlen($plaintext) + 10,
        ':id'   => $testFileId
    ]);

    assertThrows(
        'Manipulasi metadata file_size terdeteksi setelah dekripsi',
        function () use ($testFileId, $ownerId): void {
            FileEncryptionService::decryptById(
                $testFileId,
                $ownerId
            );
        },
        'ukuran plaintext tidak sesuai'
    );

    $passed++;

    /*
     * Pulihkan metadata sebelum pengujian AAD.
     */
    $restoreSizeStmt = $db->prepare(
        'UPDATE encrypted_files
         SET file_size = :size
         WHERE id = :id'
    );

    $restoreSizeStmt->execute([
        ':size' => strlen($plaintext),
        ':id'   => $testFileId
    ]);

    // ==========================================
    // TEST 6: OWNER METADATA TAMPERING / AAD
    // ==========================================

    echo PHP_EOL . "--- TEST 6: OWNER METADATA TAMPERING / AAD ---" . PHP_EOL;

    $changeOwnerStmt = $db->prepare(
        'UPDATE encrypted_files
         SET user_id = :other_id
         WHERE id = :id'
    );

    $changeOwnerStmt->execute([
        ':other_id' => $otherUserId,
        ':id'       => $testFileId
    ]);

    assertThrows(
        'Perubahan user_id tidak dapat membuka ciphertext dengan AAD pemilik lama',
        function () use ($testFileId, $otherUserId): void {
            FileEncryptionService::decryptById(
                $testFileId,
                $otherUserId
            );
        },
        'data tidak valid'
    );

    $passed++;

    // ==========================================
    // TEST SUMMARY
    // ==========================================

    echo PHP_EOL . "=== HASIL: {$passed}/6 TEST PASS ===" . PHP_EOL;

} catch (Throwable $e) {

    $testFailed = true;

    echo PHP_EOL . '[ERROR] ' . $e->getMessage() . PHP_EOL;

} finally {

    /*
     * Rollback semua perubahan database.
     */
    if ($db->inTransaction()) {
        $db->rollBack();

        echo '[CLEANUP] Transaksi database di-rollback.'
            . PHP_EOL;
    }

    /*
     * File fisik tidak ikut rollback SQL.
     * Hapus ciphertext test secara manual.
     */
    if (
        $storedCipherPath !== null &&
        is_file($storedCipherPath)
    ) {
        if (!unlink($storedCipherPath)) {
            $testFailed = true;

            echo '[CLEANUP WARNING] Gagal menghapus file ciphertext test.'
                . PHP_EOL;
        } else {
            echo '[CLEANUP] File ciphertext test dihapus.'
                . PHP_EOL;
        }
    }

    /*
     * Hapus temporary plaintext.
     */
    if (
        is_string($tempPlaintextPath) &&
        is_file($tempPlaintextPath)
    ) {
        unlink($tempPlaintextPath);
    }
}

if ($testFailed) {
    exit(1);
}

echo "=== DB-06 TEST SELESAI ===" . PHP_EOL;
