<?php

require_once __DIR__ . '/../../backend/services/crypto/SteganographyService.php';

function test(string $name, bool $condition): void
{
    echo ($condition ? "[PASS] " : "[FAIL] ") . $name . PHP_EOL;
}

$userId = 1;
$fixtureDir = __DIR__ . '/fixtures';

$carrierPath = $fixtureDir . '/capacity-carrier.png';
$normalPath = $fixtureDir . '/capacity-normal.png';
$exactPath = $fixtureDir . '/capacity-exact.png';
$oversizedPath = $fixtureDir . '/capacity-oversized.png';

echo "=== STEGANOGRAPHY CAPACITY VALIDATION TEST ===\n\n";

try {
    if (!extension_loaded('gd')) {
        throw new RuntimeException('GD extension belum aktif.');
    }

    if (!is_dir($fixtureDir)) {
        throw new RuntimeException('Folder fixtures tidak ditemukan.');
    }

    // Buat carrier PNG 20 x 20.
    echo "--- PREPARING CARRIER ---\n";

    $image = imagecreatetruecolor(20, 20);

    if (!$image) {
        throw new RuntimeException('Gagal membuat carrier image.');
    }

    try {
        imagealphablending($image, false);
        imagesavealpha($image, true);

        if (!imagepng($image, $carrierPath)) {
            throw new RuntimeException('Gagal menyimpan carrier PNG.');
        }
    } finally {
        imagedestroy($image);
    }

    $capacityBytes = intdiv(20 * 20 * 3, 8);
    $headerBytes = 37;
    $maxMessageBytes = $capacityBytes - $headerBytes;

    echo "Image dimensions : 20 x 20 pixels\n";
    echo "Total capacity   : {$capacityBytes} bytes\n";
    echo "Header size      : {$headerBytes} bytes\n";
    echo "Max plaintext    : {$maxMessageBytes} bytes\n\n";

    // TEST 1: Normal payload.
    echo "--- TEST 1: NORMAL PAYLOAD ---\n";

    $normalMessage = 'Hello TrueCount!';

    $result = SteganographyService::embedMessage(
        $normalMessage,
        $carrierPath,
        $normalPath,
        $userId
    );

    test(
        'Pesan normal berhasil di-embed',
        is_file($normalPath)
    );

    $extracted = SteganographyService::extractMessage(
        $normalPath,
        $userId
    );

    test(
        'Pesan normal berhasil diekstrak',
        $extracted === $normalMessage
    );

    echo "Payload size: {$result['payload_size']} bytes\n\n";

    // TEST 2: Payload tepat memenuhi kapasitas.
    echo "--- TEST 2: EXACT CAPACITY ---\n";

    $exactMessage = str_repeat('A', $maxMessageBytes);

    $result = SteganographyService::embedMessage(
        $exactMessage,
        $carrierPath,
        $exactPath,
        $userId
    );

    test(
        'Payload tepat kapasitas berhasil di-embed',
        is_file($exactPath)
    );

    test(
        'Payload size sama dengan kapasitas maksimum',
        $result['payload_size'] === $capacityBytes
    );

    $extracted = SteganographyService::extractMessage(
        $exactPath,
        $userId
    );

    test(
        'Payload tepat kapasitas berhasil diekstrak',
        $extracted === $exactMessage
    );

    echo "Payload size: {$result['payload_size']} bytes\n\n";

    // TEST 3: Payload melebihi kapasitas.
    echo "--- TEST 3: OVERSIZED PAYLOAD ---\n";

    $oversizedMessage = str_repeat('B', $maxMessageBytes + 1);

    try {
        SteganographyService::embedMessage(
            $oversizedMessage,
            $carrierPath,
            $oversizedPath,
            $userId
        );

        test(
            'Payload melebihi kapasitas ditolak',
            false
        );

    } catch (RuntimeException $e) {
        test(
            'Payload melebihi kapasitas ditolak',
            $e->getMessage() === 'Kapasitas gambar tidak mencukupi.'
        );

        echo "Pesan: {$e->getMessage()}\n";
    }

    test(
        'File oversized tidak dihasilkan',
        !is_file($oversizedPath)
    );

} catch (Throwable $e) {
    echo "\n[ERROR] " . $e->getMessage() . PHP_EOL;

} finally {
    // Bersihkan seluruh file pengujian.
    foreach ([
        $carrierPath,
        $normalPath,
        $exactPath,
        $oversizedPath
    ] as $path) {
        if (is_file($path)) {
            unlink($path);
        }
    }
}

echo "\n=== TEST SELESAI ===\n";
