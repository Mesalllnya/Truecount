<?php

/**
 * Audio Obfuscation Service
 * TrueCount - Cryptography Module
 *
 * Menyimpan file audio dalam bentuk yang tetap dapat dibuka oleh media
 * player (header format audio dipertahankan), namun audio samples-nya
 * di-XOR dengan repeating key sehingga suara yang keluar berupa noise.
 *
 * Ketika dibuka melalui aplikasi TrueCount, de-obfuscation membalik XOR
 * sehingga suara asli dapat didengar kembali.
 *
 * Strategi per format:
 *   WAV         - Skip 44 byte RIFF/fmt/data header, XOR sisa (sample data)
 *   WebM        - Skip 4 byte EBML signature, XOR sisa
 *   OGG         - Skip 4 byte "OggS" signature, XOR sisa
 *   MP3         - Skip 3 byte ID3/frame signature, XOR sisa
 *   M4A/AAC/FLAC- Skip 8 byte container signature, XOR sisa
 *
 * Key repeating = HMAC-SHA256(CHACHA20_KEY, nonce) — 32 byte, diulang
 * sepanjang data audio agar seluruh samples ter-obfuscate.
 *
 * Nonce (32 hex chars) di-prefix ke awal file yang disimpan di storage.
 */

require_once __DIR__ . '/../../config/env.php';

class AudioObfuscationService
{
    /**
     * Offset (byte) header yang dipertahankan apa adanya per MIME type.
     * Bytes setelah offset ini yang di-XOR dengan repeating key.
     *
     * Offset dipilih cukup kecil agar hanya signature/magic bytes yang
     * dilewati — selebihnya (audio data) di-XOR.
     */
    private const HEADER_OFFSETS = [
        'audio/wav'   => 44,   // RIFF + fmt chunk + data chunk header
        'audio/x-wav' => 44,
        'audio/webm'  => 4,    // EBML signature (1A 45 DF A3)
        'video/webm'  => 4,
        'audio/ogg'   => 4,    // OggS capture pattern
        'audio/mpeg'  => 3,    // ID3 marker atau sync frame
        'audio/mp4'   => 8,    // ftyp box signature
        'video/mp4'   => 8,    // finfo mendeteksi MP4 audio sebagai video/mp4
        'audio/aac'   => 2,    // ADTS sync word
        'audio/flac'  => 4,    // fLaC marker
    ];

    private const DEFAULT_OFFSET = 4;
    private const NONCE_LENGTH   = 16; // bytes → 32 hex chars saat disimpan

    // ------------------------------------------------------------------ //
    //  Public API                                                          //
    // ------------------------------------------------------------------ //

    /**
     * Obfuscate audio bytes.
     *
     * @param  string $audioBytes  Plaintext audio (raw bytes)
     * @param  string $mimeType    MIME type (mis. 'audio/webm')
     * @return array{data: string, nonce: string}
     *         data  = bytes siap simpan (header asli + samples ter-XOR)
     *         nonce = 32 hex chars, sisipkan sebagai prefix di file storage
     */
    public static function obfuscate(string $audioBytes, string $mimeType): array
    {
        $nonce  = bin2hex(random_bytes(self::NONCE_LENGTH)); // 32 hex chars
        $offset = self::getOffset($mimeType);
        $key    = self::deriveKey($nonce);

        $header  = substr($audioBytes, 0, $offset);
        $payload = (string) substr($audioBytes, $offset);

        $obfuscated = $header . self::xorRepeating($payload, $key);

        return [
            'data'  => $obfuscated,
            'nonce' => $nonce,
        ];
    }

    /**
     * Kembalikan audio ke bentuk asli (XOR simetris).
     *
     * @param  string $obfuscatedBytes  Bytes audio yang ter-obfuscate
     * @param  string $mimeType         MIME type audio
     * @param  string $nonce            32 hex chars nonce
     * @return string Plaintext audio asli
     */
    public static function deobfuscate(
        string $obfuscatedBytes,
        string $mimeType,
        string $nonce
    ): string {
        $offset = self::getOffset($mimeType);
        $key    = self::deriveKey($nonce);

        $header  = substr($obfuscatedBytes, 0, $offset);
        $payload = (string) substr($obfuscatedBytes, $offset);

        // XOR simetris: operasi yang sama menghasilkan plaintext kembali.
        return $header . self::xorRepeating($payload, $key);
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
     * Derive 32-byte repeating XOR key dari master key + nonce.
     * HMAC-SHA256 menghasilkan output deterministik yang berbeda per nonce.
     */
    private static function deriveKey(string $nonce): string
    {
        return hash_hmac('sha256', $nonce, self::getKey(), true);
    }

    /**
     * XOR $data dengan repeating $key (key diulang sepanjang data).
     * Operasi ini simetris: XOR dua kali dengan key yang sama = data asli.
     */
    private static function xorRepeating(string $data, string $key): string
    {
        $dataLen = strlen($data);
        $keyLen  = strlen($key);

        if ($dataLen === 0 || $keyLen === 0) {
            return $data;
        }

        $result = '';
        for ($i = 0; $i < $dataLen; $i++) {
            $result .= $data[$i] ^ $key[$i % $keyLen];
        }

        return $result;
    }
}
