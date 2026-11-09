
<?php

/**
 * File Encryption Service
 * TrueCount - Cryptography Module
 *
 * File encryption menggunakan ChaCha20-Poly1305.
 * Ciphertext disimpan di private storage.
 */

require_once __DIR__ . '/ChaCha20Poly1305Service.php';
require_once __DIR__ . '/../../config/database.php';

class FileEncryptionService
{
    private const ALGORITHM = 'chacha20';
    private const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

    /**
     * Direktori penyimpanan di luar public backend.
     */
    private static function getStorageDirectory(): string
    {
        return dirname(__DIR__, 2)
            . DIRECTORY_SEPARATOR . 'storage'
            . DIRECTORY_SEPARATOR . 'private'
            . DIRECTORY_SEPARATOR . 'encrypted-files';
    }

    /**
     * AAD mengikat ciphertext dengan konteks dan pemilik file.
     */
    private static function getAAD(int $userId): string
    {
        return 'truecount:file:v1:user:' . $userId;
    }

    /**
     * Enkripsi file dan simpan metadata ke database.
     */
    public static function encryptAndStore(
        int $userId,
        string $tmpPath,
        string $originalName
    ): int {
        if ($userId <= 0) {
            throw new InvalidArgumentException('User ID tidak valid.');
        }

        if (!is_file($tmpPath) || !is_readable($tmpPath)) {
            throw new InvalidArgumentException(
                'File tidak ditemukan atau tidak dapat dibaca.'
            );
        }

        // Bersihkan nama file dari path direktori.
        $originalName = basename(str_replace('\\', '/', $originalName));

        if (
            $originalName === '' ||
            strlen($originalName) > 255
        ) {
            throw new InvalidArgumentException('Nama file tidak valid.');
        }

        $fileSize = filesize($tmpPath);

        if ($fileSize === false || $fileSize <= 0) {
            throw new InvalidArgumentException(
                'File kosong atau ukuran tidak valid.'
            );
        }

        if ($fileSize > self::MAX_FILE_SIZE) {
            throw new InvalidArgumentException(
                'Ukuran file maksimal 20 MB.'
            );
        }

        $plaintext = file_get_contents($tmpPath);

        if ($plaintext === false) {
            throw new RuntimeException('Gagal membaca file.');
        }

        // Validasi ukuran aktual setelah file dibaca.
        $actualFileSize = strlen($plaintext);

        if ($actualFileSize !== $fileSize) {
            throw new RuntimeException(
                'Ukuran file berubah saat proses pembacaan.'
            );
        }

        // Deteksi MIME berdasarkan isi file, bukan nama file.
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($tmpPath);

        if ($mimeType === false) {
            $mimeType = 'application/octet-stream';
        }

        $aad = self::getAAD($userId);

        // Proses enkripsi ChaCha20-Poly1305.
        $encrypted = ChaCha20Poly1305Service::encrypt(
            $plaintext,
            $aad
        );

        $cipherRaw = base64_decode(
            $encrypted['ciphertext'],
            true
        );

        if ($cipherRaw === false) {
            throw new RuntimeException(
                'Format ciphertext tidak valid.'
            );
        }

        // SHA-256 dari ciphertext untuk pemeriksaan integritas storage.
        $fileHash = hash('sha256', $cipherRaw);

        $storageDirectory = self::getStorageDirectory();

        if (
            !is_dir($storageDirectory) &&
            !mkdir($storageDirectory, 0700, true) &&
            !is_dir($storageDirectory)
        ) {
            throw new RuntimeException(
                'Gagal membuat private storage.'
            );
        }

        // Nama acak agar nama asli file tidak terlihat di storage.
        $storedName = bin2hex(random_bytes(16)) . '.enc';
        $storedPath = $storageDirectory
            . DIRECTORY_SEPARATOR . $storedName;

        // Simpan ciphertext dalam bentuk binary.
        if (
            file_put_contents($storedPath, $cipherRaw, LOCK_EX) === false
        ) {
            throw new RuntimeException(
                'Gagal menyimpan encrypted file.'
            );
        }

        @chmod($storedPath, 0600);

        try {
            $db = getDB();

            $sql = "INSERT INTO encrypted_files (
                        user_id,
                        original_name,
                        stored_path,
                        algorithm,
                        nonce,
                        auth_tag,
                        file_hash,
                        file_size,
                        mime_type
                    ) VALUES (
                        :user_id,
                        :original_name,
                        :stored_path,
                        :algorithm,
                        :nonce,
                        :auth_tag,
                        :file_hash,
                        :file_size,
                        :mime_type
                    )";

            $stmt = $db->prepare($sql);

            $stmt->execute([
                ':user_id'       => $userId,
                ':original_name' => $originalName,
                ':stored_path'   => $storedName,
                ':algorithm'     => self::ALGORITHM,
                ':nonce'         => $encrypted['nonce'],
                ':auth_tag'      => $encrypted['tag'],
                ':file_hash'     => $fileHash,
                ':file_size'     => $actualFileSize,
                ':mime_type'     => $mimeType
            ]);

            return (int) $db->lastInsertId();

        } catch (Throwable $e) {
            // Jangan tinggalkan file yatim jika insert database gagal.
            if (is_file($storedPath)) {
                unlink($storedPath);
            }

            throw $e;
        }
    }

    /**
     * Ambil file milik user dan lakukan dekripsi.
     */
    public static function decryptById(
        int $fileId,
        int $userId
    ): array {
        if ($fileId <= 0 || $userId <= 0) {
            throw new InvalidArgumentException('ID tidak valid.');
        }

        $db = getDB();

        $sql = "SELECT
                    original_name,
                    stored_path,
                    algorithm,
                    nonce,
                    auth_tag,
                    file_hash,
                    file_size,
                    mime_type
                FROM encrypted_files
                WHERE id = :id AND user_id = :user_id
                LIMIT 1";

        $stmt = $db->prepare($sql);

        $stmt->execute([
            ':id'      => $fileId,
            ':user_id' => $userId
        ]);

        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$file) {
            throw new RuntimeException(
                'File tidak ditemukan atau tidak memiliki akses.'
            );
        }

        if ($file['algorithm'] !== self::ALGORITHM) {
            throw new RuntimeException(
                'Algoritma file tidak didukung.'
            );
        }

        // Validasi metadata ukuran.
        if (
            !isset($file['file_size']) ||
            !is_numeric($file['file_size']) ||
            (int) $file['file_size'] <= 0
        ) {
            throw new RuntimeException(
                'Metadata ukuran file tidak valid.'
            );
        }

        // Hanya izinkan nama file acak dengan format yang kita buat.
        if (
            !is_string($file['stored_path']) ||
            !preg_match('/^[a-f0-9]{32}\.enc$/', $file['stored_path'])
        ) {
            throw new RuntimeException(
                'Lokasi file tidak valid.'
            );
        }

        $storedPath = self::getStorageDirectory()
            . DIRECTORY_SEPARATOR . $file['stored_path'];

        if (!is_file($storedPath) || !is_readable($storedPath)) {
            throw new RuntimeException(
                'Encrypted file tidak ditemukan.'
            );
        }

        $cipherRaw = file_get_contents($storedPath);

        if ($cipherRaw === false) {
            throw new RuntimeException(
                'Gagal membaca encrypted file.'
            );
        }

        // Validasi format SHA-256 pada metadata.
        if (
            !is_string($file['file_hash']) ||
            !preg_match('/^[a-f0-9]{64}$/i', $file['file_hash'])
        ) {
            throw new RuntimeException(
                'Metadata hash file tidak valid.'
            );
        }

        // Verifikasi SHA-256 sebelum proses dekripsi.
        $actualHash = hash('sha256', $cipherRaw);

        if (!hash_equals($file['file_hash'], $actualHash)) {
            throw new RuntimeException(
                'Integritas file gagal: ciphertext telah dimodifikasi.'
            );
        }

        // Service menerima ciphertext dalam format Base64.
        $plaintext = ChaCha20Poly1305Service::decrypt(
            base64_encode($cipherRaw),
            $file['nonce'],
            $file['auth_tag'],
            self::getAAD($userId)
        );

        // Validasi konsistensi ukuran plaintext dengan metadata database.
        if (strlen($plaintext) !== (int) $file['file_size']) {
            throw new RuntimeException(
                'Integritas metadata gagal: ukuran plaintext tidak sesuai.'
            );
        }

        return [
            'original_name' => $file['original_name'],
            'mime_type'     => $file['mime_type'],
            'file_size'     => (int) $file['file_size'],
            'content'       => $plaintext
        ];
    }
}
