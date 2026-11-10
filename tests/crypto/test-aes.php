
<?php

require_once __DIR__ . '/../../backend/services/crypto/AESGCMService.php';

$message = "Halo TrueCount! Ini pesan rahasia.";

echo "=== HASIL ENKRIPSI ===\n";

$encrypted = AESGCMService::encrypt($message);

echo "Ciphertext: " . $encrypted['ciphertext'] . "\n";
echo "Nonce: " . $encrypted['nonce'] . "\n";
echo "Tag: " . $encrypted['tag'] . "\n";

echo "\n=== HASIL DEKRIPSI ===\n";

$decrypted = AESGCMService::decrypt(
    $encrypted['ciphertext'],
    $encrypted['nonce'],
    $encrypted['tag']
);

echo $decrypted . "\n";

echo "\nStatus: ";

echo ($message === $decrypted)
    ? "BERHASIL\n"
    : "GAGAL\n";


echo "\n=== UJI TAMPERING DETECTION ===\n";

// Ubah 1 bit dari ciphertext asli
$tamperedRaw = base64_decode($encrypted['ciphertext'], true);
$tamperedRaw[0] = chr(ord($tamperedRaw[0]) ^ 1);

$tamperedCiphertext = base64_encode($tamperedRaw);

try {
    AESGCMService::decrypt(
        $tamperedCiphertext,
        $encrypted['nonce'],
        $encrypted['tag']
    );

    echo "GAGAL: Ciphertext yang dimodifikasi masih diterima.\n";

} catch (RuntimeException $e) {
    echo "BERHASIL: Tampering terdeteksi!\n";
    echo "Pesan: " . $e->getMessage() . "\n";
}
