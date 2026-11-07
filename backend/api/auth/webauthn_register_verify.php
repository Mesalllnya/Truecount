<?php

/**
 * POST /auth/webauthn/register/verify
 *
 * Verifikasi WebAuthn attestation (Windows Hello registration).
 * Memerlukan JWT Bearer token.
 *
 * Body JSON:
 *   {
 *     "challenge_id": 123,
 *     "credential_id": "base64url",
 *     "attestation_object": "base64url",
 *     "client_data_json": "base64url"
 *   }
 *
 * Response 201:
 *   { "message": "Windows Hello berhasil didaftarkan.", "credential_id": "base64url" }
 *
 * Response 400: Verifikasi gagal / challenge invalid
 * Response 401: Token invalid/expired
 * Response 422: Body tidak valid
 */

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../helpers/webauthn.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method tidak diizinkan.'], 405);
}

// Ambil user dari JWT
$user = requireAuth();
$userId = $user['sub'];

$body = json_decode(file_get_contents('php://input') ?: '{}', true);
$challengeId = (int)($body['challenge_id'] ?? 0);
$credentialIdB64 = (string)($body['credential_id'] ?? '');
$attestationObjectB64 = (string)($body['attestation_object'] ?? '');
$clientDataJsonB64 = (string)($body['client_data_json'] ?? '');

if ($challengeId <= 0 || $credentialIdB64 === '' || $attestationObjectB64 === '' || $clientDataJsonB64 === '') {
    jsonResponse(['error' => 'Data tidak lengkap.'], 422);
}

$db = getDB();

// ── 1. Validasi challenge ──────────────────────────────────────────
$stmt = $db->prepare(
    'SELECT id, user_id, challenge, expires_at
       FROM webauthn_challenges
      WHERE id = ? AND type = "registration" AND status = "pending"
      LIMIT 1'
);
$stmt->execute([$challengeId]);
$challengeRow = $stmt->fetch();

if (!$challengeRow) {
    jsonResponse(['error' => 'Challenge tidak ditemukan atau sudah kedaluwarsa.'], 400);
}

if ((int)$challengeRow['user_id'] !== $userId) {
    jsonResponse(['error' => 'Challenge tidak valid untuk user ini.'], 400);
}

if (strtotime($challengeRow['expires_at']) < time()) {
    $db->prepare('UPDATE webauthn_challenges SET status = "expired" WHERE id = ?')->execute([$challengeId]);
    jsonResponse(['error' => 'Challenge sudah kedaluwarsa. Silakan coba lagi.'], 400);
}

$challengeBytes = $challengeRow['challenge']; // sudah binary dari DB (VARBINARY)

// ── 2. Decode client data JSON ─────────────────────────────────────
$clientDataJson = base64_decode(strtr($clientDataJsonB64, '-_', '+/'));
$clientData = json_decode($clientDataJson, true);

if (!$clientData || !isset($clientData['type']) || $clientData['type'] !== 'webauthn.create') {
    jsonResponse(['error' => 'Client data tidak valid.'], 400);
}

if (!isset($clientData['challenge'])) {
    jsonResponse(['error' => 'Challenge tidak ada di client data.'], 400);
}

$clientChallenge = base64_decode(strtr($clientData['challenge'], '-_', '+/'));

// Verifikasi challenge cocok
if (!hash_equals($challengeBytes, $clientChallenge)) {
    jsonResponse(['error' => 'Challenge tidak cocok.'], 400);
}

// Verifikasi origin (opsional tapi direkomendasikan untuk production)
$expectedOrigin = 'http://localhost:5173';
if (isset($clientData['origin']) && $clientData['origin'] !== $expectedOrigin) {
    error_log("[WebAuthn] Origin mismatch: expected $expectedOrigin, got {$clientData['origin']}");
}

// ── 3. Parse attestation object (CBOR) ─────────────────────────────
// Attestation object adalah CBOR encoded
$attestationObject = base64_decode(strtr($attestationObjectB64, '-_', '+/'));
$attestation = parseAttestationObject($attestationObject);

if ($attestation === false) {
    jsonResponse(['error' => 'Attestation object tidak valid.'], 400);
}

// ── 4. Verifikasi credential ID cocok ──────────────────────────────
$credentialId = base64_decode(strtr($credentialIdB64, '-_', '+/'));
if (!hash_equals($credentialId, $attestation['credential_id'])) {
    jsonResponse(['error' => 'Credential ID tidak cocok.'], 400);
}

// ── 5. Ekstrak public key dari attestation (COSE format) ───────────
$coseKey = $attestation['cose_key'] ?? null;
if (!$coseKey) {
    jsonResponse(['error' => 'Public key tidak ditemukan di attestation.'], 400);
}

