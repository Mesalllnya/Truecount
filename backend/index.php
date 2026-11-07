<?php

/**
 * TrueCount API — Entry Point
 *
 * Semua request ke backend PHP masuk ke sini.
 * PHP built-in server: php -S localhost:8000 -t backend backend/index.php
 */

require_once __DIR__ . '/helpers/logger.php';     // File logger → storage/logs/

// Access log — SEMUA request tercatat, termasuk preflight OPTIONS
// (harus sebelum response.php yang meng-exit OPTIONS lebih awal)
tc_log_info(sprintf(
    '%s %s | origin=%s | ip=%s',
    $_SERVER['REQUEST_METHOD'] ?? '-',
    $_SERVER['REQUEST_URI'] ?? '-',
    $_SERVER['HTTP_ORIGIN'] ?? '-',
    $_SERVER['REMOTE_ADDR'] ?? '-'
));

require_once __DIR__ . '/helpers/response.php';   // CORS + jsonResponse()
require_once __DIR__ . '/config/database.php';

// Warning / error PHP native juga masuk ke file log
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/storage/logs/php_errors.log');

// Semua exception / error fatal → JSON ke client, detail ke file log
set_exception_handler(function (Throwable $e): void {
    tc_log_error(
        get_class($e) . ': ' . $e->getMessage() . "\n" . $e->getTraceAsString()
    );
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
        http_response_code(500);
    }
    echo json_encode(['error' => 'Terjadi kesalahan pada server. Silakan coba lagi.']);
    exit;
});

// Simple router: baca URI dan method
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Hapus prefix /api jika ada (misal dari Nginx proxy)
$uri = preg_replace('#^/api#', '', $uri);
$uri = rtrim($uri, '/') ?: '/';

// ── Routing ──────────────────────────────────────────────────────────────────

match (true) {
    // Health-check
    $uri === '/health' => jsonResponse(['status' => 'ok', 'app' => 'TrueCount']),

    // Auth
    $uri === '/auth/register' => (function () {
        require_once __DIR__ . '/api/auth/register.php';
    })(),
    $uri === '/auth/login' => (function () {
        require_once __DIR__ . '/api/auth/login.php';
    })(),
    $uri === '/auth/logout' => (function () {
        require_once __DIR__ . '/api/auth/logout.php';
    })(),
    $uri === '/auth/me' => (function () {
        require_once __DIR__ . '/api/auth/me.php';
    })(),

    // 404
    default => jsonResponse(['error' => 'Endpoint tidak ditemukan.'], 404),
};
