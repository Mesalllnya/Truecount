
<?php

/**
 * GET /elections/{id}/results
 * Menghitung hasil pemilihan menggunakan AES-256-GCM.
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../services/crypto/BallotTallyService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Autentikasi user.
$authUser = requireAuth();
$isAdmin = ($authUser['role'] ?? '') === 'admin';

// Ambil election ID dari URL.
preg_match(
    '#^/elections/(\d+)/results$#',
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH),
    $matches
);

$electionId = isset($matches[1]) ? (int) $matches[1] : 0;

if ($electionId <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

$db = getDB();

// Ambil informasi election.
$stmt = $db->prepare(
    'SELECT id, title, description, status, start_time, end_time
     FROM elections
     WHERE id = ?
     LIMIT 1'
);

$stmt->execute([$electionId]);
$election = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

// Voter hanya boleh melihat hasil setelah election ditutup.
if (!$isAdmin && $election['status'] !== 'closed') {
    if ($election['status'] === 'draft') {
        jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
    }

    jsonResponse([
        'error' => 'Hasil pemilihan hanya tersedia setelah pemilihan ditutup.'
    ], 403);
}

// BallotTallyService saat ini hanya menghitung election closed.
try {
    $tally = BallotTallyService::calculateResults($electionId);

    // Ambil vision kandidat untuk kompatibilitas response main.
    $stmt = $db->prepare(
        'SELECT id, vision
         FROM candidates
         WHERE election_id = ?'
    );

    $stmt->execute([$electionId]);
    $candidateDetails = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    // Jumlah voter terdaftar.
    $stmt = $db->prepare(
        'SELECT COUNT(*)
         FROM voters
         WHERE election_id = ?'
    );

    $stmt->execute([$electionId]);
    $voterCount = (int) $stmt->fetchColumn();

    $totalVotes = (int) $tally['total_votes'];

    $results = [];

    foreach ($tally['results'] as $candidate) {
        $votes = (int) $candidate['vote_count'];

        $results[] = [
            'candidate_id' => (int) $candidate['candidate_id'],
            'name' => $candidate['candidate_name'],
            'vision' => $candidateDetails[$candidate['candidate_id']] ?? null,
            'votes' => $votes,
            'percentage' => $totalVotes > 0
                ? round(($votes / $totalVotes) * 100, 2)
                : 0.0
        ];
    }

    $participationRate = $voterCount > 0
        ? round(($totalVotes / $voterCount) * 100, 2)
        : 0.0;

    jsonResponse([
        'election' => $election,
        'total_votes' => $totalVotes,
        'voter_count' => $voterCount,
        'participation_rate' => $participationRate,
        'results' => $results
    ]);

} catch (InvalidArgumentException $e) {
    jsonResponse(['error' => $e->getMessage()], 400);

} catch (RuntimeException $e) {
    jsonResponse(['error' => $e->getMessage()], 422);
}
