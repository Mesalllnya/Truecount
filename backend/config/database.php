<?php

/**
 * Database Configuration
 * TrueCount - Secure E-Voting System
 *
 * Copy .env.example ke .env dan sesuaikan nilai-nilainya.
 * Pastikan file .env tidak di-commit ke repository.
 */

// Load .env jika ada
require_once __DIR__ . '/env.php';

define('DB_HOST',     $_ENV['DB_HOST']     ?? 'localhost');
define('DB_PORT',     $_ENV['DB_PORT']     ?? '3306');
define('DB_NAME',     $_ENV['DB_NAME']     ?? 'truecount_db');
define('DB_USER',     $_ENV['DB_USER']     ?? 'root');
define('DB_PASS',     $_ENV['DB_PASS']     ?? '');
define('DB_CHARSET',  'utf8mb4');

/**
 * Mengembalikan koneksi PDO ke database.
 * Lempar PDOException jika koneksi gagal.
 */
function getDB(): PDO
{
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);

    return $pdo;
}
