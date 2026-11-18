<?php

/**
 * GET /voice-messages/inbox
 * Menampilkan voice message yang diterima admin yang sedang login.
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();
$recipientId = (int) ($authUser['sub'] ?? 0);

if ($recipientId <= 0) {
    jsonResponse(['error' => 'Identitas pengguna tidak valid.'], 401);
}

$db = getDB();

$stmt = $db->prepare(
    "SELECT
        vm.id,
        vm.sender_id,
        u.username AS sender_username,
        vm.duration_seconds,
        vm.is_read,
        vm.created_at,
        vm.read_at,
        ef.mime_type,
        ef.file_size
        FROM voice_messages vm
        INNER JOIN users u
        ON u.id = vm.sender_id
        INNER JOIN encrypted_files ef
        ON ef.id = vm.file_id
        WHERE vm.recipient_id = :recipient_id
        ORDER BY vm.created_at DESC, vm.id DESC"
);

$stmt->execute([
    ':recipient_id' => $recipientId
]);

$messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

$messages = array_map(function ($message) {
    return [
        'id' => (int) $message['id'],
        'sender_id' => (int) $message['sender_id'],
        'sender_username' => $message['sender_username'],
        'duration_seconds' => (float) $message['duration_seconds'],
        'is_read' => (bool) $message['is_read'],
        'created_at' => $message['created_at'],
        'read_at' => $message['read_at'],
        'mime_type' => $message['mime_type'],
        'file_size' => (int) $message['file_size']
    ];
}, $messages);

jsonResponse([
    'messages' => $messages,
    'total' => count($messages)
]);
