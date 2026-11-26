<?php

/**
 * GET /elections/{electionId}/candidates/{candidateId}/photo/metadata
 *
 * Mengekstrak metadata steganografi yang disisipkan di dalam foto paslon.
 * Khusus admin — dipakai untuk menampilkan "info stegano" saat admin
 * mengklik foto paslon di modal kelola kandidat.
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Response 200:
 *   {
 *     "candidate":  { "id": 1, "name": "..." },
 *     "photo_path": "private/candidate-photos/xxx.png",
 *     "image":      { "width": 495, "height": 619, "size": 364096 },
 *     "steganography": {
 *       "found": true,
 *       "metadata": { "candidate_name": "...", "election_title": "...", ... },
 *       "aad_user_id": 1
 *     }
 *   }
 *
 * Catatan: payload stego di-AAD-kan ke user pengunggah, jadi endpoint
 * mencoba daftar user sampai ekstraksi berhasil.
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../helpers/storage.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../services/crypto/SteganographyService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Informasi steganografi hanya untuk admin.
requireAdmin();

// ── Ambil ID dari URI ─────────────────────────────────────
preg_match(
    '#^/elections/(\d+)/candidates/(\d+)/photo/metadata$#',
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH),
    $m
);

$electionId  = isset($m[1]) ? (int) $m[1] : 0;
$candidateId = isset($m[2]) ? (int) $m[2] : 0;

if ($electionId <= 0 || $candidateId <= 0) {
    jsonResponse(['error' => 'ID tidak valid.'], 400);
}

$db = getDB();

// ── Ambil kandidat + referensi foto ───────────────────────
$stmt = $db->prepare(
    'SELECT c.id, c.name, c.photo_path, c.photo_file_id
       FROM candidates c
      WHERE c.id = ? AND c.election_id = ?
      LIMIT 1'
);
$stmt->execute([$candidateId, $electionId]);
$candidate = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$candidate) {
    jsonResponse(['error' => 'Kandidat tidak ditemukan.'], 404);
}

$photoPath = trim((string) ($candidate['photo_path'] ?? ''), "/\\");

// Foto masih berupa encrypted file lama → metadata tidak bisa dibaca
// tanpa dekripsi dulu; beri tahu frontend.
if ($photoPath === '' && empty($candidate['photo_file_id'])) {
    jsonResponse([
        'candidate'    => ['id' => (int) $candidate['id'], 'name' => $candidate['name']],
        'photo_path'   => null,
        'steganography' => [
            'found'   => false,
            'message' => 'Kandidat ini belum memiliki foto.',
        ],
    ]);
}

if ($photoPath === '') {
    jsonResponse([
        'candidate'    => ['id' => (int) $candidate['id'], 'name' => $candidate['name']],
        'photo_path'   => null,
        'steganography' => [
            'found'   => false,
            'message' => 'Foto masih memakai penyimpanan terenkripsi lama; '
                . 'migrasikan ke PNG steganografi dulu untuk membaca metadata.',
        ],
    ]);
}

// ── Validasi path (tolak traversal) ───────────────────────
if (
    str_contains($photoPath, '..') ||
    str_starts_with($photoPath, '/') ||
    preg_match('#^[a-zA-Z]:#', $photoPath)
) {
    jsonResponse(['error' => 'Lokasi foto tidak valid.'], 400);
}

$absolutePath = storageRoot() . DIRECTORY_SEPARATOR
    . str_replace('/', DIRECTORY_SEPARATOR, $photoPath);

if (!is_file($absolutePath) || !is_readable($absolutePath)) {
    jsonResponse(['error' => 'File foto tidak ditemukan.'], 404);
}

$imageInfo = getimagesize($absolutePath);

if ($imageInfo === false || ($imageInfo['mime'] ?? '') !== 'image/png') {
    jsonResponse(['error' => 'File foto bukan PNG yang valid.'], 415);
}

// ── Ekstrak metadata steganografi ─────────────────────────
// Payload di-AAD-kan ke user pengunggah; coba daftar user sampai cocok.
$userIds = $db->query(
    'SELECT id FROM users ORDER BY (role = "admin") DESC, id ASC'
)->fetchAll(PDO::FETCH_COLUMN);

$metadataJson = null;
$aadUserId    = null;

foreach ($userIds as $userId) {
    try {
        $metadataJson = SteganographyService::extractMessage(
            $absolutePath,
            (int) $userId
        );
        $aadUserId = (int) $userId;
        break;
    } catch (Throwable $e) {
        // AAD salah / payload bukan TrueCount → coba user berikutnya.
    }
}

if ($metadataJson === null) {
    jsonResponse([
        'candidate'  => ['id' => (int) $candidate['id'], 'name' => $candidate['name']],
        'photo_path' => $photoPath,
        'image'      => [
            'width'  => $imageInfo[0],
            'height' => $imageInfo[1],
            'size'   => (int) filesize($absolutePath),
        ],
        'steganography' => [
            'found'   => false,
            'message' => 'Tidak ditemukan metadata TrueCount di dalam foto ini. '
                . 'Foto mungkin dimodifikasi atau tidak pernah disisipi metadata.',
        ],
    ]);
}

$metadata = json_decode($metadataJson, true);

if (!is_array($metadata)) {
    jsonResponse([
        'candidate'  => ['id' => (int) $candidate['id'], 'name' => $candidate['name']],
        'photo_path' => $photoPath,
        'steganography' => [
            'found'   => false,
            'message' => 'Metadata ditemukan tetapi bukan JSON valid.',
        ],
    ]);
}

jsonResponse([
    'candidate'  => [
        'id'   => (int) $candidate['id'],
        'name' => $candidate['name'],
    ],
    'photo_path' => $photoPath,
    'image'      => [
        'width'  => $imageInfo[0],
        'height' => $imageInfo[1],
        'size'   => (int) filesize($absolutePath),
    ],
    'steganography' => [
        'found'       => true,
        'metadata'    => $metadata,
        'aad_user_id' => $aadUserId,
        'verified'    => (
            (string) ($metadata['candidate_id'] ?? '') === (string) (int) $candidate['id']
            && (string) ($metadata['candidate_name'] ?? '') === (string) $candidate['name']
        ),
    ],
]);
