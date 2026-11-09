<?php

/**
 * Integration test for EncryptedMessageService AAD.
 *
 * Jalankan dari root project:
 *   & "D:\xampp\php\php.exe" tests/crypto/test-encrypted-message-aad.php
 *
 * Semua record test dibuat dalam transaksi dan di-ROLLBACK,
 * sehingga database kembali ke kondisi semula.
 */

require_once __DIR__ . '/../../backend/config/database.php';
require_once __DIR__ . '/../../backend/services/crypto/AESGCMService.php';
require_once __DIR__ . '/../../backend/services/crypto/ChaCha20Poly1305Service.php';
require_once __DIR__ . '/../../backend/services/crypto/EncryptedMessageService.php';

function assertTest(string $name, bool $condition): void
{
    if (!$condition) {
        throw new RuntimeException('[FAIL] ' . $name);
    }

    echo '[PASS] ' . $name . PHP_EOL;
}

function assertThrows(string $name, callable $callback): void
{
    try {
        $callback();
    } catch (Throwable $e) {
        echo '[PASS] ' . $name . PHP_EOL;
        echo '       Rejected: ' . $e->getMessage() . PHP_EOL;
        return;
    }

    throw new RuntimeException('[FAIL] ' . $name . ' — operasi seharusnya ditolak.');
}

$db = getDB();

$ownerId = 1;
$otherUserId = 3;
$testMessageIds = [];
$passed = 0;

echo "=== ENCRYPTED MESSAGE AAD INTEGRATION TEST ===" . PHP_EOL;
echo "Owner user ID : {$ownerId}" . PHP_EOL;
echo "Other user ID : {$otherUserId}" . PHP_EOL . PHP_EOL;

