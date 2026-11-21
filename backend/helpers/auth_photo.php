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
 *  - Nonce (12 byte) + auth tag (16 byte) disisipkan di **awal file yang sama**,
 *    format: [nonce][tag][ciphertext]. Tidak ada file sampingan (.json), tidak
 *    ada perubahan kolom database.
 *  - Algoritma: AES-256-GCM via AESGCMService (sama dengan implementasi Erlan).
 *    Kunci diambil dari env `ENCRYPTION_KEY_B64`.
 *
 * Foto lama (legacy) yang masih berupa JPEG asli (awalan FF D8 FF) tetap
 * disajikan utuh tanpa dekripsi, untuk backward compatibility.
 */

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/../services/crypto/AESGCMService.php';

const AUTH_PHOTO_ALGORITHM = 'AES-256-GCM';
const AUTH_PHOTO_NONCE_LEN = 12;
const AUTH_PHOTO_TAG_LEN = 16;
const AUTH_PHOTO_HEADER_LEN = AUTH_PHOTO_NONCE_LEN + AUTH_PHOTO_TAG_LEN; // 28

/**
 * Enkripsi data gambar dan simpan ke storage auth_photos.
 *
 * Format file yang tersimpan: [nonce 12B][auth_tag 16B][ciphertext]
 *
 * @param string $imageData Data gambar asli (binary).
 * @param string $uploadDir Folder tujuan (tanpa slash di akhir).
 * @return string 'storage/auth_photos/file.jpg'
 * @throws Throwable jika enkripsi atau penyimpanan gagal.
 */
function encryptAuthPhoto(string $imageData, string $uploadDir): string
{
    ensureStorageDir(rtrim($uploadDir, '/'));

    $filename = 'auth_' . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.jpg';
    $filepath = rtrim($uploadDir, '/') . DIRECTORY_SEPARATOR . $filename;

    $encrypted = AESGCMService::encrypt($imageData);

    $nonceRaw = base64_decode($encrypted['nonce'], true);
    $tagRaw   = base64_decode($encrypted['tag'], true);
    $cipherRaw = base64_decode($encrypted['ciphertext'], true);

    if ($nonceRaw === false || $tagRaw === false || $cipherRaw === false) {
        throw new RuntimeException('Format ciphertext tidak valid.');
    }

    if (strlen($nonceRaw) !== AUTH_PHOTO_NONCE_LEN || strlen($tagRaw) !== AUTH_PHOTO_TAG_LEN) {
        throw new RuntimeException('Panjang nonce/tag tidak valid.');
    }

    // Satu file: nonce + tag + ciphertext (tanpa file sampingan).
    $fileContent = $nonceRaw . $tagRaw . $cipherRaw;
    if (file_put_contents($filepath, $fileContent, LOCK_EX) === false) {
        throw new RuntimeException('Gagal menyimpan foto terenkripsi.');
    }
    @chmod($filepath, 0600);

    return 'storage/auth_photos/' . $filename;
}

/**
 * Dekripsi foto dan kembalikan data gambar asli (binary).
 *
 * Foto lama (legacy, awalan JPEG FF D8 FF) dikembalikan utuh tanpa dekripsi.
 *
 * @param string $filepath Path absolut ke file foto (.jpg).
 * @return string Data gambar asli (binary).
 * @throws Throwable jika file tidak valid atau dekripsi gagal.
 */
function decryptAuthPhoto(string $filepath): string
{
    if (!is_file($filepath) || !is_readable($filepath)) {
        throw new RuntimeException('Foto tidak ditemukan di penyimpanan.');
    }

    $content = file_get_contents($filepath);
    if ($content === false) {
        throw new RuntimeException('Gagal membaca foto.');
    }

    // Foto lama (belum dienkripsi): awalan JPEG FF D8 FF → sajikan utuh.
    if (strlen($content) >= 3 && substr($content, 0, 3) === "\xff\xd8\xff") {
        return $content;
    }

    // Format enkripsi: [nonce 12B][tag 16B][ciphertext]
    if (strlen($content) < AUTH_PHOTO_HEADER_LEN) {
        throw new RuntimeException('Format file foto tidak valid.');
    }

    $nonceRaw = substr($content, 0, AUTH_PHOTO_NONCE_LEN);
    $tagRaw   = substr($content, AUTH_PHOTO_NONCE_LEN, AUTH_PHOTO_TAG_LEN);
    $cipherRaw = substr($content, AUTH_PHOTO_HEADER_LEN);

    return AESGCMService::decrypt(
        base64_encode($cipherRaw),
        base64_encode($nonceRaw),
        base64_encode($tagRaw),
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