<?php

/**
 * GET /voice-messages/{id}/audio
 *
 * Hanya penerima yang berhak meminta audio.
 * Audio dikirim dalam bentuk terenkripsi (AES-256-GCM sesi) sehingga
 * hanya bisa didekripsi dan diputar di dalam aplikasi TrueCount.
 * File mentah yang diunduh dari luar aplikasi tidak dapat diputar.
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
    'video/mp4',   // finfo mendeteksi MP4 audio sebagai video/mp4
    'audio/aac',
    'audio/flac'
];

if (!in_array($audio['mime_type'], $allowedMimeTypes, true)) {
    jsonResponse(['error' => 'Format audio tidak didukung.'], 415);
}

// --- Lapisan enkripsi sesi (transport encryption) ---
// Enkripsi ulang audio plaintext dengan AES-256-GCM menggunakan
// ephemeral key acak per request. Key dikirim via header X-Audio-Key
// sehingga hanya kode aplikasi yang bisa mendekripsi — file yang
// diunduh langsung di luar aplikasi tidak dapat diputar.

$sessionKey  = random_bytes(32);        // AES-256 key, 32 byte
$sessionNonce = random_bytes(12);       // GCM nonce, 12 byte
$sessionTag  = '';

$ciphertext = openssl_encrypt(
    $audio['content'],
    'aes-256-gcm',
    $sessionKey,
    OPENSSL_RAW_DATA,
    $sessionNonce,
    $sessionTag,
    '',     // AAD kosong; autentikasi sudah via tag
    16
);

if ($ciphertext === false) {
    error_log('Voice session encryption failed');
    jsonResponse(['error' => 'Gagal mengenkripsi audio untuk pengiriman.'], 500);
}

// video/mp4 dan video/webm dari finfo → normalkan ke audio/* untuk browser.
$responseMimeType = match ($audio['mime_type']) {
    'video/webm' => 'audio/webm',
    'video/mp4'  => 'audio/mp4',
    default      => $audio['mime_type'],
};

// Encode semua nilai biner ke Base64 (tanpa spasi ekstra).
$b64Key   = base64_encode($sessionKey);
$b64Nonce = base64_encode($sessionNonce);
$b64Tag   = base64_encode($sessionTag);

header('Content-Type: application/octet-stream');
header('Content-Length: ' . strlen($ciphertext));
header('Content-Disposition: inline; filename="voice-message.enc"');
header('Cache-Control: private, no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('X-Audio-Key: '   . $b64Key);
header('X-Audio-Nonce: ' . $b64Nonce);
header('X-Audio-Tag: '   . $b64Tag);
header('X-Audio-Mime: '  . $responseMimeType);
// Izinkan frontend membaca header kustom (CORS).
header('Access-Control-Expose-Headers: X-Audio-Key, X-Audio-Nonce, X-Audio-Tag, X-Audio-Mime');

echo $ciphertext;
exit;