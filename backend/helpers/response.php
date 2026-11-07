<?php

/**
 * Global CORS + JSON headers.
 * Di-include sekali di index.php / setiap entry-point API.
 */

require_once __DIR__ . '/../config/app.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: ' . FRONTEND_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Pre-flight: browser mengirim OPTIONS sebelum request utama
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * Mengembalikan response JSON dan menghentikan eksekusi.
 *
 * @param mixed $data    Data yang akan di-encode.
 * @param int   $status  HTTP status code.
 */
function jsonResponse(mixed $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
