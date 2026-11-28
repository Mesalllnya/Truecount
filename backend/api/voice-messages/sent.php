<?php

/**
 * GET /voice-messages/sent
 *
 * History pesan suara yang dikirim admin yang sedang login,
 * lengkap dengan status tiap penerima (sudah diputar / belum)
 * dan waktu penerima memutarnya.
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();
$senderId = (int) ($authUser['sub'] ?? 0);

if ($senderId <= 0) {
    jsonResponse(['error' => 'Identitas pengguna tidak valid.'], 401);
}

$db = getDB();

$stmt = $db->prepare(
    "SELECT
        vm.id,
        vm.recipient_id,
        u.username AS recipient_username,
        vm.duration_seconds,
        vm.is_read,
        vm.created_at,
        vm.read_at,
        ef.mime_type,
        ef.file_size
        FROM voice_messages vm
        INNER JOIN users u
        ON u.id = vm.recipient_id
        INNER JOIN encrypted_files ef
        ON ef.id = vm.file_id
        WHERE vm.sender_id = :sender_id
        ORDER BY vm.created_at DESC, vm.id DESC"
);

$stmt->execute([
    ':sender_id' => $senderId
]);

$messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

$messages = array_map(function ($message) {
    return [
        'id' => (int) $message['id'],
        'recipient_id' => (int) $message['recipient_id'],
        'recipient_username' => $message['recipient_username'],
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
