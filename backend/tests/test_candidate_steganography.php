<?php

/**
 * TrueCount - End-to-End Steganography Test (jalur foto paslon baru)
 *
 * Sejak perubahan "steganografi tanpa enkripsi file", foto paslon disimpan
 * sebagai PNG biasa di storage/private/candidate-photos/ yang sudah
 * disisipi metadata. Test ini membaca file langsung dari disk lalu:
 *
 * 1. Validasi file PNG.
 * 2. Ekstraksi metadata steganografi.
 * 3. Verifikasi metadata kandidat terhadap database.
 *
 * Tidak mengubah database maupun file asli.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/storage.php';
require_once __DIR__ . '/../services/crypto/SteganographyService.php';

$db = getDB();

// Ambil kandidat yang punya foto jalur baru.
$stmt = $db->query(
    'SELECT id, election_id, name, vision, mission, photo_path
       FROM candidates
      WHERE photo_path IS NOT NULL AND photo_path <> ""
      ORDER BY id ASC'
);
$candidates = $stmt->fetchAll();

if (!$candidates) {
    echo "=== TEST FAILED ===\n";
    echo "Tidak ada kandidat dengan foto jalur baru (photo_path).\n";
    exit(1);
}

// Semua user mungkin sebagai pemilik AAD steganografi.
$owners = $db->query('SELECT id FROM users ORDER BY id ASC')
    ->fetchAll(PDO::FETCH_COLUMN);

$tempPath = null;

try {
    echo "=== TRUECOUNT STEGANOGRAPHY TEST ===\n\n";

    foreach ($candidates as $candidate) {
        $label = "Kandidat #{$candidate['id']} ({$candidate['name']})";
        echo "-- {$label} --\n";

        // 1. Baca PNG dari disk.
        $relative = trim($candidate['photo_path'], "/\\");
        $abs = storageRoot() . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $relative);

        if (!is_file($abs)) {
            throw new RuntimeException("File foto tidak ditemukan: {$abs}");
        }

        $imageInfo = getimagesize($abs);

        if ($imageInfo === false || $imageInfo[2] !== IMAGETYPE_PNG) {
            throw new RuntimeException('File bukan PNG valid.');
        }

        echo "    [1] PNG valid: {$imageInfo[0]}x{$imageInfo[1]}\n";

        // 2. Ekstrak metadata (coba pemilik yang mungkin).
        $metadataJson = null;

        foreach ($owners as $ownerId) {
            try {
                $metadataJson = SteganographyService::extractMessage(
                    $abs,
                    (int) $ownerId
                );
                break;
            } catch (Throwable $e) {
                // AAD salah → coba user berikutnya.
            }
        }

        if ($metadataJson === null) {
            throw new RuntimeException(
                'Metadata steganografi tidak bisa diekstrak dengan user mana pun.'
            );
        }

        echo "    [2] Metadata berhasil diekstrak.\n";

        $metadata = json_decode($metadataJson, true);

        if (!is_array($metadata)) {
            throw new RuntimeException(
                'Metadata bukan JSON valid: ' . json_last_error_msg()
            );
        }

        echo "    [3] Metadata:\n";
        echo json_encode(
            $metadata,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
        ) . "\n";

        // 3. Verifikasi terhadap database.
        $expected = [
            'election_id'    => (int) $candidate['election_id'],
            'candidate_id'   => (int) $candidate['id'],
            'candidate_name' => (string) $candidate['name'],
        ];

        foreach ($expected as $key => $expectedValue) {
            $actual = $metadata[$key] ?? null;

            if ((string) $actual !== (string) $expectedValue) {
                throw new RuntimeException(
                    "Metadata {$key} tidak sesuai database "
                    . "(harap: {$expectedValue}, dapat: " . var_export($actual, true) . ")."
                );
            }

            echo "    [OK] {$key} cocok ({$expectedValue}).\n";
        }

        echo "\n";
    }

    echo "=== ALL TESTS PASSED ===\n";

} catch (Throwable $e) {
    echo "\n=== TEST FAILED ===\n";
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);

} finally {
    if ($tempPath !== null && is_file($tempPath)) {
        unlink($tempPath);
    }
}
