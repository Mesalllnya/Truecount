<?php

/**
 * GET /elections/{id}/voters - Daftar voter terdaftar di pemilihan (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Response 200:
 *   {
 *     "voters": [
 *       { id, user_id, username, email, has_voted, registered_at, voted_at }
 *     ],
 *     "total": 10,
 *     "voted": 6
 *   }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/datetime.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

// ── Ambil election_id dari URI ────────────────────────────
preg_match('#^/elections/(\d+)/voters#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$electionId = isset($m[1]) ? (int)$m[1] : 0;

if ($electionId <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$electionId]);

if (!$stmt->fetch()) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

$stmt = $db->prepare(
    'SELECT v.id, v.user_id, u.username, u.email, v.has_voted, v.registered_at, v.voted_at
       FROM voters v
       JOIN users u ON u.id = v.user_id
      WHERE v.election_id = ?
      ORDER BY v.registered_at DESC'
);
$stmt->execute([$electionId]);
$rows = $stmt->fetchAll();

$voters = array_map(fn($r) => [
    'id'            => (int)$r['id'],
    'user_id'       => (int)$r['user_id'],
    'username'      => $r['username'],
    'email'         => $r['email'],
    'has_voted'     => (bool)$r['has_voted'],
    'registered_at' => toIso8601($r['registered_at']),
    'voted_at'      => toIso8601($r['voted_at']),
], $rows);

$voted = count(array_filter($voters, fn($v) => $v['has_voted']));

jsonResponse([
    'voters' => $voters,
    'total'  => count($voters),
    'voted'  => $voted,
]);
