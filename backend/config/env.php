<?php

/**
 * Environment Loader
 * TrueCount - Configuration
 */

$envFile = dirname(__DIR__, 2) . '/.env';

if (!file_exists($envFile)) {
    throw new RuntimeException('.env file tidak ditemukan.');
}

$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

foreach ($lines as $line) {
    $line = trim($line);

    // Lewati komentar
    if ($line === '' || str_starts_with($line, '#')) {
        continue;
    }

    if (!str_contains($line, '=')) {
        continue;
    }

    [$key, $value] = explode('=', $line, 2);

    $key = trim($key);
    $value = trim($value);

    if (
        strlen($value) >= 2 &&
        (($value[0] === '"' && str_ends_with($value, '"')) ||
        ($value[0] === "'" && str_ends_with($value, "'")))
    ) {
        $value = substr($value, 1, -1);
    }

    if (!isset($_ENV[$key]) && getenv($key) === false) {
    $_ENV[$key] = $value;
    putenv("$key=$value");
    }
}