// Convert COSE key ke SPKI DER
$publicKeyDer = coseToSpki($coseKey);
if ($publicKeyDer === false) {
    jsonResponse(['error' => 'Format public key tidak didukung.'], 400);
}

// ── 6. Simpan credential ke database ───────────────────────────────
$stmt = $db->prepare(
    'INSERT INTO biometric_credentials (user_id, credential_id, public_key, sign_count, aaguid, created_at)
     VALUES (?, ?, ?, 0, ?, NOW())'
);
$aaguid = $attestation['aaguid'] ?? null;
$stmt->execute([$userId, $credentialId, $publicKeyDer, $aaguid]);

// ── 7. Tandai challenge used ───────────────────────────────────────
$db->prepare(
    'UPDATE webauthn_challenges SET status = "used", used_at = NOW() WHERE id = ?'
)->execute([$challengeId]);

jsonResponse([
    'message' => 'Windows Hello berhasil didaftarkan.',
    'credential_id' => $credentialIdB64,
], 201);

/**
 * Parse attestation object (CBOR format sederhana).
 * Returns array dengan: fmt, auth_data (binary), attestation_statement, credential_id, aaguid, cose_key
 */
function parseAttestationObject(string $data): ?array
{
    // CBOR parsing sederhana - hanya handle packed/none attestation
    // Untuk production sebaiknya pakai library CBOR yang proper
    
    $offset = 0;
    $len = strlen($data);
    
    // Attestation object adalah map dengan keys: fmt, authData, attStmt
    // fmt = text string (major type 3)
    // authData = byte string (major type 2)
    // attStmt = map
    
    // Skip map header (bisa 0xA3 untuk 3 pairs)
    if ($len < 1) return false;
    $firstByte = ord($data[0]);
    if (($firstByte & 0xE0) !== 0xA0) return false; // Bukan map
    $mapLen = $firstByte & 0x1F;
    if ($mapLen === 31) return false; // Indefinite length - skip
    $offset = 1;
    
    $fmt = null;
    $authData = null;
    $attStmt = null;
    
    for ($i = 0; $i < $mapLen; $i++) {
        // Key
        if ($offset >= $len) return false;
        $keyByte = ord($data[$offset]);
        if (($keyByte & 0xE0) !== 0x60) return false; // Bukan text string
        $keyLen = $keyByte & 0x1F;
        if ($keyLen === 31) return false;
        $offset++;
        $key = substr($data, $offset, $keyLen);
        $offset += $keyLen;
        
        // Value
        if ($offset >= $len) return false;
        $valByte = ord($data[$offset]);
        
        if ($key === 'fmt') {
            // fmt = text string
            if (($valByte & 0xE0) !== 0x60) return false;
            $valLen = $valByte & 0x1F;
            if ($valLen === 31) return false;
            $offset++;
            $fmt = substr($data, $offset, $valLen);
            $offset += $valLen;
        } elseif ($key === 'authData') {
            // authData = byte string
            if (($valByte & 0xE0) !== 0x40) return false;
            $valLen = $valByte & 0x1F;
            if ($valLen === 31) return false;
            $offset++;
            $authData = substr($data, $offset, $valLen);
            $offset += $valLen;
        } elseif ($key === 'attStmt') {
            // attStmt = map (skip parsing untuk packed/none)
            // Kita skip seluruh attStmt
            if (($valByte & 0xE0) !== 0xA0) return false;
            $attStmtMapLen = $valByte & 0x1F;
            if ($attStmtMapLen === 31) return false;
            $offset++;
            // Skip attStmt map (simplified - tidak parse recursive)
            $attStmt = 'skipped';
        } else {
            // Unknown key - skip value
            $offset = skipCborValue($data, $offset, $len);
            if ($offset === false) return false;
        }
    }
    
    if (!$authData) return false;
    
    // Parse authData untuk dapatkan credential_id, aaguid, COSE public key
    $parsedAuth = parseAuthData($authData);
    if ($parsedAuth === false) return false;
    
    return [
        'fmt' => $fmt,
        'auth_data' => $authData,
        'attestation_statement' => $attStmt,
        'credential_id' => $parsedAuth['credential_id'],
        'aaguid' => $parsedAuth['aaguid'],
        'cose_key' => $parsedAuth['cose_key'],
    ];
}

/**
 * Skip CBOR value (helper untuk skip unknown fields)
 */
