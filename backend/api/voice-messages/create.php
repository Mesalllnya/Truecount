<?php

/**
 * POST /voice-messages
 *
 * Upload voice message:
 * - Admin authentication
 * - Validate recipient
 * - Validate audio upload
 * - Encrypt using FileEncryptionService
 * - Save sender/recipient metadata
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../services/crypto/FileEncryptionService.php';
require_once __DIR__ . '/../../helpers/storage.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();

$senderId = (int) ($authUser['sub'] ?? 0);

if ($senderId <= 0) {
    jsonResponse(['error' => 'Identitas pengirim tidak valid.'], 401);
}

// Validasi penerima.
$recipientId = filter_var(
    $_POST['recipient_id'] ?? null,
    FILTER_VALIDATE_INT
);

if (!$recipientId || $recipientId <= 0) {
    jsonResponse(['error' => 'ID penerima tidak valid.'], 422);
}

if ($recipientId === $senderId) {
    jsonResponse(['error' => 'Tidak dapat mengirim pesan kepada diri sendiri.'], 422);
}

// Validasi durasi rekaman: maksimal 5 menit.
$duration = filter_var(
    $_POST['duration_seconds'] ?? null,
    FILTER_VALIDATE_FLOAT
);

if (
    $duration === false ||
    $duration <= 0 ||
    $duration > 300
) {
    jsonResponse(['error' => 'Durasi audio harus lebih dari 0 dan maksimal 300 detik.'], 422);
}

// Validasi file upload.
if (!isset($_FILES['audio'])) {
    jsonResponse(['error' => 'File audio wajib disertakan.'], 422);
}

$audio = $_FILES['audio'];

if ($audio['error'] !== UPLOAD_ERR_OK) {
    $message = match ($audio['error']) {
        UPLOAD_ERR_INI_SIZE,
        UPLOAD_ERR_FORM_SIZE => 'Ukuran audio melebihi batas upload.',
        UPLOAD_ERR_PARTIAL => 'File audio hanya terunggah sebagian.',
        UPLOAD_ERR_NO_FILE => 'File audio belum dipilih.',
        default => 'Terjadi kesalahan saat mengunggah audio.'
    };

    jsonResponse(['error' => $message], 422);
}

if (
    !isset($audio['tmp_name'], $audio['size']) ||
    !is_uploaded_file($audio['tmp_name'])
) {
    jsonResponse(['error' => 'File upload tidak valid.'], 422);
}

if ($audio['size'] <= 0 || $audio['size'] > 20 * 1024 * 1024) {
    jsonResponse(['error' => 'Ukuran audio harus antara 1 byte dan 20 MB.'], 422);
}

// Deteksi MIME berdasarkan isi file, bukan Content-Type dari client.
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($audio['tmp_name']);


$allowedAudioTypes = [
    'audio/webm'  => 'webm',
    'video/webm'  => 'webm',
    'audio/ogg'   => 'ogg',
    'audio/mpeg'  => 'mp3',
    'audio/wav'   => 'wav',
    'audio/x-wav' => 'wav',
    'audio/mp4'   => 'm4a',
    'video/mp4'   => 'm4a',  // finfo mendeteksi MP4 audio sebagai video/mp4
    'audio/aac'   => 'aac',
    'audio/flac'  => 'flac'
];

$browserMime = strtolower(
    trim(explode(';', $audio['type'] ?? '')[0])
);

// video/mp4 dari finfo diterima hanya kalau browser melaporkan audio/mp4.
$isMp4Audio =
    $mimeType === 'video/mp4' &&
    ($browserMime === 'audio/mp4' || $browserMime === 'video/mp4');

// video/webm dari finfo diterima hanya kalau browser melaporkan audio/webm.
$isWebmAudio =
    $mimeType === 'video/webm' &&
    $browserMime === 'audio/webm';

if (
    !is_string($mimeType) ||
    !isset($allowedAudioTypes[$mimeType]) ||
    ($mimeType === 'video/webm' && !$isWebmAudio) ||
    ($mimeType === 'video/mp4'  && !$isMp4Audio)
) {
    jsonResponse([
        'error' => 'Format audio tidak didukung.',
        'allowed_formats' => array_keys($allowedAudioTypes)
    ], 422);
}



$db = getDB();

// Pastikan penerima merupakan admin yang masih aktif.
$stmt = $db->prepare(
    "SELECT id
        FROM users
        WHERE id = :recipient_id
        AND role = 'admin'
        AND is_active = 1
        LIMIT 1"
);

$stmt->execute([
    ':recipient_id' => $recipientId
]);

if (!$stmt->fetch()) {
    jsonResponse(['error' => 'Penerima tidak ditemukan atau bukan admin aktif.'], 404);
}

// Nama file generik. Nama asli dari client tidak dipercaya.
$originalName = 'voice-message.' . $allowedAudioTypes[$mimeType];

$fileId = null;

try {
    // Enkripsi audio dan simpan ke encrypted_files.
    $fileId = FileEncryptionService::encryptAndStore(
        $senderId,
        $audio['tmp_name'],
        $originalName
    );

    // Simpan relasi pengirim, penerima, dan file.
    $stmt = $db->prepare(
        "INSERT INTO voice_messages (
            sender_id,
            recipient_id,
            file_id,
            duration_seconds
        ) VALUES (
            :sender_id,
            :recipient_id,
            :file_id,
            :duration_seconds
        )"
    );

    $stmt->execute([
        ':sender_id' => $senderId,
        ':recipient_id' => $recipientId,
        ':file_id' => $fileId,
        ':duration_seconds' => $duration
    ]);

    $voiceMessageId = (int) $db->lastInsertId();

    jsonResponse([
        'message' => 'Voice message berhasil dikirim dan dienkripsi.',
        'voice_message' => [
            'id' => $voiceMessageId,
            'recipient_id' => $recipientId,
            'duration_seconds' => (float) $duration,
            'mime_type' => $mimeType
        ]
    ], 201);

} catch (Throwable $e) {
    // Jika metadata voice message gagal dibuat,
    // bersihkan encrypted file yang sudah terlanjur disimpan.
    if ($fileId !== null) {
        try {
            $stmt = $db->prepare(
                "SELECT stored_path
                    FROM encrypted_files
                    WHERE id = :file_id
                    AND user_id = :sender_id
                    LIMIT 1"
            );

            $stmt->execute([
                ':file_id' => $fileId,
                ':sender_id' => $senderId
            ]);

            $storedFile = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($storedFile) {
                $storedName = $storedFile['stored_path'];

                if (preg_match('/^[a-f0-9]{32}\.enc$/', $storedName)) {
                    $storageDirectory = storagePath(
                        'private',
                        'encrypted-files'
                    );

                    $storedPath = $storageDirectory
                        . DIRECTORY_SEPARATOR . $storedName;

                    if (is_file($storedPath) && !unlink($storedPath)) {
                        throw new RuntimeException(
                            'Gagal membersihkan file terenkripsi.'
                        );
                    }

                    $deleteStmt = $db->prepare(
                        "DELETE FROM encrypted_files
                            WHERE id = :file_id
                            AND user_id = :sender_id"
                    );

                    $deleteStmt->execute([
                        ':file_id' => $fileId,
                        ':sender_id' => $senderId
                    ]);
                }
            }
        } catch (Throwable $cleanupError) {
            error_log(
                'Voice message cleanup failed: ' .
                $cleanupError->getMessage()
            );
        }
    }

    throw $e;
}
