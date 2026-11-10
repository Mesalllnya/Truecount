<?php

require_once __DIR__ . '/../../backend/config/env.php';

$keys = [
    'ENCRYPTION_KEY_B64',
    'CHACHA20_KEY_B64'
];

foreach ($keys as $key) {
    $value = getenv($key);

    $decoded = ($value !== false)
        ? base64_decode($value, true)
        : false;

    $valid = ($decoded !== false && strlen($decoded) === 32);

    echo $key . ': '
        . ($valid ? 'VALID (32 bytes)' : 'INVALID / MISSING')
        . PHP_EOL;
}
