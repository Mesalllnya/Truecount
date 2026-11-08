<?php
$pdo = new PDO('mysql:host=localhost;dbname=truecount_db', 'root', '');
$sql = file_get_contents('database/migrations/007_fix_biometric_credentials_binary.sql');
$pdo->exec($sql);
echo "Migration 007 applied successfully\n";