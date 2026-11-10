<?php

/**
 * ChaCha20-Poly1305 Service
 * TrueCount - Cryptography Module
 */

require_once __DIR__ . '/../../config/env.php';

class ChaCha20Poly1305Service
{
    private const CIPHER = 'chacha20-poly1305';
    private const KEY_LENGTH = 32;
    private const NONCE_LENGTH = 12;
    private const TAG_LENGTH = 16;

    private static function getKey(): string
    {
        $encodedKey = getenv('CHACHA20_KEY_B64');

        if ($encodedKey === false || $encodedKey === '') {
            throw new RuntimeException(
                'ChaCha20 encryption key tidak ditemukan.'
            );
        }

        $key = base64_decode($encodedKey, true);

        if ($key === false || strlen($key) !== self::KEY_LENGTH) {
            throw new RuntimeException(
                'ChaCha20 key harus berukuran 32 byte.'
            );
        }

        return $key;
    }

    public static function encrypt(
        string $plaintext,
        string $aad = ''
    ): array {
        $key = self::getKey();

        // Nonce 96-bit.
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
            throw new RuntimeException(
                'Enkripsi ChaCha20-Poly1305 gagal.'
            );
        }

        if (strlen($tag) !== self::TAG_LENGTH) {
            throw new RuntimeException(
                'Authentication tag tidak valid.'
            );
        }

        return [
            'ciphertext' => base64_encode($ciphertext),
            'nonce' => base64_encode($nonce),
            'tag' => base64_encode($tag)
        ];
    }

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
                'Format data ChaCha20-Poly1305 tidak valid.'
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
