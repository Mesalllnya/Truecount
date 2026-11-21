<?php

/**
 * Environment Loader
 * TrueCount - Configuration
 */

// Path .env bisa di-override oleh launcher desktop (mode Server/Standalone),
// supaya backend yang berjalan dari folder read-only (Program Files) tetap
// membaca konfigurasi dari folder aplikasi yang writable.
$envFile = getenv('TC_ENV_PATH') ?: dirname(__DIR__, 2) . '/.env';

// Variabel dari environment proses (Docker / Kubernetes / systemd) dipakai
// lebih dulu, sehingga container tidak wajib menyertakan file .env.
// File .env tetap didukung untuk mode lokal/desktop dan tidak menimpa
// variabel yang sudah diberikan oleh proses induk.
foreach (getenv() as $processKey => $processValue) {
    if (!isset($_ENV[$processKey])) {
        $_ENV[$processKey] = $processValue;
    }
}

if (!file_exists($envFile)) {
    // Mode container: konfigurasi boleh sepenuhnya berasal dari environment.
    if (getenv('DB_HOST') === false) {
        throw new RuntimeException(
            '.env file tidak ditemukan. Dicek: ' . $envFile .
            '. Di container, set variabel environment DB_HOST (dan lainnya) atau mount file .env.'
        );
    }
    return;
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
