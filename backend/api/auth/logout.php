<?php

/**
 * POST /auth/logout
 *
 * JWT adalah stateless - invalidasi sisi klien cukup (hapus token).
 * Endpoint ini hanya memberi konfirmasi agar frontend punya pola yang konsisten.
 *
 * Response 200:
 *   { "message": "Logout berhasil." }
 */

require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

jsonResponse(['message' => 'Logout berhasil.']);
