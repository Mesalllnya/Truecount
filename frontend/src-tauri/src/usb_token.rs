use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::interval;

/// Struct file token di USB
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbTokenFile {
    pub v: u8,
    pub uid: u64,
    pub alg: String,
    pub pk: String,
    pub sk_enc: String,
    pub salt: String,
    pub iv: String,
}

/// Payload event ke frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbTokenDetected {
    pub drive: String,
    pub user_id: u64,
    pub credential_id: String,
    pub label: Option<String>,
}

/// Response decrypt - private key dikembalikan sebagai JWK
#[derive(Debug, Serialize)]
pub struct DecryptResponse {
    pub private_key_jwk: serde_json::Value,
    pub public_key_spki: String,
    pub credential_id: String,
}

/// Response buat token
#[derive(Debug, Serialize)]
pub struct CreateTokenResponse {
    pub credential_id: String,
    pub drive: String,
}

/// Info drive removable (untuk UI pemilihan drive)
#[derive(Debug, Serialize)]
pub struct UsbDriveInfo {
    pub drive: String,
    pub has_token: bool,
}

/// Daftar drive removable (Windows/Linux/macOS)
fn list_removable_drives() -> Vec<String> {
    let mut drives = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-WmiObject Win32_Volume | Where-Object {$_.DriveType -eq 2} | Select-Object -ExpandProperty DriveLetter",
            ])
            .output();
        match output {
            Ok(out) => {
                for line in String::from_utf8_lossy(&out.stdout).lines() {
                    let l = line.trim();
                    if !l.is_empty() {
                        drives.push(format!("{}\\", l));
                    }
                }
            }
            Err(_) => {}
        }
    }
    #[cfg(target_os = "linux")]
    {
        let media_path = "/media";
        if let Ok(entries) = std::fs::read_dir(media_path) {
            for user_dir in entries.flatten() {
                if let Ok(sub) = std::fs::read_dir(user_dir.path()) {
                    for d in sub.flatten() {
                        drives.push(d.path().to_string_lossy().to_string());
                    }
                }
            }
        }
        if let Ok(entries) = std::fs::read_dir("/mnt") {
            for d in entries.flatten() {
                drives.push(d.path().to_string_lossy().to_string());
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(entries) = std::fs::read_dir("/Volumes") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !matches!(name.as_str(), "Macintosh HD" | "Recovery" | "VM" | "Preboot") {
                    drives.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }

    // Debug mode: juga scan current working directory untuk testing
    #[cfg(debug_assertions)]
    {
        if let Ok(cwd) = std::env::current_dir() {
            drives.push(cwd.to_string_lossy().to_string());
        }
    }

    drives
}

/// Scan file .truecount_token di drive
fn scan_token_file(drive: &str) -> Result<Option<UsbTokenFile>, String> {
    let path = Path::new(drive).join(".truecount_token");
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Read file: {}", e))?;
    let token: UsbTokenFile = serde_json::from_str(&content).map_err(|e| format!("Parse JSON: {}", e))?;
    Ok(Some(token))
}

/// Hitung credential_id = SHA-256(SPKI public key) -> hex
fn compute_credential_id(pk_b64url: &str) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    let der = URL_SAFE_NO_PAD.decode(pk_b64url).map_err(|e| format!("Decode pk: {}", e))?;
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(&der);
    Ok(hex::encode(hash))
}

/// Tauri command: scan semua drive removable dan return token yang ditemukan
/// (dipakai frontend saat butuh deteksi aktif, bukan cuma pasif via event)
#[tauri::command]
pub async fn scan_usb_tokens() -> Result<Vec<UsbTokenDetected>, String> {
    let mut found = Vec::new();
    for drive in list_removable_drives() {
        if let Ok(Some(token)) = scan_token_file(&drive) {
            let credential_id = compute_credential_id(&token.pk).unwrap_or_default();
            found.push(UsbTokenDetected {
                drive,
                user_id: token.uid,
                credential_id,
                label: None,
            });
        }
    }
    Ok(found)
}

/// Tauri command: daftar SEMUA drive removable (termasuk yang belum ada token)
#[tauri::command]
pub async fn list_usb_drives() -> Result<Vec<UsbDriveInfo>, String> {
    let mut result = Vec::new();
    for drive in list_removable_drives() {
        let has_token = scan_token_file(&drive).ok().flatten().is_some();
        result.push(UsbDriveInfo { drive, has_token });
    }
    Ok(result)
}

/// Tauri command: buat file token BARU di USB (tanpa registrasi ke server).
/// Generate keypair ECDSA P-256 → encrypt private key dengan PIN (PBKDF2 + AES-GCM)
/// → tulis `.truecount_token` ke root drive.
#[tauri::command(rename_all = "snake_case")]
pub async fn create_usb_token_file(drive: String, user_id: u64, pin: String) -> Result<CreateTokenResponse, String> {
    use p256::pkcs8::{EncodePrivateKey, EncodePublicKey};
    use p256::ecdsa::SigningKey;
    use rand_core::{OsRng, RngCore};
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    use pbkdf2::pbkdf2_hmac_array;
    use sha2::Sha256;
    use aes_gcm::{Aes256Gcm, Key, Nonce, aead::{Aead, KeyInit}};

    // Validasi PIN minimal 4 karakter
    if pin.chars().count() < 4 {
        return Err("PIN minimal 4 karakter.".to_string());
    }

    // 1. Generate keypair ECDSA P-256
    let signing_key = SigningKey::random(&mut OsRng);
    let verifying_key = signing_key.verifying_key();

    // 2. Export: private → PKCS#8 DER, public → SPKI DER
    let pkcs8_der = signing_key
        .to_pkcs8_der()
        .map_err(|e| format!("Export private key gagal: {e}"))?;
    let spki_der = verifying_key
        .to_public_key_der()
        .map_err(|e| format!("Export public key gagal: {e}"))?;

    // 3. Generate salt + IV
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    let mut iv = [0u8; 12];
    OsRng.fill_bytes(&mut iv);

    // 4. Derive key PBKDF2(PIN, salt, 100k iter) → AES-256-GCM encrypt
    let key = pbkdf2_hmac_array::<Sha256, 32>(pin.as_bytes(), &salt, 100_000);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Nonce::from_slice(&iv);
    let ciphertext = cipher
        .encrypt(nonce, pkcs8_der.as_bytes())
        .map_err(|_| "Enkripsi gagal.".to_string())?; // ciphertext sudah termasuk 16 byte tag

    // 5. Build JSON token file
    let pk_b64url = URL_SAFE_NO_PAD.encode(spki_der.as_bytes());
    let token = serde_json::json!({
        "v": 1,
        "uid": user_id,
        "alg": "ES256",
        "pk": pk_b64url,
        "sk_enc": URL_SAFE_NO_PAD.encode(&ciphertext),
        "salt": URL_SAFE_NO_PAD.encode(salt),
        "iv": URL_SAFE_NO_PAD.encode(iv),
    });

    // 6. Tulis file ke root drive
    let path = Path::new(&drive).join(".truecount_token");
    let json = serde_json::to_string_pretty(&token)
        .map_err(|e| format!("Serialize JSON gagal: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Gagal menulis ke {}: {e}", path.display()))?;

    let credential_id = compute_credential_id(&pk_b64url)?;

    Ok(CreateTokenResponse {
        credential_id,
        drive,
    })
}

/// Background monitor USB drives
pub fn start_usb_monitor(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = interval(Duration::from_secs(2));
        let mut known_drives: HashSet<String> = HashSet::new();

        loop {
            interval.tick().await;
            let drives = list_removable_drives();
            eprintln!("[usb-monitor] scan: {:?}", drives);

            for drive in &drives {
                if known_drives.insert(drive.clone()) {
                    // Drive baru terlihat
                    match scan_token_file(drive) {
                        Ok(Some(token)) => {
                            let credential_id = compute_credential_id(&token.pk).unwrap_or_default();
                            eprintln!("[usb-monitor] EMIT usb-token-detected drive={drive} uid={} cred={}", token.uid, credential_id);
                            let _ = app.emit(
                                "usb-token-detected",
                                UsbTokenDetected {
                                    drive: drive.clone(),
                                    user_id: token.uid,
                                    credential_id,
                                    label: None,
                                },
                            );
                        }
                        Ok(None) => {
                            eprintln!("[usb-monitor] drive {drive} tanpa file token");
                        }
                        Err(e) => {
                            eprintln!("[usb-monitor] scan gagal {drive}: {e}");
                        }
                    }
                }
            }

            known_drives.retain(|d| drives.contains(d));
        }
    });
}

