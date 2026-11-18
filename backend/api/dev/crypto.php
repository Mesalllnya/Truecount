<?php

/**
 * GET /dev/crypto - Data algoritma kriptografi untuk halaman dev (Admin + Dev only)
 *
 * Headers:
 *   Authorization: Bearer <token admin atau dev>
 *
 * Response 200:
 *   { "algorithms": [ { id, name, purpose, file, key_size, mode, description }, ... ] }
 */

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

requireDevOrAdmin();

$algorithms = [
    [
        'id'       => 'argon2id',
        'name'     => 'Argon2id',
        'purpose'  => 'Hash password',
        'file'     => 'backend/helpers/ + password_hash()',
        'key_size' => '65536 KB memory, 4 iterations, 2 threads',
        'mode'     => 'Password hashing',
        'description' => 'Password tidak tersimpan sebagai plain text. Setiap password di-hash dengan Argon2id sebelum disimpan ke database.',
    ],
    [
        'id'       => 'jwt-hs256',
        'name'     => 'JWT HS256',
        'purpose'  => 'Token otentikasi',
        'file'     => 'backend/helpers/jwt.php',
        'key_size' => 'Secret key (min. 32 karakter)',
        'mode'     => 'Symmetric signing',
        'description' => 'Token JWT digunakan untuk mengautentikasikan request ke endpoint yang dilindungi. Implementasi custom tanpa library eksternal.',
    ],
    [
        'id'       => 'aes-256-gcm',
        'name'     => 'AES-256-GCM',
        'purpose'  => 'Enkripsi suara + file',
        'file'     => 'backend/services/crypto/AESGCMService.php',
        'key_size' => '256-bit',
        'mode'     => 'Authenticated encryption',
        'description' => 'Suara pemilih dan file dienkripsi dengan AES-256-GCM untuk kerahasiaan dan integritas.',
    ],
    [
        'id'       => 'chacha20-poly1305',
        'name'     => 'ChaCha20-Poly1305',
        'purpose'  => 'Enkripsi pesan/file',
        'file'     => 'backend/services/crypto/ChaCha20Poly1305Service.php',
        'key_size' => '256-bit',
        'mode'     => 'Authenticated encryption',
        'description' => 'Alternatif enkripsi untuk pesan dan file upload, menggunakan ChaCha20-Poly1305.',
    ],
    [
        'id'       => 'vigenere',
        'name'     => 'Vigenere',
        'purpose'  => 'Enkripsi pesan klasik',
        'file'     => 'backend/services/crypto/VigenereCipherService.php',
        'key_size' => 'Bervariasi (kunci teks)',
        'mode'     => 'Classical cipher',
        'description' => 'Enkripsi klasik Vigenere untuk modul steganografi dan pesan terenkripsi.',
    ],
    [
        'id'       => 'steganografi-lsb',
        'name'     => 'Steganografi (LSB)',
        'purpose'  => 'Sembunyikan pesan dalam gambar',
        'file'     => 'backend/services/crypto/SteganographyService.php',
        'key_size' => 'N/A',
        'mode'     => 'Least Significant Bit',
        'description' => 'Pesan disembunyikan dalam bit terendah piksel gambar carrier tanpa mengubah tampilan visual yang signifikan.',
    ],
    [
        'id'       => 'blockchain',
        'name'     => 'Blockchain sederhana',
        'purpose'  => 'Integritas hasil pemilihan',
        'file'     => 'backend/services/crypto/BlockchainService.php',
        'key_size' => 'SHA-256 hash',
        'mode'     => 'Merkle tree + hash chain',
        'description' => 'Hasil pemilihan dicatat dalam rantai blockchain. Setiap blok mengandung hash blok sebelumnya untuk mencegah manipulasi.',
    ],
    [
        'id'       => 'ecdsa-p256',
        'name'     => 'ECDSA P-256',
        'purpose'  => 'USB Token / WebAuthn signature',
        'file'     => 'backend/services/crypto/ + webauthn.php',
        'key_size' => '256-bit (secp256r1)',
        'mode'     => 'Digital signature',
        'description' => 'Digunakan untuk USB Token dan Windows Hello (WebAuthn) challenge-response authentication.',
    ],
];

jsonResponse([
    'message'     => 'Data algoritma kriptografi berhasil diambil.',
    'algorithms'  => $algorithms,
], 200);
