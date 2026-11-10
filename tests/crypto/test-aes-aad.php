<?php

require_once __DIR__ . '/../../backend/services/crypto/AESGCMService.php';

function test(string $name, bool $condition): void
{
    echo ($condition ? "[PASS] " : "[FAIL] ")
        . $name . PHP_EOL;
}

echo "=== AES-256-GCM AAD TEST ===\n";

$message = "Ballot rahasia TrueCount";
$aad = "truecount:ballot:v1:election:1";

// 1. Enkripsi menggunakan AAD.
$encrypted = AESGCMService::encrypt($message, $aad);

test(
    "Enkripsi dengan AAD berhasil",
    !empty($encrypted['ciphertext'])
);

// 2. Dekripsi dengan AAD yang benar.
$decrypted = AESGCMService::decrypt(
    $encrypted['ciphertext'],
    $encrypted['nonce'],
    $encrypted['tag'],
    $aad
);

test(
    "Dekripsi dengan AAD benar berhasil",
    $decrypted === $message
);

// 3. Dekripsi dengan AAD berbeda.
try {
    AESGCMService::decrypt(
        $encrypted['ciphertext'],
        $encrypted['nonce'],
        $encrypted['tag'],
        'truecount:ballot:v1:election:2'
    );

    test("AAD berbeda ditolak", false);

} catch (RuntimeException $e) {
    test("AAD berbeda ditolak", true);
}

// 4. Backward compatibility tanpa AAD.
$legacy = AESGCMService::encrypt($message);

$legacyDecrypted = AESGCMService::decrypt(
    $legacy['ciphertext'],
    $legacy['nonce'],
    $legacy['tag']
);

test(
    "Enkripsi tanpa AAD tetap kompatibel",
    $legacyDecrypted === $message
);

echo "\n=== TEST SELESAI ===\n";
