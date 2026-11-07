<?php

/**
 * GET /auth/webauthn/list
 *
 * Ambil daftar Windows Hello credentials user yang login.
 * Memerlukan JWT Bearer token.
 *
 * Response 200:
 *   {
 *     "credentials": [
 *       {
 *         "id": 1,
 *         "credential_id": "base64url...",
 *         "aaguid": "hex...",
 *         "sign_count": 5,
 *         "created_at": "2024-01-15 10:30:00",
 *         "last_used_at": "2024-01-20 14:22:00"
 *       }
 *     ]
 *   }
 *
 * Response 401: Token invalid/expired
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Ambil user dari JWT
$user = requireAuth();
$userId = $user['sub'];

$db = getDB();

$stmt = $db->prepare(
    'SELECT id, credential_id, aaguid, sign_count, created_at, last_used_at
       FROM biometric_credentials
      WHERE user_id = ?
      ORDER BY created_at DESC'
);
$stmt->execute([$userId]);
$credentials = $stmt->fetchAll();

// Format credential_id ke base64url untuk frontend
$formatted = [];
foreach ($credentials as $cred) {
    $credIdB64 = rtrim(strtr(base64_encode($cred['credential_id']), '+/', '-_'), '=');
    $formatted[] = [
        'id' => (int)$cred['id'],
        'credential_id' => $credIdB64,
        'aaguid' => $cred['aaguid'],
        'sign_count' => (int)$cred['sign_count'],
        'created_at' => $cred['created_at'],
        'last_used_at' => $cred['last_used_at'],
    ];
}

jsonResponse(['credentials' => $formatted]);