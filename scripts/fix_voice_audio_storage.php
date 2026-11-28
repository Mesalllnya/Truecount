<?php
/**
 * Perbaikan penyimpanan voice message lama di storage/private/encrypted-files.
 *
 * Dua kasus:
 *   A. algorithm = audio_obfuscated dengan prefix nonce 32 byte di awal file
 *      (format lama) → prefix dibuang agar signature audio (RIFF/EBML/OggS/
 *      ftyp) kembali ke offset 0 dan file bisa dibuka media player.
 *      file_hash di database ikut diperbarui.
 *
 *   B. algorithm = chacha20 (format paling lama, ciphertext biner penuh)
 *      → didekripsi lalu disimpan ulang dengan AudioObfuscationService
 *      (header utuh + samples ter-XOR), algorithm diganti audio_obfuscated.
 *
 * Setelah dijalankan, SEMUA file voice message di volume berbentuk container
 * audio valid yang bisa dibuka player (berisi noise), bukan biner mentah.
 *
 * Idempoten: file yang sudah benar dilewati.
 *
 * Penggunaan (dry-run):
 *   php scripts/fix_voice_audio_storage.php
 * Eksekusi:
 *   php scripts/fix_voice_audio_storage.php --apply
 *
 * Di Docker:
 *   docker compose --env-file .env.docker exec backend \
 *     php scripts/fix_voice_audio_storage.php --apply
 */

require __DIR__ . '/../backend/config/env.php';
require __DIR__ . '/../backend/helpers/storage.php';
require __DIR__ . '/../backend/config/database.php';
require __DIR__ . '/../backend/services/crypto/ChaCha20Poly1305Service.php';
require __DIR__ . '/../backend/services/crypto/AudioObfuscationService.php';

$apply = in_array('--apply', array_slice($argv, 1), true);
$db    = getDB();
$dir   = storagePath('private', 'encrypted-files');

$mimeToExt = [
    'audio/webm'  => 'webm',
    'video/webm'  => 'webm',
    'audio/ogg'   => 'ogg',
    'audio/mpeg'  => 'mp3',
    'audio/wav'   => 'wav',
    'audio/x-wav' => 'wav',
    'audio/mp4'   => 'm4a',
    'video/mp4'   => 'm4a',
    'audio/aac'   => 'aac',
    'audio/flac'  => 'flac',
];

// Hanya file yang dipakai voice_messages; foto kandidat dkk tidak disentuh.
$rows = $db->query(
    "SELECT ef.id, ef.user_id, ef.stored_path, ef.algorithm, ef.nonce,
            ef.auth_tag, ef.file_hash, ef.file_size, ef.mime_type
       FROM encrypted_files ef
       INNER JOIN voice_messages vm ON vm.file_id = ef.id
      ORDER BY ef.id"
)->fetchAll(PDO::FETCH_ASSOC);

if (!$rows) {
    echo "Tidak ada file voice message di database.\n";
    exit(0);
}

$fixed   = 0;
$skip    = 0;
$fail    = 0;

