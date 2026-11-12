<?php

/**
 * POST /invites - buat undangan pendaftaran (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Body JSON:
 *   { "email": "calon@contoh.com" | optional, "role": "voter"|"admin" | optional }
 *
 * Response 201:
 *   { "message": "Undangan berhasil dibuat.",
 *     "invite": { id, token, email, role, status, expires_at, link } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAdmin();

// ── Parse body ────────────────────────────────────────────
$body  = json_decode(file_get_contents('php://input'), true);
$email = trim($body['email'] ?? '');
$role  = $body['role']  ?? 'voter';

// ── Validasi ──────────────────────────────────────────────
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Format email tidak valid.'], 422);
}

if (!in_array($role, ['voter', 'admin'], true)) {
    jsonResponse(['error' => 'Peran tidak valid. Gunakan "voter" atau "admin".'], 422);
}

// ── Buat undangan ─────────────────────────────────────────
$token      = bin2hex(random_bytes(24));
$emailOrNull = $email === '' ? null : $email;

$db   = getDB();
$stmt = $db->prepare(
    'INSERT INTO invites (token, email, role, created_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY), UTC_TIMESTAMP())'
);
$stmt->execute([$token, $emailOrNull, $role, $authUser['sub'], INVITE_EXPIRE_DAYS]);

// Ambil kembali baris agar expires_at persis sesuai DB
$stmt = $db->prepare(
    'SELECT id, token, email, role, status, expires_at, created_at
       FROM invites WHERE id = ? LIMIT 1'
);
$stmt->execute([$db->lastInsertId()]);
$invite = $stmt->fetch();

jsonResponse([
    'message' => 'Undangan berhasil dibuat.',
    'invite'  => [
        'id'         => (int)$invite['id'],
        'token'      => $invite['token'],
        'email'      => $invite['email'],
        'role'       => $invite['role'],
        'status'     => $invite['status'],
        'expires_at' => toIso8601($invite['expires_at']),
        'created_at' => toIso8601($invite['created_at']),
        'link'       => '/daftar?undangan=' . $invite['token'],
    ],
], 201);
