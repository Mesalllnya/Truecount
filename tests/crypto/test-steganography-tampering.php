<?php

require_once __DIR__ . '/../../backend/services/crypto/SteganographyService.php';

function test(string $name, bool $condition): void
{
    echo ($condition ? "[PASS] " : "[FAIL] ") . $name . PHP_EOL;
}

$userId = 1;

$fixtureDir = __DIR__ . '/fixtures';
$carrierPath = $fixtureDir . '/carrier.png';
$stegoPath = $fixtureDir . '/tampering-original.png';
$tamperedPath = $fixtureDir . '/tampering-modified.png';

$message = 'TrueCount image tampering security test.';

echo "=== STEGANOGRAPHY IMAGE TAMPERING TEST ===\n\n";

try {
    if (!extension_loaded('gd')) {
        throw new RuntimeException('GD extension belum aktif.');
    }

    if (!is_file($carrierPath)) {
        throw new RuntimeException('Carrier image tidak ditemukan.');
    }

    // 1. Embed pesan ke carrier image.
    echo "--- EMBEDDING ---\n";

    $result = SteganographyService::embedMessage(
        $message,
        $carrierPath,
        $stegoPath,
        $userId
    );

    test('Embedding berhasil', is_file($stegoPath));

    echo "Payload: {$result['payload_size']} bytes\n";

    // 2. Pastikan pesan asli dapat diekstrak.
    echo "\n--- ORIGINAL EXTRACTION ---\n";

    $original = SteganographyService::extractMessage(
        $stegoPath,
        $userId
    );

    test('Original plaintext cocok', $original === $message);

    // 3. Buat salinan untuk dimodifikasi.
    if (!copy($stegoPath, $tamperedPath)) {
        throw new RuntimeException('Gagal menyalin stego image.');
    }

    $image = imagecreatefrompng($tamperedPath);

    if (!$image) {
        throw new RuntimeException('Gagal membaca stego image.');
    }

    try {
        imagealphablending($image, false);
        imagesavealpha($image, true);

        /*
         * Header = 37 bytes.
         * Payload ciphertext dimulai pada bit index 296.
         *
         * Kita membalik LSB channel RGB pertama
         * setelah header agar ciphertext berubah.
         */

        $bitIndex = 37 * 8;

        $width = imagesx($image);

        $pixelIndex = intdiv($bitIndex, 3);
        $channel = $bitIndex % 3;

        $x = $pixelIndex % $width;
        $y = intdiv($pixelIndex, $width);

        $color = imagecolorat($image, $x, $y);

        $r = ($color >> 16) & 0xFF;
        $g = ($color >> 8) & 0xFF;
        $b = $color & 0xFF;
        $alpha = ($color >> 24) & 0x7F;

        $channels = [$r, $g, $b];

        // Balik satu bit pada ciphertext.
        $channels[$channel] ^= 1;

        $newColor = ($alpha << 24)
            | ($channels[0] << 16)
            | ($channels[1] << 8)
            | $channels[2];

        imagesetpixel($image, $x, $y, $newColor);

        if (!imagepng($image, $tamperedPath, 6)) {
            throw new RuntimeException(
                'Gagal menyimpan gambar yang dimodifikasi.'
            );
        }

    } finally {
        imagedestroy($image);
    }

    echo "\n--- TAMPERING DETECTION ---\n";

    echo "Satu bit ciphertext berhasil dimodifikasi.\n";

    // 4. Extraction harus gagal karena authentication tag tidak cocok.
    try {
        $extracted = SteganographyService::extractMessage(
            $tamperedPath,
            $userId
        );

        test('Ciphertext tampering terdeteksi', false);

        echo "Pesan hasil ekstraksi: {$extracted}\n";

    } catch (RuntimeException $e) {
        test('Ciphertext tampering terdeteksi', true);
        echo "Pesan: " . $e->getMessage() . PHP_EOL;
    }

} catch (Throwable $e) {
    echo "\n[ERROR] " . $e->getMessage() . PHP_EOL;

} finally {
    // Bersihkan file pengujian.
    foreach ([$stegoPath, $tamperedPath] as $path) {
        if (is_file($path)) {
            unlink($path);
        }
    }
}

echo "\n=== TEST SELESAI ===\n";
