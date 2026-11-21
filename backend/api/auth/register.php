<?php

/**
 * POST /auth/register
 *
 * Pendaftaran TIDAK terbuka untuk publik - hanya lewat undangan
 * yang dibuat admin (POST /invites). Tanpa token undangan yang valid,
 * request ini ditolak.
 *
 * Body JSON:
 *   {
 *     "username": "...",
 *     "email": "...",
 *     "password": "...",
 *     "invite_token": "...",
 *     "id_photo": "data:image/jpeg;base64,...",   // optional
 *     "id_photo_type": "ktp|sim"                  // required if id_photo provided
 *   }
 *
 * Response 201:
 *   { "message": "Akun berhasil dibuat.", "user": { id, username, email, role } }
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../helpers/datetime.php';
require_once __DIR__ . '/../../helpers/storage.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/app.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// ── Parse body ────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);

$username     = trim($body['username']       ?? '');
$email        = trim($body['email']          ?? '');
$password     = $body['password']            ?? '';
$inviteToken  = trim($body['invite_token']   ?? '');
$idPhotoB64   = $body['id_photo']            ?? null;       // base64 data URL
$idPhotoType  = $body['id_photo_type']       ?? null;       // 'ktp' | 'sim'

// ── Validasi field akun ────────────────────────────────────
$errors = [];

if ($username === '') {
    $errors[] = 'Username wajib diisi.';
} elseif (strlen($username) < 3 || strlen($username) > 50) {
    $errors[] = 'Username harus 3–50 karakter.';
} elseif (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
    $errors[] = 'Username hanya boleh huruf, angka, dan underscore.';
}

if ($email === '') {
    $errors[] = 'Email wajib diisi.';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Format email tidak valid.';
}

if (strlen($password) < 8) {
    $errors[] = 'Kata sandi minimal 8 karakter.';
} elseif (!preg_match('/[0-9]/', $password)) {
    $errors[] = 'Kata sandi wajib mengandung minimal 1 angka.';
} elseif (!preg_match('/[^a-zA-Z0-9]/', $password)) {
    $errors[] = 'Kata sandi wajib mengandung minimal 1 karakter khusus (mis. !@#$%^&*).';
}

// ── Validasi foto ID (jika disediakan) ──────────────────────
$idPhotoPath = null;
if ($idPhotoB64 !== null && $idPhotoB64 !== '') {
    if (!in_array($idPhotoType, ['ktp', 'sim'], true)) {
        $errors[] = 'Tipe foto ID harus "ktp" atau "sim".';
    } else {
        // Decode base64 data URL
        if (!preg_match('/^data:image\/(jpeg|jpg|png);base64,/', $idPhotoB64)) {
            $errors[] = 'Format foto ID tidak valid. Harus JPEG/PNG base64.';
        } else {
            $parts = explode(',', $idPhotoB64, 2);
            $imageData = base64_decode($parts[1] ?? '');
            if ($imageData === false || strlen($imageData) === 0) {
                $errors[] = 'Data foto ID tidak valid.';
            } elseif (strlen($imageData) > 5 * 1024 * 1024) { // 5MB max
                $errors[] = 'Ukuran foto ID terlalu besar (maksimal 5 MB).';
            }
        }
    }
}

// Note: Admin accounts (from invite with role=admin) also need KTP photo
// but validation is handled in the invitation flow, not here.

if (!empty($errors)) {
    jsonResponse(['error' => implode(' ', $errors)], 422);
}

// ── Validasi undangan ─────────────────────────────────────
if ($inviteToken === '') {
    jsonResponse([
        'error' => 'Pendaftaran hanya melalui undangan. Hubungi admin untuk mendapatkan tautan undangan.',
    ], 403);
}

$db = getDB();

$stmt = $db->prepare('SELECT * FROM invites WHERE token = ? LIMIT 1');
$stmt->execute([$inviteToken]);
$invite = $stmt->fetch();

if (!$invite) {
    jsonResponse(['error' => 'Undangan tidak valid.'], 400);
}

if ($invite['status'] === 'accepted') {
    jsonResponse(['error' => 'Undangan sudah digunakan.'], 400);
}

if ($invite['status'] === 'revoked') {
    jsonResponse(['error' => 'Undangan telah dibatalkan oleh admin.'], 400);
}

if (isPastUtc($invite['expires_at'])) {
    jsonResponse(['error' => 'Undangan sudah kedaluwarsa.'], 400);
}

// Undangan terikat email → email akun mengikuti undangan (diabaikan dari form)
if ($invite['email'] !== null && $invite['email'] !== '') {
    $email = $invite['email'];
}

// ── Cek duplikat ──────────────────────────────────────────
$stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
$stmt->execute([$username, $email]);
$existing = $stmt->fetch();

if ($existing) {
    jsonResponse(['error' => 'Username atau email sudah digunakan.'], 409);
}

// Role 'dev' hanya bisa ditambahkan langsung via database/seed, tidak lewat undangan
if ($invite['role'] === 'dev') {
    jsonResponse(['error' => 'Peran developer tidak dapat dibuat melalui undangan.'], 403);
}

// ── Hash password (Argon2id) ──────────────────────────────
$hash = password_hash($password, PASSWORD_ARGON2ID, [
    'memory_cost' => ARGON2_MEMORY_COST,
    'time_cost'   => ARGON2_TIME_COST,
    'threads'     => ARGON2_THREADS,
]);

// ── Simpan foto ID ke storage (sebelum transaksi DB) ───────
$idPhotoPath = null;
$idPhotoTypeSaved = null;
if ($idPhotoB64 !== null && $idPhotoB64 !== '') {
    $parts = explode(',', $idPhotoB64, 2);
    $imageData = base64_decode($parts[1]);
    $uploadDir = storagePath('id_photos');
    ensureStorageDir($uploadDir);
    $ext = ($idPhotoType === 'ktp') ? 'ktp' : 'sim';
    $filename = "id_{$ext}_" . date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.jpg';
    $filepath = $uploadDir . DIRECTORY_SEPARATOR . $filename;
    
    // Enkripsi foto ID dengan AES-256-GCM (algoritma Erlan)
    // Format file: [nonce 12B][auth_tag 16B][ciphertext]
    require_once __DIR__ . '/../../services/crypto/AESGCMService.php';
    $encrypted = AESGCMService::encrypt($imageData);
    $nonceRaw = base64_decode($encrypted['nonce'], true);
    $tagRaw = base64_decode($encrypted['tag'], true);
    $cipherRaw = base64_decode($encrypted['ciphertext'], true);
    
    if ($nonceRaw === false || $tagRaw === false || $cipherRaw === false) {
        jsonResponse(['error' => 'Gagal mengenkripsi foto ID.'], 500);
    }
    
    $fileContent = $nonceRaw . $tagRaw . $cipherRaw;
    if (file_put_contents($filepath, $fileContent, LOCK_EX) === false) {
        jsonResponse(['error' => 'Gagal menyimpan foto ID.'], 500);
    }
    @chmod($filepath, 0644);
    $idPhotoPath = 'storage/id_photos/' . $filename;
    $idPhotoTypeSaved = $idPhotoType;
}

// ── Simpan user + tandai undangan terpakai (atomik) ───────
$db->beginTransaction();

$stmt = $db->prepare(
    'INSERT INTO users (username, email, password_hash, id_photo_path, id_photo_type, role) VALUES (?, ?, ?, ?, ?, ?)'
);
$stmt->execute([$username, $email, $hash, $idPhotoPath, $idPhotoTypeSaved, $invite['role']]);
$userId = (int)$db->lastInsertId();

// UPDATE bersyarat - cegah undangan dipakai dua kali bersamaan
$upd = $db->prepare(
    "UPDATE invites
        SET status = 'accepted', used_by = ?, used_at = UTC_TIMESTAMP()
      WHERE token = ? AND status = 'pending'"
);
$upd->execute([$userId, $inviteToken]);

if ($upd->rowCount() === 0) {
    $db->rollBack();
    jsonResponse(['error' => 'Undangan sudah digunakan.'], 400);
}

$db->commit();

jsonResponse([
    'message' => 'Akun berhasil dibuat.',
    'user'    => [
        'id'       => $userId,
        'username' => $username,
        'email'    => $email,
        'role'     => $invite['role'],
    ],
], 201);
