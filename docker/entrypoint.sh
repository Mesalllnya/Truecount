#!/bin/sh
#
# TrueCount - entrypoint container backend.
#
# Tugas:
#   1. Siapkan folder storage/upload yang writable.
#   2. Tunggu MySQL siap (kalau RUN_MIGRATIONS=true).
#   3. Jalankan migrasi (opsional + seed).
#   4. Serahkan proses ke Apache.

set -eu

cd /var/www/html

log() {
    echo "[truecount] $*"
}

STORAGE_ROOT="${TC_STORAGE_ROOT:-/var/www/html/backend/storage}"

# ── 1. Folder runtime ────────────────────────────────────────────────────────
mkdir -p \
    "$STORAGE_ROOT/logs" \
    "$STORAGE_ROOT/auth_photos" \
    "$STORAGE_ROOT/id_photos" \
    "$STORAGE_ROOT/encrypted" \
    "$STORAGE_ROOT/private" \
    "$STORAGE_ROOT/temp" \
    backend/uploads/candidates

# Volume Docker dibuat sebagai root; Apache berjalan sebagai www-data.
chown -R www-data:www-data "$STORAGE_ROOT" backend/uploads 2>/dev/null || true

# ── 2 & 3. Tunggu database lalu migrasi ─────────────────────────────────────
wait_for_db() {
    attempt=1
    max_attempts="${DB_WAIT_ATTEMPTS:-60}"

    while [ "$attempt" -le "$max_attempts" ]; do
        if php -r '
            $host = getenv("DB_HOST") ?: "db";
            $port = getenv("DB_PORT") ?: "3306";
            $name = getenv("DB_NAME") ?: "truecount_db";
            $user = getenv("DB_USER") ?: "truecount";
            $pass = getenv("DB_PASS");
            $pass = $pass === false ? "" : $pass;

            try {
                new PDO(
                    "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
                    $user,
                    $pass,
                    [PDO::ATTR_TIMEOUT => 3]
                );
                exit(0);
            } catch (Throwable $e) {
                fwrite(STDERR, "[truecount] DB belum siap: " . $e->getMessage() . PHP_EOL);
                exit(1);
            }
        '; then
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    return 1
}

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    log "Menunggu database ${DB_HOST:-db}:${DB_PORT:-3306} ..."
    if ! wait_for_db; then
        log "Database tidak siap setelah ${DB_WAIT_ATTEMPTS:-60} percobaan. Container berhenti."
        exit 1
    fi

    log "Menjalankan migrasi database ..."
    if [ "${RUN_SEED:-false}" = "true" ]; then
        log "Seed aktif: admin/dev default akan dibuat (hanya untuk demo)."
        php database/migrate.php --seed
    else
        php database/migrate.php
    fi
fi

# ── 4. Jalankan Apache ───────────────────────────────────────────────────────
log "Backend siap. Menjalankan Apache di port 80."
exec "$@"
