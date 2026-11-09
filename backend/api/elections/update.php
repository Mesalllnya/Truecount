<?php

/**
 * PUT /elections/{id} - Update pemilihan (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Body JSON (semua field opsional, hanya yang dikirim yang diubah):
 *   {
 *     "title":       "...",
 *     "description": "...",
 *     "start_time":  "2026-11-10T08:00:00Z",
 *     "end_time":    "2026-11-12T17:00:00Z",
 *     "status":      "draft"|"active"|"closed"
 *   }
 *
 * Catatan: election yang sudah "closed" tidak bisa diubah.
 *
 * Response 200:
 *   { "message": "Pemilihan berhasil diperbarui.", "election": { ... } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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
$stmt = $db->prepare('SELECT * FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}

if ($election['status'] === 'closed') {
    jsonResponse(['error' => 'Pemilihan yang sudah ditutup tidak dapat diubah.'], 422);
}

// ── Parse body ────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$setClauses = [];
$params     = [];

if (isset($body['title'])) {
    $title = trim($body['title']);
    if ($title === '') {
        jsonResponse(['error' => 'Judul tidak boleh kosong.'], 422);
    }
    if (strlen($title) > 255) {
        jsonResponse(['error' => 'Judul maksimal 255 karakter.'], 422);
    }
    $setClauses[] = 'title = ?';
    $params[]     = $title;
}

if (array_key_exists('description', $body)) {
    $desc         = trim($body['description']);
    $setClauses[] = 'description = ?';
    $params[]     = $desc === '' ? null : $desc;
}

if (isset($body['start_time'])) {
    $ts = strtotime($body['start_time']);
    if ($ts === false) {
        jsonResponse(['error' => 'Format start_time tidak valid.'], 422);
    }
    $setClauses[] = 'start_time = ?';
    $params[]     = gmdate('Y-m-d H:i:s', $ts);
}

if (isset($body['end_time'])) {
    $ts = strtotime($body['end_time']);
    if ($ts === false) {
        jsonResponse(['error' => 'Format end_time tidak valid.'], 422);
    }
    $setClauses[] = 'end_time = ?';
    $params[]     = gmdate('Y-m-d H:i:s', $ts);
}

if (isset($body['status'])) {
    if (!in_array($body['status'], ['draft', 'active', 'closed'], true)) {
        jsonResponse(['error' => 'Status tidak valid. Gunakan draft, active, atau closed.'], 422);
    }
    $setClauses[] = 'status = ?';
    $params[]     = $body['status'];
}

if (empty($setClauses)) {
    jsonResponse(['error' => 'Tidak ada field yang diubah.'], 422);
}

// Validasi konsistensi start_time < end_time setelah update
$newStart = isset($body['start_time']) ? strtotime($body['start_time'])
            : strtotime($election['start_time'] . ' UTC');
$newEnd   = isset($body['end_time'])   ? strtotime($body['end_time'])
            : strtotime($election['end_time']   . ' UTC');

if ($newEnd <= $newStart) {
    jsonResponse(['error' => 'Waktu selesai harus setelah waktu mulai.'], 422);
}

$setClauses[] = 'updated_at = UTC_TIMESTAMP()';
$params[]     = $id;

$db->prepare('UPDATE elections SET ' . implode(', ', $setClauses) . ' WHERE id = ?')
   ->execute($params);

$stmt = $db->prepare(
    'SELECT id, title, description, start_time, end_time, status, created_by, created_at, updated_at
       FROM elections WHERE id = ? LIMIT 1'
);
$stmt->execute([$id]);
$updated = $stmt->fetch();

jsonResponse([
    'message'  => 'Pemilihan berhasil diperbarui.',
    'election' => [
        'id'          => (int)$updated['id'],
        'title'       => $updated['title'],
        'description' => $updated['description'],
        'start_time'  => toIso8601($updated['start_time']),
        'end_time'    => toIso8601($updated['end_time']),
        'status'      => $updated['status'],
        'created_by'  => (int)$updated['created_by'],
        'created_at'  => toIso8601($updated['created_at']),
        'updated_at'  => toIso8601($updated['updated_at']),
    ],
]);
