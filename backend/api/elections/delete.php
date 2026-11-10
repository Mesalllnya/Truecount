<?php

/**
 * DELETE /elections/{id} - Hapus pemilihan (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Catatan: election yang sudah "active" atau "closed" tidak bisa dihapus
 *          agar integritas data historis terjaga.
 *
 * Response 200:
 *   { "message": "Pemilihan berhasil dihapus." }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

// ── Ambil ID dari URI ─────────────────────────────────────
preg_match('#^/elections/(\d+)$#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$id = isset($m[1]) ? (int)$m[1] : 0;

if ($id <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

$db   = getDB();
$stmt = $db->prepare('SELECT id, status FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

if (in_array($election['status'], ['active', 'closed'], true)) {
    jsonResponse(['error' => 'Pemilihan yang sudah aktif atau ditutup tidak dapat dihapus.'], 422);
}

$db->prepare('DELETE FROM elections WHERE id = ?')->execute([$id]);

jsonResponse(['message' => 'Pemilihan berhasil dihapus.']);
