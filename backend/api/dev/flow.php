<?php

/**
 * GET /dev/flow - Data alur aplikasi untuk halaman dev (Admin + Dev only)
 *
 * Headers:
 *   Authorization: Bearer <token admin atau dev>
 *
 * Response 200:
 *   { "flow": [ { id, label, description, role, x, y, edges, technical }, ... ] }
 *
 * `description` = penjelasan ringkas untuk audiens umum.
 * `technical`   = daftar detail teknis (endpoint, algoritma, file) untuk developer.
 */

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireDevOrAdmin();

$flow = [
    [
        'id'          => 'user',
        'label'       => 'Pengguna',
        'description' => 'Semua berawal dari sini. Pengguna membuka TrueCount lewat browser atau aplikasi desktop, lalu diarahkan ke halaman masuk.',
        'role'        => 'sistem',
        'x'           => 0,
        'y'           => 0,
        'edges'       => ['login'],
        'technical'   => [
            'Frontend React 19 (Vite) + aplikasi desktop Tauri 2',
            'Landing page / → redirect ke /masuk bila belum login',
            'Pendaftaran publik ditutup — akun hanya dibuat lewat undangan admin',
        ],
    ],
    [
        'id'          => 'login',
        'label'       => 'Login / Masuk',
        'description' => 'Pengguna masuk lewat salah satu dari 3 metode: Windows Hello (sidik jari/wajah), Dongle USB, atau kata sandi. Kamera wajib aktif sebagai bukti audit setiap percobaan.',
        'role'        => 'sistem',
        'x'           => 2,
        'y'           => 0,
        'edges'       => ['setup'],
        'technical'   => [
            'POST /auth/security-status → cek apakah user sudah punya WebAuthn/Dongle',
            'Windows Hello: WebAuthn navigator.credentials.get() (kredensial ECDSA P-256)',
            'Dongle USB: startUsbAuthenticate → sign challenge → verifyUsbAuthenticate',
            'Kata sandi: verifikasi hash Argon2id — dipakai saat onboarding / 5x gagal',
            'Foto kamera + IP + user_agent dicatat ke tabel auth_attempts',
            'Berhasil → JWT HS256 diterbitkan, disimpan di localStorage (tc_token)',
        ],
    ],
    [
        'id'          => 'setup',
        'label'       => 'Setup Keamanan',
        'description' => 'Sebelum masuk dasbor, pengguna wajib memasang minimal satu metode keamanan tambahan: Windows Hello atau Dongle USB.',
        'role'        => 'sistem',
        'x'           => 4,
        'y'           => 0,
        'edges'       => ['dashboard'],
        'technical'   => [
            'AuthGuard → GET /auth/security-setup → requires_setup = true → /atur-keamanan',
            'Windows Hello: navigator.credentials.create() → POST /auth/webauthn/register/verify',
            'Dongle USB: buat token di flashdisk → startUsbRegister → sign → verifyUsbRegister',
            'Kredensial disimpan di tabel biometric_credentials / usb_tokens',
        ],
    ],
    [
        'id'          => 'dashboard',
        'label'       => 'Dasbor',
        'description' => 'Pusat kendali aplikasi. Admin mengelola undangan, pemilihan, kandidat, dan audit blockchain; pemilih melihat pemilihan yang terdaftar di akunnya.',
        'role'        => 'admin+pemilih',
        'x'           => 6,
        'y'           => 0,
        'edges'       => ['vote'],
        'technical'   => [
            'Admin: kelola /invites, /elections, /elections/candidates, /elections/blockchain-*',
            'Pemilih: GET /elections → daftar pemilihan yang terdaftar di akunnya',
            'Registrasi voter ke pemilihan: /elections/voters/register',
            'Akses dibatasi middleware requireAuth + requireAdmin / requireDevOrAdmin',
        ],
    ],
    [
        'id'          => 'vote',
        'label'       => 'Input Suara',
        'description' => 'Pemilih memilih kandidat; pilihan tersimpan sebagai draft, lalu dikirim dan dienkripsi — tanpa menyimpan siapa yang memilih (privacy by design).',
        'role'        => 'pemilih',
        'x'           => 6,
        'y'           => -2,
        'edges'       => ['result'],
        'technical'   => [
            'POST /elections/:id/vote',
            'Suara dienkripsi AES-256-GCM (BallotService) sebelum disimpan',
            'Tabel ballots tidak punya foreign key ke users → suara anonim',
            'Flag has_voted = true mencegah pemilih memilih dua kali',
        ],
    ],
    [
        'id'          => 'result',
        'label'       => 'Hasil + Blockchain',
        'description' => 'Hasil dihitung dan dipublikasikan. Integritasnya dijaga blockchain: tiap blok menyimpan hash blok sebelumnya sehingga tidak bisa diubah diam-diam.',
        'role'        => 'admin+pemilih',
        'x'           => 6,
        'y'           => -4,
        'edges'       => [],
        'technical'   => [
            'GET /elections/:id/results → tally suara per kandidat',
            'BlockchainService: Merkle root + hash chain SHA-256',
            'POST /elections/:id/blockchain-seal → cetak blok hasil',
            'POST /elections/:id/blockchain-verify → cek integritas rantai',
        ],
    ],
];

jsonResponse([
    'message' => 'Data alur aplikasi berhasil diambil.',
    'flow'    => $flow,
], 200);
