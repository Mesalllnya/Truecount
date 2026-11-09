<?php

/**
 * GET /elections/{id} - Detail satu pemilihan
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * - Voter : hanya bisa lihat jika status active / closed
 * - Admin : bisa lihat semua status termasuk draft
 *
 * Response 200:
 *   { "election": { id, title, description, start_time, end_time,
 *                   status, created_by, created_at, updated_at,
 *                   candidate_count, voter_count } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();
$isAdmin  = ($authUser['role'] ?? '') === 'admin';

// ── Ambil ID dari URI ─────────────────────────────────────
preg_match('#^/elections/(\d+)$#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$id = isset($m[1]) ? (int)$m[1] : 0;

if ($id <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

$db   = getDB();
$stmt = $db->prepare(
    'SELECT e.id, e.title, e.description, e.start_time, e.end_time,
            e.status, e.created_by, e.created_at, e.updated_at,
            COUNT(DISTINCT c.id) AS candidate_count,
            COUNT(DISTINCT v.id) AS voter_count
       FROM elections e
       LEFT JOIN candidates c ON c.election_id = e.id
       LEFT JOIN voters      v ON v.election_id = e.id
      WHERE e.id = ?
      GROUP BY e.id
      LIMIT 1'
);
$stmt->execute([$id]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

// Voter tidak boleh lihat draft
if (!$isAdmin && $election['status'] === 'draft') {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

$isRegistered = false;
$hasVoted     = false;

if (!$isAdmin) {
    $stmtVoter = $db->prepare('SELECT id, has_voted FROM voters WHERE election_id = ? AND user_id = ? LIMIT 1');
    $stmtVoter->execute([$id, $authUser['sub']]);
    $vRow = $stmtVoter->fetch();
    if ($vRow) {
        $isRegistered = true;
        $hasVoted     = (bool)$vRow['has_voted'];
    }
}

jsonResponse([
    'election' => [
        'id'              => (int)$election['id'],
        'title'           => $election['title'],
        'description'     => $election['description'],
        'start_time'      => toIso8601($election['start_time']),
        'end_time'        => toIso8601($election['end_time']),
        'status'          => $election['status'],
        'created_by'      => (int)$election['created_by'],
        'created_at'      => toIso8601($election['created_at']),
        'updated_at'      => toIso8601($election['updated_at']),
        'candidate_count' => (int)$election['candidate_count'],
        'voter_count'     => (int)$election['voter_count'],
        'is_registered'   => $isRegistered,
        'has_voted'       => $hasVoted,
    ],
]);
