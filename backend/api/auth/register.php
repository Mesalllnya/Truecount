<?php

/**
 * POST /auth/register
 *
 * Body JSON:
 *   { "username": "...", "email": "...", "password": "..." }
 *
 * Response 201:
 *   { "message": "Akun berhasil dibuat.", "user": { id, username, email, role } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// ── Parse body ────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);

$username = trim($body['username'] ?? '');
$email    = trim($body['email']    ?? '');
$password = $body['password']      ?? '';

// ── Validasi ──────────────────────────────────────────────
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

// ── Cek duplikat ──────────────────────────────────────────
$db = getDB();

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

// ── Simpan user ───────────────────────────────────────────
$stmt = $db->prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
);
$stmt->execute([$username, $email, $hash, 'voter']);

$userId = (int)$db->lastInsertId();

jsonResponse([
    'message' => 'Akun berhasil dibuat.',
    'user'    => [
        'id'       => $userId,
        'username' => $username,
        'email'    => $email,
        'role'     => 'voter',
    ],
], 201);
