#!/usr/bin/env php
<?php

/**
 * TrueCount - Database Migration Runner
 *
 * Penggunaan:
 *   php database/migrate.php           → jalankan migration yang belum diterapkan
 *   php database/migrate.php --seed    → migration + seeding
 *   php database/migrate.php --fresh   → DROP semua tabel, lalu migration ulang
 *
 * Migration yang sudah pernah berhasil dicatat di tabel `schema_migrations`
 * sehingga aman dijalankan berulang.
 */

require_once __DIR__ . '/../backend/config/database.php';

/**
 * Error MySQL yang berarti objek sudah ada (database lama sebelum ada
 * tabel schema_migrations). Dianggap "sudah diterapkan".
 */
function isAlreadyApplied(PDOException $e): bool
{
    $driverCode = (int) ($e->errorInfo[1] ?? 0);
    return in_array($driverCode, [1050, 1060, 1061, 1091], true);
}

/**
 * Buang statement USE ...; karena database sudah dipilih dari DB_NAME.
 */
function stripUseStatements(string $sql): string
{
    return preg_replace('/^\s*USE\s+`?[^;`]+`?\s*;/mi', '', $sql) ?? $sql;
}

function sqlStatements(string $sql): array
{
    return array_values(array_filter(
        array_map('trim', explode(';', stripUseStatements($sql))),
        static fn(string $s): bool => $s !== ''
    ));
}

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

    // Tabel pencatat migration (dibuat setelah --fresh agar ikut bersih).
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `schema_migrations` (
            `filename`   VARCHAR(191) NOT NULL PRIMARY KEY,
            `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $recordMigration = $pdo->prepare(
        'INSERT IGNORE INTO `schema_migrations` (`filename`) VALUES (?)'
    );

    $applied = array_flip(
        $pdo->query('SELECT `filename` FROM `schema_migrations`')->fetchAll(PDO::FETCH_COLUMN)
    );

    // Jalankan semua file SQL di migrations/ secara berurutan
    $migrationDir = __DIR__ . '/migrations';
    $files = glob($migrationDir . '/*.sql');
    sort($files);

    if (empty($files)) {
        echo "[!] Tidak ada file migration ditemukan.\n";
        exit(1);
    }

    $skipped = 0;

    foreach ($files as $file) {
        $name = basename($file);

        if (isset($applied[$name])) {
            $skipped++;
            continue;
        }

        echo "[→] Menjalankan: $name ... ";

        try {
            foreach (sqlStatements(file_get_contents($file)) as $stmt) {
                $pdo->exec($stmt);
            }
        } catch (PDOException $e) {
            if (!isAlreadyApplied($e)) {
                throw $e;
            }
            // Database lama: objek sudah ada tetapi belum tercatat.
            echo "OK (sudah ada sebelumnya)\n";
            $recordMigration->execute([$name]);
            continue;
        }

        $recordMigration->execute([$name]);
        echo "OK\n";
    }

    if ($skipped > 0) {
        echo "[=] $skipped migration sudah pernah diterapkan, dilewati.\n";
    }

    if ($seed) {
        echo "\n[→] Seeding...\n";
        $seedDir = __DIR__ . '/seeds';
        $seeds   = glob($seedDir . '/*.sql');
        sort($seeds);
        foreach ($seeds as $file) {
            $name = basename($file);
            echo "    $name ... ";
            foreach (sqlStatements(file_get_contents($file)) as $stmt) {
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
