<?php

/**
 * TrueCount API — Entry Point
 *
 * Semua request ke backend PHP masuk ke sini.
 * PHP built-in server: php -S localhost:8000 -t backend backend/index.php
 */

require_once __DIR__ . '/helpers/response.php';   // CORS + jsonResponse()
require_once __DIR__ . '/config/database.php';

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
