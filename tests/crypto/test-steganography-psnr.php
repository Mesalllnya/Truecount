
<?php

require_once __DIR__ . '/../../backend/services/crypto/SteganographyService.php';

echo "=== STEGANOGRAPHY PSNR / IMAGE QUALITY TEST ===\n\n";

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

$carrierPath = __DIR__ . '/fixtures/carrier.png';
$outputPath  = __DIR__ . '/psnr-output.png';

$message = "TrueCount PSNR image quality validation test.";
$userId = 1;

// --------------------------------------------------
// HELPER: CALCULATE MSE AND PSNR
// --------------------------------------------------

function calculateImageQuality(
    string $originalPath,
    string $stegoPath
): array {

    $original = imagecreatefrompng($originalPath);
    $stego = imagecreatefrompng($stegoPath);

    if (!$original || !$stego) {
        throw new RuntimeException("Gagal membaca gambar.");
    }

    $width = imagesx($original);
    $height = imagesy($original);

    if (
        $width !== imagesx($stego) ||
        $height !== imagesy($stego)
    ) {
        throw new RuntimeException(
            "Dimensi gambar tidak sama."
        );
    }

    $totalError = 0;
    $totalSamples = $width * $height * 3;

    for ($y = 0; $y < $height; $y++) {
        for ($x = 0; $x < $width; $x++) {

            $pixelOriginal = imagecolorat(
                $original,
                $x,
                $y
            );

            $pixelStego = imagecolorat(
                $stego,
                $x,
                $y
            );

            $channelsOriginal = [
                ($pixelOriginal >> 16) & 0xFF,
                ($pixelOriginal >> 8) & 0xFF,
                $pixelOriginal & 0xFF
            ];

            $channelsStego = [
                ($pixelStego >> 16) & 0xFF,
                ($pixelStego >> 8) & 0xFF,
                $pixelStego & 0xFF
            ];

            for ($i = 0; $i < 3; $i++) {

                $difference =
                    $channelsOriginal[$i] -
                    $channelsStego[$i];

                $totalError += $difference * $difference;
            }
        }
    }

    imagedestroy($original);
    imagedestroy($stego);

    $mse = $totalError / $totalSamples;

    $psnr = ($mse == 0)
        ? INF
        : 10 * log10((255 * 255) / $mse);

    return [
        'mse' => $mse,
        'psnr' => $psnr
    ];
}

// --------------------------------------------------
// TEST 1: CARRIER VALIDATION
// --------------------------------------------------

echo "--- CARRIER VALIDATION ---\n";

if (!is_file($carrierPath) || !is_readable($carrierPath)) {
    die("[FAIL] Carrier image tidak ditemukan atau tidak dapat dibaca.\n");
}

echo "[PASS] Carrier image ditemukan\n";

// --------------------------------------------------
// TEST 2: EMBEDDING
// --------------------------------------------------

echo "\n--- EMBEDDING ---\n";

try {

    $embedResult = SteganographyService::embedMessage(
        $message,
        $carrierPath,
        $outputPath,
        $userId
    );

    echo "[PASS] Embedding berhasil\n";
    echo "Payload size: " .
        $embedResult['payload_size'] . " bytes\n";

} catch (Throwable $e) {

    die("[FAIL] " . $e->getMessage() . "\n");
}

// --------------------------------------------------
// TEST 3: IMAGE DIMENSION VALIDATION
// --------------------------------------------------

echo "\n--- DIMENSION VALIDATION ---\n";

$originalInfo = getimagesize($carrierPath);
$stegoInfo = getimagesize($outputPath);

if (
    $originalInfo[0] === $stegoInfo[0] &&
    $originalInfo[1] === $stegoInfo[1]
) {

    echo "[PASS] Dimensi gambar tetap sama\n";

} else {

    die("[FAIL] Dimensi gambar berubah\n");
}

echo "Original: {$originalInfo[0]} x {$originalInfo[1]}\n";
echo "Stego   : {$stegoInfo[0]} x {$stegoInfo[1]}\n";

// --------------------------------------------------
// TEST 4: IMAGE QUALITY ANALYSIS
// --------------------------------------------------

echo "\n--- IMAGE QUALITY ANALYSIS ---\n";

try {

    $result = calculateImageQuality(
        $carrierPath,
        $outputPath
    );

    printf("MSE  : %.10f\n", $result['mse']);

    if (is_infinite($result['psnr'])) {

        echo "PSNR : Infinity dB\n";

    } else {

        printf("PSNR : %.4f dB\n", $result['psnr']);
    }

} catch (Throwable $e) {

    die("[FAIL] " . $e->getMessage() . "\n");
}

// --------------------------------------------------
// TEST 5: QUALITY VALIDATION
// --------------------------------------------------

echo "\n--- QUALITY VALIDATION ---\n";

if ($result['psnr'] >= 40) {

    echo "[PASS] PSNR memenuhi threshold 40 dB\n";

} else {

    echo "[FAIL] PSNR berada di bawah threshold 40 dB\n";
}

// --------------------------------------------------
// TEST 6: EXTRACTION VALIDATION
// --------------------------------------------------

echo "\n--- EXTRACTION VALIDATION ---\n";

try {

    $extractedMessage = SteganographyService::extractMessage(
        $outputPath,
        $userId
    );

    if (hash_equals($message, $extractedMessage)) {

        echo "[PASS] Pesan berhasil diekstrak\n";
        echo "[PASS] Plaintext identik dengan pesan asli\n";

    } else {

        echo "[FAIL] Plaintext tidak identik\n";
    }

} catch (Throwable $e) {

    echo "[FAIL] " . $e->getMessage() . "\n";
}

// --------------------------------------------------
// CLEANUP
// --------------------------------------------------

if (file_exists($outputPath)) {
    unlink($outputPath);
}

echo "\n=== TEST SELESAI ===\n";
