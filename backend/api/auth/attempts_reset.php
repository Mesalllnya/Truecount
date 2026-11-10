<?php

/**
 * POST /auth/attempts/reset
 *
 * Reset failed authentication attempts for an identifier.
 * Called on successful login.
 *
 * Request body:
 *   { "identifier": "username or email" }
 *
 * Response 200:
 *   { "message": "Attempts reset" }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    jsonResponse(['error' => 'Request body tidak valid.'], 400);
}

$identifier = trim($input['identifier'] ?? '');

if ($identifier === '') {
    jsonResponse(['error' => 'Identifier wajib diisi.'], 400);
}

try {
    $db = getDB();

    // Get user ID if exists
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();
    $userId = $user ? (int)$user['id'] : null;

    // Delete attempts for this identifier/user
    if ($userId) {
        $stmt = $db->prepare('DELETE FROM auth_attempts WHERE user_id = ?');
        $stmt->execute([$userId]);
    } else {
        $stmt = $db->prepare('DELETE FROM auth_attempts WHERE identifier = ? AND user_id IS NULL');
        $stmt->execute([$identifier]);
    }

    jsonResponse(['message' => 'Attempts reset']);
} catch (Throwable $e) {
    error_log('Failed to reset auth attempts: ' . $e->getMessage());
    jsonResponse(['message' => 'Attempts reset (with errors)']);
}