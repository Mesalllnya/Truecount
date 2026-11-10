<?php

require_once __DIR__ . '/ChaCha20Poly1305Service.php';

class SteganographyService
{
    private const MAGIC = 'TCST';
    private const VERSION = 1;

    // 4 magic + 1 version + 12 nonce + 16 tag + 4 length
    private const HEADER_SIZE = 37;

    private const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

    private static function getAAD(int $userId): string
    {
        return 'truecount:steganography:v1:user:' . $userId;
    }

    /**
     * Membaca PNG dan menyiapkan GD untuk manipulasi LSB.
     */
    private static function loadPng(string $path)
    {
        if (!extension_loaded('gd')) {
            throw new RuntimeException('Ekstensi GD belum aktif.');
        }

        if (!is_file($path) || !is_readable($path)) {
            throw new InvalidArgumentException(
                'Gambar tidak ditemukan atau tidak dapat dibaca.'
            );
        }

        $size = filesize($path);

        if ($size === false || $size > self::MAX_IMAGE_SIZE) {
            throw new InvalidArgumentException(
                'Ukuran gambar maksimal 10 MB.'
            );
        }

        $info = getimagesize($path);

        if (!$info || $info['mime'] !== 'image/png') {
            throw new InvalidArgumentException(
                'Format gambar harus PNG.'
            );
        }

        $image = imagecreatefrompng($path);

        if (!$image) {
            throw new RuntimeException('Gagal membaca gambar PNG.');
        }

        if (!imageistruecolor($image)) {
            imagepalettetotruecolor($image);
        }

        // PENTING: jangan blend RGB saat memodifikasi pixel.
        imagealphablending($image, false);

        // Pertahankan alpha channel ketika menyimpan PNG.
        imagesavealpha($image, true);

        return $image;
    }

    /**
     * Mengubah pesan menjadi payload terenkripsi.
     */
    private static function buildPayload(
        string $message,
        int $userId
    ): string {
        if ($userId <= 0) {
            throw new InvalidArgumentException('User ID tidak valid.');
        }

        $encrypted = ChaCha20Poly1305Service::encrypt(
            $message,
            self::getAAD($userId)
        );

        $nonce = base64_decode($encrypted['nonce'], true);
        $tag = base64_decode($encrypted['tag'], true);
        $ciphertext = base64_decode(
            $encrypted['ciphertext'],
            true
        );

        if (
            $nonce === false ||
            strlen($nonce) !== 12 ||
            $tag === false ||
            strlen($tag) !== 16 ||
            $ciphertext === false ||
            strlen($ciphertext) === 0
        ) {
            throw new RuntimeException(
                'Hasil enkripsi tidak valid.'
            );
        }

        return self::MAGIC
            . chr(self::VERSION)
            . $nonce
            . $tag
            . pack('N', strlen($ciphertext))
            . $ciphertext;
    }

    /**
     * Mengubah satu bit pada channel RGB.
     *
     * Format warna GD truecolor:
     * Alpha: bit 24-30
     * Red  : bit 16-23
     * Green: bit 8-15
     * Blue : bit 0-7
     */
    private static function setBit(
        $image,
        int $bitIndex,
        int $bit
    ): void {
        $width = imagesx($image);

        $pixelIndex = intdiv($bitIndex, 3);
        $channel = $bitIndex % 3;

        $x = $pixelIndex % $width;
        $y = intdiv($pixelIndex, $width);

        $color = imagecolorat($image, $x, $y);

        $r = ($color >> 16) & 0xFF;
        $g = ($color >> 8) & 0xFF;
        $b = $color & 0xFF;
        $alpha = ($color >> 24) & 0x7F;

        $channels = [$r, $g, $b];

        $channels[$channel] =
            ($channels[$channel] & 0xFE) | $bit;

        // Susun ulang warna secara langsung agar alpha
        // dan RGB dipertahankan tanpa alpha blending.
        $newColor = ($alpha << 24)
            | ($channels[0] << 16)
            | ($channels[1] << 8)
            | $channels[2];

        imagesetpixel($image, $x, $y, $newColor);
    }

    /**
     * Membaca satu bit dari channel RGB.
     */
    private static function getBit(
        $image,
        int $bitIndex
    ): int {
        $width = imagesx($image);

        $pixelIndex = intdiv($bitIndex, 3);
        $channel = $bitIndex % 3;

        $x = $pixelIndex % $width;
        $y = intdiv($pixelIndex, $width);

        $color = imagecolorat($image, $x, $y);

        $channels = [
            ($color >> 16) & 0xFF,
            ($color >> 8) & 0xFF,
            $color & 0xFF
        ];

        return $channels[$channel] & 1;
    }

    /**
     * Mengubah byte menjadi array bit MSB-first.
     */
    private static function bytesToBits(string $data): array
    {
        $bits = [];

        $bytes = unpack('C*', $data);

        foreach ($bytes as $byte) {
            for ($i = 7; $i >= 0; $i--) {
                $bits[] = ($byte >> $i) & 1;
            }
        }

        return $bits;
    }