foreach ($rows as $row) {
    $id       = (int) $row['id'];
    $name     = $row['stored_path'];
    $path     = $dir . DIRECTORY_SEPARATOR . $name;

    if (!is_file($path)) {
        echo "[FAIL] #$id - file tidak ada: $name\n";
        $fail++;
        continue;
    }

    $raw = file_get_contents($path);

    if ($raw === false) {
        echo "[FAIL] #$id - gagal membaca $name\n";
        $fail++;
        continue;
    }

    // ── Kasus A: audio_obfuscated dengan prefix nonce ──────────────
    if ($row['algorithm'] === 'audio_obfuscated') {
        $nonce = (string) $row['nonce'];

        if (!preg_match('/^[a-f0-9]{32}$/', $nonce)) {
            echo "[FAIL] #$id - nonce di database tidak valid: $nonce\n";
            $fail++;
            continue;
        }

        if (substr($raw, 0, 32) !== $nonce) {
            echo "[SKIP] #$id $name - sudah tanpa prefix nonce\n";
            $skip++;
            continue;
        }

        $stripped = substr($raw, 32);

        if ($stripped === '') {
            echo "[FAIL] #$id - file kosong setelah prefix dibuang\n";
            $fail++;
            continue;
        }

        $newHash = hash('sha256', $stripped);

        if (!$apply) {
            echo "[DRY]  #$id $name - buang prefix32 byte\n";
            $fixed++;
            continue;
        }

        if (file_put_contents($path, $stripped, LOCK_EX) === false) {
            echo "[FAIL] #$id - gagal menulis ulang $name\n";
            $fail++;
            continue;
        }

        @chmod($path, 0600);

        $upd = $db->prepare(
            'UPDATE encrypted_files SET file_hash = ? WHERE id = ? AND algorithm = ?'
        );
        $upd->execute([$newHash, $id, 'audio_obfuscated']);

        echo "[OK]   #$id $name - prefix nonce dibuang, file_hash diperbarui\n";
        $fixed++;
        continue;
    }

    // ── Kasus B: chacha20 (ciphertext biner penuh) ─────────────────
    if ($row['algorithm'] === 'chacha20') {
        $mime = (string) $row['mime_type'];

        if (!isset($mimeToExt[$mime])) {
            echo "[SKIP] #$id $name - mime bukan audio ($mime)\n";
            $skip++;
            continue;
        }

        $aad = 'truecount:file:v1:user:' . (int) $row['user_id'];

        try {
            $plaintext = ChaCha20Poly1305Service::decrypt(
                base64_encode($raw),
                $row['nonce'],
                $row['auth_tag'],
                $aad
            );
        } catch (Throwable $e) {
            echo "[FAIL] #$id $name - dekripsi gagal: {$e->getMessage()}\n";
            $fail++;
            continue;
        }

        if ($plaintext === '' || strlen($plaintext) !== (int) $row['file_size']) {
            echo "[FAIL] #$id $name - ukuran plaintext tidak sesuai metadata\n";
            $fail++;
            continue;
        }

        try {
            $obf   = AudioObfuscationService::obfuscate($plaintext, $mime);
            $bytes = $obf['data'];
        } catch (Throwable $e) {
            echo "[FAIL] #$id $name - obfuscate gagal: {$e->getMessage()}\n";
            $fail++;
            continue;
        }

        $newExt  = $mimeToExt[$mime];
        $newName = preg_replace('/\.[^.]+$/', '.' . $newExt, $name);
        $newPath = $dir . DIRECTORY_SEPARATOR . $newName;
        $newHash = hash('sha256', $bytes);

        if (!$apply) {
            echo "[DRY]  #$id $name → $newName (chacha20 → audio_obfuscated)\n";
            $fixed++;
            continue;
        }

        if ($newPath !== $path && is_file($newPath)) {
            echo "[FAIL] #$id - tujuan sudah ada: $newName\n";
            $fail++;
            continue;
        }

        if (file_put_contents($newPath, $bytes, LOCK_EX) === false) {
            echo "[FAIL] #$id - gagal menulis $newName\n";
            $fail++;
            continue;
        }

        // Apache membaca sebagai www-data; paksa ownership & mode yang aman.
        @chown($newPath, 'www-data');
        @chgrp($newPath, 'www-data');
        @chmod($newPath, 0600);

        $upd = $db->prepare(
            "UPDATE encrypted_files
                SET stored_path = ?,
                    algorithm = 'audio_obfuscated',
                    nonce = ?,
                    auth_tag = 'obfuscated',
                    file_hash = ?
              WHERE id = ?"
        );
        $upd->execute([$newName, $obf['nonce'], $newHash, $id]);

        if ($newPath !== $path) {
            @unlink($path);
        }

        echo "[OK]   #$id $name → $newName (chacha20 → audio_obfuscated)\n";
        $fixed++;
        continue;
    }

    echo "[SKIP] #$id $name - algorithm tak dikenal: {$row['algorithm']}\n";
    $skip++;
}

echo "\nRingkasan: $fixed diproses, $skip sudah benar/skipped, $fail gagal.\n";

if (!$apply && $fixed > 0) {
    echo "Dry-run. Jalankan dengan --apply untuk eksekusi.\n";
}

exit($fail > 0 ? 1 : 0);
