<?php

/**
 * POST /elections/{id}/voters - Daftarkan user ke pemilihan (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Body JSON:
 *   { "user_id": 5 }             -- daftarkan satu user
 *   atau
 *   { "user_ids": [5, 6, 7] }    -- daftarkan banyak user sekaligus
 *
 * Catatan: user yang sudah terdaftar di-skip (tidak error, idempoten).
 * Tidak bisa daftarkan voter ke election yang sudah "closed".
 *
 * Response 200:
 *   { "message": "...", "registered": 3, "skipped": 1 }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
$stmt = $db->prepare('SELECT id, status FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$electionId]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}
if ($election['status'] === 'closed') {
    jsonResponse(['error' => 'Tidak dapat mendaftarkan voter ke pemilihan yang sudah ditutup.'], 422);
}

// ── Parse body ────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// Normalisasi: terima user_id tunggal atau user_ids array
if (isset($body['user_ids']) && is_array($body['user_ids'])) {
    $rawIds = $body['user_ids'];
} elseif (isset($body['user_id'])) {
    $rawIds = [$body['user_id']];
} else {
    jsonResponse(['error' => 'user_id atau user_ids wajib diisi.'], 422);
}

// Validasi dan sanitasi ID
$userIds = array_values(array_unique(array_filter(
    array_map('intval', $rawIds),
    fn($id) => $id > 0
)));

if (empty($userIds)) {
    jsonResponse(['error' => 'Tidak ada user_id valid yang diberikan.'], 422);
}
if (count($userIds) > 200) {
    jsonResponse(['error' => 'Maksimal 200 user per request.'], 422);
}

// ── Verifikasi semua user ada dan role = voter ────────────
$placeholders = implode(',', array_fill(0, count($userIds), '?'));
$stmt = $db->prepare(
    "SELECT id, role FROM users WHERE id IN ({$placeholders}) AND is_active = 1"
);
$stmt->execute($userIds);
$foundUsers = $stmt->fetchAll(\PDO::FETCH_KEY_PAIR);   // id => role

$notFound = array_diff($userIds, array_keys($foundUsers));
if (!empty($notFound)) {
    jsonResponse([
        'error'     => 'Beberapa user tidak ditemukan atau tidak aktif.',
        'not_found' => array_values($notFound),
    ], 422);
}

$nonVoters = array_keys(array_filter($foundUsers, fn($role) => $role !== 'voter'));
if (!empty($nonVoters)) {
    jsonResponse([
        'error'      => 'Hanya user dengan role "voter" yang bisa didaftarkan.',
        'non_voters' => array_values($nonVoters),
    ], 422);
}

// ── Ambil voter yang sudah terdaftar ─────────────────────
$stmt = $db->prepare(
    "SELECT user_id FROM voters WHERE election_id = ? AND user_id IN ({$placeholders})"
);
$stmt->execute(array_merge([$electionId], $userIds));
$alreadyRegistered = $stmt->fetchAll(\PDO::FETCH_COLUMN);
$alreadyRegistered = array_map('intval', $alreadyRegistered);

$toRegister = array_diff($userIds, $alreadyRegistered);
$skipped    = count($alreadyRegistered);

// ── Insert ────────────────────────────────────────────────
$registered = 0;
if (!empty($toRegister)) {
    $insertPlaceholders = implode(',', array_fill(0, count($toRegister), '(?, ?, 0, UTC_TIMESTAMP())'));
    $insertParams = [];
    foreach ($toRegister as $uid) {
        $insertParams[] = $uid;
        $insertParams[] = $electionId;
    }
    $db->prepare(
        "INSERT INTO voters (user_id, election_id, has_voted, registered_at) VALUES {$insertPlaceholders}"
    )->execute($insertParams);
    $registered = count($toRegister);
}

$msg = $registered > 0
    ? "{$registered} voter berhasil didaftarkan."
    : 'Semua user yang diberikan sudah terdaftar.';

jsonResponse([
    'message'    => $msg,
    'registered' => $registered,
    'skipped'    => $skipped,
]);
