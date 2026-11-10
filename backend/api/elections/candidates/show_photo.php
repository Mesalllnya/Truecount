<?php

/**
 * GET /elections/{electionId}/candidates/{candidateId}/photo
 *
 * Mengambil foto kandidat dari private encrypted storage,
 * memverifikasi otorisasi, lalu mengembalikan PNG hasil dekripsi.
 */

require_once __DIR__ . '/../../../helpers/response.php';
require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../services/crypto/FileEncryptionService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// 1. Autentikasi pengguna
$authUser = requireAuth();
$isAdmin = ($authUser['role'] ?? '') === 'admin';

// 2. Ambil ID election dan kandidat dari URI
preg_match(
    '#^/elections/(\d+)/candidates/(\d+)/photo$#',
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH),
    $matches
);

$electionId = isset($matches[1]) ? (int) $matches[1] : 0;
$candidateId = isset($matches[2]) ? (int) $matches[2] : 0;

if ($electionId <= 0 || $candidateId <= 0) {
    jsonResponse(['error' => 'ID tidak valid.'], 400);
}

$db = getDB();

// 3. Ambil informasi election, kandidat, dan pemilik file
$stmt = $db->prepare(
    'SELECT
        e.status AS election_status,
        c.photo_file_id,
        ef.user_id AS file_owner_id,
        ef.mime_type
     FROM candidates c
     INNER JOIN elections e
        ON e.id = c.election_id
     LEFT JOIN encrypted_files ef
        ON ef.id = c.photo_file_id
     WHERE c.id = ?
       AND c.election_id = ?
     LIMIT 1'
);

$stmt->execute([$candidateId, $electionId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    jsonResponse(['error' => 'Kandidat tidak ditemukan.'], 404);
}

// 4. Voter tidak boleh melihat foto dari election Draft
if (!$isAdmin && $row['election_status'] === 'draft') {
    jsonResponse(['error' => 'Foto tidak ditemukan.'], 404);
}

// 5. Pastikan kandidat mempunyai encrypted file
$fileId = (int) ($row['photo_file_id'] ?? 0);
$fileOwnerId = (int) ($row['file_owner_id'] ?? 0);

if ($fileId <= 0 || $fileOwnerId <= 0) {
    jsonResponse(['error' => 'Foto kandidat belum tersedia.'], 404);
}

if ($row['mime_type'] !== 'image/png') {
    jsonResponse(['error' => 'Format foto tidak didukung.'], 415);
}

// 6. Dekripsi menggunakan identitas pemilik dari database
try {
    $decrypted = FileEncryptionService::decryptById(
        $fileId,
        $fileOwnerId
    );

    $imageContent = $decrypted['content'];

    // 7. Validasi bahwa plaintext benar-benar gambar PNG
    $imageInfo = getimagesizefromstring($imageContent);

    if (
        $imageInfo === false ||
        ($imageInfo['mime'] ?? '') !== 'image/png'
    ) {
        throw new RuntimeException('Hasil dekripsi bukan PNG yang valid.');
    }

    // 8. Kirim gambar ke browser
    header('Content-Type: image/png');
    header('Content-Length: ' . strlen($imageContent));
    header('Cache-Control: private, no-store, no-cache, must-revalidate');
    header('X-Content-Type-Options: nosniff');

    echo $imageContent;
    exit;

} catch (Throwable $e) {
    error_log(
        '[Candidate Photo Decryption] ' . $e->getMessage()
    );

    jsonResponse([
        'error' => 'Gagal mengambil foto kandidat.'
    ], 500);
}
