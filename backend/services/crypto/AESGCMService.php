<?php

/**
 * AES-256-GCM Service
 * TrueCount - Cryptography Module
 */

require_once __DIR__ . '/../../config/env.php';

class AESGCMService
{
    private const CIPHER = 'aes-256-gcm';
    private const NONCE_LENGTH = 12;
    private const TAG_LENGTH = 16;

    /**
     * Mengambil encryption key dari .env
     */
    private static function getKey(): string
    {
        $encodedKey = getenv('ENCRYPTION_KEY_B64');

        if ($encodedKey === false || $encodedKey === '') {
            throw new RuntimeException(
                'Encryption key tidak ditemukan.'
            );
        }

        $key = base64_decode($encodedKey, true);

        if ($key === false || strlen($key) !== 32) {
            throw new RuntimeException(
                'Encryption key harus 32 byte.'
            );
        }

        return $key;
    }

    /**
     * Enkripsi plaintext menggunakan AES-256-GCM.
     *
     * @param string $plaintext Data yang dienkripsi.
     * @param string $aad Additional Authenticated Data.
     */
    public static function encrypt(
        string $plaintext,
        string $aad = ''
    ): array {
        $key = self::getKey();

        // Nonce harus unik untuk setiap enkripsi dengan key yang sama.
        $nonce = random_bytes(self::NONCE_LENGTH);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $nonce,
            $tag,
            $aad,
            self::TAG_LENGTH
        );

        if ($ciphertext === false) {
            throw new RuntimeException('Enkripsi gagal.');
        }

        return [
            'ciphertext' => base64_encode($ciphertext),
            'nonce'      => base64_encode($nonce),
            'tag'        => base64_encode($tag)
        ];
    }

    /**
     * Dekripsi ciphertext menggunakan AES-256-GCM.
     *
     * AAD harus sama persis dengan AAD saat enkripsi.
     */
    public static function decrypt(
        string $ciphertext,
        string $nonce,
        string $tag,
        string $aad = ''
    ): string {
        $cipherRaw = base64_decode($ciphertext, true);
        $nonceRaw = base64_decode($nonce, true);
        $tagRaw = base64_decode($tag, true);

        if (
            $cipherRaw === false ||
            $nonceRaw === false ||
            $tagRaw === false ||
            strlen($nonceRaw) !== self::NONCE_LENGTH ||
            strlen($tagRaw) !== self::TAG_LENGTH
        ) {
            throw new InvalidArgumentException(
                'Format data tidak valid.'
            );
        }

        $plaintext = openssl_decrypt(
            $cipherRaw,
            self::CIPHER,
            self::getKey(),
            OPENSSL_RAW_DATA,
            $nonceRaw,
            $tagRaw,
            $aad
        );

        if ($plaintext === false) {
            throw new RuntimeException(
                'Dekripsi gagal: data tidak valid atau telah dimodifikasi.'
            );
        }

        return $plaintext;
    }
}
