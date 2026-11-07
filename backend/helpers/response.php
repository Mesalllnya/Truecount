<?php

/**
 * Global CORS + JSON headers.
 * Di-include sekali di index.php / setiap entry-point API.
 */

require_once __DIR__ . '/../config/app.php';

header('Content-Type: application/json; charset=UTF-8');

// CORS: izinkan origin frontend (browser dev) + origin webview Tauri (desktop)
$allowedOrigins = [
    FRONTEND_ORIGIN,
    'http://tauri.localhost',   // Windows WebView2
    'tauri://localhost',        // macOS / Linux WebKitGTK
];
$origin = rtrim($_SERVER['HTTP_ORIGIN'] ?? '', '/');

// Origin lokal (localhost / 127.0.0.1 / [::1]) diizinkan dengan PORT BERAPA PUN -
// Vite dev server pakai host 127.0.0.1:5173, jangan diblokir hanya karena
// port/host penulisannya beda dari FRONTEND_ORIGIN.
$isLocalOrigin = (bool) preg_match(
    '#^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$#i',
    $origin
);
$allowOrigin = (in_array($origin, $allowedOrigins, true) || $isLocalOrigin)
    ? $origin
    : FRONTEND_ORIGIN;

header('Access-Control-Allow-Origin: ' . $allowOrigin);
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Private-Network: true');

// Pre-flight: browser mengirim OPTIONS sebelum request utama
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * Mengembalikan response JSON dan menghentikan eksekusi.
 *
 * @param mixed $data    Data yang akan di-encode.
 * @param int   $status  HTTP status code.
 */
function jsonResponse(mixed $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
