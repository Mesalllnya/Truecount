<?php

/**
 * GET /elections/{id}/candidates - Daftar kandidat pada sebuah pemilihan
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response 200:
 *   { "candidates": [ { id, election_id, name, vision, mission,
 *                        photo_path, created_at } ] }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/datetime.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();
$isAdmin  = ($authUser['role'] ?? '') === 'admin';

// ── Ambil election_id dari URI ────────────────────────────
preg_match('#^/elections/(\d+)/candidates#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
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

// Voter tidak boleh lihat kandidat di election draft
if (!$isAdmin && $election['status'] === 'draft') {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

$stmt = $db->prepare(
    'SELECT id, election_id, name, vision, mission, photo_path, created_at
       FROM candidates
      WHERE election_id = ?
      ORDER BY id ASC'
);
$stmt->execute([$electionId]);
$rows = $stmt->fetchAll();

$candidates = array_map(fn($r) => [
    'id'          => (int)$r['id'],
    'election_id' => (int)$r['election_id'],
    'name'        => $r['name'],
    'vision'      => $r['vision'],
    'mission'     => $r['mission'],
    'photo_path'  => $r['photo_path'],
    'created_at'  => toIso8601($r['created_at']),
], $rows);

jsonResponse(['candidates' => $candidates]);
