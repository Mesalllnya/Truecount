<?php

/**
 * Auth middleware - verifikasi JWT dari header Authorization.
 *
 * Cara pakai di endpoint yang butuh auth:
 *
 *   require_once __DIR__ . '/../../middleware/auth.php';
 *   $authUser = requireAuth();   // returns payload array, atau exit 401
 */

require_once __DIR__ . '/../helpers/jwt.php';
require_once __DIR__ . '/../helpers/response.php';  // sudah di-include sebelumnya biasanya, tapi aman di-require_once

/**
 * Ambil token dari header Authorization: Bearer <token>
 */
function getBearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['HTTP_AUTHORIZATION'] // Apache
           ?? getallheaders()['Authorization']
           ?? getallheaders()['authorization']
           ?? '';

    if (str_starts_with($header, 'Bearer ')) {
        return substr($header, 7);
    }

    return null;
}

/**
 * Paksa autentikasi. Jika token tidak valid / tidak ada, langsung 401 dan exit.
 *
 * @return array  JWT payload (sub, username, email, role, iat, exp)
 */
function requireAuth(): array
{
    $token = getBearerToken();

    if ($token === null) {
        jsonResponse(['error' => 'Token tidak ditemukan. Silakan login terlebih dahulu.'], 401);
    }

    $payload = verifyJwt($token);

    if ($payload === false) {
        jsonResponse(['error' => 'Token tidak valid atau sudah kedaluwarsa.'], 401);
    }

    return $payload;
}

/**
 * Paksa autentikasi + role admin. Jika bukan admin, langsung 403 dan exit.
 *
 * @return array  JWT payload (sub, username, email, role, iat, exp)
 */
function requireAdmin(): array
{
    $user = requireAuth();

    if (($user['role'] ?? '') !== 'admin') {
        jsonResponse(['error' => 'Akses ditolak. Hanya admin yang diizinkan.'], 403);
    }

    return $user;
}
