<?php

require_once __DIR__ . '/../services/crypto/FileEncryptionService.php';
require_once __DIR__ . '/../services/crypto/SteganographyService.php';

echo "=== STEGANOGRAPHY TAMPERING TEST ===\n\n";

$fileId = 12;
$userId = 5;

$tempPath = null;
$image = null;

try {
    // 1. Dekripsi file
    echo "[1] Decrypt original image...\n";

    $decrypted = FileEncryptionService::decryptById(
        $fileId,
        $userId
    );

    $pngContent = $decrypted['content'];

    echo "[PASS] Original image decrypted.\n";

    // 2. Validasi PNG
    echo "[2] Validate PNG...\n";

    $imageInfo = getimagesizefromstring($pngContent);

    if (
        $imageInfo === false ||
        $imageInfo[2] !== IMAGETYPE_PNG
    ) {
        throw new RuntimeException('PNG tidak valid.');
    }

    echo "[PASS] PNG valid: "
        . $imageInfo[0] . 'x' . $imageInfo[1] . "\n";

    // 3. Load PNG menggunakan GD
    echo "[3] Load image into GD...\n";

    $image = imagecreatefromstring($pngContent);

    if ($image === false) {
        throw new RuntimeException('Gagal memuat PNG.');
    }

    // Header = 37 byte = 296 bit.
    // Ubah bit pertama payload ciphertext.
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

    // Flip satu LSB pada payload.
    $channels[$channel] ^= 0x01;

    $newColor = ($alpha << 24)
        | ($channels[0] << 16)
        | ($channels[1] << 8)
        | $channels[2];

    imagesetpixel($image, $x, $y, $newColor);

    echo "[PASS] One payload LSB modified.\n";

    // 4. Simpan PNG sementara
    echo "[4] Save tampered PNG...\n";

    $tempPath = tempnam(sys_get_temp_dir(), 'tc_stego_');

    if ($tempPath === false) {
        throw new RuntimeException('Gagal membuat temporary file.');
    }

    if (!imagepng($image, $tempPath)) {
        throw new RuntimeException('Gagal menyimpan PNG.');
    }

    imagedestroy($image);
    $image = null;

    // 5. Pastikan PNG hasil manipulasi tetap valid
    echo "[5] Validate tampered PNG...\n";

    $tamperedInfo = getimagesize($tempPath);

    if (
        $tamperedInfo === false ||
        $tamperedInfo[2] !== IMAGETYPE_PNG
    ) {
        throw new RuntimeException(
            'PNG hasil manipulasi tidak valid.'
        );
    }

    echo "[PASS] Tampered PNG remains structurally valid.\n";

    // 6. Ekstraksi harus gagal pada autentikasi AEAD
    echo "[6] Attempt metadata extraction...\n";

    $rejected = false;

    try {
        SteganographyService::extractMessage(
            $tempPath,
            $userId
        );
    } catch (Throwable $e) {
        $rejected = true;

        echo "[PASS] Modified payload rejected.\n";
        echo "Reason: " . $e->getMessage() . "\n";
    }

    if (!$rejected) {
        throw new RuntimeException(
            'Payload yang dimodifikasi masih berhasil diekstrak.'
        );
    }

    echo "\n=== STEGANOGRAPHY TAMPERING TEST PASSED ===\n";

} catch (Throwable $e) {
    echo "\n[FAIL] " . $e->getMessage() . "\n";
    exit(1);

} finally {
    if ($image !== null) {
        imagedestroy($image);
    }

    if ($tempPath !== null && is_file($tempPath)) {
        unlink($tempPath);
    }
}
