
<?php

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/crypto/EncryptedMessageService.php';

// Wajib login
$authUser = requireAuth();

$userId = (int) ($authUser['sub'] ?? 0);

if ($userId <= 0) {
    jsonResponse(['error' => 'Identitas user tidak valid.'], 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// ID pesan dikirim melalui parameter route
$messageId = (int) ($_GET['id'] ?? 0);

if ($messageId <= 0) {
    jsonResponse(['error' => 'ID pesan tidak valid.'], 400);
}

try {
    $plaintext = EncryptedMessageService::decryptById(
        $messageId,
        $userId
    );

    jsonResponse([
        'success' => true,
        'message' => 'Pesan berhasil didekripsi.',
        'data' => [
            'id' => $messageId,
            'plaintext' => $plaintext
        ]
    ]);

} catch (InvalidArgumentException $e) {
    jsonResponse(['error' => $e->getMessage()], 400);

} catch (RuntimeException $e) {
    // Tidak membocorkan apakah pesan milik user lain atau tidak ditemukan.
    jsonResponse(['error' => $e->getMessage()], 404);
}
