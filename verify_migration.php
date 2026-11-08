<?php
$pdo = new PDO('mysql:host=localhost;dbname=truecount_db', 'root', '');
$stmt = $pdo->query('SHOW COLUMNS FROM biometric_credentials WHERE Field IN ("credential_id", "public_key")');
while ($row = $stmt->fetch()) {
    echo $row['Field'] . ' => ' . $row['Type'] . PHP_EOL;
}