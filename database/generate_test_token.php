#!/usr/bin/env php
<?php

/**
 * Generate test .truecount_token file untuk USB flashdisk
 * 
 * Usage: php generate_test_token.php [output_path] [user_id] [pin]
 * 
 * Contoh:
 *   php generate_test_token.php E:/ 1 "123456"
 *   php generate_test_token.php /media/user/USB 1 "mypin123"
 */

$args = array_slice($argv, 1);

if (empty($args)) {
    echo "Usage: php generate_test_token.php <drive_path> [user_id] [pin]\n";
    echo "Contoh: php generate_test_token.php E:/ 1 \"123456\"\n";
    echo "        php generate_test_token.php /media/user/USB 1 \"mypin123\"\n";
    exit(1);
}

$drivePath = rtrim($args[0], '/\\') . '/';
$userId = (int)($args[1] ?? 1);
$pin = $args[2] ?? '123456';

if (!is_dir($drivePath)) {
    echo "[✗] Drive path tidak valid: $drivePath\n";
    exit(1);
}

// Generate ECDSA P-256 keypair via openssl CLI (lebih reliable di Windows)
echo "[→] Generate ECDSA P-256 keypair via openssl CLI...\n";

$tmpDir = sys_get_temp_dir();
$privPemFile = $tmpDir . '/tc_priv_' . bin2hex(random_bytes(6)) . '.pem';
$pubPemFile  = $tmpDir . '/tc_pub_' . bin2hex(random_bytes(6)) . '.pem';

// Generate EC private key (SEC1 PEM)
$cmd = 'openssl ecparam -name prime256v1 -genkey -noout -out "' . $privPemFile . '" 2>&1';
exec($cmd, $out, $ret);
if ($ret !== 0) {
    echo "[✗] openssl ecparam gagal: " . implode("\n", $out) . "\n";
    exit(1);
}

// Convert ke PKCS#8 DER
$pkcs8DerFile = $tmpDir . '/tc_pkcs8_' . bin2hex(random_bytes(6)) . '.der';
$cmd = 'openssl pkcs8 -topk8 -nocrypt -in "' . $privPemFile . '" -outform DER -out "' . $pkcs8DerFile . '" 2>&1';
exec($cmd, $out, $ret);
if ($ret !== 0 || !file_exists($pkcs8DerFile)) {
    echo "[✗] openssl pkcs8 gagal: " . implode("\n", $out) . "\n";
    exit(1);
}
$pkcs8Der = file_get_contents($pkcs8DerFile);
if (empty($pkcs8Der)) {
    echo "[✗] Gagal konversi PKCS#8\n";
    exit(1);
}

// Export public key SPKI DER
$spkiDerFile = $tmpDir . '/tc_spki_' . bin2hex(random_bytes(6)) . '.der';
$cmd = 'openssl pkey -in "' . $privPemFile . '" -pubout -outform DER -out "' . $spkiDerFile . '" 2>&1';
exec($cmd, $out, $ret);
if ($ret !== 0 || !file_exists($spkiDerFile)) {
    echo "[✗] openssl pkey gagal: " . implode("\n", $out) . "\n";
    exit(1);
}
$spkiDer = file_get_contents($spkiDerFile);
if (empty($spkiDer)) {
    echo "[✗] Gagal export public key\n";
    exit(1);
}

// Cleanup temp files
@unlink($privPemFile);
@unlink($pubPemFile);
@unlink($pkcs8DerFile);
@unlink($spkiDerFile);

echo "    OK - keypair generated (" . strlen($pkcs8Der) . " bytes private, " . strlen($spkiDer) . " bytes public)\n";

// Encrypt private key with AES-256-GCM using PBKDF2
$salt = random_bytes(16);
$iv = random_bytes(12);
$iterations = 100_000;
$key = hash_pbkdf2('sha256', $pin, $salt, $iterations, 32, true);

$cipher = 'aes-256-gcm';
$ciphertext = openssl_encrypt($pkcs8Der, $cipher, $key, OPENSSL_RAW_DATA, $iv, $tag);
if ($ciphertext === false) {
    echo "[✗] Gagal enkripsi private key\n";
    exit(1);
}
$ciphertextWithTag = $ciphertext . $tag;

// Build token file
$token = [
    'v' => 1,
    'uid' => $userId,
    'alg' => 'ES256',
    'pk' => rtrim(strtr(base64_encode($spkiDer), '+/', '-_'), '='),
    'sk_enc' => rtrim(strtr(base64_encode($ciphertextWithTag), '+/', '-_'), '='),
    'salt' => rtrim(strtr(base64_encode($salt), '+/', '-_'), '='),
    'iv' => rtrim(strtr(base64_encode($iv), '+/', '-_'), '='),
];

$outputFile = $drivePath . '.truecount_token';
$json = json_encode($token, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
file_put_contents($outputFile, $json);

// Hide file on Windows
if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    exec("attrib +h \"$outputFile\"");
}

echo "[✓] Token file dibuat: $outputFile\n";
echo "    User ID: $userId\n";
echo "    PIN: $pin\n";
echo "    Credential ID: " . bin2hex(hash('sha256', $spkiDer, true)) . "\n";
echo "\n";
echo "Sekarang colokkan USB, buka http://localhost:5173/usb-token-test\n";
echo "Sistem akan auto-deteksi token ini dalam 2 detik.\n";