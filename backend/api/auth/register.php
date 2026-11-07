<?php

/**
 * POST /auth/register
 *
 * Pendaftaran TIDAK terbuka untuk publik — hanya lewat undangan
 * yang dibuat admin (POST /invites). Tanpa token undangan yang valid,
 * request ini ditolak.
 *
 * Body JSON:
 *   { "username": "...", "email": "...", "password": "...", "invite_token": "..." }
 *
 * Response 201:
 *   { "message": "Akun berhasil dibuat.", "user": { id, username, email, role } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// ── Parse body ────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);

$username    = trim($body['username']     ?? '');
$email       = trim($body['email']        ?? '');
$password    = $body['password']          ?? '';
$inviteToken = trim($body['invite_token'] ?? '');

// ── Validasi field akun ────────────────────────────────────
$errors = [];

if ($username === '') {
    $errors[] = 'Username wajib diisi.';
} elseif (strlen($username) < 3 || strlen($username) > 50) {
    $errors[] = 'Username harus 3–50 karakter.';
} elseif (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    $errors[] = 'Username hanya boleh huruf, angka, dan underscore.';
}

if ($email === '') {
    $errors[] = 'Email wajib diisi.';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Format email tidak valid.';
}

if (strlen($password) < 8) {
    $errors[] = 'Kata sandi minimal 8 karakter.';
}

if (!empty($errors)) {
    jsonResponse(['error' => implode(' ', $errors)], 422);
}

// ── Validasi undangan ─────────────────────────────────────
if ($inviteToken === '') {
    jsonResponse([
        'error' => 'Pendaftaran hanya melalui undangan. Hubungi admin untuk mendapatkan tautan undangan.',
    ], 403);
}

$db = getDB();

$stmt = $db->prepare('SELECT * FROM invites WHERE token = ? LIMIT 1');
$stmt->execute([$inviteToken]);
$invite = $stmt->fetch();

if (!$invite) {
    jsonResponse(['error' => 'Undangan tidak valid.'], 400);
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

// Undangan terikat email → email akun mengikuti undangan (diabaikan dari form)
if ($invite['email'] !== null && $invite['email'] !== '') {
    $email = $invite['email'];
}

// ── Cek duplikat ──────────────────────────────────────────
$stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
$stmt->execute([$username, $email]);
$existing = $stmt->fetch();

if ($existing) {
    jsonResponse(['error' => 'Username atau email sudah digunakan.'], 409);
}

// ── Hash password (Argon2id) ──────────────────────────────
$hash = password_hash($password, PASSWORD_ARGON2ID, [
    'memory_cost' => ARGON2_MEMORY_COST,
    'time_cost'   => ARGON2_TIME_COST,
    'threads'     => ARGON2_THREADS,
]);

// ── Simpan user + tandai undangan terpakai (atomik) ───────
$db->beginTransaction();

$stmt = $db->prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
);
$stmt->execute([$username, $email, $hash, $invite['role']]);
$userId = (int)$db->lastInsertId();

// UPDATE bersyarat — cegah undangan dipakai dua kali bersamaan
$upd = $db->prepare(
    "UPDATE invites
        SET status = 'accepted', used_by = ?, used_at = UTC_TIMESTAMP()
      WHERE token = ? AND status = 'pending'"
);
$upd->execute([$userId, $inviteToken]);

if ($upd->rowCount() === 0) {
    $db->rollBack();
    jsonResponse(['error' => 'Undangan sudah digunakan.'], 400);
}

$db->commit();

jsonResponse([
    'message' => 'Akun berhasil dibuat.',
    'user'    => [
        'id'       => $userId,
        'username' => $username,
        'email'    => $email,
        'role'     => $invite['role'],
    ],
], 201);
