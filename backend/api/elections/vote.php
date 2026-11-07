<?php

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/crypto/BallotService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Identitas user berasal dari JWT.
$authUser = requireAuth();
$userId = (int) ($authUser['sub'] ?? 0);

if ($userId <= 0) {
    jsonResponse(['error' => 'Identitas user tidak valid.'], 401);
}

// Baca JSON request.
$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    jsonResponse(['error' => 'Format JSON tidak valid.'], 400);
}

$electionId = filter_var(
    $input['election_id'] ?? null,
    FILTER_VALIDATE_INT
);

$candidateId = filter_var(
    $input['candidate_id'] ?? null,
    FILTER_VALIDATE_INT
);

if (!$electionId || !$candidateId) {
    jsonResponse([
        'error' => 'Election ID dan Candidate ID wajib diisi.'
    ], 400);
}

try {
    BallotService::submitVote(
        $userId,
        $electionId,
        $candidateId
    );

    jsonResponse([
        'success' => true,
        'message' => 'Suara berhasil disimpan.'
    ], 201);

} catch (InvalidArgumentException $e) {
    jsonResponse(['error' => $e->getMessage()], 400);

} catch (RuntimeException $e) {
    jsonResponse(['error' => $e->getMessage()], 422);
}
