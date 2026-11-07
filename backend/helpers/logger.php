<?php

/**
 * TrueCount — File Logger
 *
 * Semua log ditulis ke: backend/storage/logs/
 *   - app.log        → request access log + error yang ditangkap handler
 *   - php_errors.log → warning/error PHP native (via ini error_log)
 *
 * Bekerja di semua mode:
 *   - Web dev (php -S)
 *   - Desktop app (backend di-spawn oleh Tauri, folder log ikut terbundle)
 *   - Production (Nginx/Apache + PHP-FPM)
 */

/**
 * Pastikan folder log ada, kembalikan path-nya.
 */
function tc_log_dir(): string
{
    $dir = __DIR__ . '/../storage/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

/**
 * Tulis satu baris log ke app.log (level: info|warn|error).
 */
function tc_log(string $level, string $message): void
{
    $file  = tc_log_dir() . '/app.log';
    $line  = sprintf("[%s] [%s] %s\n", date('Y-m-d H:i:s'), strtoupper($level), $message);
    @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
}

function tc_log_info(string $message): void
{
    tc_log('info', $message);
}

function tc_log_warn(string $message): void
{
    tc_log('warn', $message);
}

function tc_log_error(string $message): void
{
    tc_log('error', $message);
}
