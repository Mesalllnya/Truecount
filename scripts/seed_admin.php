<?php

/**
 * TrueCount - Seed Admin Only
 *
 * Menjalankan hanya database/seeds/001_admin.sql.
 * Dipakai oleh scripts/deploy-server.ps1 (-SeedAdmin) supaya tidak
 * menjalankan seluruh seed dummy (pemilih1, pemilih2, dev).
 *
 * Penggunaan:
 *   php scripts/seed_admin.php
 */

require_once __DIR__ . '/../backend/config/database.php';

$seedFile = __DIR__ . '/../database/seeds/001_admin.sql';

if (!is_file($seedFile)) {
    fwrite(STDERR, "ERROR: file seed tidak ditemukan: {$seedFile}\n");
    exit(1);
}

try {
    $db = getDB();
    $sql = file_get_contents($seedFile);

    // Buang statement USE ...; karena database sudah dipilih oleh getDB().
    $sql = preg_replace('/^\s*USE\s+`?[^;]+`?\s*;/mi', '', $sql);

    $statements = array_filter(
        array_map('trim', explode(';', $sql)),
        static fn(string $s): bool => $s !== ''
    );

    foreach ($statements as $statement) {
        $db->exec($statement);
    }

    echo "[OK] Seed admin selesai.\n";
} catch (Throwable $e) {
    fwrite(STDERR, '[ERROR] Seed admin gagal: ' . $e->getMessage() . "\n");
    exit(1);
}
