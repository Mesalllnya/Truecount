<?php

declare(strict_types=1);

/**
 * Helper datetime - semua DATETIME MySQL di modul invites disimpan dalam UTC.
 *
 * Nilai DATETIME MySQL dikonversi dengan asumsi UTC, supaya perbandingan
 * dan formatting konsisten di mesin mana pun tanpa tergantung timezone server.
 */

/** Format DATETIME MySQL. */
const FORMAT_MYSQL = 'Y-m-d H:i:s';

/** Zona waktu acuan untuk semua waktu di sistem. */
const TZ_UTC = 'UTC';

/**
 * Konversi 'Y-m-d H:i:s' (UTC) → ISO 8601 dengan offset +00:00
 * (contoh: 2026-11-08T10:00:00+00:00) supaya frontend JavaScript
 * bisa mem-parsing dan menampilkan waktu lokal.
 *
 * Mengembalikan null jika input null, kosong, atau bukan format DATETIME yang valid.
 */
function toIso8601(?string $mysqlUtc): ?string
{
    if ($mysqlUtc === null || $mysqlUtc === '') {
        return null;
    }

    $dt = DateTimeImmutable::createFromFormat(FORMAT_MYSQL, $mysqlUtc, new DateTimeZone(TZ_UTC));
    if ($dt === false) {
        return null;
    }

    return $dt->format(DateTimeInterface::ATOM); // selalu +00:00 karena objek bawa TZ UTC
}

/**
 * True jika DATETIME (UTC) sudah lewat dari waktu sekarang (UTC).
 *
 * Mengembalikan false jika input bukan format DATETIME yang valid.
 */
function isPastUtc(string $mysqlUtc): bool
{
    $dt = DateTimeImmutable::createFromFormat(FORMAT_MYSQL, $mysqlUtc, new DateTimeZone(TZ_UTC));
    if ($dt === false) {
        return false;
    }

    $now = new DateTimeImmutable('now', new DateTimeZone(TZ_UTC));

    return $dt < $now;
}

/**
 * Waktu sekarang dalam UTC sebagai string DATETIME MySQL ('Y-m-d H:i:s').
 * Berguna saat perlu menyisipkan timestamp UTC dari sisi PHP (bukan SQL).
 */
function nowUtc(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone(TZ_UTC)))->format(FORMAT_MYSQL);
}