/// Tauri command: decrypt private key dari file USB
#[tauri::command]
pub async fn decrypt_usb_token_private_key(drive: String, pin: String) -> Result<DecryptResponse, String> {
    let token = scan_token_file(&drive)?
        .ok_or_else(|| "Token file not found on drive".to_string())?;

    // Clone pk untuk dipakai berkali-kali
    let pk_b64url = token.pk.clone();
    let pk_for_cred = pk_b64url.clone();

    // Decode base64url
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    let salt = URL_SAFE_NO_PAD.decode(&token.salt).map_err(|e| format!("Decode salt: {}", e))?;
    let iv = URL_SAFE_NO_PAD.decode(&token.iv).map_err(|e| format!("Decode iv: {}", e))?;
    let ciphertext_with_tag = URL_SAFE_NO_PAD.decode(&token.sk_enc).map_err(|e| format!("Decode sk_enc: {}", e))?;

    // PBKDF2 derive key (100k iter, SHA-256) -> AES-256-GCM
    use pbkdf2::pbkdf2_hmac_array;
    use sha2::Sha256;
    let key = pbkdf2_hmac_array::<Sha256, 32>(pin.as_bytes(), &salt, 100_000);

    // AES-GCM decrypt (ciphertext + tag 16 bytes di akhir)
    if ciphertext_with_tag.len() < 16 {
        return Err("Ciphertext too short".to_string());
    }
    let (ciphertext, tag) = ciphertext_with_tag.split_at(ciphertext_with_tag.len() - 16);

    use aes_gcm::{Aes256Gcm, Key, Nonce, aead::{Aead, KeyInit}};
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Nonce::from_slice(&iv);
    let mut payload = ciphertext.to_vec();
    payload.extend_from_slice(tag);
    let plaintext = cipher.decrypt(nonce, payload.as_ref())
        .map_err(|_| "Decrypt failed: wrong PIN or corrupted file".to_string())?;

    // plaintext = PKCS#8 DER private key
    // Convert ke JWK untuk Web Crypto API
    let private_key_jwk = pkcs8_der_to_jwk(&plaintext, &token.alg)?;

    Ok(DecryptResponse {
        private_key_jwk,
        public_key_spki: pk_b64url,
        credential_id: compute_credential_id(&pk_for_cred)?,
    })
}

