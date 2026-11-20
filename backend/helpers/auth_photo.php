<?php

/**
 * Helper enkripsi dan dekripsi foto log keamanan (auth_attempts.photo_path).
 *
 * Desain:
 *  - Foto dienkripsi sebelum disimpan, tetapi **path penyimpanan tetap sama**
 *    (`storage/auth_photos/<file>.jpg`) sehingga kolom `photo_path` di database
 *    tidak berubah dan tidak merusak referensi data yang sudah ada.
 *  - Isi file yang disimpan adalah ciphertext (bukan gambar asli), sehingga
 *    foto tidak bisa dibaca langsung dari storage tanpa dekripsi.
 *  - Nonce + auth tag disimpan di file sampingan `<file>.jpg.meta.json` yang
 *    berada di folder yang sama.
 *  - Algoritma: AES-256-GCM melalui AESGCMService (sama dengan implementasi
 *    Erlan). Kunci diambil dari env `ENCRYPTION_KEY_B64`.
 *
 * Foto lama (legacy) yang belum punya file sampingan tetap disajikan utuh
 * (tanpa enkripsi) agar tidak terjadi regresi pada data yang sudah ada.
 */

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/../services/crypto/AESGCMService.php';

const AUTH_PHOTO_ALGORITHM = 'AES-256-GCM';
const AUTH_PHOTO_META_SUFFIX = '.meta.json';

/**
 * Enkripsi data gambar dan simpan ke storage auth_photos.
 *
 * @param string $imageData Data gambar asli (binary).
 * @param string $uploadDir Folder tujuan (tanpa slash di akhir).
 * @return array ['photoPath' => 'storage/auth_photos/file.jpg', 'nonce' => '...', 'tag' => '...']
 * @throws Throwable jika enkripsi atau penyimpanan gagal.
 */
function encryptAuthPhoto(string $imageData, string $uploadDir): array
{
    ensureStorageDir(rtrim($uploadDir, '/'));

    $filename = 'auth_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.jpg';
    $filepath = rtrim($uploadDir, '/') . DIRECTORY_SEPARATOR . $filename;

    $encrypted = AESGCMService::encrypt($imageData);

    $cipherRaw = base64_decode($encrypted['ciphertext'], true);
    if ($cipherRaw === false) {
        throw new RuntimeException('Format ciphertext tidak valid.');
    }

    // Simpan ciphertext ke file dengan path yang sama (photo_path tidak berubah).
    if (file_put_contents($filepath, $cipherRaw, LOCK_EX) === false) {
        throw new RuntimeException('Gagal menyimpan foto terenkripsi.');
    }
    @chmod($filepath, 0600);

    // Simpan nonce + tag ke file sampingan agar foto tidak bisa dibaca tanpa kunci.
    $meta = [
        'algorithm' => AUTH_PHOTO_ALGORITHM,
        'nonce'     => $encrypted['nonce'],
        'tag'       => $encrypted['tag'],
    ];
    $metaPath = $filepath . AUTH_PHOTO_META_SUFFIX;
    if (file_put_contents($metaPath, json_encode($meta), LOCK_EX) === false) {
        @unlink($filepath);
        throw new RuntimeException('Gagal menyimpan metadata enkripsi.');
    }
    @chmod($metaPath, 0600);

    return [
        'photoPath' => 'storage/auth_photos/' . $filename,
        'nonce'     => $encrypted['nonce'],
        'tag'       => $encrypted['tag'],
    ];
}

/**
 * Dekripsi foto dan kembalikan data gambar asli (binary).
 *
 * Foto lama (legacy) tanpa file sampingan dikembalikan utuh (backward compatible).
 *
 * @param string $filepath Path absolut ke file foto (.jpg).
 * @return string Data gambar asli (binary).
 * @throws Throwable jika file/meta tidak valid atau dekripsi gagal.
 */
function decryptAuthPhoto(string $filepath): string
{
    if (!is_file($filepath) || !is_readable($filepath)) {
        throw new RuntimeException('Foto tidak ditemukan di penyimpanan.');
    }

    $metaPath = $filepath . AUTH_PHOTO_META_SUFFIX;

    // Foto lama (belum dienkripsi): tidak ada metadata, sajikan isi file as-is.
    if (!is_file($metaPath) || !is_readable($metaPath)) {
        $plaintext = file_get_contents($filepath);
        if ($plaintext === false) {
            throw new RuntimeException('Gagal membaca foto.');
        }
        return $plaintext;
    }

    $meta = json_decode(file_get_contents($metaPath), true);
    if (!is_array($meta) || !isset($meta['nonce'], $meta['tag'])) {
        throw new RuntimeException('Metadata enkripsi tidak valid.');
    }

    $cipherRaw = file_get_contents($filepath);
    if ($cipherRaw === false) {
        throw new RuntimeException('Gagal membaca foto terenkripsi.');
    }

    return AESGCMService::decrypt(
        base64_encode($cipherRaw),
        (string)$meta['nonce'],
        (string)$meta['tag'],
        ''
    );
}

/**
 * Path absolut folder auth_photos.
 */
function authPhotoDir(): string
{
    return storagePath('auth_photos');
}
