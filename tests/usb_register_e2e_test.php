#!/usr/bin/env php
<?php

/**
 * Test end-to-end USB token register flow (simulasi frontend).
 * 
 * 1. Login admin → token JWT
 * 2. Start register → challenge
 * 3. Baca .truecount_token → decrypt private key dengan PIN
 * 4. Sign challenge dengan ECDSA
 * 5. Verify di backend → harus 201
 */

$base = 'http://localhost:8000';
$tokenFile = __DIR__ . '/../.truecount_token';
$pin = '123456';

if (!file_exists($tokenFile)) {
    echo "[✗] Token file tidak ditemukan: $tokenFile\n";
    echo "    Generate dulu: php database/generate_test_token.php . 1 \"123456\"\n";
    exit(1);
}

function postJson(string $url, array $data = [], ?string $bearer = null): array {
    $ch = curl_init($url);
    $headers = ['Content-Type: application/json'];
    if ($bearer) $headers[] = "Authorization: Bearer $bearer";
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($data),
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [json_decode($raw, true), $code];
}

function getJson(string $url, ?string $bearer = null): array {
    $ch = curl_init($url);
    $headers = [];
    if ($bearer) $headers[] = "Authorization: Bearer $bearer";
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [json_decode($raw, true), $code];
}

// ── 1. Login ───────────────────────────────────────────────
echo "[1] Login admin...\n";
[$login, $code] = postJson("$base/auth/login", ['identifier' => 'admin', 'password' => 'Admin@1234']);
if ($code !== 200) { echo "[✗] Login gagal: " . json_encode($login) . "\n"; exit(1); }
$jwt = $login['token'];
echo "    OK - user: {$login['user']['username']} (id={$login['user']['id']})\n";

// ── 2. Start register ──────────────────────────────────────
echo "[2] Start register...\n";
[$start, $code] = postJson("$base/mfa/usb/register/start", [], $jwt);
if ($code !== 200) { echo "[✗] Start gagal: " . json_encode($start) . "\n"; exit(1); }
$challengeId = $start['challenge_id'];
$challengeB64 = $start['challenge'];
$challenge = base64_decode(strtr($challengeB64, '-_', '+/'));
echo "    OK - challenge_id=$challengeId\n";

// ── 3. Decrypt token file ──────────────────────────────────
echo "[3] Decrypt token file dengan PIN '$pin'...\n";
$token = json_decode(file_get_contents($tokenFile), true);
$salt = base64_decode(strtr($token['salt'], '-_', '+/'));
$iv = base64_decode(strtr($token['iv'], '-_', '+/'));
$ciphertextWithTag = base64_decode(strtr($token['sk_enc'], '-_', '+/'));
$pkSpkiDer = base64_decode(strtr($token['pk'], '-_', '+/'));

$key = hash_pbkdf2('sha256', $pin, $salt, 100_000, 32, true);
$ciphertext = substr($ciphertextWithTag, 0, -16);
$tag = substr($ciphertextWithTag, -16);
$pkcs8Der = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
if ($pkcs8Der === false) { echo "[✗] Decrypt gagal (PIN salah?)\n"; exit(1); }
echo "    OK - private key terdekripsi (" . strlen($pkcs8Der) . " bytes)\n";

// ── 4. Sign challenge ──────────────────────────────────────
echo "[4] Sign challenge...\n";
// PHP 8.4: DER binary perlu PEM wrapper
$privPem = "-----BEGIN PRIVATE KEY-----\n" . chunk_split(base64_encode($pkcs8Der), 64, "\n") . "-----END PRIVATE KEY-----\n";
$privKey = openssl_pkey_get_private($privPem);
if (!$privKey) { echo "[✗] Import private key gagal\n"; exit(1); }
$derSig = '';
$ok = openssl_sign($challenge, $derSig, $privKey, OPENSSL_ALGO_SHA256);
if (!$ok) { echo "[✗] Sign gagal\n"; exit(1); }

// Convert DER signature → raw (r||s)
// Parse DER: SEQUENCE { INTEGER r, INTEGER s }
function derToRaw(string $der): string {
    $offset = 2; // skip SEQUENCE tag + length (asumsi < 128 bytes)
    // INTEGER r
    $offset++; // skip tag
    $rLen = ord($der[$offset]); $offset++;
    $r = substr($der, $offset, $rLen); $offset += $rLen;
    // INTEGER s
    $offset++; // skip tag
    $sLen = ord($der[$offset]); $offset++;
    $s = substr($der, $offset, $sLen); $offset += $sLen;
    // Strip leading zeros to get 32 bytes each
    $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);
    return $r . $s;
}
$rawSig = derToRaw($derSig);
echo "    OK - signature " . strlen($rawSig) . " bytes (raw r||s)\n";

// ── 5. Verify di backend ───────────────────────────────────
echo "[5] Verify di backend...\n";
[$verify, $code] = postJson("$base/mfa/usb/register/verify", [
    'challenge_id' => $challengeId,
    'signature' => rtrim(strtr(base64_encode($rawSig), '+/', '-_'), '='),
    'public_key' => rtrim(strtr(base64_encode($pkSpkiDer), '+/', '-_'), '='),
    'label' => 'USB Test',
], $jwt);
echo "    HTTP $code: " . json_encode($verify, JSON_UNESCAPED_UNICODE) . "\n";

if ($code !== 201) {
    echo "\n[✗] REGISTER GAGAL\n";
    exit(1);
}

// ── 6. List credentials ────────────────────────────────────
echo "[6] List credentials...\n";
[$list, $code] = getJson("$base/mfa/usb/list", $jwt);
echo "    HTTP $code\n";
foreach ($list['credentials'] ?? [] as $cred) {
    echo "    - id={$cred['id']} label='{$cred['label']}' active=" . ($cred['is_active'] ? 'ya' : 'tidak') . "\n";
}

echo "\n[✓] END-TO-END REGISTER FLOW SUKSES!\n";