function skipCborValue(string $data, int $offset, int $len): int|false
{
    if ($offset >= $len) return false;
    $byte = ord($data[$offset]);
    $major = ($byte & 0xE0) >> 5;
    $info = $byte & 0x1F;
    
    if ($info < 24) {
        return $offset + 1;
    } elseif ($info === 24) { // uint8
        return $offset + 2;
    } elseif ($info === 25) { // uint16
        return $offset + 3;
    } elseif ($info === 26) { // uint32
        return $offset + 5;
    } elseif ($info === 27) { // uint64
        return $offset + 9;
    } elseif ($info === 28 || $info === 29 || $info === 30) {
        return false; // Reserved
    } elseif ($info === 31) { // Indefinite
        // Untuk simplicity, kita tidak handle indefinite length
        return false;
    }
    
    // Untuk major types dengan payload length (0-2, 3, 4, 5, 6, 7)
    // major 0/1: unsigned/negative integer - sudah di-handle di atas
    // major 2: byte string
    // major 3: text string
    // major 4: array
    // major 5: map
    // major 6: tag
    // major 7: simple/float
    
    if ($major === 2 || $major === 3) { // byte string / text string
        $payloadLen = 0;
        if ($info < 24) $payloadLen = $info;
        elseif ($info === 24) { if ($offset + 1 >= $len) return false; $payloadLen = ord($data[$offset + 1]); return $offset + 2 + $payloadLen; }
        elseif ($info === 25) { if ($offset + 2 >= $len) return false; $payloadLen = unpack('n', substr($data, $offset + 1, 2))[1]; return $offset + 3 + $payloadLen; }
        elseif ($info === 26) { if ($offset + 4 >= $len) return false; $payloadLen = unpack('N', substr($data, $offset + 1, 4))[1]; return $offset + 5 + $payloadLen; }
        return false;
    } elseif ($major === 4) { // array
        // Skip array elements recursively (simplified)
        return false;
    } elseif ($major === 5) { // map
        return false;
    } elseif ($major === 7) { // simple/float
        return $offset + 1;
    }
    
    return false;
}

/**
 * Parse authenticator data untuk extract credential_id, aaguid, COSE public key
 */
function parseAuthData(string $authData): ?array
{
    $offset = 0;
    $len = strlen($authData);
    
    // rpIdHash (32 bytes)
    if ($offset + 32 > $len) return false;
    $offset += 32;
    
    // flags (1 byte)
    if ($offset >= $len) return false;
    $flags = ord($authData[$offset]);
    $offset += 1;
    
    // signCount (4 bytes, big-endian)
    if ($offset + 4 > $len) return false;
    $offset += 4;
    
    // AT flag (attested credential data present)
    $hasAttestedCredentialData = ($flags & 0x40) !== 0;
    if (!$hasAttestedCredentialData) return false;
    
    // AAGUID (16 bytes)
    if ($offset + 16 > $len) return false;
    $aaguid = substr($authData, $offset, 16);
    $offset += 16;
    
    // Credential ID length (2 bytes, big-endian)
    if ($offset + 2 > $len) return false;
    $credIdLen = unpack('n', substr($authData, $offset, 2))[1];
    $offset += 2;
    
    // Credential ID
    if ($offset + $credIdLen > $len) return false;
    $credentialId = substr($authData, $offset, $credIdLen);
    $offset += $credIdLen;
    
    // COSE Public Key (CBOR encoded) - parse sederhana
    if ($offset >= $len) return false;
    $coseKey = parseCoseKey(substr($authData, $offset));
    if ($coseKey === false) return false;
    
    return [
        'credential_id' => $credentialId,
        'aaguid' => bin2hex($aaguid),
        'cose_key' => $coseKey,
    ];
}

/**
 * Parse COSE key (simplified untuk EC2 P-256)
 */
