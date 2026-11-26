<?php

/**
 * Encrypted Message Service
 * TrueCount - Cryptography Module
 *
 * Crypto version:
 * - 0: Legacy message / Vigenere without AAD.
 * - 1: Message encrypted with user-specific AAD.
 */

require_once __DIR__ . '/AESGCMService.php';
require_once __DIR__ . '/ChaCha20Poly1305Service.php';
require_once __DIR__ . '/VigenereCipherService.php';
require_once __DIR__ . '/../../config/database.php';

class EncryptedMessageService
{
    private const SUPPORTED_ALGORITHMS = [
        'aes256gcm',
        'chacha20',
        'vigenere'
    ];

    private const CRYPTO_VERSION = 1;

    private static function buildAAD(int $userId): string
    {
        return 'truecount:message:v1:user:' . $userId;
    }

    public static function encryptAndStore(
        int $userId,
        string $plaintext,
        string $algorithm = 'aes256gcm',
        string $vigenereKey = ''
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

        $nonce = null;
        $tag = null;

        if ($algorithm === 'vigenere') {
            $ciphertext = VigenereCipherService::encrypt(
                $plaintext,
                $vigenereKey
            );

            // Vigenere tidak menggunakan nonce, tag, maupun AAD.
            $cryptoVersion = 0;
        } else {
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
                    throw new InvalidArgumentException(
                        'Algoritma tidak valid.'
                    );
            }

            $ciphertext = $encrypted['ciphertext'];
            $nonce = $encrypted['nonce'];
            $tag = $encrypted['tag'];
            $cryptoVersion = self::CRYPTO_VERSION;
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
            ':user_id' => $userId,
            ':algorithm' => $algorithm,
            ':ciphertext' => $ciphertext,
            ':nonce' => $nonce,
            ':auth_tag' => $tag,
            ':crypto_version' => $cryptoVersion
        ]);

        return (int) $db->lastInsertId();
    }

    public static function decryptById(
        int $messageId,
        int $userId,
        string $vigenereKey = ''
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
            ':id' => $messageId,
            ':user_id' => $userId
        ]);

        $message = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$message) {
            throw new RuntimeException(
                'Pesan tidak ditemukan atau tidak memiliki akses.'
            );
        }

        // Vigenere tidak menggunakan nonce, tag, maupun AAD.
        if ($message['algorithm'] === 'vigenere') {
            if ((int) $message['crypto_version'] !== 0) {
                throw new RuntimeException(
                    'Versi enkripsi Vigenere tidak didukung.'
                );
            }

            return VigenereCipherService::decrypt(
                $message['ciphertext'],
                $vigenereKey
            );
        }

        // Validasi khusus AES dan ChaCha.
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
