<?php

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/crypto/EncryptedMessageService.php';

$authUser = requireAuth();

$userId = (int) ($authUser['sub'] ?? 0);

if ($userId <= 0) {
    jsonResponse(['error' => 'Identitas user tidak valid.'], 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$messageId = (int) ($_GET['id'] ?? 0);

if ($messageId <= 0) {
    jsonResponse(['error' => 'ID pesan tidak valid.'], 400);
}

// Ambil key dari HTTP header.
$vigenereKey = $_SERVER['HTTP_X_VIGENERE_KEY'] ?? '';

if (!is_string($vigenereKey)) {
    jsonResponse(['error' => 'Key Vigenere tidak valid.'], 400);
}

try {
    $plaintext = EncryptedMessageService::decryptById(
        $messageId,
        $userId,
        $vigenereKey
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
    jsonResponse(['error' => $e->getMessage()], 404);
}
