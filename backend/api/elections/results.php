<?php

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/crypto/BallotTallyService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Hanya admin yang boleh menghitung hasil.
$authUser = requireAdmin();

$electionId = filter_var(
    $_GET['id'] ?? null,
    FILTER_VALIDATE_INT
);

if (!$electionId || $electionId <= 0) {
    jsonResponse(['error' => 'Election ID tidak valid.'], 400);
}

try {
    $results = BallotTallyService::calculateResults($electionId);

    jsonResponse([
        'success' => true,
        'message' => 'Penghitungan suara berhasil.',
        'data' => $results
    ]);

} catch (InvalidArgumentException $e) {
    jsonResponse(['error' => $e->getMessage()], 400);

} catch (RuntimeException $e) {
    jsonResponse(['error' => $e->getMessage()], 422);
}
