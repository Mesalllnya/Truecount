<?php

/**
 * GET /dev/flow - Data alur aplikasi untuk halaman dev (Admin + Dev only)
 *
 * Headers:
 *   Authorization: Bearer <token admin atau dev>
 *
 * Response 200:
 *   { "flow": [ { id, label, description, role, x, y, edges: [...] }, ... ] }
 */

require_once __DIR__ . '/../../../middleware/auth.php';
require_once __DIR__ . '/../../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireDevOrAdmin();

$flow = [
    [
        'id'          => 'user',
        'label'       => 'Pengguna',
        'description' => 'Pengguna membuka aplikasi TrueCount',
        'role'        => 'sistem',
        'x'           => 0,
        'y'           => 0,
        'edges'       => ['login'],
    ],
    [
        'id'          => 'login',
        'label'       => 'Login / Masuk',
        'description' => '3 metode auth: Windows Hello, Dongle USB, Kata Sandi',
        'role'        => 'sistem',
        'x'           => 2,
        'y'           => 0,
        'edges'       => ['setup'],
    ],
    [
        'id'          => 'setup',
        'label'       => 'Setup Keamanan',
        'description' => 'Wajib setup Windows Hello atau Dongle sebelum akses dasbor',
        'role'        => 'sistem',
        'x'           => 4,
        'y'           => 0,
        'edges'       => ['dashboard'],
    ],
    [
        'id'          => 'dashboard',
        'label'       => 'Dasbor',
        'description' => 'Admin: undangan, pemilihan, blockchain audit | Pemilih: daftar pemilihan aktif',
        'role'        => 'admin+pemilih',
        'x'           => 6,
        'y'           => 0,
        'edges'       => ['vote', 'result'],
    ],
    [
        'id'          => 'vote',
        'label'       => 'Input Suara',
        'description' => 'Pemilih memilih kandidat, suara dienkripsi AES-256-GCM',
        'role'        => 'pemilih',
        'x'           => 6,
        'y'           => -2,
        'edges'       => ['result'],
    ],
    [
        'id'          => 'result',
        'label'       => 'Hasil + Blockchain',
        'description' => 'Tally suara + verifikasi integritas blockchain',
        'role'        => 'admin+pemilih',
        'x'           => 6,
        'y'           => -4,
        'edges'       => [],
    ],
];

jsonResponse([
    'message' => 'Data alur aplikasi berhasil diambil.',
    'flow'    => $flow,
], 200);