/// Convert PKCS#8 DER (ECDSA P-256) ke JWK
fn pkcs8_der_to_jwk(der: &[u8], alg: &str) -> Result<serde_json::Value, String> {
    use p256::pkcs8::DecodePrivateKey;
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

    // Parse PKCS#8 private key menggunakan p256
    let signing_key = p256::ecdsa::SigningKey::from_pkcs8_der(der)
        .map_err(|e| format!("Parse PKCS#8: {}", e))?;

    // Get private key (d) - 32 bytes
    let d = signing_key.to_bytes();
    if d.len() != 32 {
        return Err("Invalid private key length".to_string());
    }

    // Get public key (X, Y) - uncompressed
    let verifying_key = signing_key.verifying_key();
    let encoded_point = verifying_key.to_encoded_point(false); // false = uncompressed
    let pub_bytes = encoded_point.as_bytes();
    
    if pub_bytes.len() != 65 || pub_bytes[0] != 0x04 {
        return Err("Invalid public key format".to_string());
    }
    let x = &pub_bytes[1..33];
    let y = &pub_bytes[33..65];

    Ok(serde_json::json!({
        "kty": "EC",
        "crv": "P-256",
        "alg": alg,
        "d": URL_SAFE_NO_PAD.encode(d),
        "x": URL_SAFE_NO_PAD.encode(x),
        "y": URL_SAFE_NO_PAD.encode(y),
        "ext": true,
        "key_ops": ["sign"]
    }))
}