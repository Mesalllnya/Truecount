<?php
require __DIR__ . '/../backend/config/database.php';
try {
    $db = getDB();
    echo "DB OK\n";
    $tables = $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables (" . count($tables) . "):\n";
    foreach ($tables as $t) echo "  - $t\n";

    // Cek tabel utama ada isinya
    $count = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    echo "\nusers: $count rows\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
