<?php

/**
 * TrueCount - Steganography Tampering Test (jalur foto paslon baru)
 *
 * Foto paslon kini berupa PNG biasa di disk yang sudah disisipi metadata.
 * Test ini memastikan modifikasi satu bit pada payload membuat ekstraksi
 * metadata GAGAL (autentikasi AEAD menolak), sehingga integritas metadata
 * terjaga walau file tidak dienkripsi.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/storage.php';
require_once __DIR__ . '/../services/crypto/SteganographyService.php';

echo "=== STEGANOGRAPHY TAMPERING TEST ===\n\n";

$db = getDB();

// Ambil satu kandidat berfoto jalur baru.
$candidate = $db->query(
    'SELECT id, name, photo_path
       FROM candidates
      WHERE photo_path IS NOT NULL AND photo_path <> ""
      ORDER BY id ASC
      LIMIT 1'
)->fetch(PDO::FETCH_ASSOC);

if (!$candidate) {
    echo "[FAIL] Tidak ada kandidat dengan foto jalur baru.\n";
    exit(1);
}

$relative = trim($candidate['photo_path'], "/\\");
$originalPath = storageRoot() . DIRECTORY_SEPARATOR
    . str_replace('/', DIRECTORY_SEPARATOR, $relative);

if (!is_file($originalPath)) {
    echo "[FAIL] File foto tidak ditemukan: {$originalPath}\n";
    exit(1);
}

echo "Foto uji: kandidat #{$candidate['id']} ({$candidate['name']})\n\n";

$owners = $db->query('SELECT id FROM users ORDER BY id ASC')
    ->fetchAll(PDO::FETCH_COLUMN);

$image = null;
$tempPath = null;

try {
    // 1. Cari pemilik AAD yang benar (berhasil ekstrak file asli).
    echo "[1] Cari pemilik AAD steganografi...\n";

    $ownerId = null;

    foreach ($owners as $candidate_owner) {
        try {
            SteganographyService::extractMessage($originalPath, (int) $candidate_owner);
            $ownerId = (int) $candidate_owner;
            break;
        } catch (Throwable $e) {
            // AAD salah → lanjut.
        }
    }

    if ($ownerId === null) {
        throw new RuntimeException(
            'Tidak ada user yang bisa mengekstrak metadata file asli.'
        );
    }

    echo "[PASS] Pemilik AAD: user #{$ownerId}\n";

    // 2. Load PNG menggunakan GD.
    echo "[2] Load image into GD...\n";

    $image = imagecreatefrompng($originalPath);

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

    // 3. Simpan PNG sementara.
    echo "[3] Save tampered PNG...\n";

    $tempPath = tempnam(sys_get_temp_dir(), 'tc_stego_');

    if ($tempPath === false) {
        throw new RuntimeException('Gagal membuat temporary file.');
    }

    // tempnam tidak ber ekstensi .png, paksa ekstensi PNG.
    $pngTempPath = $tempPath . '.png';
    rename($tempPath, $pngTempPath);
    $tempPath = $pngTempPath;

    if (!imagepng($image, $tempPath)) {
        throw new RuntimeException('Gagal menyimpan PNG.');
    }

    imagedestroy($image);
    $image = null;

    // 4. Pastikan PNG hasil manipulasi tetap valid secara struktural.
    echo "[4] Validate tampered PNG...\n";

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

    // 5. Ekstraksi harus gagal pada autentikasi AEAD.
    echo "[5] Attempt metadata extraction...\n";

    $rejected = false;

    try {
        SteganographyService::extractMessage($tempPath, $ownerId);
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
