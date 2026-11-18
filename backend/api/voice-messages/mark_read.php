<?php

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();
$recipientId = (int) ($authUser['sub'] ?? 0);

$messageId = filter_var(
    $_GET['id'] ?? null,
    FILTER_VALIDATE_INT
);

if ($recipientId <= 0 || !$messageId || $messageId <= 0) {
    jsonResponse(['error' => 'Parameter tidak valid.'], 422);
}

$db = getDB();

$stmt = $db->prepare(
    "UPDATE voice_messages
        SET is_read = 1,
            read_at = COALESCE(read_at, NOW())
        WHERE id = :message_id
        AND recipient_id = :recipient_id"
);

$stmt->execute([
    ':message_id' => $messageId,
    ':recipient_id' => $recipientId
]);

if ($stmt->rowCount() === 0) {
    // Cek apakah pesan memang sudah dibaca oleh penerima.
    $check = $db->prepare(
        "SELECT id, is_read
            FROM voice_messages
            WHERE id = :message_id
            AND recipient_id = :recipient_id
            LIMIT 1"
    );

    $check->execute([
        ':message_id' => $messageId,
        ':recipient_id' => $recipientId
    ]);

    $message = $check->fetch(PDO::FETCH_ASSOC);

    if (!$message) {
        jsonResponse(['error' => 'Pesan tidak ditemukan atau akses ditolak.'], 404);
    }
}

jsonResponse([
    'message' => 'Voice message berhasil ditandai sudah dibaca.',
    'voice_message_id' => (int) $messageId,
    'is_read' => true
]);
