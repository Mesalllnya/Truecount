<?php

require_once __DIR__ .
    '/backend/services/crypto/ChaCha20Poly1305Service.php';

echo "=== CHACHA20-POLY1305 TEST ===\n\n";

$message = "Halo TrueCount! Pesan rahasia ChaCha20.";

try {
    // Encryption
    $encrypted = ChaCha20Poly1305Service::encrypt($message);

    echo "=== HASIL ENKRIPSI ===\n";
    echo "Ciphertext: " . $encrypted['ciphertext'] . "\n";
    echo "Nonce: " . $encrypted['nonce'] . "\n";
    echo "Tag: " . $encrypted['tag'] . "\n";

    // Decryption
    $decrypted = ChaCha20Poly1305Service::decrypt(
        $encrypted['ciphertext'],
        $encrypted['nonce'],
        $encrypted['tag']
    );

    echo "\n=== HASIL DEKRIPSI ===\n";
    echo $decrypted . "\n";

    if ($decrypted !== $message) {
        throw new RuntimeException(
            'Hasil dekripsi tidak sama dengan plaintext.'
        );
    }

    echo "\nStatus: BERHASIL\n";

    // Tampering test
    echo "\n=== TAMPERING DETECTION TEST ===\n";

    $cipherRaw = base64_decode(
        $encrypted['ciphertext'],
        true
    );

    if ($cipherRaw !== false && strlen($cipherRaw) > 0) {
        $cipherRaw[0] = chr(ord($cipherRaw[0]) ^ 1);
    }

    $tamperedCiphertext = base64_encode($cipherRaw);

    try {
        ChaCha20Poly1305Service::decrypt(
            $tamperedCiphertext,
            $encrypted['nonce'],
            $encrypted['tag']
        );

        echo "FAIL: Tampering tidak terdeteksi.\n";

    } catch (RuntimeException $e) {
        echo "PASS: Tampering berhasil dideteksi!\n";
        echo "Pesan: " . $e->getMessage() . "\n";
    }

} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