try {
    // Pastikan kedua akun pengujian tersedia.
    $userStmt = $db->prepare(
        'SELECT id FROM users WHERE id IN (:owner_id, :other_id)'
    );
    $userStmt->execute([
        ':owner_id' => $ownerId,
        ':other_id' => $otherUserId
    ]);

    $existingUsers = array_map(
        'intval',
        $userStmt->fetchAll(PDO::FETCH_COLUMN)
    );

    if (
        !in_array($ownerId, $existingUsers, true) ||
        !in_array($otherUserId, $existingUsers, true)
    ) {
        throw new RuntimeException(
            'Akun testing ID 1 dan ID 3 harus tersedia di tabel users.'
        );
    }

    // Seluruh perubahan DB selama test akan dibatalkan.
    $db->beginTransaction();

    echo "--- TEST 1: AES-GCM MESSAGE WITH AAD ---" . PHP_EOL;

    $aesPlaintext = 'Pesan uji AES-GCM dengan AAD TrueCount.';
    $aesMessageId = EncryptedMessageService::encryptAndStore(
        $ownerId,
        $aesPlaintext,
        'aes256gcm'
    );
    $testMessageIds[] = $aesMessageId;

    $metaStmt = $db->prepare(
        'SELECT crypto_version, algorithm
         FROM encrypted_messages
         WHERE id = :id'
    );
    $metaStmt->execute([':id' => $aesMessageId]);
    $aesMeta = $metaStmt->fetch(PDO::FETCH_ASSOC);

    assertTest(
        'Pesan AES baru tersimpan dengan crypto_version = 1',
        $aesMeta !== false
            && (int) $aesMeta['crypto_version'] === 1
            && $aesMeta['algorithm'] === 'aes256gcm'
    );
    $passed++;

    echo PHP_EOL . "--- TEST 2: OWNER DECRYPTION ---" . PHP_EOL;

    $decryptedAes = EncryptedMessageService::decryptById(
        $aesMessageId,
        $ownerId
    );

    assertTest(
        'Pemilik dapat mendekripsi pesan AES',
        hash_equals($aesPlaintext, $decryptedAes)
    );
    $passed++;

    echo PHP_EOL . "--- TEST 3: UNAUTHORIZED USER ---" . PHP_EOL;

    assertThrows(
        'User lain tidak dapat mengambil pesan melalui service',
        function () use ($aesMessageId, $otherUserId): void {
            EncryptedMessageService::decryptById(
                $aesMessageId,
                $otherUserId
            );
        }
    );
    $passed++;

    echo PHP_EOL . "--- TEST 4: DATABASE OWNER TAMPERING ---" . PHP_EOL;

    // Simulasikan perubahan kepemilikan langsung di database.
    $changeOwnerStmt = $db->prepare(
        'UPDATE encrypted_messages
         SET user_id = :other_id
         WHERE id = :id'
    );
    $changeOwnerStmt->execute([
        ':other_id' => $otherUserId,
        ':id'       => $aesMessageId
    ]);

    assertThrows(
        'Perubahan user_id tidak membuat ciphertext bisa didekripsi user lain',
        function () use ($aesMessageId, $otherUserId): void {
            EncryptedMessageService::decryptById(
                $aesMessageId,
                $otherUserId
            );
        }
    );
    $passed++;

    // Kembalikan pemilik untuk menjaga konsistensi sebelum rollback.
    $restoreOwnerStmt = $db->prepare(
        'UPDATE encrypted_messages
         SET user_id = :owner_id
         WHERE id = :id'
    );
    $restoreOwnerStmt->execute([
        ':owner_id' => $ownerId,
        ':id'       => $aesMessageId
    ]);

    echo PHP_EOL . "--- TEST 5: LEGACY VERSION 0 ---" . PHP_EOL;

    $legacyPlaintext = 'Pesan lama TrueCount tanpa AAD.';
    $legacyEncrypted = AESGCMService::encrypt($legacyPlaintext);

    $legacyInsert = $db->prepare(
        "INSERT INTO encrypted_messages
            (user_id, algorithm, ciphertext, iv_nonce, auth_tag, crypto_version)
         VALUES
            (:user_id, 'aes256gcm', :ciphertext, :nonce, :auth_tag, 0)"
    );
    $legacyInsert->execute([
        ':user_id'    => $ownerId,
        ':ciphertext' => $legacyEncrypted['ciphertext'],
        ':nonce'      => $legacyEncrypted['nonce'],
        ':auth_tag'   => $legacyEncrypted['tag']
    ]);

    $legacyMessageId = (int) $db->lastInsertId();
    $testMessageIds[] = $legacyMessageId;

    $legacyDecrypted = EncryptedMessageService::decryptById(
        $legacyMessageId,
        $ownerId
    );

    assertTest(
        'Pesan legacy crypto_version 0 tetap dapat didekripsi',
        hash_equals($legacyPlaintext, $legacyDecrypted)
    );
    $passed++;

    echo PHP_EOL . "--- TEST 6: CHACHA20-POLY1305 WITH AAD ---" . PHP_EOL;

    $chachaPlaintext = 'Pesan uji ChaCha20-Poly1305 dengan AAD.';
    $chachaMessageId = EncryptedMessageService::encryptAndStore(
        $ownerId,
        $chachaPlaintext,
        'chacha20'
    );
    $testMessageIds[] = $chachaMessageId;

    $chachaMetaStmt = $db->prepare(
        'SELECT crypto_version, algorithm
         FROM encrypted_messages
         WHERE id = :id'
    );
    $chachaMetaStmt->execute([':id' => $chachaMessageId]);
    $chachaMeta = $chachaMetaStmt->fetch(PDO::FETCH_ASSOC);

    $decryptedChacha = EncryptedMessageService::decryptById(
        $chachaMessageId,
        $ownerId
    );

    assertTest(
        'ChaCha20 tersimpan sebagai versi 1 dan plaintext cocok',
        $chachaMeta !== false
            && (int) $chachaMeta['crypto_version'] === 1
            && $chachaMeta['algorithm'] === 'chacha20'
            && hash_equals($chachaPlaintext, $decryptedChacha)
    );
    $passed++;

    echo PHP_EOL . "=== HASIL: {$passed}/6 TEST PASS ===" . PHP_EOL;

} catch (Throwable $e) {
    echo PHP_EOL . '[ERROR] ' . $e->getMessage() . PHP_EOL;
    $testFailed = true;

} finally {
    if ($db->inTransaction()) {
        $db->rollBack();
        echo PHP_EOL . '[CLEANUP] Transaksi di-rollback; database dikembalikan.' . PHP_EOL;
    }
}

if (!empty($testFailed)) {
    exit(1);
}

echo "=== TEST SELESAI ===" . PHP_EOL;
