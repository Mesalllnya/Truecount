<?php

/**
 * POST /auth/login - with optional photo
 *
 * Body JSON:
 *   { "identifier": "username_atau_email", "password": "...", "auth_photo": "data:image/jpeg;base64,..." }
 *
 * Response 200:
 *   { "message": "Login berhasil.", "token": "...", "user": { id, username, email, role } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/jwt.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// ── Parse body ────────────────────────────────────────────
$body       = json_decode(file_get_contents('php://input'), true);
$identifier = trim($body['identifier'] ?? '');
$password   = $body['password']        ?? '';
$authPhoto  = $body['auth_photo']      ?? null;

if ($identifier === '' || $password === '') {
    jsonResponse(['error' => 'Username/email dan kata sandi wajib diisi.'], 422);
}

// ── Save photo if provided ────────────────────────────────
$photoPath = null;
if ($authPhoto && str_starts_with($authPhoto, 'data:image/')) {
    try {
        // Extract base64 data
        $parts = explode(',', $authPhoto, 2);
        if (count($parts) === 2) {
            $base64 = $parts[1];
            $imageData = base64_decode($base64);
            if ($imageData !== false) {
                // Create upload directory
                $uploadDir = __DIR__ . '/../../../storage/auth_photos/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                
                // Generate filename: timestamp_random.jpg
                $filename = 'auth_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.jpg';
                $filepath = $uploadDir . $filename;
                
                if (file_put_contents($filepath, $imageData) !== false) {
                    $photoPath = 'storage/auth_photos/' . $filename;
                }
            }
        }
    } catch (Throwable $e) {
        error_log('[Auth Login] Photo save error: ' . $e->getMessage());
        // Continue without photo - don't block login
    }
}

// ── Cari user ─────────────────────────────────────────────
$db   = getDB();
$stmt = $db->prepare(
    'SELECT id, username, email, password_hash, role, is_active
       FROM users
      WHERE username = ? OR email = ?
      LIMIT 1'
);
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

// Gunakan password_verify agar tetap constant-time meski user tidak ada
$dummyHash = '$argon2id$v=19$m=65536,t=4,p=2$dummysalt123456789012$dummyhashvaluethatislong';
$hashToCheck = $user ? $user['password_hash'] : $dummyHash;

if (!$user || !password_verify($password, $hashToCheck)) {
    // Log failed attempt with photo if available
    logAuthAttempt($db, $identifier, 'password', false, 'Invalid credentials', $photoPath);
    jsonResponse(['error' => 'Username/email atau kata sandi salah.'], 401);
}

if (!(bool)$user['is_active']) {
    logAuthAttempt($db, $identifier, 'password', false, 'Account inactive', $photoPath);
    jsonResponse(['error' => 'Akun Anda telah dinonaktifkan. Hubungi administrator.'], 403);
}

// ── Buat token JWT ────────────────────────────────────────
$token = generateJwt([
    'sub'      => $user['id'],
    'username' => $user['username'],
    'email'    => $user['email'],
    'role'     => $user['role'],
]);

// Log successful attempt with photo
logAuthAttempt($db, $identifier, 'password', true, null, $photoPath);

jsonResponse([
    'message' => 'Login berhasil.',
    'token'   => $token,
    'user'    => [
        'id'       => (int)$user['id'],
        'username' => $user['username'],
        'email'    => $user['email'],
        'role'     => $user['role'],
    ],
]);

/**
 * Log authentication attempt to database
 */
function logAuthAttempt(PDO $db, string $identifier, string $method, bool $success, ?string $error, ?string $photoPath): void
{
    try {
        // Get user ID if exists
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
        $stmt->execute([$identifier, $identifier]);
        $user = $stmt->fetch();
        $userId = $user ? (int)$user['id'] : null;

        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        $stmt = $db->prepare(
            'INSERT INTO auth_attempts (user_id, identifier, method, success, error, ip_address, user_agent, photo_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $identifier, $method, $success ? 1 : 0, $error, $ip, $userAgent, $photoPath]);
    } catch (Throwable $e) {
        error_log('[Auth Attempt Log] ' . $e->getMessage());
    }
}