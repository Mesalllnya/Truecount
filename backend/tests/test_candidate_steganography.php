<?php

/**
 * TrueCount - End-to-End Steganography Test
 *
 * Menguji:
 * 1. Dekripsi encrypted file.
 * 2. Validasi PNG.
 * 3. Ekstraksi metadata steganografi.
 * 4. Verifikasi metadata kandidat.
 *
 * Tidak mengubah database maupun file asli.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/crypto/FileEncryptionService.php';
require_once __DIR__ . '/../services/crypto/SteganographyService.php';

// Data pengujian
$fileId = 12;
$userId = 5;
$expectedCandidateId = 9;

$tempPath = null;

try {
    echo "=== TRUECOUNT STEGANOGRAPHY TEST ===\n\n";

    // 1. Dekripsi file terenkripsi
    echo "[1] Decrypt encrypted file...\n";

    $decrypted = FileEncryptionService::decryptById(
        $fileId,
        $userId
    );

    echo "    SUCCESS: File berhasil didekripsi.\n";
    echo "    Original name: {$decrypted['original_name']}\n";
    echo "    MIME type: {$decrypted['mime_type']}\n";
    echo "    File size: {$decrypted['file_size']} bytes\n\n";

    // 2. Validasi konten PNG
    echo "[2] Validate PNG content...\n";

    if ($decrypted['mime_type'] !== 'image/png') {
        throw new RuntimeException('MIME type bukan image/png.');
    }

    $imageInfo = getimagesizefromstring($decrypted['content']);

    if ($imageInfo === false || $imageInfo[2] !== IMAGETYPE_PNG) {
        throw new RuntimeException('Konten bukan PNG yang valid.');
    }

    echo "    SUCCESS: PNG valid.\n";
    echo "    Dimensions: {$imageInfo[0]} x {$imageInfo[1]}\n\n";

    // 3. Simpan hasil dekripsi ke file sementara
    echo "[3] Save temporary PNG...\n";

    $tempPath = tempnam(sys_get_temp_dir(), 'tc_stego_');

    if ($tempPath === false) {
        throw new RuntimeException('Gagal membuat temporary file.');
    }

    if (file_put_contents($tempPath, $decrypted['content']) === false) {
        throw new RuntimeException('Gagal menulis temporary PNG.');
    }

    echo "    SUCCESS: Temporary PNG created.\n\n";

    // 4. Ekstraksi metadata steganografi
    echo "[4] Extract steganography metadata...\n";

    $metadataJson = SteganographyService::extractMessage(
        $tempPath,
        $userId
    );

    echo "    SUCCESS: Metadata berhasil diekstrak.\n\n";

    // 5. Parse JSON metadata
    echo "[5] Decode metadata JSON...\n";

    $metadata = json_decode($metadataJson, true);

    if (!is_array($metadata)) {
        throw new RuntimeException(
            'Metadata bukan JSON valid: ' . json_last_error_msg()
        );
    }

    echo "    SUCCESS: JSON valid.\n";
    echo "    Metadata:\n";

    echo json_encode(
        $metadata,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
    ) . "\n\n";

    // 6. Verifikasi candidate ID
    echo "[6] Verify candidate identity...\n";

    if (
        !isset($metadata['candidate_id']) ||
        (int) $metadata['candidate_id'] !== $expectedCandidateId
    ) {
        throw new RuntimeException(
            'Candidate ID tidak sesuai.'
        );
    }

    echo "    SUCCESS: Candidate ID cocok ({$expectedCandidateId}).\n\n";

    // 7. Verifikasi election dan uploader terhadap database
    echo "[7] Verify metadata against database...\n";

    $stmt = getDB()->prepare(
        'SELECT
            c.id,
            c.election_id,
            ef.user_id
         FROM candidates c
         JOIN encrypted_files ef
            ON ef.id = c.photo_file_id
         WHERE c.id = ?
           AND ef.id = ?
         LIMIT 1'
    );

    $stmt->execute([$expectedCandidateId, $fileId]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$record) {
        throw new RuntimeException(
            'Relasi kandidat dan encrypted file tidak ditemukan.'
        );
    }

    $checks = [
        'election_id' => (int) $record['election_id'],
        'uploaded_by' => (int) $record['user_id'],
    ];

    foreach ($checks as $key => $expectedValue) {
        if (
            !isset($metadata[$key]) ||
            (string) $metadata[$key] !== (string) $expectedValue
        ) {
            throw new RuntimeException(
                "Metadata {$key} tidak sesuai database."
            );
        }

        echo "    SUCCESS: {$key} cocok ({$expectedValue}).\n";
    }

    echo "\n=== ALL TESTS PASSED ===\n";

} catch (Throwable $e) {
    echo "\n=== TEST FAILED ===\n";
    echo "Error: " . $e->getMessage() . "\n";
    exitCode:
    exit(1);

} finally {
    if ($tempPath !== null && is_file($tempPath)) {
        unlink($tempPath);
    }
}
