<?php

/**
 * DELETE /elections/{id}/voters/{userId} - Hapus user dari partisipasi pemilihan (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

preg_match('#^/elections/(\d+)/voters(?:/(\d+))?$#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$electionId   = isset($m[1]) ? (int)$m[1] : 0;
$singleUserId = isset($m[2]) ? (int)$m[2] : 0;

if ($electionId <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

$db = getDB();

$stmt = $db->prepare('SELECT id, status FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$electionId]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}
if ($election['status'] === 'closed') {
    jsonResponse(['error' => 'Tidak dapat mengubah peserta pada pemilihan yang sudah ditutup.'], 422);
}

// Cek apakah single delete atau bulk delete { "user_ids": [...] }
$body = json_decode(file_get_contents('php://input'), true) ?? [];
if ($singleUserId > 0) {
    $userIds = [$singleUserId];
} elseif (isset($body['user_ids']) && is_array($body['user_ids'])) {
    $userIds = array_values(array_unique(array_filter(array_map('intval', $body['user_ids']), fn($id) => $id > 0)));
} else {
    jsonResponse(['error' => 'user_id atau user_ids wajib diisi.'], 422);
}

if (empty($userIds)) {
    jsonResponse(['error' => 'Tidak ada user_id valid untuk dihapus.'], 422);
}

$deletedCount = 0;
$skippedVoted = 0;

$stmtCheck  = $db->prepare('SELECT id, has_voted FROM voters WHERE election_id = ? AND user_id = ? LIMIT 1');
$stmtDelete = $db->prepare('DELETE FROM voters WHERE id = ?');

foreach ($userIds as $uid) {
    $stmtCheck->execute([$electionId, $uid]);
    $voter = $stmtCheck->fetch();
    if (!$voter) continue;

    if ((int)$voter['has_voted'] === 1) {
        $skippedVoted++;
        continue;
    }

    $stmtDelete->execute([$voter['id']]);
    $deletedCount++;
}

jsonResponse([
    'message'       => "Berhasil mengeluarkan {$deletedCount} pemilih.",
    'deleted'       => $deletedCount,
    'skipped_voted' => $skippedVoted
]);

