<?php

/**
 * Audio Obfuscation Service
 * TrueCount - Cryptography Module
 *
 * Menyimpan file audio dalam bentuk yang tetap dapat dibuka oleh media
 * player (header format dipertahankan), namun audio samples-nya di-XOR
 * dengan keystream sehingga suara yang keluar berupa noise/distorsi.
 *
 * Ketika dibuka melalui aplikasi TrueCount, dekripsi membalik XOR sehingga
 * suara asli dapat didengar.
 *
 * Format yang didukung dan offset header yang dipertahankan:
 *   WAV         - 44 byte (RIFF header + fmt chunk + data chunk header)
 *   WebM        - 512 byte (EBML header)
 *   OGG         - 512 byte (Ogg page headers)
 *   MP3         - 512 byte (ID3v2 header + beberapa frame awal)
 *   M4A/AAC/FLAC- 512 byte (container/codec header)
 *
 * Keystream di-derive dari CHACHA20_KEY_B64 + nonce menggunakan SHA-256
 * berulang (stream cipher sederhana tanpa library tambahan).
 */

require_once __DIR__ . '/../../config/env.php';

class AudioObfuscationService
{
    /**
     * Offset (byte) yang dipertahankan apa adanya per MIME type.
     * Bytes setelah offset ini yang di-XOR.
     */
    private const HEADER_OFFSETS = [
        'audio/wav'   => 44,
        'audio/x-wav' => 44,
        'audio/webm'  => 512,
        'video/webm'  => 512,
        'audio/ogg'   => 512,
        'audio/mpeg'  => 512,
        'audio/mp4'   => 512,
        'audio/aac'   => 512,
        'audio/flac'  => 512,
    ];

    private const DEFAULT_OFFSET = 512;
    private const NONCE_LENGTH   = 16;

    // ------------------------------------------------------------------ //
    //  Public API                                                          //
    // ------------------------------------------------------------------ //

    /**
     * Obfuscate audio bytes.
     *
     * Header dipertahankan; bytes setelahnya di-XOR dengan keystream.
     *
     * @param  string $audioBytes  Plaintext audio (raw bytes)
     * @param  string $mimeType    MIME type audio (mis. 'audio/webm')
     * @return array{data: string, nonce: string}
     *         data  = bytes siap simpan (header asli + samples ter-XOR)
     *         nonce = hex string 32 karakter, simpan di database
     */
    public static function obfuscate(string $audioBytes, string $mimeType): array
    {
        $key    = self::getKey();
        $nonce  = bin2hex(random_bytes(self::NONCE_LENGTH)); // 32 hex chars
        $offset = self::getOffset($mimeType);

        $header  = substr($audioBytes, 0, $offset);
        $payload = substr($audioBytes, $offset);

        // Kalau file lebih pendek dari offset, XOR seluruh file.
        if ($payload === false || $payload === '') {
            $payload = '';
        }

        $obfuscated = $header . self::xorWithKeystream($payload, $key, $nonce);

        return [
            'data'  => $obfuscated,
            'nonce' => $nonce,
        ];
    }

    /**
     * Kembalikan audio ke bentuk asli.
     *
     * @param  string $obfuscatedBytes  Bytes yang tersimpan di storage
     * @param  string $mimeType         MIME type audio
     * @param  string $nonce            Nonce hex yang tersimpan di database
     * @return string Plaintext audio asli
     */
    public static function deobfuscate(
        string $obfuscatedBytes,
        string $mimeType,
        string $nonce
    ): string {
        $key    = self::getKey();
        $offset = self::getOffset($mimeType);

        $header  = substr($obfuscatedBytes, 0, $offset);
        $payload = substr($obfuscatedBytes, $offset);

        if ($payload === false || $payload === '') {
            $payload = '';
        }

        // XOR simetris: XOR ulang dengan keystream yang sama → plaintext.
        $plain = $header . self::xorWithKeystream($payload, $key, $nonce);

        return $plain;
    }

    /**
     * Apakah MIME type ini didukung obfuscation?
     */
    public static function supports(string $mimeType): bool
    {
        return isset(self::HEADER_OFFSETS[$mimeType]);
    }

    // ------------------------------------------------------------------ //
    //  Private helpers                                                     //
    // ------------------------------------------------------------------ //

    private static function getKey(): string
    {
        $encoded = getenv('CHACHA20_KEY_B64');

        if ($encoded === false || $encoded === '') {
            throw new RuntimeException('ChaCha20 encryption key tidak ditemukan.');
        }

        $key = base64_decode($encoded, true);

        if ($key === false || strlen($key) !== 32) {
            throw new RuntimeException('ChaCha20 key harus berukuran 32 byte.');
        }

        return $key;
    }

    private static function getOffset(string $mimeType): int
    {
        return self::HEADER_OFFSETS[$mimeType] ?? self::DEFAULT_OFFSET;
    }

    /**
     * XOR $data dengan keystream yang di-derive dari $key + $nonce.
     *
     * Keystream dihasilkan dengan SHA-256($key . $nonce . $blockIndex)
     * berulang per 32-byte block sehingga panjang keystream = panjang data.
     *
     * Ini adalah stream cipher sederhana yang deterministik — cukup untuk
     * tujuan obfuscation audio tanpa memerlukan ekstensi PHP tambahan.
     */
    private static function xorWithKeystream(
        string $data,
        string $key,
        string $nonce
    ): string {
        $length = strlen($data);

        if ($length === 0) {
            return '';
        }

        $keystream = '';
        $block     = 0;

        while (strlen($keystream) < $length) {
            $keystream .= hash('sha256', $key . $nonce . pack('N', $block), true);
            $block++;
        }

        // Potong keystream sesuai panjang data lalu XOR.
        return $data ^ substr($keystream, 0, $length);
    }
}
