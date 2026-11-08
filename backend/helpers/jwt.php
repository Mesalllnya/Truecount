<?php

/**
 * JWT helper - HS256 tanpa library eksternal.
 *
 * generateJwt(array $payload): string
 * verifyJwt(string $token): array|false
 */

require_once __DIR__ . '/../config/app.php';

if (!function_exists('base64UrlEncode')) {
    function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

if (!function_exists('base64UrlDecode')) {
    function base64UrlDecode(string $data): string
    {
        $pad  = strlen($data) % 4;
        if ($pad) $data .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

/**
 * Buat JWT HS256.
 *
 * @param array $payload  Data yang dimasukkan ke token (jangan taruh password).
 * @param int   $expire   Override durasi (detik). Default: JWT_EXPIRE dari config.
 */
function generateJwt(array $payload, int $expire = 0): string
{
    $header = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));

    $payload['iat'] = time();
    $payload['exp'] = time() + ($expire ?: JWT_EXPIRE);

    $body = base64UrlEncode(json_encode($payload));

    $sig  = base64UrlEncode(
        hash_hmac('sha256', "$header.$body", JWT_SECRET, true)
    );

    return "$header.$body.$sig";
}

/**
 * Verifikasi JWT.
 *
 * @return array  Payload jika valid.
 * @return false  Jika signature salah atau token kedaluwarsa.
 */
function verifyJwt(string $token): array|false
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) return false;

    [$header, $body, $sig] = $parts;

    // Verifikasi signature
    $expected = base64UrlEncode(
        hash_hmac('sha256', "$header.$body", JWT_SECRET, true)
    );

    if (!hash_equals($expected, $sig)) return false;

    $payload = json_decode(base64UrlDecode($body), true);
    if (!is_array($payload)) return false;

    // Cek expiry
    if (isset($payload['exp']) && $payload['exp'] < time()) return false;

    return $payload;
}
