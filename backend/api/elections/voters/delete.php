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

preg_match('#^/elections/(\d+)/voters/(\d+)$#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$electionId = isset($m[1]) ? (int)$m[1] : 0;
$userId     = isset($m[2]) ? (int)$m[2] : 0;

if ($electionId <= 0 || $userId <= 0) {
    jsonResponse(['error' => 'ID tidak valid.'], 400);
}

$db = getDB();

// Cek apakah sudah vote
$stmt = $db->prepare('SELECT id, has_voted FROM voters WHERE election_id = ? AND user_id = ? LIMIT 1');
$stmt->execute([$electionId, $userId]);
$voter = $stmt->fetch();

if (!$voter) {
    jsonResponse(['error' => 'Pemilih tidak terdaftar di pemilihan ini.'], 404);
}

if ((int)$voter['has_voted'] === 1) {
    jsonResponse(['error' => 'Pemilih sudah memberikan suara, tidak dapat dihapus.'], 422);
}

$stmt = $db->prepare('DELETE FROM voters WHERE id = ?');
$stmt->execute([$voter['id']]);

jsonResponse(['message' => 'Pemilih berhasil dihapus dari pemilihan.']);

