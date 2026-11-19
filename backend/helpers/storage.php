<?php

/**
 * Helper path penyimpanan runtime.
 *
 * Semua file upload (foto auth, file terenkripsi, log) disatukan di satu root:
 *   default : <backend>/storage
 *   override: env TC_STORAGE_ROOT (di-set oleh launcher Tauri)
 *
 * Kenapa perlu helper:
 *   Sebelumnya ada dua root berbeda:
 *     - foto auth     : <project-root>/storage/auth_photos
 *     - file terenkripsi: <backend>/storage/private/...
 *   Saat backend dipindah ke %APPDATA%\com.truecount.app\backend,
 *   <project-root> ikut berubah sehingga foto lama tidak ditemukan.
 */

function storageRoot(): string
{
    $override = getenv('TC_STORAGE_ROOT');
    if (is_string($override) && trim($override) !== '') {
        return rtrim($override, "/\\");
    }

    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
}

/**
 * Gabungkan path di dalam storage root.
 * Contoh: storagePath('auth_photos') → <backend>/storage/auth_photos
 */
function storagePath(string ...$parts): string
{
    return storageRoot() . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $parts);
}

/**
 * Buat folder kalau belum ada (aman dipanggil berulang).
 */
function ensureStorageDir(string $path): void
{
    if (!is_dir($path)) {
        mkdir($path, 0755, true);
    }
}
