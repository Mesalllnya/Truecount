<?php

/**
 * PUT /elections/{electionId}/candidates/{candidateId} - Update kandidat (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Body JSON (semua opsional):
 *   { "name": "...", "vision": "...", "mission": "...", "photo_path": "..." }
 *
 * Response 200:
 *   { "message": "Kandidat berhasil diperbarui.", "candidate": { ... } }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/datetime.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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

$db   = getDB();

// Verifikasi election ada dan bukan closed
$stmt = $db->prepare('SELECT id, status FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$electionId]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}
if ($election['status'] !== 'draft') {
    jsonResponse(['error' => 'Tidak dapat mengubah kandidat setelah pemilihan dimulai atau ditutup.'], 422);
}

// Verifikasi kandidat ada dan milik election ini
$stmt = $db->prepare('SELECT * FROM candidates WHERE id = ? AND election_id = ? LIMIT 1');
$stmt->execute([$candidateId, $electionId]);
$candidate = $stmt->fetch();

if (!$candidate) {
    jsonResponse(['error' => 'Kandidat tidak ditemukan.'], 404);
}

// ── Parse body ────────────────────────────────────────────
$body       = json_decode(file_get_contents('php://input'), true) ?? [];
$setClauses = [];
$params     = [];

if (isset($body['name'])) {
    $name = trim($body['name']);
    if ($name === '') {
        jsonResponse(['error' => 'Nama tidak boleh kosong.'], 422);
    }
    if (strlen($name) > 150) {
        jsonResponse(['error' => 'Nama kandidat maksimal 150 karakter.'], 422);
    }
    $setClauses[] = 'name = ?';
    $params[]     = $name;
}

if (array_key_exists('vision', $body)) {
    $v            = trim($body['vision']);
    $setClauses[] = 'vision = ?';
    $params[]     = $v === '' ? null : $v;
}

if (array_key_exists('mission', $body)) {
    $v            = trim($body['mission']);
    $setClauses[] = 'mission = ?';
    $params[]     = $v === '' ? null : $v;
}

if (array_key_exists('photo_path', $body)) {
    $v            = trim($body['photo_path']);
    $setClauses[] = 'photo_path = ?';
    $params[]     = $v === '' ? null : $v;
}

if (empty($setClauses)) {
    jsonResponse(['error' => 'Tidak ada field yang diubah.'], 422);
}

$params[] = $candidateId;
$db->prepare('UPDATE candidates SET ' . implode(', ', $setClauses) . ' WHERE id = ?')
   ->execute($params);

$stmt = $db->prepare(
    'SELECT id, election_id, name, vision, mission, photo_path, created_at
       FROM candidates WHERE id = ? LIMIT 1'
);
$stmt->execute([$candidateId]);
$updated = $stmt->fetch();

jsonResponse([
    'message'   => 'Kandidat berhasil diperbarui.',
    'candidate' => [
        'id'          => (int)$updated['id'],
        'election_id' => (int)$updated['election_id'],
        'name'        => $updated['name'],
        'vision'      => $updated['vision'],
        'mission'     => $updated['mission'],
        'photo_path'  => $updated['photo_path'],
        'created_at'  => toIso8601($updated['created_at']),
    ],
]);
