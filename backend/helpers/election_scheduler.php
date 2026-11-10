<?php

declare(strict_types=1);

/**
 * Helper untuk menyinkronkan status pemilihan secara otomatis berdasarkan waktu (UTC).
 *
 * Aturan:
 * 1. Jika status = 'draft' atau 'active' dan waktu sekarang >= end_time -> otomatis ubah ke 'closed'.
 * 2. Jika status = 'draft' dan waktu sekarang >= start_time DAN waktu sekarang < end_time -> otomatis ubah ke 'active'.
 *
 * Fungsi ini dipanggil sebelum memproses list, detail, atau voting.
 */
function syncElectionStatuses(PDO $db): void
{
    // 1. Tutup pemilihan yang sudah lewat end_time
    $db->exec(
        "UPDATE elections
            SET status = 'closed', updated_at = UTC_TIMESTAMP()
          WHERE status IN ('draft', 'active')
            AND end_time <= UTC_TIMESTAMP()"
    );

    // 2. Aktifkan pemilihan yang sudah masuk rentang waktu [start_time, end_time)
    $db->exec(
        "UPDATE elections
            SET status = 'active', updated_at = UTC_TIMESTAMP()
          WHERE status = 'draft'
            AND start_time <= UTC_TIMESTAMP()
            AND end_time > UTC_TIMESTAMP()"
    );
}

