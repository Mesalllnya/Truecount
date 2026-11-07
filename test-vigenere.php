<?php

require_once __DIR__ . '/backend/services/crypto/VigenereCipherService.php';

function test(string $name, bool $condition): void
{
    echo ($condition ? "[PASS] " : "[FAIL] ") . $name . PHP_EOL;
}

// Test 1: Contoh klasik Vigenere.
$plaintext = "ATTACKATDAWN";
$key = "LEMON";

$ciphertext = VigenereCipherService::encrypt($plaintext, $key);
$decrypted = VigenereCipherService::decrypt($ciphertext, $key);

echo "Plaintext  : $plaintext" . PHP_EOL;
echo "Key        : $key" . PHP_EOL;
echo "Ciphertext : $ciphertext" . PHP_EOL;
echo "Decrypted  : $decrypted" . PHP_EOL . PHP_EOL;

test("Contoh klasik menghasilkan LXFOPVEFRNHR", $ciphertext === "LXFOPVEFRNHR");
test("Dekripsi mengembalikan plaintext", $decrypted === $plaintext);

// Test 2: Huruf besar, kecil, spasi, dan tanda baca.
$plaintext2 = "Hello World! 123";
$ciphertext2 = VigenereCipherService::encrypt($plaintext2, "CRYPTO");
$decrypted2 = VigenereCipherService::decrypt($ciphertext2, "CRYPTO");

test("Karakter non-alfabet tetap dipertahankan", $decrypted2 === $plaintext2);

// Test 3: Key kosong harus ditolak.
try {
    VigenereCipherService::encrypt("HELLO", "");
    test("Key kosong ditolak", false);
} catch (InvalidArgumentException $e) {
    test("Key kosong ditolak", true);
}

// Test 4: Key dengan angka harus ditolak.
try {
    VigenereCipherService::encrypt("HELLO", "KEY123");
    test("Key non-alfabet ditolak", false);
} catch (InvalidArgumentException $e) {
    test("Key non-alfabet ditolak", true);
}
