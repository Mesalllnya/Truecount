<?php

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/crypto/BlockchainService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Hanya admin yang boleh melakukan sealing.
$authUser = requireAdmin();

$electionId = filter_var(
    $_GET['id'] ?? null,
    FILTER_VALIDATE_INT
);

if (!$electionId || $electionId <= 0) {
    jsonResponse(['error' => 'Election ID tidak valid.'], 400);
}

try {
    $result = BlockchainService::sealElection($electionId);

    jsonResponse([
        'success' => true,
        'message' => 'Election berhasil di-seal ke blockchain.',
        'data' => $result
    ], 201);

} catch (InvalidArgumentException $e) {
    jsonResponse(['error' => $e->getMessage()], 400);

} catch (RuntimeException $e) {
    jsonResponse(['error' => $e->getMessage()], 422);
}
