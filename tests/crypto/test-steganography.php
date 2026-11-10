
<?php

require_once __DIR__ . '/../../backend/services/crypto/SteganographyService.php';

function test(string $name, bool $condition): void
{
    echo ($condition ? "[PASS] " : "[FAIL] ") . $name . PHP_EOL;
}

$userId = 1;

$fixtureDir = __DIR__ . '/fixtures';
$carrierPath = $fixtureDir . '/carrier.png';
$outputPath = $fixtureDir . '/stego-output.png';
$invalidPath = $fixtureDir . '/invalid.png';

$message = "Halo TrueCount! Ini pesan rahasia menggunakan Steganography LSB.";

echo "=== STEGANOGRAPHY LSB TEST ===\n\n";

$fileGenerated = false;

// Persiapan
try {
    if (!extension_loaded('gd')) {
        throw new RuntimeException('Ekstensi GD belum aktif.');
    }

    if (!is_file($carrierPath)) {
        throw new RuntimeException('Carrier image tidak ditemukan.');
    }

    if (!is_dir($fixtureDir)) {
        throw new RuntimeException('Folder fixtures tidak ditemukan.');
    }

    // 1. EMBEDDING
    echo "--- EMBEDDING TEST ---\n";

    $result = SteganographyService::embedMessage(
        $message,
        $carrierPath,
        $outputPath,
        $userId
    );

    $fileGenerated = is_file($outputPath);

    test("Embedding berhasil", $fileGenerated);

    if (!$fileGenerated) {
        throw new RuntimeException('Stego image gagal dibuat.');
    }

    echo "Payload size: " . $result['payload_size'] . " bytes\n";
    echo "Capacity: " . $result['capacity_bytes'] . " bytes\n";

} catch (Throwable $e) {
    echo "[ERROR] Embedding: " . $e->getMessage() . PHP_EOL;
}

// 2. EXTRACTION
echo "\n--- EXTRACTION TEST ---\n";

if ($fileGenerated) {
    try {
        $extracted = SteganographyService::extractMessage(
            $outputPath,
            $userId
        );

        test("Extraction berhasil", $extracted === $message);
        test("Plaintext sesuai pesan asli", $extracted === $message);
        echo "Original message : " . $message . PHP_EOL;
        echo "Decrypted message: " . $extracted . PHP_EOL;

    } catch (Throwable $e) {
        test("Extraction berhasil", false);
        echo "Pesan error: " . $e->getMessage() . PHP_EOL;
    }
} else {
    echo "[SKIP] Extraction karena embedding gagal.\n";
}

$originalSize = filesize($carrierPath);
$stegoSize = filesize($outputPath);

echo "\n=== IMAGE SIZE COMPARISON ===\n";

echo "Original PNG : " . number_format($originalSize) . " bytes\n";
echo "Stego PNG    : " . number_format($stegoSize) . " bytes\n";

$difference = $stegoSize - $originalSize;

echo "Difference   : " . ($difference >= 0 ? "+" : "")
    . number_format($difference) . " bytes\n";

echo "Size change  : "
    . round(($difference / $originalSize) * 100, 2)
    . "%\n";

// 3. UNAUTHORIZED ACCESS
echo "\n--- UNAUTHORIZED ACCESS TEST ---\n";

if ($fileGenerated) {
    try {
        SteganographyService::extractMessage(
            $outputPath,
            999
        );

        test("User lain ditolak", false);

    } catch (RuntimeException $e) {
        test("User lain ditolak", true);
        echo "Pesan: " . $e->getMessage() . PHP_EOL;

    } catch (Throwable $e) {
        test("User lain ditolak", false);
        echo "Unexpected error: " . $e->getMessage() . PHP_EOL;
    }
} else {
    echo "[SKIP] Unauthorized access karena embedding gagal.\n";
}

// 4. INVALID IMAGE
echo "\n--- INVALID IMAGE TEST ---\n";

try {
    $invalidImage = imagecreatetruecolor(100, 100);

    if (!$invalidImage) {
        throw new RuntimeException('Gagal membuat gambar pengujian.');
    }

    $created = imagepng($invalidImage, $invalidPath);
    imagedestroy($invalidImage);

    if (!$created) {
        throw new RuntimeException('Gagal menyimpan gambar pengujian.');
    }

    try {
        SteganographyService::extractMessage(
            $invalidPath,
            $userId
        );

        test("Gambar tanpa payload ditolak", false);

    } catch (RuntimeException $e) {
        test("Gambar tanpa payload ditolak", true);
        echo "Pesan: " . $e->getMessage() . PHP_EOL;
    }

} catch (Throwable $e) {
    echo "[ERROR] Invalid image test: " . $e->getMessage() . PHP_EOL;
}

// CLEANUP
$cleanupFiles = [
    $outputPath,
    $invalidPath,
];

foreach ($cleanupFiles as $file) {
    if (is_file($file)) {
        if (!unlink($file)) {
            echo "[WARNING] Gagal menghapus file: {$file}" . PHP_EOL;
        }
    }
}

echo "\n=== TEST SELESAI ===\n";
