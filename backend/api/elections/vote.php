<?php

/**
 * POST /elections/{id}/vote - Kirim suara (voter yang sudah terdaftar)
 *
 * Headers:
 *   Authorization: Bearer <token voter>
 *
 * Body JSON:
 *   {
 *     "candidate_id": 3        (wajib, ID kandidat yang dipilih)
 *   }
 *
 * Aturan:
 *   - Election harus berstatus "active"
 *   - User harus terdaftar sebagai voter di election ini (ada di tabel voters)
 *   - User belum pernah memilih (has_voted = 0)
 *   - Kandidat harus ada dan milik election ini
 *
 * Privacy by design:
 *   - Tabel `voters` hanya dicatat has_voted + voted_at (TANPA simpan pilihan)
 *   - Tabel `ballots` menyimpan pilihan (TANPA FK ke users/voters)
 *   - Sehingga tidak ada cara melacak siapa memilih siapa
 *
 * Enkripsi ballot:
 *   - Sprint ini: plaintext di-hash SHA-256 sebagai integrity_hash,
 *     encrypted_vote diisi plaintext JSON sementara (stub),
 *     nonce diisi random hex 32 karakter.
 *   - Sprint 3: Orang 3 akan mengganti dengan AES-256-GCM nyata.
 *     Cukup ganti logika di bagian "Siapkan ballot data" di bawah.
 *
 * Response 200:
 *   { "message": "Suara berhasil dikirim." }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();

// Admin tidak boleh vote
if (($authUser['role'] ?? '') === 'admin') {
    jsonResponse(['error' => 'Admin tidak dapat memberikan suara.'], 403);
}

// ── Ambil election_id dari URI ────────────────────────────
preg_match('#^/elections/(\d+)/vote$#', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), $m);
$electionId = isset($m[1]) ? (int)$m[1] : 0;

if ($electionId <= 0) {
    jsonResponse(['error' => 'ID pemilihan tidak valid.'], 400);
}

// ── Parse body ────────────────────────────────────────────
$body        = json_decode(file_get_contents('php://input'), true) ?? [];
$candidateId = isset($body['candidate_id']) ? (int)$body['candidate_id'] : 0;

if ($candidateId <= 0) {
    jsonResponse(['error' => 'candidate_id wajib diisi.'], 422);
}

$db = getDB();

// ── Cek election ada dan active ───────────────────────────
$stmt = $db->prepare('SELECT id, status FROM elections WHERE id = ? LIMIT 1');
$stmt->execute([$electionId]);
$election = $stmt->fetch();

if (!$election) {
    jsonResponse(['error' => 'Pemilihan tidak ditemukan.'], 404);
}
if ($election['status'] !== 'active') {
    $msg = match ($election['status']) {
        'draft'  => 'Pemilihan belum dibuka.',
        'closed' => 'Pemilihan sudah ditutup.',
        default  => 'Pemilihan tidak aktif.',
    };
    jsonResponse(['error' => $msg], 422);
}

// ── Cek kandidat ada dan milik election ini ───────────────
$stmt = $db->prepare(
    'SELECT id, name FROM candidates WHERE id = ? AND election_id = ? LIMIT 1'
);
$stmt->execute([$candidateId, $electionId]);
$candidate = $stmt->fetch();

if (!$candidate) {
    jsonResponse(['error' => 'Kandidat tidak ditemukan dalam pemilihan ini.'], 404);
}

// ── Cek voter terdaftar di election ini ───────────────────
$stmt = $db->prepare(
    'SELECT id, has_voted FROM voters WHERE user_id = ? AND election_id = ? LIMIT 1'
);
$stmt->execute([$authUser['sub'], $electionId]);
$voterRow = $stmt->fetch();

if (!$voterRow) {
    jsonResponse(['error' => 'Kamu belum terdaftar sebagai pemilih di pemilihan ini.'], 403);
}

if ((int)$voterRow['has_voted'] === 1) {
    jsonResponse(['error' => 'Kamu sudah memberikan suara di pemilihan ini.'], 409);
}

// ── Siapkan ballot data ───────────────────────────────────
// Stub enkripsi: plaintext JSON → akan diganti AES-256-GCM oleh Orang 3 (Sprint 3).
// Interface yang harus disediakan Orang 3:
//   encryptBallot(string $plaintext): array{ encrypted_vote, nonce, integrity_hash }
$plaintext      = json_encode(['candidate_id' => $candidateId], JSON_UNESCAPED_UNICODE);
$nonce          = bin2hex(random_bytes(16));          // 32-char hex nonce (stub)
$integrityHash  = hash('sha256', $plaintext . $nonce); // SHA-256 integrity check

// ── Transaksi: simpan ballot + tandai voter sudah vote ────
// Menggunakan transaksi agar kedua operasi atomic - tidak ada situasi
// suara tersimpan tapi has_voted tidak terupdate atau sebaliknya.
$db->beginTransaction();

try {
    // 1. Simpan ballot (TANPA FK ke user - privacy by design)
    $stmt = $db->prepare(
        'INSERT INTO ballots (election_id, encrypted_vote, nonce, integrity_hash, submitted_at)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP())'
    );
    $stmt->execute([$electionId, $plaintext, $nonce, $integrityHash]);

    // 2. Tandai voter sudah memilih (TANPA simpan candidate_id di sini)
    $stmt = $db->prepare(
        'UPDATE voters SET has_voted = 1, voted_at = UTC_TIMESTAMP()
          WHERE id = ?'
    );
    $stmt->execute([$voterRow['id']]);

    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    throw $e; // ditangkap oleh exception handler global di index.php
}

jsonResponse(['message' => 'Suara berhasil dikirim.']);
