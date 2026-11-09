#!/usr/bin/env php
<?php

/**
 * TrueCount - API Test Runner
 *
 * Penggunaan:
 *   php tests/api_test.php
 *   php tests/api_test.php --verbose
 *
 * Menguji Auth API + Invite API (pendaftaran via undangan) secara otomatis.
 * Tidak butuh library eksternal - murni PHP + cURL (+ PDO untuk fixture).
 */

define('BASE_URL', 'http://localhost:8000');
define('VERBOSE',  in_array('--verbose', $argv, true));

// ── ANSI colors ───────────────────────────────────────────
function green(string $s): string  { return "\033[32m{$s}\033[0m"; }
function red(string $s): string    { return "\033[31m{$s}\033[0m"; }
function yellow(string $s): string { return "\033[33m{$s}\033[0m"; }
function bold(string $s): string   { return "\033[1m{$s}\033[0m"; }
function dim(string $s): string    { return "\033[2m{$s}\033[0m"; }

// ── HTTP helper ───────────────────────────────────────────
function request(string $method, string $path, array $body = [], array $headers = []): array
{
    $url = BASE_URL . $path;
    $ch  = curl_init($url);

    $defaultHeaders = ['Content-Type: application/json', 'Accept: application/json'];
    $allHeaders     = array_merge($defaultHeaders, $headers);

    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $allHeaders,
        CURLOPT_TIMEOUT        => 10,
    ]);

    if (!empty($body)) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $raw    = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error  = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['status' => 0, 'body' => [], 'raw' => $error, 'error' => $error];
    }

    return [
        'status' => $status,
        'body'   => json_decode($raw, true) ?? [],
        'raw'    => $raw,
        'error'  => null,
    ];
}

// ── Test runner ───────────────────────────────────────────
$pass  = 0;
$fail  = 0;
$token = null;   // akan diisi setelah login berhasil

function test(string $name, callable $fn): void
{
    global $pass, $fail;
    try {
        $fn();
        echo green('  ✓') . " {$name}\n";
        $pass++;
    } catch (Throwable $e) {
        echo red('  ✗') . " {$name}\n";
        echo dim("    → " . $e->getMessage()) . "\n";
        $fail++;
    }
}

function assert_equals(mixed $expected, mixed $actual, string $msg = ''): void
{
    if ($expected !== $actual) {
        throw new \RuntimeException(
            ($msg ?: 'Nilai tidak sesuai') .
            " - diharapkan: " . json_encode($expected) .
            ", didapat: " . json_encode($actual)
        );
    }
}

function assert_has(array $data, string $key, string $msg = ''): void
{
    if (!array_key_exists($key, $data)) {
        throw new \RuntimeException(
            ($msg ?: "Key '{$key}' tidak ditemukan di response") .
            " - response: " . json_encode($data)
        );
    }
}

function assert_not_empty(mixed $value, string $msg = ''): void
{
    if (empty($value)) {
        throw new \RuntimeException($msg ?: 'Nilai kosong, diharapkan tidak kosong');
    }
}

// ── Fixture: buat undangan langsung ke DB (untuk test validasi) ──
require_once __DIR__ . '/../backend/config/database.php';

