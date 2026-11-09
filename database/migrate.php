#!/usr/bin/env php
<?php

/**
 * TrueCount - Database Migration Runner
 *
 * Penggunaan:
 *   php database/migrate.php           → jalankan semua migration
 *   php database/migrate.php --seed    → migration + seeding
 *   php database/migrate.php --fresh   → DROP semua tabel, lalu migration ulang
 */

require_once __DIR__ . '/../backend/config/database.php';

$args  = array_slice($argv, 1);
$seed  = in_array('--seed',  $args, true);
$fresh = in_array('--fresh', $args, true);

try {
    // Koneksi pertama TANPA dbname - database mungkin belum ada
    $dsnNoDB = sprintf('mysql:host=%s;port=%s;charset=%s', DB_HOST, DB_PORT, DB_CHARSET);
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
    ];
    $pdo = new PDO($dsnNoDB, DB_USER, DB_PASS, $options);

    // Buat database jika belum ada, lalu pilih
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `" . DB_NAME . "`");

    echo "[TrueCount] Terhubung ke database: " . DB_NAME . "\n\n";

    if ($fresh) {
        echo "[⚠]  --fresh: menghapus semua tabel...\n";
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($tables as $table) {
            $pdo->exec("DROP TABLE IF EXISTS `$table`");
            echo "     Dropped: $table\n";
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        echo "\n";
    }

    // Jalankan semua file SQL di migrations/ secara berurutan
    $migrationDir = __DIR__ . '/migrations';
    $files = glob($migrationDir . '/*.sql');
    sort($files);

    if (empty($files)) {
        echo "[!] Tidak ada file migration ditemukan.\n";
        exit(1);
    }

    foreach ($files as $file) {
        $name = basename($file);
        echo "[→] Menjalankan: $name ... ";
        $sql = file_get_contents($file);
        // Pisahkan statement berdasarkan ; agar bisa dijalankan satu per satu
        $statements = array_filter(
            array_map('trim', explode(';', $sql)),
            fn($s) => $s !== ''
        );
        foreach ($statements as $stmt) {
            $pdo->exec($stmt);
        }
        echo "OK\n";
    }

    if ($seed) {
        echo "\n[→] Seeding...\n";
        $seedDir = __DIR__ . '/seeds';
        $seeds   = glob($seedDir . '/*.sql');
        sort($seeds);
        foreach ($seeds as $file) {
            $name = basename($file);
            echo "    $name ... ";
            $sql = file_get_contents($file);
            $statements = array_filter(
                array_map('trim', explode(';', $sql)),
                fn($s) => $s !== ''
            );
            foreach ($statements as $stmt) {
                $pdo->exec($stmt);
            }
            echo "OK\n";
        }
    }

    echo "\n[✓] Migration selesai.\n";
} catch (PDOException $e) {
    echo "\n[✗] Error: " . $e->getMessage() . "\n";
    exit(1);
}
