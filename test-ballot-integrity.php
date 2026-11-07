<?php

require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/services/crypto/AESGCMService.php';

echo "=== BALLOT INTEGRITY VERIFICATION ===\n\n";

$db = getDB();

// Ambil ballot pengujian
$stmt = $db->prepare("
    SELECT id, election_id, encrypted_vote,
        nonce, auth_tag, integrity_hash
    FROM ballots
    WHERE id = :id
    LIMIT 1
");

$stmt->execute([':id' => 1]);
$ballot = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$ballot) {
    die("ERROR: Ballot tidak ditemukan.\n");
}

echo "Ballot ID: " . $ballot['id'] . "\n";

// 1. Hitung ulang SHA-256
$calculatedHash = hash(
    'sha256',
    $ballot['encrypted_vote'] .
    $ballot['nonce'] .
    $ballot['auth_tag']
);

if (hash_equals($ballot['integrity_hash'], $calculatedHash)) {
    echo "Integrity Hash: VALID\n";
} else {
    die("Integrity Hash: INVALID\n");
}

// 2. Uji dekripsi normal
try {
    $plaintext = AESGCMService::decrypt(
        $ballot['encrypted_vote'],
        $ballot['nonce'],
        $ballot['auth_tag']
    );

    echo "AES-GCM Decryption: BERHASIL\n";
} catch (Throwable $e) {
    die("Dekripsi normal gagal: " . $e->getMessage() . "\n");
}

// 3. Simulasi tampering di memory saja
echo "\n=== TAMPERING DETECTION TEST ===\n";

$cipherRaw = base64_decode(
    $ballot['encrypted_vote'],
    true
);

if ($cipherRaw === false || strlen($cipherRaw) === 0) {
    die("Ciphertext tidak valid untuk pengujian.\n");
}

// Ubah satu byte pertama
$cipherRaw[0] = chr(ord($cipherRaw[0]) ^ 1);

$tamperedCiphertext = base64_encode($cipherRaw);

try {
    AESGCMService::decrypt(
        $tamperedCiphertext,
        $ballot['nonce'],
        $ballot['auth_tag']
    );

    echo "FAIL: Ciphertext yang dimodifikasi berhasil didekripsi.\n";

} catch (Throwable $e) {
    echo "PASS: Tampering berhasil dideteksi!\n";
    echo "Pesan: " . $e->getMessage() . "\n";
}

echo "\nDatabase asli tidak diubah.\n";
echo "=== TEST SELESAI ===\n";
