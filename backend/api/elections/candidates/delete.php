<?php

/**
 * DELETE /elections/{electionId}/candidates/{candidateId} - Hapus kandidat (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Catatan: tidak bisa hapus kandidat pada election yang sudah active/closed.
 *
 * Response 200:
 *   { "message": "Kandidat berhasil dihapus." }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

// ── Ambil ID dari URI ─────────────────────────────────────
preg_match('#^/elections/(\d+)/candidates/(\d+)$#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$electionId  = isset($m[1]) ? (int)$m[1] : 0;
$candidateId = isset($m[2]) ? (int)$m[2] : 0;

if ($electionId <= 0 || $candidateId <= 0) {
    jsonResponse(['error' => 'ID tidak valid.'], 400);
}

$db = getDB();

$stmt = $db->prepare('SELECT id, status FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$electionId]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

if (in_array($election['status'], ['active', 'closed'], true)) {
    jsonResponse(['error' => 'Tidak dapat menghapus kandidat pada pemilihan yang sudah aktif atau ditutup.'], 422);
}

$stmt = $db->prepare('SELECT id FROM candidates WHERE id = ? AND election_id = ? LIMIT 1');
$stmt->execute([$candidateId, $electionId]);

if (!$stmt->fetch()) {
    jsonResponse(['error' => 'Kandidat tidak ditemukan.'], 404);
}

$db->prepare('DELETE FROM candidates WHERE id = ?')->execute([$candidateId]);

jsonResponse(['message' => 'Kandidat berhasil dihapus.']);
