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

    // WebAuthn (Windows Hello)
    $uri === '/auth/webauthn/login/start' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/auth/webauthn_login_start.php';
    })(),
    $uri === '/auth/webauthn/login/start' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),
    $uri === '/auth/webauthn/login/verify' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/auth/webauthn_login_verify.php';
    })(),
    $uri === '/auth/webauthn/login/verify' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
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

    // ── MFA USB Token ───────────────────────────────────────
    // Register: start challenge
    $uri === '/mfa/usb/register/start' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/mfa/usb/register_start.php';
    })(),
    $uri === '/mfa/usb/register/start' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Register: verify signature + simpan credential
    $uri === '/mfa/usb/register/verify' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/mfa/usb/register_verify.php';
    })(),
    $uri === '/mfa/usb/register/verify' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // List token user
    $uri === '/mfa/usb/list' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/mfa/usb/list.php';
    })(),
    $uri === '/mfa/usb/list' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Revoke token: POST /mfa/usb/{id}/revoke
    preg_match('#^/mfa/usb/(\d+)/revoke$#', $uri, $m) && $method === 'POST' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/mfa/usb/' . $m[1] . '/revoke';
        require_once __DIR__ . '/api/mfa/usb/revoke.php';
    })(),
    preg_match('#^/mfa/usb/(\d+)/revoke$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Update label: POST /mfa/usb/{id}/label
    preg_match('#^/mfa/usb/(\d+)/label$#', $uri, $m) && $method === 'POST' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/mfa/usb/' . $m[1] . '/label';
        require_once __DIR__ . '/api/mfa/usb/label.php';
    })(),
    preg_match('#^/mfa/usb/(\d+)/label$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // 404
    default => jsonResponse(['error' => 'Endpoint tidak ditemukan.'], 404),
};
