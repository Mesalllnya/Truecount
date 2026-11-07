<?php

/**
 * POST /invites/:id/revoke - batalkan undangan (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Response 200:
 *   { "message": "Undangan berhasil dibatalkan.", "invite": { id, token, status } }
 *
 * Response error:
 *   404 - undangan tidak ditemukan
 *   400 - undangan sudah tidak bisa dibatalkan (sudah diterima/dibatalkan)
 *   403 - bukan pembuat undangan (opsional: admin lain tidak bisa batalkan)
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();

// ── Ambil ID dari path ───────────────────────────────────────
// Path: /invites/123/revoke
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$segments = explode('/', trim($path, '/'));
// Expected: ['invites', 'id', 'revoke']
$inviteId = null;
if (count($segments) >= 3 && $segments[0] === 'invites' && $segments[2] === 'revoke') {
    $inviteId = (int)$segments[1];
}

if (!$inviteId || $inviteId <= 0) {
    jsonResponse(['error' => 'ID undangan tidak valid.'], 400);
}

$db = getDB();

// Cek undangan exists
$stmt = $db->prepare('SELECT id, token, status, created_by FROM invites WHERE id = ? LIMIT 1');
$stmt->execute([$inviteId]);
$invite = $stmt->fetch();

if (!$invite) {
    jsonResponse(['error' => 'Undangan tidak ditemukan.'], 404);
}

// Cek status: hanya bisa dibatalkan kalau 'pending'
if ($invite['status'] !== 'pending') {
    $msg = match ($invite['status']) {
        'accepted' => 'Undangan sudah digunakan, tidak bisa dibatalkan.',
        'revoked'  => 'Undangan sudah dibatalkan sebelumnya.',
        default    => 'Undangan tidak bisa dibatalkan.',
    };
    jsonResponse(['error' => $msg], 400);
}

// Opsional: Hanya pembuat undangan yang bisa batalkan (uncomment jika diinginkan)
// if ((int)$invite['created_by'] !== (int)$authUser['sub']) {
//     jsonResponse(['error' => 'Anda tidak berhak membatalkan undangan ini.'], 403);
// }

// ── Update status ke revoked ─────────────────────────────────
$stmt = $db->prepare('UPDATE invites SET status = ? WHERE id = ?');
$stmt->execute(['revoked', $inviteId]);

jsonResponse([
    'message' => 'Undangan berhasil dibatalkan.',
    'invite'  => [
        'id'     => $inviteId,
        'token'  => $invite['token'],
        'status' => 'revoked',
    ],
]);