function parseCoseKey(string $data): ?array
{
    $offset = 0;
    $len = strlen($data);
    
    // COSE key adalah map
    if ($len < 1) return false;
    $firstByte = ord($data[0]);
    if (($firstByte & 0xE0) !== 0xA0) return false; // Bukan map
    $mapLen = $firstByte & 0x1F;
    if ($mapLen === 31) return false;
    $offset = 1;
    
    $result = [];
    
    for ($i = 0; $i < $mapLen; $i++) {
        if ($offset >= $len) return false;
        
        // Key (integer label untuk COSE)
        $keyByte = ord($data[$offset]);
        if (($keyByte & 0xE0) !== 0x00) return false; // Bukan unsigned int
        $keyInfo = $keyByte & 0x1F;
        if ($keyInfo < 24) {
            $keyLabel = $keyInfo;
            $offset++;
        } elseif ($keyInfo === 24) {
            if ($offset + 1 >= $len) return false;
            $keyLabel = ord($data[$offset + 1]);
            $offset += 2;
        } else {
            return false;
        }
        
        // Value
        if ($offset >= $len) return false;
        $valByte = ord($data[$offset]);
        
        // COSE key labels:
        // 1 = kty (key type), 2 = kid, 3 = alg, -1 = crv, -2 = x, -3 = y
        if ($keyLabel === 1) { // kty
            if (($valByte & 0xE0) !== 0x00) return false;
            $result['kty'] = $valByte & 0x1F;
        } elseif ($keyLabel === 3) { // alg
            if (($valByte & 0xE0) !== 0x00) return false;
            $result['alg'] = $valByte & 0x1F;
        } elseif ($keyLabel === -1 || $keyLabel === 255) { // crv (negative = 0x20-0x3F range)
            // crv bisa negative integer (major type 1)
            if (($valByte & 0xE0) === 0x20) { // negative int
                $info = $valByte & 0x1F;
                if ($info < 24) {
                    $result['crv'] = -1 - $info;
                }
            }
        } elseif ($keyLabel === -2 || $keyLabel === 254) { // x coordinate
            // byte string
            if (($valByte & 0xE0) !== 0x40) return false;
            $valInfo = $valByte & 0x1F;
            $valLen = 0;
            if ($valInfo < 24) {
                $valLen = $valInfo;
                $offset++;
            } elseif ($valInfo === 24) {
                if ($offset + 1 >= $len) return false;
                $valLen = ord($data[$offset + 1]);
                $offset += 2;
            } else {
                return false;
            }
            if ($offset + $valLen > $len) return false;
            $result['x'] = substr($data, $offset, $valLen);
            $offset += $valLen;
        } elseif ($keyLabel === -3 || $keyLabel === 253) { // y coordinate
            if (($valByte & 0xE0) !== 0x40) return false;
            $valInfo = $valByte & 0x1F;
            $valLen = 0;
            if ($valInfo < 24) {
                $valLen = $valInfo;
                $offset++;
            } elseif ($valInfo === 24) {
                if ($offset + 1 >= $len) return false;
                $valLen = ord($data[$offset + 1]);
                $offset += 2;
            } else {
                return false;
            }
            if ($offset + $valLen > $len) return false;
            $result['y'] = substr($data, $offset, $valLen);
            $offset += $valLen;
        } else {
            // Skip unknown
            $offset = skipCborValue($data, $offset, $len);
            if ($offset === false) return false;
            continue;
        }
    }
    
    // Validate required fields
    if (!isset($result['kty']) || $result['kty'] !== 2) return false; // EC2
    if (!isset($result['alg']) || $result['alg'] !== -7) return false; // ES256
    if (!isset($result['crv']) || $result['crv'] !== 1) return false; // P-256
    if (!isset($result['x']) || !isset($result['y'])) return false;
    
    return $result;
}

/**
 * Convert COSE key (EC2 P-256) ke SPKI DER format
 */
function coseToSpki(array $coseKey): string|false
{
    // SPKI untuk EC P-256:
    // SEQUENCE {
    //   SEQUENCE {
    //     OBJECT IDENTIFIER 1.2.840.10045.2.1 (ecPublicKey)
    //     OBJECT IDENTIFIER 1.2.840.10045.3.1.7 (prime256v1)
    //   }
    //   BIT STRING (uncompressed point: 0x04 || x || y)
    // }
    
    $x = $coseKey['x'];
    $y = $coseKey['y'];
    
    // Pastikan x dan y 32 bytes (P-256)
    if (strlen($x) !== 32 || strlen($y) !== 32) return false;
    
    // Uncompressed point: 0x04 || x || y
    $point = "\x04" . $x . $y;
    
    // Algorithm identifier: ecPublicKey (1.2.840.10045.2.1) + prime256v1 (1.2.840.10045.3.1.7)
    $algId = "\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07";
    
    // BIT STRING wrapper (0x00 = unused bits)
    $bitStrLen = strlen($point) + 1;
    $bitStr = "\x03" . encodeLength($bitStrLen) . "\x00" . $point;
    
    // SEQUENCE wrapper
    $seqContent = $algId . $bitStr;
    $seq = "\x30" . encodeLength(strlen($seqContent)) . $seqContent;
    
    return $seq;
}

/**
 * Encode length untuk DER (simplified untuk length < 128)
 */
function encodeLength(int $len): string
{
    if ($len < 128) {
        return chr($len);
    } elseif ($len < 256) {
        return "\x81" . chr($len);
    } elseif ($len < 65536) {
        return "\x82" . chr($len >> 8) . chr($len & 0xFF);
    }
    return '';
}