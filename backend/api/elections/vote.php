
<?php

/**
 * POST /elections/{id}/vote
 * Mengirim suara menggunakan AES-256-GCM.
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../services/crypto/BallotService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Autentikasi user dari JWT.
$authUser = requireAuth();
$userId = (int) ($authUser['sub'] ?? 0);

if ($userId <= 0) {
    jsonResponse(['error' => 'Identitas user tidak valid.'], 401);
}

// Admin tidak boleh memberikan suara.
if (($authUser['role'] ?? '') === 'admin') {
    jsonResponse(['error' => 'Admin tidak dapat memberikan suara.'], 403);
}

// Ambil election ID dari URL.
preg_match(
    '#^/elections/(\d+)/vote$#',
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH),
    $matches
);

$electionId = isset($matches[1]) ? (int) $matches[1] : 0;

if ($electionId <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

// Parse JSON request.
$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    jsonResponse(['error' => 'Format JSON tidak valid.'], 400);
}

$candidateId = filter_var(
    $input['candidate_id'] ?? null,
    FILTER_VALIDATE_INT
);

if (!$candidateId || $candidateId <= 0) {
    jsonResponse(['error' => 'candidate_id wajib diisi.'], 422);
}

try {
    $ballotId = BallotService::submitVote(
        $userId,
        $electionId,
        $candidateId
    );

    jsonResponse([
        'success' => true,
        'message' => 'Suara berhasil dikirim.',
        'ballot_id' => $ballotId
    ], 201);

} catch (InvalidArgumentException $e) {
    jsonResponse([
        'error' => $e->getMessage()
    ], 400);

} catch (RuntimeException $e) {
    jsonResponse([
        'error' => $e->getMessage()
    ], 422);
}
