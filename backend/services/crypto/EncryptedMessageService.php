<?php

/**
 * Encrypted Message Service
 * TrueCount - Cryptography Module
 *
 * Crypto version:
 * - 0: Legacy message, encrypted without AAD.
 * - 1: Message encrypted with user-specific AAD.
 */

require_once __DIR__ . '/AESGCMService.php';
require_once __DIR__ . '/ChaCha20Poly1305Service.php';
require_once __DIR__ . '/../../config/database.php';

class EncryptedMessageService
{
    private const SUPPORTED_ALGORITHMS = [
        'aes256gcm',
        'chacha20'
    ];

    private const CRYPTO_VERSION = 1;

    /**
     * AAD mengikat ciphertext ke pemilik pesan.
     */
    private static function buildAAD(int $userId): string
    {
        return 'truecount:message:v1:user:' . $userId;
    }

    /**
     * Enkripsi pesan dan simpan ke database.
     *
     * Pesan baru selalu menggunakan crypto_version 1 dan AAD.
     * Default tetap AES agar kompatibel dengan API lama.
     */
    public static function encryptAndStore(
        int $userId,
        string $plaintext,
        string $algorithm = 'aes256gcm'
    ): int {
        if ($userId <= 0) {
            throw new InvalidArgumentException('User ID tidak valid.');
        }

        if ($plaintext === '') {
            throw new InvalidArgumentException('Pesan tidak boleh kosong.');
        }

        if (!in_array($algorithm, self::SUPPORTED_ALGORITHMS, true)) {
            throw new InvalidArgumentException(
                'Algoritma enkripsi tidak didukung.'
            );
        }

        $aad = self::buildAAD($userId);

        switch ($algorithm) {
            case 'aes256gcm':
                $encrypted = AESGCMService::encrypt($plaintext, $aad);
                break;

            case 'chacha20':
                $encrypted = ChaCha20Poly1305Service::encrypt(
                    $plaintext,
                    $aad
                );
                break;

            default:
                throw new InvalidArgumentException('Algoritma tidak valid.');
        }

        $db = getDB();

        $sql = "INSERT INTO encrypted_messages
                (
                    user_id,
                    algorithm,
                    ciphertext,
                    iv_nonce,
                    auth_tag,
                    crypto_version
                )
                VALUES
                (
                    :user_id,
                    :algorithm,
                    :ciphertext,
                    :nonce,
                    :auth_tag,
                    :crypto_version
                )";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':user_id'        => $userId,
            ':algorithm'      => $algorithm,
            ':ciphertext'     => $encrypted['ciphertext'],
            ':nonce'          => $encrypted['nonce'],
            ':auth_tag'       => $encrypted['tag'],
            ':crypto_version' => self::CRYPTO_VERSION
        ]);

        return (int) $db->lastInsertId();
    }

    /**
     * Ambil pesan dari database dan dekripsi.
     * Pesan hanya dapat diakses oleh pemiliknya.
     *
     * Versi 0: tanpa AAD (data lama).
     * Versi 1: AAD berbasis user_id (data baru).
     */
    public static function decryptById(
        int $messageId,
        int $userId
    ): string {
        if ($messageId <= 0 || $userId <= 0) {
            throw new InvalidArgumentException('ID tidak valid.');
        }

        $db = getDB();

        $sql = "SELECT
                    ciphertext,
                    iv_nonce,
                    auth_tag,
                    algorithm,
                    crypto_version
                FROM encrypted_messages
                WHERE id = :id AND user_id = :user_id
                LIMIT 1";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':id'      => $messageId,
            ':user_id' => $userId
        ]);

        $message = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$message) {
            throw new RuntimeException(
                'Pesan tidak ditemukan atau tidak memiliki akses.'
            );
        }

        if (
            empty($message['iv_nonce']) ||
            empty($message['auth_tag']) ||
            !isset($message['crypto_version'])
        ) {
            throw new RuntimeException('Data enkripsi tidak lengkap.');
        }

        $cryptoVersion = (int) $message['crypto_version'];

        switch ($cryptoVersion) {
            case 0:
                $aad = '';
                break;

            case self::CRYPTO_VERSION:
                $aad = self::buildAAD($userId);
                break;

            default:
                throw new RuntimeException(
                    'Versi enkripsi tidak didukung.'
                );
        }

        switch ($message['algorithm']) {
            case 'aes256gcm':
                return AESGCMService::decrypt(
                    $message['ciphertext'],
                    $message['iv_nonce'],
                    $message['auth_tag'],
                    $aad
                );

            case 'chacha20':
                return ChaCha20Poly1305Service::decrypt(
                    $message['ciphertext'],
                    $message['iv_nonce'],
                    $message['auth_tag'],
                    $aad
                );

            default:
                throw new RuntimeException(
                    'Algoritma enkripsi tidak didukung.'
                );
        }
    }
}
