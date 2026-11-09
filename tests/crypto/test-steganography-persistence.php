<?php

require_once __DIR__ . '/../../backend/services/crypto/SteganographyService.php';

function test(string $name, bool $condition): void
{
    echo ($condition ? "[PASS] " : "[FAIL] ") . $name . PHP_EOL;
}

$userId = 1;
$fixtureDir = __DIR__ . '/fixtures';

$carrierPath = $fixtureDir . '/carrier.png';
$outputPath = $fixtureDir . '/persistence-output.png';

$message = 'TrueCount PNG Persistence Test: data harus tetap utuh setelah disimpan dan dibaca ulang.';

echo "=== STEGANOGRAPHY PNG PERSISTENCE TEST ===\n\n";

try {
    if (!extension_loaded('gd')) {
        throw new RuntimeException('GD extension belum aktif.');
    }

    if (!is_dir($fixtureDir)) {
        throw new RuntimeException('Folder fixtures tidak ditemukan.');
    }

    if (!is_file($carrierPath)) {
        throw new RuntimeException('Carrier image tidak ditemukan.');
    }

    // 1. EMBEDDING
    echo "--- EMBEDDING ---\n";

    $result = SteganographyService::embedMessage(
        $message,
        $carrierPath,
        $outputPath,
        $userId
    );

    test('Embedding berhasil', is_file($outputPath));

    echo "Payload size: {$result['payload_size']} bytes\n";

    // 2. FILE VALIDATION
    echo "\n--- FILE VALIDATION ---\n";

    clearstatcache(true, $outputPath);

    test(
        'File output tersedia',
        is_file($outputPath)
    );

    test(
        'File output tidak kosong',
        filesize($outputPath) > 0
    );

    $imageInfo = getimagesize($outputPath);

    test(
        'Format output adalah PNG',
        $imageInfo !== false &&
        $imageInfo['mime'] === 'image/png'
    );

    echo "Image dimensions: "
        . $imageInfo[0] . " x " . $imageInfo[1] . "\n";

    // 3. PERSISTENCE CHECK
    echo "\n--- DISK PERSISTENCE ---\n";

    // Simulasikan proses baru dengan membaca file kembali dari disk.
    unset($result);

    clearstatcache(true, $outputPath);

    $reloadedImage = imagecreatefrompng($outputPath);

    test(
        'PNG berhasil dibaca ulang dari disk',
        $reloadedImage !== false
    );

    if ($reloadedImage !== false) {
        imagedestroy($reloadedImage);
    }

    // 4. EXTRACTION
    echo "\n--- EXTRACTION AFTER RELOAD ---\n";

    $extracted = SteganographyService::extractMessage(
        $outputPath,
        $userId
    );

    test(
        'Extraction setelah reload berhasil',
        $extracted === $message
    );

    test(
        'Plaintext tetap identik',
        hash_equals(
            hash('sha256', $message),
            hash('sha256', $extracted)
        )
    );

    echo "Original length : " . strlen($message) . " bytes\n";
    echo "Extracted length: " . strlen($extracted) . " bytes\n";

} catch (Throwable $e) {
    echo "\n[ERROR] " . $e->getMessage() . PHP_EOL;

} finally {
    if (is_file($outputPath)) {
        unlink($outputPath);
    }
}

echo "\n=== TEST SELESAI ===\n";
