<?php

/**
 * POST /auth/webauthn/{id}/revoke
 *
 * Hapus/nonaktifkan Windows Hello credential.
 * Memerlukan JWT Bearer token.
 *
 * Response 200:
 *   { "message": "Windows Hello berhasil dihapus." }
 *
 * Response 401: Token invalid/expired
 * Response 404: Credential tidak ditemukan
 * Response 403: Credential milik user lain
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Ambil user dari JWT
$user = requireAuth();
$userId = $user['sub'];

// Extract ID dari URI
$uri = $_SERVER['REQUEST_URI'];
$uri = parse_url($uri, PHP_URL_PATH);
$uri = preg_replace('#^/api#', '', $uri);
$uri = rtrim($uri, '/');

if (!preg_match('#^/auth/webauthn/(\d+)/revoke$#', $uri, $matches)) {
    jsonResponse(['error' => 'Endpoint tidak valid.'], 404);
}
$credentialId = (int)$matches[1];

$db = getDB();

// Verifikasi credential milik user ini
$stmt = $db->prepare('SELECT id FROM biometric_credentials WHERE id = ? AND user_id = ? LIMIT 1');
$stmt->execute([$credentialId, $userId]);
$cred = $stmt->fetch();

if (!$cred) {
    jsonResponse(['error' => 'Windows Hello tidak ditemukan.'], 404);
}

// Hapus credential
$stmt = $db->prepare('DELETE FROM biometric_credentials WHERE id = ?');
$stmt->execute([$credentialId]);

jsonResponse(['message' => 'Windows Hello berhasil dihapus.']);