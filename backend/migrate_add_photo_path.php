<?php
require_once 'config/database.php';
$db = getDB();
try {
    $db->exec('ALTER TABLE auth_attempts ADD COLUMN photo_path VARCHAR(500) NULL AFTER user_agent');
    echo 'Column photo_path added successfully\n';
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column') !== false) {
        echo 'Column photo_path already exists\n';
    } else {
        echo 'Error: ' . $e->getMessage() . '\n';
    }
}