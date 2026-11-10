<?php

/**
 * POST /elections - Buat pemilihan baru (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Body JSON:
 *   {
 *     "title":       "Pemilihan Ketua BEM 2026",   (wajib)
 *     "description": "...",                         (opsional)
 *     "start_time":  "2026-11-10T08:00:00Z",        (wajib, ISO 8601)
 *     "end_time":    "2026-11-12T17:00:00Z"         (wajib, ISO 8601)
 *   }
 *
 * Response 201:
 *   { "message": "Pemilihan berhasil dibuat.", "election": { ... } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();

// ── Parse body ────────────────────────────────────────────
$body        = json_decode(file_get_contents('php://input'), true);
$title       = trim($body['title']       ?? '');
$description = trim($body['description'] ?? '');
$startRaw    = trim($body['start_time']  ?? '');
$endRaw      = trim($body['end_time']    ?? '');

// ── Validasi ──────────────────────────────────────────────
if ($title === '') {
    jsonResponse(['error' => 'Judul pemilihan wajib diisi.'], 422);
}
if (strlen($title) > 255) {
    jsonResponse(['error' => 'Judul maksimal 255 karakter.'], 422);
}
if ($startRaw === '') {
    jsonResponse(['error' => 'Waktu mulai (start_time) wajib diisi.'], 422);
}
if ($endRaw === '') {
    jsonResponse(['error' => 'Waktu selesai (end_time) wajib diisi.'], 422);
}

$startTs = strtotime($startRaw);
$endTs   = strtotime($endRaw);

if ($startTs === false) {
    jsonResponse(['error' => 'Format start_time tidak valid. Gunakan ISO 8601.'], 422);
}
if ($endTs === false) {
    jsonResponse(['error' => 'Format end_time tidak valid. Gunakan ISO 8601.'], 422);
}
if ($endTs <= $startTs) {
    jsonResponse(['error' => 'Waktu selesai harus setelah waktu mulai.'], 422);
}

// Simpan ke DB dalam format MySQL DATETIME (UTC)
$startMysql = gmdate('Y-m-d H:i:s', $startTs);
$endMysql   = gmdate('Y-m-d H:i:s', $endTs);

// ── Simpan ────────────────────────────────────────────────
$db   = getDB();
$stmt = $db->prepare(
    'INSERT INTO elections (title, description, start_time, end_time, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, "draft", ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
);
$stmt->execute([
    $title,
    $description === '' ? null : $description,
    $startMysql,
    $endMysql,
    $authUser['sub'],
]);

$id   = (int)$db->lastInsertId();
$stmt = $db->prepare(
    'SELECT id, title, description, start_time, end_time, status, created_by, created_at
       FROM elections WHERE id = ? LIMIT 1'
);
$stmt->execute([$id]);
$election = $stmt->fetch();

jsonResponse([
    'message'  => 'Pemilihan berhasil dibuat.',
    'election' => [
        'id'          => (int)$election['id'],
        'title'       => $election['title'],
        'description' => $election['description'],
        'start_time'  => toIso8601($election['start_time']),
        'end_time'    => toIso8601($election['end_time']),
        'status'      => $election['status'],
        'created_by'  => (int)$election['created_by'],
        'created_at'  => toIso8601($election['created_at']),
    ],
], 201);
