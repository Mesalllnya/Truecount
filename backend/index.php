<?php

/**
 * TrueCount API - Entry Point
 *
 * Semua request ke backend PHP masuk ke sini.
 * PHP built-in server: php -S localhost:8000 -t backend backend/index.php
 */

require_once __DIR__ . '/helpers/logger.php';     // File logger → storage/logs/

// Set zona waktu default ke WIB (Asia/Jakarta, UTC+7)
date_default_timezone_set('Asia/Jakarta');

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

// Static files: /uploads/...
if (str_starts_with($uri, '/uploads/')) {
    $filePath = __DIR__ . $uri;
    // Cegah path traversal
    $realUploads = realpath(__DIR__ . '/uploads');
    $realFile    = realpath($filePath);
    if ($realFile && $realUploads && str_starts_with($realFile, $realUploads) && file_exists($realFile)) {
        $ext = strtolower(pathinfo($realFile, PATHINFO_EXTENSION));
        $mimes = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'webp' => 'image/webp',
            'gif'  => 'image/gif',
            'svg'  => 'image/svg+xml',
        ];
        header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
        header('Content-Length: ' . filesize($realFile));
        header('Cache-Control: public, max-age=86400');
        readfile($realFile);
        exit;
    } else {
        jsonResponse(['error' => 'File tidak ditemukan.'], 404);
    }
}

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
    $uri === '/auth/change-password' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/auth/change_password.php';
    })(),
    $uri === '/auth/change-password' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Security setup status
    $uri === '/auth/security-setup' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/auth/security_setup.php';
    })(),
    $uri === '/auth/security-setup' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Security status publik (halaman login - cek user perlu setup keamanan atau tidak)
    $uri === '/auth/security-status' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/auth/security_status.php';
    })(),
    $uri === '/auth/security-status' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Auth attempts logging
    $uri === '/auth/attempts/log' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/auth/attempts_log.php';
    })(),
    $uri === '/auth/attempts/log' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    $uri === '/auth/attempts/reset' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/auth/attempts_reset.php';
    })(),
    $uri === '/auth/attempts/reset' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // List auth attempts (admin)
    $uri === '/auth/attempts/list' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/auth/attempts_list.php';
    })(),
    $uri === '/auth/attempts/list' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // WebAuthn (Windows Hello) - Login
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

    // WebAuthn (Windows Hello) - Register & Manage
    $uri === '/auth/webauthn/register/start' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/auth/webauthn_register_start.php';
    })(),
    $uri === '/auth/webauthn/register/start' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),
    $uri === '/auth/webauthn/register/verify' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/auth/webauthn_register_verify.php';
    })(),
    $uri === '/auth/webauthn/register/verify' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),
    $uri === '/auth/webauthn/list' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/auth/webauthn_list.php';
    })(),
    $uri === '/auth/webauthn/list' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),
    preg_match('#^/auth/webauthn/(\d+)/revoke$#', $uri, $m) && $method === 'POST' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/auth/webauthn/' . $m[1] . '/revoke';
        require_once __DIR__ . '/api/auth/webauthn_revoke.php';
    })(),
    preg_match('#^/auth/webauthn/(\d+)/revoke$#', $uri) => (function () {
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

    // Authenticate (Login MFA): start challenge
    $uri === '/mfa/usb/authenticate/start' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/mfa/usb/authenticate_start.php';
    })(),
    $uri === '/mfa/usb/authenticate/start' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // Authenticate (Login MFA): verify signature
    $uri === '/mfa/usb/authenticate/verify' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/mfa/usb/authenticate_verify.php';
    })(),
    $uri === '/mfa/usb/authenticate/verify' => (function () {
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

    // ── Elections ────────────────────────────────────────────
    // GET  /elections        - daftar semua pemilihan
    $uri === '/elections' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/elections/list.php';
    })(),
    // POST /elections        - buat pemilihan baru (admin)
    $uri === '/elections' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/elections/create.php';
    })(),
    $uri === '/elections' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // GET    /elections/{id}  - detail pemilihan
    preg_match('#^/elections/(\d+)$#', $uri, $m) && $method === 'GET' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1];
        require_once __DIR__ . '/api/elections/show.php';
    })(),
    // PUT    /elections/{id}  - update pemilihan (admin)
    preg_match('#^/elections/(\d+)$#', $uri, $m) && $method === 'PUT' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1];
        require_once __DIR__ . '/api/elections/update.php';
    })(),
    // DELETE /elections/{id}  - hapus pemilihan (admin)
    preg_match('#^/elections/(\d+)$#', $uri, $m) && $method === 'DELETE' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1];
        require_once __DIR__ . '/api/elections/delete.php';
    })(),
    preg_match('#^/elections/(\d+)$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // ── Candidates ───────────────────────────────────────────
    // GET  /elections/{id}/candidates         - daftar kandidat
    preg_match('#^/elections/(\d+)/candidates$#', $uri, $m) && $method === 'GET' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/candidates';
        require_once __DIR__ . '/api/elections/candidates/list.php';
    })(),
    // POST /elections/{id}/candidates         - tambah kandidat (admin)
    preg_match('#^/elections/(\d+)/candidates$#', $uri, $m) && $method === 'POST' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/candidates';
        require_once __DIR__ . '/api/elections/candidates/create.php';
    })(),
    preg_match('#^/elections/(\d+)/candidates$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // ── Voters ───────────────────────────────────────────────
    // GET  /elections/{id}/voters  - daftar voter (admin)
    preg_match('#^/elections/(\d+)/voters$#', $uri, $m) && $method === 'GET' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/voters';
        require_once __DIR__ . '/api/elections/voters/list.php';
    })(),
    // POST /elections/{id}/voters  - daftarkan voter (admin)
    preg_match('#^/elections/(\d+)/voters$#', $uri, $m) && $method === 'POST' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/voters';
        require_once __DIR__ . '/api/elections/voters/register.php';
    })(),
    preg_match('#^/elections/(\d+)/voters$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // GET    /elections/{id}/results          - hasil tally pemilihan
    preg_match('#^/elections/(\d+)/results$#', $uri, $m) && $method === 'GET' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/results';
        require_once __DIR__ . '/api/elections/results.php';
    })(),
    preg_match('#^/elections/(\d+)/results$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // POST   /elections/{id}/vote             - kirim suara (voter)
    preg_match('#^/elections/(\d+)/vote$#', $uri, $m) && $method === 'POST' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/vote';
        require_once __DIR__ . '/api/elections/vote.php';
    })(),
    preg_match('#^/elections/(\d+)/vote$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // GET foto kandidat terenkripsi
    preg_match('#^/elections/(\d+)/candidates/(\d+)/photo$#', $uri, $m)
    && $method === 'GET' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1]
            . '/candidates/' . $m[2] . '/photo';

        require_once __DIR__ . '/api/elections/candidates/show_photo.php';
    })(),

    // Upload foto kandidat: POST /elections/{id}/candidates/{cid}/photo
    preg_match('#^/elections/(\d+)/candidates/(\d+)/photo$#', $uri, $m) && $method === 'POST' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/candidates/' . $m[2] . '/photo';
        require_once __DIR__ . '/api/elections/candidates/upload_photo.php';
    })(),
    preg_match('#^/elections/(\d+)/candidates/(\d+)/photo$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // PUT    /elections/{id}/candidates/{cid} - update kandidat (admin)
    preg_match('#^/elections/(\d+)/candidates/(\d+)$#', $uri, $m) && $method === 'PUT' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/candidates/' . $m[2];
        require_once __DIR__ . '/api/elections/candidates/update.php';
    })(),
    // DELETE /elections/{id}/candidates/{cid} - hapus kandidat (admin)
    preg_match('#^/elections/(\d+)/candidates/(\d+)$#', $uri, $m) && $method === 'DELETE' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/candidates/' . $m[2];
        require_once __DIR__ . '/api/elections/candidates/delete.php';
    })(),
    preg_match('#^/elections/(\d+)/candidates/(\d+)$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // ── Voters Management ─────────────────────────────────────
    // GET /users/voters - daftar semua voter yang aktif di sistem (admin)
    $uri === '/users/voters' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/users/voters.php';
    })(),
    $uri === '/users/voters' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // GET /users/search?q=... - cari pengguna (admin)
    $uri === '/users/search' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/users/search.php';
    })(),
    $uri === '/users/search' => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // GET /auth/attempts/{id}/photo - foto kamera percobaan login (admin)
    preg_match('#^/auth/attempts/(\d+)/photo$#', $uri, $m) && $method === 'GET' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/auth/attempts/' . $m[1] . '/photo';
        require_once __DIR__ . '/api/auth/attempts_photo.php';
    })(),
    preg_match('#^/auth/attempts/(\d+)/photo$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // DELETE /elections/{id}/voters/{userId} - keluarkan voter dari pemilihan (admin)
    preg_match('#^/elections/(\d+)/voters/(\d+)$#', $uri, $m) && $method === 'DELETE' => (function () use ($m) {
        $_SERVER['REQUEST_URI'] = '/elections/' . $m[1] . '/voters/' . $m[2];
        require_once __DIR__ . '/api/elections/voters/delete.php';
    })(),
    preg_match('#^/elections/(\d+)/voters/(\d+)$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

        // ── Cryptography: Encrypted Messages ──────────────────────

    $uri === '/encrypted-messages' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/encrypted-messages/create.php';
    })(),

    preg_match('#^/encrypted-messages/(\d+)$#', $uri, $m)
        && $method === 'GET' => (function () use ($m) {
            $_GET['id'] = $m[1];
            require_once __DIR__ . '/api/encrypted-messages/get.php';
        })(),

    $uri === '/encrypted-messages' ||
    preg_match('#^/encrypted-messages/(\d+)$#', $uri) => (function () {
        jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
    })(),

    // ── Blockchain ────────────────────────────────────────────

    $uri === '/elections/blockchain/seal' && $method === 'POST' => (function () {
        require_once __DIR__ . '/api/elections/blockchain-seal.php';
    })(),

    $uri === '/elections/blockchain/verify' && $method === 'GET' => (function () {
        require_once __DIR__ . '/api/elections/blockchain-verify.php';
    })(),

    // 404
    default => jsonResponse(['error' => 'Endpoint tidak ditemukan.'], 404),
};
