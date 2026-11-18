<?php

/**
 * GET /voice-messages/{id}/audio
 *
 * Hanya penerima yang berhak meminta audio.
 */

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../services/crypto/FileEncryptionService.php';

$authUser = requireAdmin();
$recipientId = (int) ($authUser['sub'] ?? 0);

$voiceMessageId = filter_var(
    $_GET['id'] ?? null,
    FILTER_VALIDATE_INT
);

if (
    $recipientId <= 0 ||
    !$voiceMessageId ||
    $voiceMessageId <= 0
) {
    jsonResponse(['error' => 'Parameter tidak valid.'], 422);
}

$db = getDB();

// Periksa bahwa pesan memang ditujukan kepada admin yang login.
$stmt = $db->prepare(
    "SELECT
        vm.id,
        vm.sender_id,
        vm.file_id,
        ef.mime_type
        FROM voice_messages vm
        INNER JOIN encrypted_files ef
        ON ef.id = vm.file_id
        WHERE vm.id = :message_id
        AND vm.recipient_id = :recipient_id
        LIMIT 1"
);

$stmt->execute([
    ':message_id' => $voiceMessageId,
    ':recipient_id' => $recipientId
]);

$message = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$message) {
    jsonResponse([
        'error' => 'Voice message tidak ditemukan atau akses ditolak.'
    ], 404);
}

// Pemilik file adalah pengirim, bukan penerima.
try {
    $audio = FileEncryptionService::decryptById(
        (int) $message['file_id'],
        (int) $message['sender_id']
    );
} catch (Throwable $e) {
    error_log('Voice playback failed: ' . $e->getMessage());

    jsonResponse([
        'error' => 'Gagal memproses audio.'
    ], 500);
}


$allowedMimeTypes = [
    'audio/webm',
    'video/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/aac',
    'audio/flac'
];

if (!in_array($audio['mime_type'], $allowedMimeTypes, true)) {
    jsonResponse(['error' => 'Format audio tidak didukung.'], 415);
}

// WebM yang direkam sebagai audio dikirim dengan MIME audio/webm.
$responseMimeType = $audio['mime_type'] === 'video/webm'
    ? 'audio/webm'
    : $audio['mime_type'];

header('Content-Type: ' . $responseMimeType);
header('Content-Length: ' . strlen($audio['content']));
header('Content-Disposition: inline; filename="voice-message-audio"');
header('Cache-Control: private, no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

echo $audio['content'];
exit;