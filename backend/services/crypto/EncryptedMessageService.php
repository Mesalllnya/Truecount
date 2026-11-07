
<?php

/**
 * Encrypted Message Service
 * TrueCount - Cryptography Module
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

    /**
     * Enkripsi pesan dan simpan ke database.
     *
     * Default tetap AES agar kompatibel dengan API lama.
     */
    public static function encryptAndStore(
        int $userId,
        string $plaintext,
        string $algorithm = 'aes256gcm'
    ): int {

        if ($userId <= 0) {
            throw new InvalidArgumentException(
                'User ID tidak valid.'
            );
        }

        if ($plaintext === '') {
            throw new InvalidArgumentException(
                'Pesan tidak boleh kosong.'
            );
        }

        if (!in_array(
            $algorithm,
            self::SUPPORTED_ALGORITHMS,
            true
        )) {
            throw new InvalidArgumentException(
                'Algoritma enkripsi tidak didukung.'
            );
        }

        // Pilih service berdasarkan algoritma.
        switch ($algorithm) {
            case 'aes256gcm':
                $encrypted = AESGCMService::encrypt($plaintext);
                break;

            case 'chacha20':
                $encrypted = ChaCha20Poly1305Service::encrypt($plaintext);
                break;

            default:
                throw new InvalidArgumentException(
                    'Algoritma tidak valid.'
                );
        }

        $db = getDB();

        $sql = "INSERT INTO encrypted_messages
                (user_id, algorithm, ciphertext, iv_nonce, auth_tag)
                VALUES
                (:user_id, :algorithm, :ciphertext, :nonce, :auth_tag)";

        $stmt = $db->prepare($sql);

        $stmt->execute([
            ':user_id'    => $userId,
            ':algorithm'  => $algorithm,
            ':ciphertext' => $encrypted['ciphertext'],
            ':nonce'      => $encrypted['nonce'],
            ':auth_tag'   => $encrypted['tag']
        ]);

        return (int) $db->lastInsertId();
    }

    /**
     * Ambil pesan dari database dan dekripsi.
     * Pesan hanya dapat diakses oleh pemiliknya.
     */
    public static function decryptById(
        int $messageId,
        int $userId
    ): string {

        if ($messageId <= 0 || $userId <= 0) {
            throw new InvalidArgumentException(
                'ID tidak valid.'
            );
        }

        $db = getDB();

        $sql = "SELECT ciphertext, iv_nonce, auth_tag, algorithm
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
            empty($message['auth_tag'])
        ) {
            throw new RuntimeException(
                'Data enkripsi tidak lengkap.'
            );
        }

        // Pilih algoritma berdasarkan data database.
        switch ($message['algorithm']) {
            case 'aes256gcm':
                return AESGCMService::decrypt(
                    $message['ciphertext'],
                    $message['iv_nonce'],
                    $message['auth_tag']
                );

            case 'chacha20':
                return ChaCha20Poly1305Service::decrypt(
                    $message['ciphertext'],
                    $message['iv_nonce'],
                    $message['auth_tag']
                );

            default:
                throw new RuntimeException(
                    'Algoritma enkripsi tidak didukung.'
                );
        }
    }
}
