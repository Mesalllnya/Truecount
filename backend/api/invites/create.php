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
$body = json_decode(file_get_contents('php://input'), true);

// Dukung:
// 1) Single invite: { "email": "a@b.com", "role": "voter" }
// 2) Bulk email:    { "emails": ["a@b.com", "b@c.com"], "role": "voter" }
// 3) Bulk count:    { "count": 5, "role": "voter" } (buat N link undangan anonim sekaligus)

$role = $body['role'] ?? 'voter';
if (!in_array($role, ['voter', 'admin'], true)) {
    jsonResponse(['error' => 'Peran tidak valid. Gunakan "voter" atau "admin".'], 422);
}

$db = getDB();
$stmtInsert = $db->prepare(
    'INSERT INTO invites (token, email, role, created_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY), UTC_TIMESTAMP())'
);
$stmtGet = $db->prepare(
    'SELECT id, token, email, role, status, expires_at, created_at
       FROM invites WHERE id = ? LIMIT 1'
);

// Kasus 1: Bulk Emails array
if (isset($body['emails']) && is_array($body['emails'])) {
    $rawEmails = $body['emails'];
    if (count($rawEmails) === 0) {
        jsonResponse(['error' => 'Daftar email tidak boleh kosong.'], 422);
    }
    if (count($rawEmails) > 100) {
        jsonResponse(['error' => 'Maksimal 100 email per pembuatan undangan.'], 422);
    }

    $createdInvites = [];
    $invalidEmails = [];

    foreach ($rawEmails as $em) {
        $em = trim((string)$em);
        if ($em === '') continue;

        if (!filter_var($em, FILTER_VALIDATE_EMAIL)) {
            $invalidEmails[] = $em;
            continue;
        }

        $token = bin2hex(random_bytes(24));
        $stmtInsert->execute([$token, $em, $role, $authUser['sub'], INVITE_EXPIRE_DAYS]);
        $stmtGet->execute([$db->lastInsertId()]);
        $inv = $stmtGet->fetch();
        $createdInvites[] = [
            'id'         => (int)$inv['id'],
            'token'      => $inv['token'],
            'email'      => $inv['email'],
            'role'       => $inv['role'],
            'status'     => $inv['status'],
            'expires_at' => toIso8601($inv['expires_at']),
            'created_at' => toIso8601($inv['created_at']),
            'link'       => '/daftar?undangan=' . $inv['token'],
        ];
    }

    jsonResponse([
        'message'        => 'Berhasil membuat ' . count($createdInvites) . ' undangan.',
        'invites'        => $createdInvites,
        'count'          => count($createdInvites),
        'invalid_emails' => $invalidEmails,
    ], 201);
}

// Kasus 2: Bulk Count (Anonim)
if (isset($body['count']) && (int)$body['count'] > 1) {
    $count = min(100, max(1, (int)$body['count']));
    $createdInvites = [];

    for ($i = 0; $i < $count; $i++) {
        $token = bin2hex(random_bytes(24));
        $stmtInsert->execute([$token, null, $role, $authUser['sub'], INVITE_EXPIRE_DAYS]);
        $stmtGet->execute([$db->lastInsertId()]);
        $inv = $stmtGet->fetch();
        $createdInvites[] = [
            'id'         => (int)$inv['id'],
            'token'      => $inv['token'],
            'email'      => null,
            'role'       => $inv['role'],
            'status'     => $inv['status'],
            'expires_at' => toIso8601($inv['expires_at']),
            'created_at' => toIso8601($inv['created_at']),
            'link'       => '/daftar?undangan=' . $inv['token'],
        ];
    }

    jsonResponse([
        'message' => "Berhasil membuat {$count} undangan.",
        'invites' => $createdInvites,
        'count'   => $count,
    ], 201);
}

// Kasus 3: Single Invite biasa
$email = trim($body['email'] ?? '');
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Format email tidak valid.'], 422);
}

$token       = bin2hex(random_bytes(24));
$emailOrNull = $email === '' ? null : $email;

$stmtInsert->execute([$token, $emailOrNull, $role, $authUser['sub'], INVITE_EXPIRE_DAYS]);
$stmtGet->execute([$db->lastInsertId()]);
$invite = $stmtGet->fetch();

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
