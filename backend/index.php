<?php

/**
 * TrueCount API - Entry Point
 *
 * Semua request ke backend PHP masuk ke sini.
 * PHP built-in server: php -S localhost:8000 -t backend backend/index.php
 */

require_once __DIR__ . '/helpers/logger.php';     // File logger → storage/logs/

// Access log - SEMUA request tercatat, termasuk preflight OPTIONS
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
    // Health-check (dipakai HealthMonitor di frontend)
    $uri === '/health' => (function () {
        $dbOk = true;
        try {
            getDB();
        } catch (Throwable $e) {
            $dbOk = false;
            // Catat ke error log file (storage/logs/app.log)
            tc_log_warn('Health check: database tidak tersambung - ' . $e->getMessage());
        }
        jsonResponse([
            'status'   => $dbOk ? 'ok' : 'degraded',
            'app'      => 'TrueCount',
            'database' => $dbOk ? 'connected' : 'disconnected',
            'ip'       => $_SERVER['REMOTE_ADDR'] ?? '-',
        ]);
    })(),

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

    // Undangan pendaftaran (invite) - buat/list khusus admin, verify publik
    $uri === '/invites' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/invites/list.php';
    })(),
    $uri === '/invites' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/invites/create.php';
    })(),
    $uri === '/invites' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),
    $uri === '/invites/verify' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/invites/verify.php';
    })(),
    $uri === '/invites/verify' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Revoke undangan: POST /invites/{id}/revoke
    preg_match('#^/invites/(\d+)/revoke$#', $uri, $m) && $method === 'POST' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/invites/' . $m[1] . '/revoke';
        require_once __DIR__ . '/api/invites/revoke.php';
    })(),
    preg_match('#^/invites/(\d+)/revoke$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    
    // Encrypted Messages 

    // POST /encrypted-messages
    $uri === '/encrypted-messages' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/encrypted-messages/create.php';
    })(),

    // GET /encrypted-messages/{id}
    preg_match('#^/encrypted-messages/(\d+)$#', $uri, $m)
        && $method === 'GET' => (function () use ($m) {
            $_GET['id'] = $m[1];
            require_once __DIR__ . '/api/encrypted-messages/get.php';
        })(),

    // Method tidak diizinkan
    $uri === '/encrypted-messages' ||
    preg_match('#^/encrypted-messages/(\d+)$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Election Voting
    preg_match('#^/elections/vote$#', $uri) && $method === 'POST'
    => (function () {
        require_once __DIR__ . '/api/elections/vote.php';
    })(),

    
    // Election Results - Admin Only
    $uri === '/elections/results' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/elections/results.php';
    })(),

    // Method tidak diizinkan untuk election endpoints
    $uri === '/elections/results' ||
    $uri === '/elections/vote' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    
    // Blockchain - Seal Election
    $uri === '/elections/blockchain/seal' && $method === 'POST'
        => (function () {
            require_once __DIR__ . '/api/elections/blockchain-seal.php';
        })(),

    // Blockchain - Verify Election
    $uri === '/elections/blockchain/verify' && $method === 'GET'
        => (function () {
            require_once __DIR__ . '/api/elections/blockchain-verify.php';
        })(),


    // 404
    default => jsonResponse(['error' => 'Endpoint tidak ditemukan.'], 404),
};