function createDbInvite(array $opts = []): array
{
    $db    = getDB();
    $token = bin2hex(random_bytes(24));
    $email = $opts['email'] ?? null;
    $expired = (bool)($opts['expired'] ?? false);

    $expiresExpr = $expired
        ? 'DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)'
        : 'DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY)';

    $stmt = $db->prepare(
        "INSERT INTO invites (token, email, role, created_by, expires_at)
         SELECT ?, NULLIF(?, ''), 'voter', id, {$expiresExpr}
           FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    $stmt->execute([$token, $email]);

    return ['token' => $token, 'email' => $email];
}

// ── Unique suffix agar tidak collision test berulang ─────
$suffix   = substr(md5(microtime()), 0, 6);
$testUser = [
    'username' => "tc_test_{$suffix}",
    'email'    => "tc_test_{$suffix}@truecount.test",
    'password' => 'TestPass@999',
];

// ══════════════════════════════════════════════════════════
echo bold("\nTrueCount - API Test Runner\n");
echo dim(str_repeat('─', 42) . "\n\n");

// ── 1. Health check ───────────────────────────────────────
echo bold("1. Health Check\n");

test('GET /health → 200', function () {
    $r = request('GET', '/health');
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_equals('ok', $r['body']['status'] ?? null, 'body.status');
    assert_equals('TrueCount', $r['body']['app'] ?? null, 'body.app');
});

// ── 2. Pendaftaran tanpa undangan ─────────────────────────
echo "\n" . bold("2. Pendaftaran Tanpa Undangan (harus ditolak)\n");

test('POST /auth/register tanpa undangan → 403', function () {
    $r = request('POST', '/auth/register', [
        'username' => 'noinvite_user',
        'email'    => 'noinvite@test.com',
        'password' => 'ValidPass@1',
    ]);
    assert_equals(403, $r['status'], 'Status HTTP harus 403');
    assert_has($r['body'], 'error', 'Key error');
});

test('POST /auth/register → 422 (field kosong)', function () {
    $r = request('POST', '/auth/register', []);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

// ── 3. Login admin (untuk buat undangan) ─────────────────
echo "\n" . bold("3. Login Admin\n");

$adminToken = null;
test('POST /auth/login → 200 (akun admin)', function () use (&$adminToken) {
    $r = request('POST', '/auth/login', [
        'identifier' => 'admin',
        'password'   => 'Admin@1234',
    ]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_equals('admin', $r['body']['user']['role'] ?? null, 'role harus admin');
    assert_not_empty($r['body']['token'] ?? '', 'Token tidak boleh kosong');
    $adminToken = $r['body']['token'];
});

// ── 4. Buat undangan (admin) ─────────────────────────────
echo "\n" . bold("4. Buat Undangan (POST /invites)\n");

$inviteToken  = null;
$inviteLink   = null;
test('POST /invites (admin) → 201', function () use (&$inviteToken, &$inviteLink) {
    global $adminToken;
    $r = request('POST', '/invites', [], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(201, $r['status'], 'Status HTTP harus 201');
    assert_has($r['body'], 'invite', 'Key invite');
    assert_not_empty($r['body']['invite']['token'] ?? '', 'invite.token');
    assert_not_empty($r['body']['invite']['link']  ?? '', 'invite.link');
    $inviteToken = $r['body']['invite']['token'];
    $inviteLink  = $r['body']['invite']['link'];
});

test('POST /invites (admin, email terikat) → 201', function () {
    global $adminToken;
    $r = request('POST', '/invites', ['email' => 'bound@truecount.test'], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(201, $r['status'], 'Status HTTP harus 201');
    assert_equals('bound@truecount.test', $r['body']['invite']['email'] ?? null, 'email tersimpan');
});

test('POST /invites (admin, role admin) → 201', function () {
    global $adminToken;
    $r = request('POST', '/invites', ['role' => 'admin'], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(201, $r['status'], 'Status HTTP harus 201');
    assert_equals('admin', $r['body']['invite']['role'] ?? null, 'role tersimpan');
});

test('POST /invites → 401 (tanpa token)', function () {
    $r = request('POST', '/invites');
    assert_equals(401, $r['status'], 'Status HTTP harus 401');
});

test('POST /invites → 422 (email tidak valid)', function () {
    global $adminToken;
    $r = request('POST', '/invites', ['email' => 'bukan-email'], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

test('POST /invites → 422 (role tidak valid)', function () {
    global $adminToken;
    $r = request('POST', '/invites', ['role' => 'hacker'], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

// ── 5. Daftar undangan + verifikasi ──────────────────────
echo "\n" . bold("5. Daftar & Verifikasi Undangan\n");

test('GET /invites (admin) → 200 + stats', function () {
    global $adminToken;
    $r = request('GET', '/invites', [], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_has($r['body'], 'stats', 'Key stats');
    assert_has($r['body'], 'invites', 'Key invites');
    assert_has($r['body']['stats'], 'total', 'stats.total');
    assert_has($r['body']['stats'], 'menunggu', 'stats.menunggu');
    assert_has($r['body']['stats'], 'diterima', 'stats.diterima');
    assert_has($r['body']['stats'], 'kedaluwarsa', 'stats.kedaluwarsa');
});

test('GET /invites → 401 (tanpa token)', function () {
    $r = request('GET', '/invites');
    assert_equals(401, $r['status'], 'Status HTTP harus 401');
});

test('GET /invites/verify (token valid) → 200', function () use ($inviteToken) {
    $r = request('GET', "/invites/verify?token={$inviteToken}");
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_equals(true, $r['body']['valid'] ?? null, 'body.valid');
});

test('GET /invites/verify (token palsu) → 404', function () {
    $r = request('GET', '/invites/verify?token=token_palsu_123456');
    assert_equals(404, $r['status'], 'Status HTTP harus 404');
});

test('GET /invites/verify (token kedaluwarsa) → 400', function () {
    $fixture = createDbInvite(['expired' => true]);
    $r = request('GET', "/invites/verify?token={$fixture['token']}");
    assert_equals(400, $r['status'], 'Status HTTP harus 400');
});

test('GET /invites/verify (tanpa token) → 422', function () {
    $r = request('GET', '/invites/verify');
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

// ── 6. Register via undangan ─────────────────────────────
echo "\n" . bold("6. Register Via Undangan\n");

test('POST /auth/register (undangan valid) → 201', function () use ($testUser, $inviteToken) {
    $r = request('POST', '/auth/register', $testUser + ['invite_token' => $inviteToken]);
    assert_equals(201, $r['status'], 'Status HTTP harus 201');
    assert_has($r['body'], 'user', 'Key user');
    assert_equals($testUser['username'], $r['body']['user']['username'] ?? null, 'username');
    assert_equals('voter', $r['body']['user']['role'] ?? null, 'role mengikuti undangan (voter)');
});

test('POST /auth/register (undangan sudah dipakai) → 400', function () use ($testUser, $inviteToken) {
    $r = request('POST', '/auth/register', [
        'username'     => 'pakai_ulang_user',
        'email'        => 'pakai_ulang@test.com',
        'password'     => 'ValidPass@1',
        'invite_token' => $inviteToken,
    ]);
    assert_equals(400, $r['status'], 'Status HTTP harus 400');
});

test('POST /auth/register (undangan palsu) → 400', function () {
    $r = request('POST', '/auth/register', [
        'username'     => 'invite_palsu_user',
        'email'        => 'invite_palsu@test.com',
        'password'     => 'ValidPass@1',
        'invite_token' => 'token_palsu_123456',
    ]);
    assert_equals(400, $r['status'], 'Status HTTP harus 400');
});

test('POST /auth/register (undangan kedaluwarsa) → 400', function () {
    $fixture = createDbInvite(['expired' => true]);
    $r = request('POST', '/auth/register', [
        'username'     => 'expired_user',
        'email'        => 'expired@test.com',
        'password'     => 'ValidPass@1',
        'invite_token' => $fixture['token'],
    ]);
    assert_equals(400, $r['status'], 'Status HTTP harus 400');
});

test('POST /auth/register (username duplikat) → 409', function () use ($testUser) {
    $fixture = createDbInvite();
    $r = request('POST', '/auth/register', $testUser + ['invite_token' => $fixture['token']]);
    assert_equals(409, $r['status'], 'Status HTTP harus 409');
});

test('POST /auth/register (password pendek) → 422', function () {
    $fixture = createDbInvite();
    $r = request('POST', '/auth/register', [
        'username'     => 'shortpass_user',
        'email'        => 'shortpass@test.com',
        'password'     => '123',
        'invite_token' => $fixture['token'],
    ]);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

test('POST /auth/register (email tidak valid) → 422', function () {
    $fixture = createDbInvite();
    $r = request('POST', '/auth/register', [
        'username'     => 'bademail_user',
        'email'        => 'bukan-email',
        'password'     => 'ValidPass@1',
        'invite_token' => $fixture['token'],
    ]);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

test('POST /auth/register (email terikat undangan) → 201 & email mengikuti undangan', function () use ($suffix) {
    $fixture = createDbInvite(['email' => "bound_{$suffix}@truecount.test"]);
    $r = request('POST', '/auth/register', [
        'username'     => "bound_{$suffix}",
        'email'        => 'email_lain@test.com',   // diabaikan - undangan terikat
        'password'     => 'ValidPass@1',
        'invite_token' => $fixture['token'],
    ]);
    assert_equals(201, $r['status'], 'Status HTTP harus 201');
    assert_equals($fixture['email'], $r['body']['user']['email'] ?? null, 'email harus dari undangan');
});

// ── 7. Login ──────────────────────────────────────────────
echo "\n" . bold("7. Login\n");

test('POST /auth/login → 200 (username + password benar)', function () use ($testUser, &$token) {
    $r = request('POST', '/auth/login', [
        'identifier' => $testUser['username'],
        'password'   => $testUser['password'],
    ]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_has($r['body'], 'token', 'Key token');
    assert_not_empty($r['body']['token'] ?? '', 'Token tidak boleh kosong');
    $token = $r['body']['token'];   // simpan untuk test berikutnya
});

test('POST /auth/login → 200 (login pakai email)', function () use ($testUser) {
    $r = request('POST', '/auth/login', [
        'identifier' => $testUser['email'],
        'password'   => $testUser['password'],
    ]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_has($r['body'], 'token', 'Key token');
});

test('POST /auth/login → 401 (password salah)', function () use ($testUser) {
    $r = request('POST', '/auth/login', [
        'identifier' => $testUser['username'],
        'password'   => 'salahpassword',
    ]);
    assert_equals(401, $r['status'], 'Status HTTP harus 401');
    assert_has($r['body'], 'error', 'Key error');
});

test('POST /auth/login → 401 (user tidak ada)', function () {
    $r = request('POST', '/auth/login', [
        'identifier' => 'user_tidak_ada_sama_sekali',
        'password'   => 'apapun',
    ]);
    assert_equals(401, $r['status'], 'Status HTTP harus 401');
});

test('POST /auth/login → 422 (field kosong)', function () {
    $r = request('POST', '/auth/login', ['identifier' => '', 'password' => '']);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

// ── 8. Invite permission (voter tidak boleh) ─────────────
echo "\n" . bold("8. Hak Akses Undangan (voter ditolak)\n");

test('POST /invites (token voter) → 403', function () use (&$token) {
    $r = request('POST', '/invites', [], ["Authorization: Bearer {$token}"]);
    assert_equals(403, $r['status'], 'Status HTTP harus 403');
});

test('GET /invites (token voter) → 403', function () use (&$token) {
    $r = request('GET', '/invites', [], ["Authorization: Bearer {$token}"]);
    assert_equals(403, $r['status'], 'Status HTTP harus 403');
});

// ── 9. Me (butuh token) ───────────────────────────────────
echo "\n" . bold("9. GET /auth/me\n");

test('GET /auth/me → 200 (token valid)', function () use (&$token) {
    if (!$token) throw new \RuntimeException('Token belum tersedia dari test login');
    $r = request('GET', '/auth/me', [], ["Authorization: Bearer {$token}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_has($r['body'], 'user', 'Key user');
    assert_has($r['body']['user'], 'id',       'user.id');
    assert_has($r['body']['user'], 'username', 'user.username');
    assert_has($r['body']['user'], 'email',    'user.email');
    assert_has($r['body']['user'], 'role',     'user.role');
});

test('GET /auth/me → 401 (tanpa token)', function () {
    $r = request('GET', '/auth/me');
    assert_equals(401, $r['status'], 'Status HTTP harus 401');
});

test('GET /auth/me → 401 (token palsu)', function () {
    $r = request('GET', '/auth/me', [], ['Authorization: Bearer token.palsu.sekali']);
    assert_equals(401, $r['status'], 'Status HTTP harus 401');
});

test('GET /auth/me → 401 (token kedaluwarsa)', function () {
    // Buat JWT dengan exp di masa lalu
    $header  = base64_encode(json_encode(['alg'=>'HS256','typ'=>'JWT']));
    $payload = base64_encode(json_encode(['sub'=>1,'exp'=>time()-3600,'iat'=>time()-7200]));
    $sig     = base64_encode(hash_hmac('sha256', "$header.$payload", 'wrong_secret', true));
    $expired = "$header.$payload.$sig";
    $r = request('GET', '/auth/me', [], ["Authorization: Bearer {$expired}"]);
    assert_equals(401, $r['status'], 'Status HTTP harus 401');
});

// ── 10. Logout ────────────────────────────────────────────
echo "\n" . bold("10. POST /auth/logout\n");

test('POST /auth/logout → 200', function () {
    $r = request('POST', '/auth/logout');
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_has($r['body'], 'message', 'Key message');
});

// ── 11. Method not allowed ────────────────────────────────
echo "\n" . bold("11. Method Validation\n");

test('GET /auth/register → 405', function () {
    $r = request('GET', '/auth/register');
    assert_equals(405, $r['status'], 'Status HTTP harus 405');
});

test('GET /auth/login → 405', function () {
    $r = request('GET', '/auth/login');
    assert_equals(405, $r['status'], 'Status HTTP harus 405');
});

test('DELETE /invites → 405', function () {
    $r = request('DELETE', '/invites');
    assert_equals(405, $r['status'], 'Status HTTP harus 405');
});

test('POST /invites/verify → 405', function () {
    $r = request('POST', '/invites/verify');
    assert_equals(405, $r['status'], 'Status HTTP harus 405');
});

test('GET /endpoint-tidak-ada → 404', function () {
    $r = request('GET', '/endpoint-tidak-ada-sama-sekali');
    assert_equals(404, $r['status'], 'Status HTTP harus 404');
});

// ── 12. Elections CRUD (admin) ────────────────────────────
echo "\n" . bold("12. Elections CRUD\n");

$electionId = null;

test('POST /elections (admin) → 201', function () use (&$electionId, &$adminToken) {
    $r = request('POST', '/elections', [
        'title'       => 'Test Pemilihan BEM',
        'description' => 'Pemilihan test otomatis',
        'start_time'  => date('c', strtotime('+1 hour')),
        'end_time'    => date('c', strtotime('+2 days')),
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(201, $r['status'], 'Status HTTP harus 201');
    assert_has($r['body'], 'election', 'Key election');
    assert_not_empty($r['body']['election']['id'] ?? 0, 'election.id');
    assert_equals('draft', $r['body']['election']['status'] ?? null, 'status awal harus draft');
    $electionId = $r['body']['election']['id'];
});

test('POST /elections (voter) → 403', function () use (&$token) {
    $r = request('POST', '/elections', [
        'title'      => 'Tidak boleh',
        'start_time' => date('c', strtotime('+1 hour')),
        'end_time'   => date('c', strtotime('+2 days')),
    ], ["Authorization: Bearer {$token}"]);
    assert_equals(403, $r['status'], 'Status HTTP harus 403');
});

test('POST /elections → 422 (tanpa title) ', function () use (&$adminToken) {
    $r = request('POST', '/elections', [
        'start_time' => date('c', strtotime('+1 hour')),
        'end_time'   => date('c', strtotime('+2 days')),
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

test('POST /elections → 422 (end_time ≤ start_time)', function () use (&$adminToken) {
    $r = request('POST', '/elections', [
        'title'      => 'Waktu salah',
        'start_time' => date('c', strtotime('+2 days')),
        'end_time'   => date('c', strtotime('+1 hour')),
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

test('GET /elections (admin) → 200', function () use (&$adminToken) {
    $r = request('GET', '/elections', [], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_has($r['body'], 'elections', 'Key elections');
});

test('GET /elections (voter, hanya active/closed) → 200', function () use (&$token) {
    $r = request('GET', '/elections', [], ["Authorization: Bearer {$token}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    // Voter tidak boleh lihat draft
    foreach (($r['body']['elections'] ?? []) as $e) {
        if ($e['status'] === 'draft') {
            throw new \RuntimeException('Voter tidak boleh melihat election draft');
        }
    }
});

test('GET /elections/{id} (admin) → 200', function () use (&$electionId, &$adminToken) {
    $r = request('GET', "/elections/{$electionId}", [], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_equals($electionId, $r['body']['election']['id'] ?? null, 'election.id sesuai');
});

test('GET /elections/{id} draft (voter) → 404', function () use (&$electionId, &$token) {
    // election masih draft, voter harus dapat 404
    $r = request('GET', "/elections/{$electionId}", [], ["Authorization: Bearer {$token}"]);
    assert_equals(404, $r['status'], 'Voter tidak boleh lihat draft');
});

test('PUT /elections/{id} → 200 (ubah status jadi active)', function () use (&$electionId, &$adminToken) {
    $r = request('PUT', "/elections/{$electionId}", [
        'status' => 'active',
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_equals('active', $r['body']['election']['status'] ?? null, 'status harus active');
});

test('GET /elections/{id} active (voter) → 200', function () use (&$electionId, &$token) {
    $r = request('GET', "/elections/{$electionId}", [], ["Authorization: Bearer {$token}"]);
    assert_equals(200, $r['status'], 'Voter boleh lihat active');
});

// ── 13. Candidates CRUD ───────────────────────────────────
echo "\n" . bold("13. Candidates CRUD\n");

$candidateId = null;

test('POST /elections/{id}/candidates (admin) → 201', function () use (&$electionId, &$adminToken, &$candidateId) {
    $r = request('POST', "/elections/{$electionId}/candidates", [
        'name'    => 'Kandidat Test',
        'vision'  => 'Visi test',
        'mission' => 'Misi test',
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(201, $r['status'], 'Status HTTP harus 201');
    assert_has($r['body'], 'candidate', 'Key candidate');
    assert_equals('Kandidat Test', $r['body']['candidate']['name'] ?? null, 'name sesuai');
    $candidateId = $r['body']['candidate']['id'];
});

test('POST /elections/{id}/candidates (voter) → 403', function () use (&$electionId, &$token) {
    $r = request('POST', "/elections/{$electionId}/candidates", [
        'name' => 'Coba voter tambah kandidat',
    ], ["Authorization: Bearer {$token}"]);
    assert_equals(403, $r['status'], 'Voter tidak boleh tambah kandidat');
});

test('POST /elections/{id}/candidates → 422 (tanpa nama)', function () use (&$electionId, &$adminToken) {
    $r = request('POST', "/elections/{$electionId}/candidates", [
        'vision' => 'tanpa nama',
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(422, $r['status'], 'Status HTTP harus 422');
});

test('GET /elections/{id}/candidates → 200', function () use (&$electionId, &$token) {
    $r = request('GET', "/elections/{$electionId}/candidates", [], ["Authorization: Bearer {$token}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_has($r['body'], 'candidates', 'Key candidates');
});

test('PUT /elections/{id}/candidates/{cid} → 200', function () use (&$electionId, &$candidateId, &$adminToken) {
    $r = request('PUT', "/elections/{$electionId}/candidates/{$candidateId}", [
        'name' => 'Kandidat Test Updated',
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_equals('Kandidat Test Updated', $r['body']['candidate']['name'] ?? null, 'name terupdate');
});

// ── 14. Voting ────────────────────────────────────────────
echo "\n" . bold("14. Voting\n");

// Daftarkan voter ke election langsung via DB untuk keperluan test
function registerVoterDb(int $userId, int $electionId): void
{
    $db = getDB();
    $db->prepare(
        'INSERT IGNORE INTO voters (user_id, election_id, has_voted, registered_at)
         VALUES (?, ?, 0, UTC_TIMESTAMP())'
    )->execute([$userId, $electionId]);
}

$voterId = null;

test('GET /auth/me untuk dapat voter user_id', function () use (&$token, &$voterId) {
    $r = request('GET', '/auth/me', [], ["Authorization: Bearer {$token}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    $voterId = $r['body']['user']['id'] ?? null;
    assert_not_empty($voterId, 'Harus dapat user id voter');
});

test('POST /elections/{id}/vote (belum terdaftar) → 403', function () use (&$electionId, &$candidateId, &$token) {
    $r = request('POST', "/elections/{$electionId}/vote", [
        'candidate_id' => $candidateId,
    ], ["Authorization: Bearer {$token}"]);
    assert_equals(403, $r['status'], 'Harus 403 jika belum terdaftar sebagai voter');
});

test('POST /elections/{id}/vote (admin tidak boleh) → 403', function () use (&$electionId, &$candidateId, &$adminToken) {
    $r = request('POST', "/elections/{$electionId}/vote", [
        'candidate_id' => $candidateId,
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(403, $r['status'], 'Admin tidak boleh vote');
});

test('POST /elections/{id}/vote (voter terdaftar) → 200', function () use (&$electionId, &$candidateId, &$token, &$voterId) {
    // Daftarkan voter ke election via DB
    registerVoterDb((int)$voterId, (int)$electionId);
    $r = request('POST', "/elections/{$electionId}/vote", [
        'candidate_id' => $candidateId,
    ], ["Authorization: Bearer {$token}"]);
    assert_equals(200, $r['status'], 'Status HTTP harus 200');
    assert_has($r['body'], 'message', 'Key message');
});

test('POST /elections/{id}/vote (vote dua kali) → 409', function () use (&$electionId, &$candidateId, &$token) {
    $r = request('POST', "/elections/{$electionId}/vote", [
        'candidate_id' => $candidateId,
    ], ["Authorization: Bearer {$token}"]);
    assert_equals(409, $r['status'], 'Harus 409 jika sudah pernah vote');
});

test('POST /elections/{id}/vote (kandidat tidak ada) → 404', function () use (&$electionId, &$adminToken) {
    // Buat voter admin baru untuk tes ini (pakai user admin, daftarkan dulu)
    // Karena admin tidak bisa vote, pakai fixture DB buat voter baru
    $db      = getDB();
    $suffix2 = substr(md5(microtime() . 'v2'), 0, 6);
    $pw      = password_hash('VoterTest@1', PASSWORD_ARGON2ID);
    $db->prepare(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'voter')"
    )->execute(["voter2_{$suffix2}", "voter2_{$suffix2}@test.com", $pw]);
    $uid2 = (int)$db->lastInsertId();
    registerVoterDb($uid2, (int)$electionId);

    $loginR = request('POST', '/auth/login', [
        'identifier' => "voter2_{$suffix2}",
        'password'   => 'VoterTest@1',
    ]);
    $token2 = $loginR['body']['token'] ?? '';

    $r = request('POST', "/elections/{$electionId}/vote", [
        'candidate_id' => 999999,
    ], ["Authorization: Bearer {$token2}"]);
    assert_equals(404, $r['status'], 'Kandidat tidak ada harus 404');
});

test('POST /elections/{id}/vote (election draft) → 422', function () use (&$adminToken, &$candidateId) {
    // Buat election baru yang masih draft
    $createR = request('POST', '/elections', [
        'title'      => 'Draft Election Test',
        'start_time' => date('c', strtotime('+1 day')),
        'end_time'   => date('c', strtotime('+3 days')),
    ], ["Authorization: Bearer {$adminToken}"]);
    $draftId = $createR['body']['election']['id'] ?? 0;

    $db      = getDB();
    $suffix3 = substr(md5(microtime() . 'v3'), 0, 6);
    $pw      = password_hash('VoterTest@1', PASSWORD_ARGON2ID);
    $db->prepare(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'voter')"
    )->execute(["voter3_{$suffix3}", "voter3_{$suffix3}@test.com", $pw]);
    $uid3 = (int)$db->lastInsertId();
    registerVoterDb($uid3, (int)$draftId);

    $loginR = request('POST', '/auth/login', [
        'identifier' => "voter3_{$suffix3}",
        'password'   => 'VoterTest@1',
    ]);
    $token3 = $loginR['body']['token'] ?? '';

    $r = request('POST', "/elections/{$draftId}/vote", [
        'candidate_id' => $candidateId,
    ], ["Authorization: Bearer {$token3}"]);
    assert_equals(422, $r['status'], 'Election draft harus 422');
});

// ── 15. Voters Management ─────────────────────────────────
echo "\n" . bold("15. Voters Management\n");

test('POST /elections/{id}/voters (admin, daftarkan voter) → 200', function () use (&$electionId, &$adminToken, &$voterId) {
    // Buat voter baru via DB untuk didaftarkan
    $db      = getDB();
    $suffix4 = substr(md5(microtime() . 'v4'), 0, 6);
    $pw      = password_hash('VoterTest@1', PASSWORD_ARGON2ID);
    $db->prepare(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'voter')"
    )->execute(["voter4_{$suffix4}", "voter4_{$suffix4}@test.com", $pw]);
    $uid4 = (int)$db->lastInsertId();

    $r = request('POST', "/elections/{$electionId}/voters", [
        'user_id' => $uid4,
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP harus 200');
    assert_has($r['body'], 'registered', 'Key registered');
    assert_equals(1, $r['body']['registered'] ?? null, 'registered harus 1');
});

test('POST /elections/{id}/voters (idempoten - user sudah terdaftar) → 200', function () use (&$electionId, &$adminToken, &$voterId) {
    // Kirim ulang voterId yang sudah terdaftar dari test voting sebelumnya
    $r = request('POST', "/elections/{$electionId}/voters", [
        'user_id' => $voterId,
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP harus 200');
    assert_equals(0, $r['body']['registered'] ?? -1, 'registered 0 karena sudah terdaftar');
    assert_equals(1, $r['body']['skipped']    ?? -1, 'skipped 1');
});

test('POST /elections/{id}/voters (bulk user_ids) → 200', function () use (&$electionId, &$adminToken) {
    $db      = getDB();
    $suffix5 = substr(md5(microtime() . 'v5'), 0, 6);
    $pw      = password_hash('VoterTest@1', PASSWORD_ARGON2ID);
    $db->prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'voter')")
       ->execute(["voter5a_{$suffix5}", "voter5a_{$suffix5}@test.com", $pw]);
    $uid5a = (int)$db->lastInsertId();
    $db->prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'voter')")
       ->execute(["voter5b_{$suffix5}", "voter5b_{$suffix5}@test.com", $pw]);
    $uid5b = (int)$db->lastInsertId();

    $r = request('POST', "/elections/{$electionId}/voters", [
        'user_ids' => [$uid5a, $uid5b],
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP harus 200');
    assert_equals(2, $r['body']['registered'] ?? -1, 'registered harus 2');
});

test('POST /elections/{id}/voters (voter tidak boleh) → 403', function () use (&$electionId, &$token, &$voterId) {
    $r = request('POST', "/elections/{$electionId}/voters", [
        'user_id' => $voterId,
    ], ["Authorization: Bearer {$token}"]);
    assert_equals(403, $r['status'], 'Voter tidak boleh daftarkan voter');
});

test('POST /elections/{id}/voters (user_id tidak ada) → 422', function () use (&$electionId, &$adminToken) {
    $r = request('POST', "/elections/{$electionId}/voters", [
        'user_id' => 999998,
    ], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(422, $r['status'], 'User tidak ada harus 422');
});

test('GET /elections/{id}/voters (admin) → 200', function () use (&$electionId, &$adminToken) {
    $r = request('GET', "/elections/{$electionId}/voters", [], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Status HTTP');
    assert_has($r['body'], 'voters', 'Key voters');
    assert_has($r['body'], 'total',  'Key total');
    assert_has($r['body'], 'voted',  'Key voted');
});

test('GET /elections/{id}/voters (voter tidak boleh) → 403', function () use (&$electionId, &$token) {
    $r = request('GET', "/elections/{$electionId}/voters", [], ["Authorization: Bearer {$token}"]);
    assert_equals(403, $r['status'], 'Voter tidak boleh lihat daftar voter');
});

// ── 16. Results ───────────────────────────────────────────
echo "\n" . bold("16. Hasil Pemilihan\n");

test('GET /elections/{id}/results (active, admin) → 200 live count', function () use (&$electionId, &$adminToken) {
    $r = request('GET', "/elections/{$electionId}/results", [], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $r['status'], 'Admin boleh lihat hasil election active');
    assert_has($r['body'], 'results',     'Key results');
    assert_has($r['body'], 'total_votes', 'Key total_votes');
    assert_has($r['body'], 'voter_count', 'Key voter_count');
    assert_has($r['body'], 'participation_rate', 'Key participation_rate');
});

test('GET /elections/{id}/results (active, voter) → 403', function () use (&$electionId, &$token) {
    $r = request('GET', "/elections/{$electionId}/results", [], ["Authorization: Bearer {$token}"]);
    assert_equals(403, $r['status'], 'Voter tidak boleh lihat hasil election active');
});

test('GET /elections/{id}/results (closed, voter) → 200', function () use (&$electionId, &$adminToken, &$token) {
    // Tutup election dulu
    request('PUT', "/elections/{$electionId}", ['status' => 'closed'], ["Authorization: Bearer {$adminToken}"]);

    $r = request('GET', "/elections/{$electionId}/results", [], ["Authorization: Bearer {$token}"]);
    assert_equals(200, $r['status'], 'Voter boleh lihat hasil election closed');
    assert_has($r['body'], 'results', 'Key results');
    // Pastikan ada suara (dari test voting sebelumnya)
    $totalVotes = $r['body']['total_votes'] ?? -1;
    if ($totalVotes < 1) {
        throw new \RuntimeException("total_votes harus >= 1, didapat: {$totalVotes}");
    }
});

// ── 17. Delete election (admin) ───────────────────────────
echo "\n" . bold("17. Hapus Election\n");

test('DELETE /elections/{id} (active) → 422', function () use (&$electionId, &$adminToken) {
    $r = request('DELETE', "/elections/{$electionId}", [], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(422, $r['status'], 'Tidak boleh hapus election active');
});

test('DELETE /elections/{id} draft → 200', function () use (&$adminToken) {
    $r = request('POST', '/elections', [
        'title'      => 'Akan Dihapus',
        'start_time' => date('c', strtotime('+1 day')),
        'end_time'   => date('c', strtotime('+3 days')),
    ], ["Authorization: Bearer {$adminToken}"]);
    $tmpId = $r['body']['election']['id'] ?? 0;

    $del = request('DELETE', "/elections/{$tmpId}", [], ["Authorization: Bearer {$adminToken}"]);
    assert_equals(200, $del['status'], 'Hapus draft harus 200');
    assert_has($del['body'], 'message', 'Key message');
});

// ── Summary ───────────────────────────────────────────────
$total = $pass + $fail;
echo "\n" . dim(str_repeat('─', 42)) . "\n";
echo bold("Hasil: ");

if ($fail === 0) {
    echo green("{$pass}/{$total} passed") . " - " . green("Semua test berhasil!") . "\n\n";
    exit(0);
} else {
    echo red("{$fail} gagal") . ", " . green("{$pass} berhasil") . " dari {$total} test.\n\n";
    exit(1);
}