    /**
     * Mengubah array bit menjadi byte.
     */
    private static function bitsToBytes(array $bits): string
    {
        $result = '';

        foreach (array_chunk($bits, 8) as $chunk) {
            if (count($chunk) !== 8) {
                throw new RuntimeException(
                    'Data bit tidak lengkap.'
                );
            }

            $byte = 0;

            foreach ($chunk as $bit) {
                $byte = ($byte << 1) | $bit;
            }

            $result .= chr($byte);
        }

        return $result;
    }

    /**
     * Membaca sejumlah byte dari gambar.
     */
    private static function readBytes(
        $image,
        int $startBit,
        int $length
    ): string {
        if ($length < 0) {
            throw new InvalidArgumentException(
                'Panjang data tidak valid.'
            );
        }

        $bits = [];

        for ($i = 0; $i < $length * 8; $i++) {
            $bits[] = self::getBit(
                $image,
                $startBit + $i
            );
        }

        return self::bitsToBytes($bits);
    }

    /**
     * Embed pesan terenkripsi ke dalam gambar PNG.
     */
    public static function embedMessage(
        string $message,
        string $carrierPath,
        string $outputPath,
        int $userId
    ): array {
        if ($message === '') {
            throw new InvalidArgumentException(
                'Pesan tidak boleh kosong.'
            );
        }

        if ($userId <= 0) {
            throw new InvalidArgumentException(
                'User ID tidak valid.'
            );
        }

        $outputDirectory = dirname($outputPath);

        if (!is_dir($outputDirectory)) {
            throw new InvalidArgumentException(
                'Direktori output tidak ditemukan.'
            );
        }

        if (
            strtolower(pathinfo($outputPath, PATHINFO_EXTENSION))
            !== 'png'
        ) {
            throw new InvalidArgumentException(
                'Output harus menggunakan format PNG.'
            );
        }

        if (
            realpath($carrierPath) !== false &&
            realpath($carrierPath) === realpath($outputPath)
        ) {
            throw new InvalidArgumentException(
                'Output tidak boleh menimpa carrier image.'
            );
        }

        $payload = self::buildPayload($message, $userId);
        $image = self::loadPng($carrierPath);

        try {
            $width = imagesx($image);
            $height = imagesy($image);

            $capacityBits = $width * $height * 3;
            $payloadBits = strlen($payload) * 8;

            if ($payloadBits > $capacityBits) {
                throw new RuntimeException(
                    'Kapasitas gambar tidak mencukupi.'
                );
            }

            $bits = self::bytesToBits($payload);

            foreach ($bits as $index => $bit) {
                self::setBit($image, $index, $bit);
            }

            // Pastikan konfigurasi alpha tetap benar.
            imagesavealpha($image, true);

            if (!imagepng($image, $outputPath, 6)) {
                throw new RuntimeException(
                    'Gagal menyimpan stego image.'
                );
            }

            return [
                'output_path' => $outputPath,
                'payload_size' => strlen($payload),
                'capacity_bytes' => intdiv(
                    $capacityBits,
                    8
                ),
                'image_width' => $width,
                'image_height' => $height
            ];

        } finally {
            imagedestroy($image);
        }
    }

    /**
     * Extract dan decrypt pesan dari stego image.
     */
    public static function extractMessage(
        string $stegoPath,
        int $userId
    ): string {
        if ($userId <= 0) {
            throw new InvalidArgumentException(
                'User ID tidak valid.'
            );
        }

        $image = self::loadPng($stegoPath);

        try {
            $capacityBits = imagesx($image)
                * imagesy($image) * 3;

            if (
                $capacityBits <
                self::HEADER_SIZE * 8
            ) {
                throw new RuntimeException(
                    'Gambar terlalu kecil.'
                );
            }

            // Baca header.
            $header = self::readBytes(
                $image,
                0,
                self::HEADER_SIZE
            );

            $magic = substr($header, 0, 4);
            $version = ord($header[4]);

            if (
                $magic !== self::MAGIC ||
                $version !== self::VERSION
            ) {
                throw new RuntimeException(
                    'Tidak ditemukan pesan TrueCount yang valid.'
                );
            }

            $nonce = substr($header, 5, 12);
            $tag = substr($header, 17, 16);

            $lengthData = unpack(
                'Nlength',
                substr($header, 33, 4)
            );

            $length = $lengthData['length'];

            if ($length <= 0) {
                throw new RuntimeException(
                    'Panjang ciphertext tidak valid.'
                );
            }

            $totalLength = self::HEADER_SIZE + $length;

            if (
                $totalLength >
                intdiv($capacityBits, 8)
            ) {
                throw new RuntimeException(
                    'Payload melebihi kapasitas gambar.'
                );
            }

            // Baca ciphertext setelah header.
            $ciphertext = self::readBytes(
                $image,
                self::HEADER_SIZE * 8,
                $length
            );

            // Verifikasi authentication tag melalui ChaCha20.
            return ChaCha20Poly1305Service::decrypt(
                base64_encode($ciphertext),
                base64_encode($nonce),
                base64_encode($tag),
                self::getAAD($userId)
            );

        } finally {
            imagedestroy($image);
        }
    }
}
