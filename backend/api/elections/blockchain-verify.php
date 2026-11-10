
<?php

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/crypto/BlockchainService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();

$electionId = filter_var(
    $_GET['id'] ?? null,
    FILTER_VALIDATE_INT
);

if (!$electionId || $electionId <= 0) {
    jsonResponse(['error' => 'Election ID tidak valid.'], 400);
}

try {
    $result = BlockchainService::verifyChain($electionId);

    jsonResponse([
        'success' => $result['valid'],
        'message' => $result['message'],
        'data' => $result
    ], $result['valid'] ? 200 : 409);

} catch (Throwable $e) {
    jsonResponse([
        'error' => 'Verifikasi blockchain gagal.'
    ], 500);
}
