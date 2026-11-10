<?php

/**
 * Vigenere Cipher Service
 * TrueCount - Cryptography Module
 *
 * Catatan: Vigenere merupakan cipher klasik untuk demonstrasi
 * pembelajaran, bukan untuk melindungi data sensitif.
 */

class VigenereCipherService
{
    /**
     * Validasi dan normalisasi key.
     * Key hanya boleh berisi huruf A-Z.
     */
    private static function normalizeKey(string $key): string
    {
        $key = strtoupper($key);

        if ($key === '' || !preg_match('/^[A-Z]+$/', $key)) {
            throw new InvalidArgumentException(
                'Key Vigenere harus berisi huruf alfabet A-Z saja.'
            );
        }

        return $key;
    }

    /**
     * Enkripsi plaintext menggunakan Vigenere Cipher.
     */
    public static function encrypt(string $plaintext, string $key): string
    {
        $key = self::normalizeKey($key);

        $result = '';
        $keyLength = strlen($key);
        $keyIndex = 0;

        for ($i = 0; $i < strlen($plaintext); $i++) {
            $char = $plaintext[$i];

            // Proses huruf kapital.
            if ($char >= 'A' && $char <= 'Z') {
                $plainValue = ord($char) - ord('A');
                $keyValue = ord($key[$keyIndex % $keyLength]) - ord('A');

                $cipherValue = ($plainValue + $keyValue) % 26;

                $result .= chr($cipherValue + ord('A'));
                $keyIndex++;
            }
            // Proses huruf kecil.
            elseif ($char >= 'a' && $char <= 'z') {
                $plainValue = ord($char) - ord('a');
                $keyValue = ord($key[$keyIndex % $keyLength]) - ord('A');

                $cipherValue = ($plainValue + $keyValue) % 26;

                $result .= chr($cipherValue + ord('a'));
                $keyIndex++;
            }
            // Spasi, angka, dan tanda baca tidak diubah.
            else {
                $result .= $char;
            }
        }

        return $result;
    }

    /**
     * Dekripsi ciphertext menggunakan Vigenere Cipher.
     */
    public static function decrypt(string $ciphertext, string $key): string
    {
        $key = self::normalizeKey($key);

        $result = '';
        $keyLength = strlen($key);
        $keyIndex = 0;

        for ($i = 0; $i < strlen($ciphertext); $i++) {
            $char = $ciphertext[$i];

            // Proses huruf kapital.
            if ($char >= 'A' && $char <= 'Z') {
                $cipherValue = ord($char) - ord('A');
                $keyValue = ord($key[$keyIndex % $keyLength]) - ord('A');

                $plainValue = ($cipherValue - $keyValue + 26) % 26;

                $result .= chr($plainValue + ord('A'));
                $keyIndex++;
            }
            // Proses huruf kecil.
            elseif ($char >= 'a' && $char <= 'z') {
                $cipherValue = ord($char) - ord('a');
                $keyValue = ord($key[$keyIndex % $keyLength]) - ord('A');

                $plainValue = ($cipherValue - $keyValue + 26) % 26;

                $result .= chr($plainValue + ord('a'));
                $keyIndex++;
            }
            // Spasi, angka, dan tanda baca tetap dipertahankan.
            else {
                $result .= $char;
            }
        }

        return $result;
    }
}
