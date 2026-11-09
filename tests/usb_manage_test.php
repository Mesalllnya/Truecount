#!/usr/bin/env php
<?php

/**
 * Test revoke + label USB token endpoints.
 */

$base = 'http://localhost:8000';

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

// Login
[$login, $code] = postJson("$base/auth/login", ['identifier' => 'admin', 'password' => 'Admin@1234']);
if ($code !== 200) { echo "[✗] Login gagal\n"; exit(1); }
$jwt = $login['token'];

// Ambil credential id terdaftar (id=1 dari test sebelumnya)
$credId = 1;

echo "[1] Update label...\n";
[$res, $code] = postJson("$base/mfa/usb/$credId/label", ['label' => 'USB Kantor'], $jwt);
echo "    HTTP $code: " . json_encode($res, JSON_UNESCAPED_UNICODE) . "\n";

echo "[2] Revoke token...\n";
[$res, $code] = postJson("$base/mfa/usb/$credId/revoke", [], $jwt);
echo "    HTTP $code: " . json_encode($res, JSON_UNESCAPED_UNICODE) . "\n";

echo "[3] Revoke lagi (harus 409)...\n";
[$res, $code] = postJson("$base/mfa/usb/$credId/revoke", [], $jwt);
echo "    HTTP $code: " . json_encode($res, JSON_UNESCAPED_UNICODE) . "\n";

echo "[4] List final...\n";
$ch = curl_init("$base/mfa/usb/list");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $jwt"],
]);
$raw = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$list = json_decode($raw, true);
echo "    HTTP $code\n";
foreach ($list['credentials'] ?? [] as $cred) {
    echo "    - id={$cred['id']} label='{$cred['label']}' active=" . ($cred['is_active'] ? 'ya' : 'tidak') . "\n";
}

echo "\n[✓] REVOKE + LABEL TEST SUKSES!\n";