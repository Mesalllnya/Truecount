<?php

/**
 * GET /elections/{id}/results - Hasil tally pemilihan
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * - Voter  : hanya bisa lihat hasil election yang status = "closed"
 * - Admin  : bisa lihat hasil semua status (termasuk active untuk live count)
 *
 * Response 200:
 *   {
 *     "election":   { id, title, status, start_time, end_time },
 *     "total_votes": 42,
 *     "voter_count": 100,
 *     "participation_rate": 42.0,   // persen
 *     "results": [
 *       {
 *         "candidate_id":   1,
 *         "name":           "Raka Pratama",
 *         "vision":         "...",
 *         "votes":          25,
 *         "percentage":     59.52
 *       },
 *       ...
 *     ]
 *   }
 *
 * Catatan privasi:
 *   Penghitungan suara dilakukan dengan menghitung baris di tabel `ballots`
 *   per election. Karena ballots tidak punya FK ke users/voters, isi suara
 *   tiap kandidat dihitung dari `encrypted_vote` yang di-decode (stub Sprint 2).
 *   Sprint 3: Orang 3 akan mengganti decode dengan AES-256-GCM decrypt.
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

// ── Ambil election_id dari URI ────────────────────────────
preg_match('#^/elections/(\d+)/results$#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$electionId = isset($m[1]) ? (int)$m[1] : 0;

if ($electionId <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id, title, description, status, start_time, end_time FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$electionId]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

// Voter hanya boleh lihat hasil election yang sudah closed
if (!$isAdmin && $election['status'] !== 'closed') {
    if ($election['status'] === 'draft') {
        jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
    }
    jsonResponse(['error' => 'Hasil pemilihan hanya tersedia setelah pemilihan ditutup.'], 403);
}

// ── Ambil semua kandidat ──────────────────────────────────
$stmt = $db->prepare(
    'SELECT id, name, vision FROM candidates WHERE election_id = ? ORDER BY id ASC'
);
$stmt->execute([$electionId]);
$candidates = $stmt->fetchAll();

// ── Hitung suara dari tabel ballots ──────────────────────
// Stub Sprint 2: encrypted_vote berisi plaintext JSON { "candidate_id": N }
// Sprint 3: Orang 3 akan mengganti dengan AES-256-GCM decrypt di sini.
$stmt = $db->prepare('SELECT encrypted_vote FROM ballots WHERE election_id = ?');
$stmt->execute([$electionId]);
$ballotRows = $stmt->fetchAll();

$totalVotes = count($ballotRows);
$voteCounts = [];   // candidate_id => jumlah suara

foreach ($ballotRows as $ballot) {
    $decoded = json_decode($ballot['encrypted_vote'], true);
    $cid     = isset($decoded['candidate_id']) ? (int)$decoded['candidate_id'] : 0;
    if ($cid > 0) {
        $voteCounts[$cid] = ($voteCounts[$cid] ?? 0) + 1;
    }
}

// ── Jumlah voter terdaftar (untuk participation rate) ────
$stmt = $db->prepare('SELECT COUNT(*) AS cnt FROM voters WHERE election_id = ?');
$stmt->execute([$electionId]);
$voterCount = (int)$stmt->fetchColumn();

// ── Susun hasil ───────────────────────────────────────────
$results = [];
foreach ($candidates as $c) {
    $votes      = $voteCounts[(int)$c['id']] ?? 0;
    $percentage = $totalVotes > 0
        ? round(($votes / $totalVotes) * 100, 2)
        : 0.0;

    $results[] = [
        'candidate_id' => (int)$c['id'],
        'name'         => $c['name'],
        'vision'       => $c['vision'],
        'votes'        => $votes,
        'percentage'   => $percentage,
    ];
}

// Urutkan dari suara terbanyak
usort($results, fn($a, $b) => $b['votes'] <=> $a['votes']);

$participationRate = $voterCount > 0
    ? round(($totalVotes / $voterCount) * 100, 2)
    : 0.0;

jsonResponse([
    'election' => [
        'id'         => (int)$election['id'],
        'title'      => $election['title'],
        'description'=> $election['description'],
        'status'     => $election['status'],
        'start_time' => toIso8601($election['start_time']),
        'end_time'   => toIso8601($election['end_time']),
    ],
    'total_votes'        => $totalVotes,
    'voter_count'        => $voterCount,
    'participation_rate' => $participationRate,
    'results'            => $results,
]);
