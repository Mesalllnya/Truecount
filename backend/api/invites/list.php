<?php

/**
 * GET /invites — daftar semua undangan (khusus admin)
 *
 * Headers:
 *   Authorization: Bearer <token admin>
 *
 * Response 200:
 *   {
 *     "stats": { total, menunggu, diterima, kedaluwarsa, dibatalkan },
 *     "invites": [ { id, token, email, role, status, created_at,
 *                    expires_at, used_at, used_by_username, link } ]
 *   }
 *
 * Status undangan yang masih 'pending' tapi sudah lewat expires_at
 * dihitung sebagai 'kedaluwarsa' secara dinamis.
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireAdmin();

$db   = getDB();
$stmt = $db->query(
    'SELECT i.id, i.token, i.email, i.role, i.status,
            i.expires_at, i.created_at, i.used_at,
            u.username AS used_by_username
       FROM invites i
       LEFT JOIN users u ON u.id = i.used_by
      ORDER BY i.created_at DESC, i.id DESC'
);
$rows = $stmt->fetchAll();

$invites = [];
$stats   = ['total' => 0, 'menunggu' => 0, 'diterima' => 0, 'kedaluwarsa' => 0, 'dibatalkan' => 0];

foreach ($rows as $r) {
    // Status tampilan: pending + lewat masa → kedaluwarsa
    $status = $r['status'];
    if ($status === 'pending') {
        $status = isPastUtc($r['expires_at']) ? 'kedaluwarsa' : 'menunggu';
    } elseif ($status === 'accepted') {
        $status = 'diterima';
    } elseif ($status === 'revoked') {
        $status = 'dibatalkan';
    }

    $invites[] = [
        'id'               => (int)$r['id'],
        'token'            => $r['token'],
        'email'            => $r['email'],
        'role'             => $r['role'],
        'status'           => $status,
        'created_at'       => toIso8601($r['created_at']),
        'expires_at'       => toIso8601($r['expires_at']),
        'used_at'          => toIso8601($r['used_at']),
        'used_by_username' => $r['used_by_username'],
        'link'             => '/daftar?undangan=' . $r['token'],
    ];

    $stats[$status] = ($stats[$status] ?? 0) + 1;
}

$stats['total'] = count($invites);

jsonResponse([
    'stats'   => $stats,
    'invites' => $invites,
]);
