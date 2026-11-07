<?php

/**
 * GET /invites/verify?token=<token> - cek status undangan (publik)
 *
 * Dipakai halaman /daftar untuk memvalidasi tautan undangan
 * sebelum menampilkan form pendaftaran.
 *
 * Response 200 (valid):
 *   { "valid": true, "invite": { token, email, role, expires_at } }
 *
 * Response error:
 *   404 - undangan tidak ditemukan
 *   400 - sudah digunakan / kedaluwarsa / dibatalkan
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$token = trim($_GET['token'] ?? '');

if ($token === '') {
    jsonResponse(['error' => 'Token undangan wajib diisi.'], 422);
}

$db   = getDB();
$stmt = $db->prepare('SELECT * FROM invites WHERE token = ? LIMIT 1');
$stmt->execute([$token]);
$invite = $stmt->fetch();

if (!$invite) {
    jsonResponse(['error' => 'Undangan tidak ditemukan. Periksa kembali tautan Anda.'], 404);
}

if ($invite['status'] === 'accepted') {
    jsonResponse(['error' => 'Undangan sudah digunakan.'], 400);
}

if ($invite['status'] === 'revoked') {
    jsonResponse(['error' => 'Undangan telah dibatalkan oleh admin.'], 400);
}

if (isPastUtc($invite['expires_at'])) {
    jsonResponse(['error' => 'Undangan sudah kedaluwarsa.'], 400);
}

jsonResponse([
    'valid'  => true,
    'invite' => [
        'token'      => $invite['token'],
        'email'      => $invite['email'],
        'role'       => $invite['role'],
        'expires_at' => toIso8601($invite['expires_at']),
    ],
]);
