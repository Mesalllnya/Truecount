
<?php

/**
 * POST /elections/{id}/candidates
 * Tambah kandidat (khusus admin).
 *
 * Body JSON:
 * {
 *   "name": "Raka Pratama",
 *   "vision": "Inovasi untuk kampus",
 *   "mission": "..."
 * }
 *
 * Foto diunggah terpisah melalui:
 * POST /elections/{id}/candidates/{cid}/photo
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/datetime.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

preg_match(
    '#^/elections/(\d+)/candidates#',
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH),
    $m
);

$electionId = isset($m[1]) ? (int)$m[1] : 0;

if ($electionId <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

$db = getDB();

$stmt = $db->prepare(
    'SELECT id, status FROM elections WHERE id = ? LIMIT 1'
);
$stmt->execute([$electionId]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

if ($election['status'] !== 'draft') {
    jsonResponse([
        'error' => 'Tidak dapat menambah kandidat setelah pemilihan dimulai atau ditutup.'
    ], 422);
}

// Parse JSON body
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$name = trim($body['name'] ?? '');
$vision = trim($body['vision'] ?? '');
$mission = trim($body['mission'] ?? '');

if ($name === '') {
    jsonResponse(['error' => 'Nama kandidat wajib diisi.'], 422);
}

if (strlen($name) > 150) {
    jsonResponse(['error' => 'Nama kandidat maksimal 150 karakter.'], 422);
}

// Simpan kandidat tanpa foto publik.
// Foto akan diunggah melalui endpoint terenkripsi.
$stmt = $db->prepare(
    'INSERT INTO candidates
        (election_id, name, vision, mission, photo_path, created_at)
     VALUES (?, ?, ?, ?, NULL, UTC_TIMESTAMP())'
);

$stmt->execute([
    $electionId,
    $name,
    $vision === '' ? null : $vision,
    $mission === '' ? null : $mission,
]);

$candidateId = (int)$db->lastInsertId();

$stmt = $db->prepare(
    'SELECT id, election_id, name, vision, mission, photo_path, created_at
     FROM candidates
     WHERE id = ?
     LIMIT 1'
);

$stmt->execute([$candidateId]);
$candidate = $stmt->fetch();

jsonResponse([
    'message' => 'Kandidat berhasil ditambahkan.',
    'candidate' => [
        'id' => (int)$candidate['id'],
        'election_id' => (int)$candidate['election_id'],
        'name' => $candidate['name'],
        'vision' => $candidate['vision'],
        'mission' => $candidate['mission'],
        'photo_path' => null,
        'created_at' => toIso8601($candidate['created_at']),
    ],
], 201);
