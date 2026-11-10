<?php

/**
 * GET /auth/security-setup
 *
 * Check if user has WebAuthn or USB Token configured.
 * Used to determine if user needs to set up security methods.
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Response 200:
 *   { "has_webauthn": true, "has_dongle": false, "requires_setup": false }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$authUser = requireAuth();
$userId = $authUser['sub'];

$db = getDB();

// Check WebAuthn credentials
$stmt = $db->prepare(
    'SELECT COUNT(*) as count FROM biometric_credentials WHERE user_id = ?'
);
$stmt->execute([$userId]);
$webauthnCount = (int)$stmt->fetchColumn();

// Check USB token credentials
$stmt = $db->prepare(
    'SELECT COUNT(*) as count FROM usb_token_credentials WHERE user_id = ? AND revoked_at IS NULL'
);
$stmt->execute([$userId]);
$dongleCount = (int)$stmt->fetchColumn();

$hasWebAuthn = $webauthnCount > 0;
$hasDongle = $dongleCount > 0;
$requiresSetup = !$hasWebAuthn && !$hasDongle;

jsonResponse([
    'has_webauthn' => $hasWebAuthn,
    'has_dongle'   => $hasDongle,
    'requires_setup' => $requiresSetup,
    'user_id'      => $userId,
]);