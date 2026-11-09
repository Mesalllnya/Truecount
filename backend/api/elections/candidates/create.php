<?php

/**
 * POST /elections/{id}/candidates - Tambah kandidat (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Body JSON:
 *   {
 *     "name":       "Raka Pratama",          (wajib)
 *     "vision":     "Inovasi untuk kampus",  (opsional)
 *     "mission":    "...",                   (opsional)
 *     "photo_path": "/uploads/raka.jpg"      (opsional)
 *   }
 *
 * Catatan: tidak bisa menambah kandidat ke election yang sudah "closed".
 *
 * Response 201:
 *   { "message": "Kandidat berhasil ditambahkan.", "candidate": { ... } }
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/datetime.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

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

if ($election['status'] !== 'draft') {
    jsonResponse(['error' => 'Tidak dapat menambah kandidat setelah pemilihan dimulai atau ditutup.'], 422);
}

// ── Parse body ────────────────────────────────────────────
// Mendukung JSON body atau multipart/form-data (dengan upload file langsung)
$name      = '';
$vision    = '';
$mission   = '';
$photoPath = '';

if (!empty($_POST)) {
    $name    = trim($_POST['name']    ?? '');
    $vision  = trim($_POST['vision']  ?? '');
    $mission = trim($_POST['mission'] ?? '');
} else {
    $body      = json_decode(file_get_contents('php://input'), true) ?? [];
    $name      = trim($body['name']       ?? '');
    $vision    = trim($body['vision']     ?? '');
    $mission   = trim($body['mission']    ?? '');
    $photoPath = trim($body['photo_path'] ?? '');
}

if ($name === '') {
    jsonResponse(['error' => 'Nama kandidat wajib diisi.'], 422);
}
if (strlen($name) > 150) {
    jsonResponse(['error' => 'Nama kandidat maksimal 150 karakter.'], 422);
}

// Cek apakah ada file foto yang diunggah langsung melalui multipart
if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
    $file     = $_FILES['photo'];
    $maxBytes = 2 * 1024 * 1024;
    if ($file['size'] <= $maxBytes) {
        $finfo    = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
        $extMap   = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (isset($extMap[$mimeType])) {
            $uploadDir = __DIR__ . '/../../../uploads/candidates/';
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0777, true);
            }
            $filename = 'c_' . bin2hex(random_bytes(8)) . '.' . $extMap[$mimeType];
            if (move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
                $photoPath = '/uploads/candidates/' . $filename;
            }
        }
    }
}

// ── Simpan ────────────────────────────────────────────────
$stmt = $db->prepare(
    'INSERT INTO candidates (election_id, name, vision, mission, photo_path, created_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())'
);
$stmt->execute([
    $electionId,
    $name,
    $vision    === '' ? null : $vision,
    $mission   === '' ? null : $mission,
    $photoPath === '' ? null : $photoPath,
]);

$candidateId = (int)$db->lastInsertId();
$stmt = $db->prepare(
    'SELECT id, election_id, name, vision, mission, photo_path, created_at
       FROM candidates WHERE id = ? LIMIT 1'
);
$stmt->execute([$candidateId]);
$candidate = $stmt->fetch();

jsonResponse([
    'message'   => 'Kandidat berhasil ditambahkan.',
    'candidate' => [
        'id'          => (int)$candidate['id'],
        'election_id' => (int)$candidate['election_id'],
        'name'        => $candidate['name'],
        'vision'      => $candidate['vision'],
        'mission'     => $candidate['mission'],
        'photo_path'  => $candidate['photo_path'],
        'created_at'  => toIso8601($candidate['created_at']),
    ],
], 201);
