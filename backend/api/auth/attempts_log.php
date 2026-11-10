<?php

/**
 * POST /auth/attempts/log
 *
 * Log an authentication attempt (success or failure).
 * Used for tracking failed attempts and enabling password fallback after 5 failures.
 *
 * Request body:
 *   {
 *     "identifier": "username or email",
 *     "method": "webauthn|dongle|password",
 *     "success": true|false,
 *     "error": "error message (optional)",
 *     "user_agent": "browser user agent (optional)",
 *     "auth_photo": "data:image/jpeg;base64,... (optional)"
 *   }
 *
 * Response 200:
 *   { "message": "Attempt logged" }
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
$method = $input['method'] ?? '';
$success = $input['success'] ?? false;
$error = $input['error'] ?? null;
$userAgent = $input['user_agent'] ?? null;
$authPhoto = $input['auth_photo'] ?? null;

if ($identifier === '' || $method === '') {
    jsonResponse(['error' => 'Identifier dan method wajib diisi.'], 400);
}

$validMethods = ['webauthn', 'dongle', 'password'];
if (!in_array($method, $validMethods, true)) {
    jsonResponse(['error' => 'Method tidak valid.'], 400);
}

if (!in_array($success, [true, false], true)) {
    jsonResponse(['error' => 'Success harus boolean.'], 400);
}

// Save photo if provided
$photoPath = null;
if ($authPhoto && str_starts_with($authPhoto, 'data:image/')) {
    try {
        $parts = explode(',', $authPhoto, 2);
        if (count($parts) === 2) {
            $base64 = $parts[1];
            $imageData = base64_decode($base64);
            if ($imageData !== false) {
                $uploadDir = __DIR__ . '/../../../storage/auth_photos/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                $filename = 'attempt_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.jpg';
                $filepath = $uploadDir . $filename;
                if (file_put_contents($filepath, $imageData) !== false) {
                    $photoPath = 'storage/auth_photos/' . $filename;
                }
            }
        }
    } catch (Throwable $e) {
        error_log('[Auth Attempt Log] Photo save error: ' . $e->getMessage());
    }
}

try {
    $db = getDB();

    // Get user ID if exists (for linking attempts to user)
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();
    $userId = $user ? (int)$user['id'] : null;

    // Get client IP
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;

    // Insert attempt
    $stmt = $db->prepare(
        'INSERT INTO auth_attempts (user_id, identifier, method, success, error, ip_address, user_agent, photo_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $identifier, $method, $success ? 1 : 0, $error, $ip, $userAgent, $photoPath]);

    jsonResponse(['message' => 'Attempt logged']);
} catch (Throwable $e) {
    // Log error but don't fail the request - logging shouldn't block auth
    error_log('Failed to log auth attempt: ' . $e->getMessage());
    jsonResponse(['message' => 'Attempt logged (with errors)']);
}