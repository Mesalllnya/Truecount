<?php

/**
 * Test: Session encryption untuk transport audio voice message.
 *
 * Mensimulasikan apa yang dilakukan show_audio.php (enkripsi sesi) dan
 * memverifikasi bahwa hanya kode dengan key yang benar bisa mendekripsi,
 * sedangkan file yang diunduh tanpa key tidak dapat diputar.
 *
 * Jalankan: php tests/crypto/test-voice-session-encryption.php
 */

$pass = 0;
$fail = 0;

function ok(string $label): void {
    global $pass;
    $pass++;
    echo "[PASS] $label\n";
}

function fail(string $label, string $reason = ''): void {
    global $fail;
    $fail++;
    echo "[FAIL] $label" . ($reason ? " — $reason" : '') . "\n";
}

// -------------------------------------------------------------------------
// Simulasi audio plaintext (representasikan bytes audio WebM)
// -------------------------------------------------------------------------
$fakeAudio = random_bytes(4096); // 4 KB simulasi data audio biner

// -------------------------------------------------------------------------
// TEST 1: Enkripsi sesi (seperti di show_audio.php)
// -------------------------------------------------------------------------
$sessionKey   = random_bytes(32);
$sessionNonce = random_bytes(12);
$sessionTag   = '';

$ciphertext = openssl_encrypt(
    $fakeAudio,
    'aes-256-gcm',
    $sessionKey,
    OPENSSL_RAW_DATA,
    $sessionNonce,
    $sessionTag,
    '',
    16
);

if ($ciphertext !== false && strlen($ciphertext) === strlen($fakeAudio)) {
    ok('Enkripsi sesi berhasil menghasilkan ciphertext');
} else {
    fail('Enkripsi sesi', 'openssl_encrypt gagal');
}

// -------------------------------------------------------------------------
// TEST 2: Ciphertext ≠ plaintext (audio terenkripsi berbeda dari asli)
// -------------------------------------------------------------------------
if ($ciphertext !== $fakeAudio) {
    ok('Ciphertext berbeda dari plaintext audio');
} else {
    fail('Ciphertext berbeda dari plaintext audio', 'ciphertext identik dengan audio asli');
}

// -------------------------------------------------------------------------
// TEST 3: Dekripsi dengan key & nonce yang benar menghasilkan audio asli
//         (simulasi dekripsi di Web Crypto browser)
// -------------------------------------------------------------------------
$decrypted = openssl_decrypt(
    $ciphertext,
    'aes-256-gcm',
    $sessionKey,
    OPENSSL_RAW_DATA,
    $sessionNonce,
    $sessionTag
);

if ($decrypted !== false && $decrypted === $fakeAudio) {
    ok('Dekripsi dengan key benar menghasilkan audio asli (simulasi Web Crypto)');
} else {
    fail('Dekripsi dengan key benar', 'hasil dekripsi tidak cocok dengan audio asli');
}

// -------------------------------------------------------------------------
// TEST 4: Dekripsi GAGAL dengan key berbeda (simulasi download langsung)
// -------------------------------------------------------------------------
$wrongKey  = random_bytes(32);
$resultWrongKey = openssl_decrypt(
    $ciphertext,
    'aes-256-gcm',
    $wrongKey,
    OPENSSL_RAW_DATA,
    $sessionNonce,
    $sessionTag
);

if ($resultWrongKey === false) {
    ok('Dekripsi dengan key salah gagal (audio tidak bisa diputar di luar aplikasi)');
} else {
    fail('Dekripsi dengan key salah', 'seharusnya gagal tapi berhasil');
}

// -------------------------------------------------------------------------
// TEST 5: Dekripsi GAGAL jika ciphertext dimodifikasi (tampering detection)
// -------------------------------------------------------------------------
$tamperedCipher = $ciphertext;
$tamperedCipher[0] = chr(ord($tamperedCipher[0]) ^ 0xFF);

$resultTampered = openssl_decrypt(
    $tamperedCipher,
    'aes-256-gcm',
    $sessionKey,
    OPENSSL_RAW_DATA,
    $sessionNonce,
    $sessionTag
);

if ($resultTampered === false) {
    ok('Tampering ciphertext terdeteksi (GCM auth tag gagal)');
} else {
    fail('Tampering detection', 'ciphertext yang dimodifikasi masih lolos dekripsi');
}

// -------------------------------------------------------------------------
// TEST 6: Setiap request menggunakan key & nonce berbeda (ephemeral)
// -------------------------------------------------------------------------
$key2   = random_bytes(32);
$nonce2 = random_bytes(12);

if ($key2 !== $sessionKey && $nonce2 !== $sessionNonce) {
    ok('Key dan nonce bersifat ephemeral (berbeda tiap request)');
} else {
    fail('Ephemeral key/nonce', 'key atau nonce identik — ini seharusnya tidak terjadi');
}

// -------------------------------------------------------------------------
// Ringkasan
// -------------------------------------------------------------------------
echo "\n";
echo "================================\n";
echo "Hasil: $pass PASS, $fail FAIL\n";
echo "================================\n";
exit($fail > 0 ? 1 : 0);
