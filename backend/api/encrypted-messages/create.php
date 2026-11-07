
<?php

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/crypto/EncryptedMessageService.php';

// Wajib login
$authUser = requireAuth();

// Ambil user ID dari JWT, bukan request body
$userId = (int) ($authUser['sub'] ?? 0);

if ($userId <= 0) {
    jsonResponse(['error' => 'Identitas user tidak valid.'], 401);
}

// Pastikan method POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Ambil JSON request
$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    jsonResponse(['error' => 'Format JSON tidak valid.'], 400);
}

$message = $input['message'] ?? null;
$algorithm = $input['algorithm'] ?? 'aes256gcm';

if (!is_string($message) || trim($message) === '') {
    jsonResponse(['error' => 'Pesan wajib diisi.'], 400);
}

if (!is_string($algorithm) ||
    !in_array($algorithm, ['aes256gcm', 'chacha20'], true)) {
    jsonResponse(['error' => 'Algoritma tidak didukung.'], 400);
}

try {
    $messageId = EncryptedMessageService::encryptAndStore(
        $userId,
        $message,
        $algorithm
    );

    jsonResponse([
        'success' => true,
        'message' => 'Pesan berhasil dienkripsi dan disimpan.',
        'data' => [
            'id' => $messageId,
            'algorithm' => $algorithm
        ]
    ], 201);

} catch (InvalidArgumentException $e) {
    jsonResponse(['error' => $e->getMessage()], 400);
}
