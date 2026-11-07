<?php

/**
 * Helper datetime - semua DATETIME MySQL di modul invites disimpan dalam UTC.
 *
 * Nilai DATETIME MySQL dikonversi ke epoch dengan asumsi UTC, supaya
 * perbandingan dengan PHP time() konsisten di mesin mana pun.
 */

/**
 * Konversi 'Y-m-d H:i:s' (UTC) → ISO 8601 (dengan offset +00:00)
 * supaya frontend JavaScript bisa mem-parsing dan menampilkan waktu lokal.
 */
function toIso8601(?string $mysqlUtc): ?string
{
    if ($mysqlUtc === null || $mysqlUtc === '') {
        return null;
    }
    return date('c', strtotime($mysqlUtc . ' UTC'));
}

/**
 * True jika DATETIME (UTC) sudah lewat dari sekarang.
 */
function isPastUtc(string $mysqlUtc): bool
{
    return strtotime($mysqlUtc . ' UTC') < time();
}
