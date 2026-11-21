use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{Manager, RunEvent};

// USB Token module
mod usb_token;
use usb_token::{create_usb_token_file, decrypt_usb_token_private_key, list_usb_drives, scan_usb_tokens, start_usb_monitor};

/// Child process PHP server - di-kill saat aplikasi ditutup.
struct PhpServer(Mutex<Option<Child>>);

/// Log file app (bukan log PHP).
struct AppLog(Mutex<std::fs::File>);

/// Konfigurasi runtime aplikasi (disimpan di app_config.json).
/// `mode`: client (tanpa PHP lokal) · standalone (PHP 127.0.0.1) · server (PHP 0.0.0.0).
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    mode: String,
    server_url: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        // Debug build tetap menjalankan backend lokal agar `tauri dev` langsung jalan.
        // Release build default client; frontend menulis alamat build-time saat start.
        AppConfig {
            mode: if cfg!(debug_assertions) {
                "standalone".to_string()
            } else {
                "client".to_string()
            },
            server_url: String::new(),
        }
    }
}

/// Log dari frontend (diagnostik kamera, error, dll.)
#[tauri::command]
fn log_from_frontend(app: tauri::AppHandle, message: String) {
    if let Some(log) = app.try_state::<AppLog>() {
        app_log(&log, &format!("[UI] {}", message));
    }
}

/// Baca konfigurasi runtime untuk frontend.
#[tauri::command]
fn get_app_config(app: tauri::AppHandle) -> AppConfig {
    load_app_config(&app)
}

/// Deteksi IPv4 LAN laptop ini, untuk saran alamat server di halaman /__server.
#[tauri::command]
fn get_lan_ip() -> Option<String> {
    use std::net::UdpSocket;

    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    // UDP connect tidak mengirim paket; hanya membaca interface dari routing table.
    socket.connect("8.8.8.8:80").ok()?;
    let ip = socket.local_addr().ok()?.ip();

    if ip.is_loopback() || ip.is_unspecified() {
        None
    } else {
        Some(ip.to_string())
    }
}

/// Simpan konfigurasi runtime. Kalau mode berubah, backend PHP di-restart.
#[tauri::command]
fn set_app_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let mode = config.mode.trim().to_lowercase();
    if !matches!(mode.as_str(), "client" | "server" | "standalone") {
        return Err("Mode harus client, server, atau standalone.".to_string());
    }

    let server_url = config.server_url.trim().trim_end_matches('/').to_string();
    if server_url.is_empty()
        || !(server_url.starts_with("http://") || server_url.starts_with("https://"))
    {
        return Err("Alamat server harus diawali http:// atau https://.".to_string());
    }

    let next = AppConfig { mode, server_url };
    let previous = load_app_config(&app);

    let running = php_running(&app);
    let restart = previous.mode != next.mode
        || (next.mode == "client" && running)
        || (next.mode != "client" && !running);

    // Siapkan/validasi backend dulu; kalau gagal, config lama tidak ditimpa.
    if restart {
        restart_php_backend(&app, &next)?;
    }

    save_app_config(&app, &next)?;

    if let Some(log) = app.try_state::<AppLog>() {
        app_log(
            &log,
            &format!("[config] disimpan mode={} server_url={}", next.mode, next.server_url),
        );
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        // Auto-allow kamera & mikrofon untuk WebView2 (terutama pada production/MSI build)
        .on_permission_request(|_webview, kind| {
            match kind {
                PermissionKind::Camera | PermissionKind::Microphone => {
                    eprintln!("[TrueCount] Izin diberikan otomatis untuk: {kind:?}");
                    PermissionResponse::Allow
                }
                _ => PermissionResponse::Default,
            }
        })
        .setup(|app| {
            // ── Siapkan logger ──────────────────────────────────────────
            let log_dir = pin_data_dir(
                app.path()
                    .app_log_dir()
                    .unwrap_or_else(|_| std::env::temp_dir().join("truecount")),
            );
            if let Err(e) = fs::create_dir_all(&log_dir) {
                eprintln!("[TrueCount] Gagal buat folder log: {e}");
            }
            let log_path = log_dir.join("truecount.log");
            match OpenOptions::new().create(true).append(true).open(&log_path) {
                Ok(file) => {
                    let log = AppLog(Mutex::new(file));
                    app_log(&log, &format!("=== TrueCount start | exe: {:?} ===", std::env::current_exe()));
                    app_log(&log, &format!("log_dir: {}", log_dir.display()));
                    app.manage(log);
                }
                Err(e) => eprintln!("[TrueCount] Gagal buka log file: {e}"),
            }

            // ── Siapkan state PHP + baca config runtime ────────────────
            app.manage(PhpServer(Mutex::new(None)));

            let config = load_app_config(app.handle());
            save_app_config(app.handle(), &config).ok();
            if let Some(log) = app.try_state::<AppLog>() {
                app_log(
                    &log,
                    &format!(
                        "[config] mode={} server_url={}",
                        config.mode,
                        if config.server_url.is_empty() { "(build default)" } else { &config.server_url }
                    ),
                );
            }

            if let Err(e) = spawn_php_backend(app.handle(), &config) {
                if let Some(log) = app.try_state::<AppLog>() {
                    app_log(&log, &format!("[spawn] gagal menyiapkan backend: {e}"));
                }
                eprintln!("[TrueCount] gagal menyiapkan backend: {e}");
            }

            // ── Start USB Token Monitor ────────────────────────────────
            start_usb_monitor(app.handle().clone());

            // Buka DevTools otomatis di debug build
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            decrypt_usb_token_private_key,
            scan_usb_tokens,
            list_usb_drives,
            create_usb_token_file,
            log_from_frontend,
            get_app_config,
            get_lan_ip,
            set_app_config
        ])
        .build(tauri::generate_context!())
        .expect("error saat menjalankan aplikasi TrueCount")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                // Matikan PHP server saat aplikasi keluar
                if let Some(state) = app_handle.try_state::<PhpServer>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
                if let Some(log) = app_handle.try_state::<AppLog>() {
                    app_log(&log, "=== TrueCount exit ===");
                }
            }
        });
}

/// Tulis satu baris ke log app.
fn app_log(log: &AppLog, msg: &str) {
    if let Ok(mut file) = log.0.lock() {
        let _ = writeln!(file, "{}", msg);
        let _ = file.flush();
    }
}

/// Cek apakah port sudah dipakai (server sudah jalan).
fn port_in_use(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{port}").parse().unwrap(),
        Duration::from_millis(300),
    )
    .is_ok()
}

/// Hapus prefix `\\?\` (Windows extended-length path) yang tidak dimengerti PHP.
fn clean_path(path: &std::path::Path) -> PathBuf {
    let s = path.display().to_string();
    match s.strip_prefix(r"\\?\") {
        Some(rest) => PathBuf::from(rest),
        None => path.to_path_buf(),
    }
}

/// Identifier bundle pada `tauri.conf.json`. Sengaja tidak berakhiran `.app`
/// (Tauri memperingatkan konflik dengan ekstensi bundle macOS).
const BUNDLE_IDENTIFIER: &str = "com.truecount.desktop";

/// Nama folder data yang dipertahankan agar instalasi lama tetap menemukan
/// config, `.env`, backend, dan logs di `%APPDATA%\com.truecount.app` (lihat docs).
const DATA_DIR_NAME: &str = "com.truecount.app";

/// `app_config_dir` / `app_log_dir` memakai identifier sebagai salah satu segmen
/// path-nya. Ganti segmen itu dengan `DATA_DIR_NAME` supaya lokasi data tidak
/// ikut berpindah saat identifier diperbaiki.
fn pin_data_dir(path: PathBuf) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::Normal(name) if name == BUNDLE_IDENTIFIER => out.push(DATA_DIR_NAME),
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Lokasi file konfigurasi runtime.
fn app_config_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| pin_data_dir(dir).join("app_config.json"))
}

/// Baca config dari disk. File kosong/rusak → default build.
fn load_app_config(app: &tauri::AppHandle) -> AppConfig {
    let Some(path) = app_config_path(app) else {
        return AppConfig::default();
    };
    let Ok(raw) = fs::read_to_string(&path) else {
        return AppConfig::default();
    };
    let Ok(parsed) = serde_json::from_str::<AppConfig>(&raw) else {
        return AppConfig::default();
    };

    let mode = parsed.mode.trim().to_lowercase();
    if !matches!(mode.as_str(), "client" | "server" | "standalone") {
        return AppConfig::default();
    }

    AppConfig {
        mode,
        server_url: parsed.server_url.trim().trim_end_matches('/').to_string(),
    }
}

/// Tulis config ke disk (buat foldernya kalau belum ada).
fn save_app_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = app_config_path(app).ok_or("Folder config aplikasi tidak tersedia.")?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("Gagal membuat folder config: {e}"))?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| format!("Gagal encode config: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("Gagal menulis config: {e}"))
}

/// Apakah child PHP masih hidup?
fn php_running(app: &tauri::AppHandle) -> bool {
    if let Some(state) = app.try_state::<PhpServer>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.as_mut() {
                return matches!(child.try_wait(), Ok(None));
            }
        }
    }
    false
}

/// Matikan PHP lokal (kalau ada) dan tunggu port benar-benar bebas.
fn stop_php_backend(app: &tauri::AppHandle) {
    let mut killed = false;
    if let Some(state) = app.try_state::<PhpServer>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
                killed = true;
            }
        }
    }

    if !killed {
        return;
    }

    for _ in 0..20 {
        if !port_in_use(8000) {
            return;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

/// Restart PHP sesuai mode pada config.
fn restart_php_backend(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    stop_php_backend(app);
    spawn_php_backend(app, config)
}

/// Folder konfigurasi aplikasi yang writable (mis. %APPDATA%\com.truecount.app).
fn runtime_root(app: &tauri::AppHandle) -> PathBuf {
    pin_data_dir(
        app.path()
            .app_config_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join(DATA_DIR_NAME)),
    )
}

/// Salin backend ke folder writable agar upload/log tidak menulis ke Program Files.
/// Saat update versi, file data (storage/uploads) yang sudah ada tidak ditimpa.
fn copy_backend_dir(src: &Path, dst: &Path, preserve_data: bool) -> std::io::Result<()> {
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dest = dst.join(entry.file_name());
        let rel = path
            .strip_prefix(src)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            fs::create_dir_all(&dest)?;
            copy_backend_dir(&path, &dest, preserve_data)?;
            continue;
        }

        // Log lama tidak perlu ikut; kredensial tetap dibaca dari TC_ENV_PATH.
        if rel.starts_with("storage/logs/") || rel == ".env" {
            continue;
        }

        // Jangan timpa data pengguna saat backend di-update.
        if preserve_data
            && (rel.starts_with("storage/") || rel.starts_with("uploads/"))
            && dest.exists()
        {
            continue;
        }

        fs::copy(&path, &dest)?;
    }
    Ok(())
}

/// Siapkan backend writable + path .env untuk PHP.
/// Return: (folder backend, path .env)
fn prepare_runtime_backend(
    app: &tauri::AppHandle,
    source: &Path,
) -> Result<(PathBuf, PathBuf), String> {
    let root = runtime_root(app);
    fs::create_dir_all(&root).map_err(|e| format!("Gagal membuat folder aplikasi: {e}"))?;

    // ── .env: pakai yang sudah ada di folder aplikasi, atau ambil dari repo/installer ──
    let env_path = root.join(".env");
    if !env_path.exists() {
        let mut candidates: Vec<PathBuf> = vec![source.join(".env")];
        let mut cursor = source.parent();
        for _ in 0..4 {
            let Some(dir) = cursor else { break };
            candidates.push(dir.join(".env"));
            cursor = dir.parent();
        }

        if let Some(found) = candidates.into_iter().find(|p| p.is_file()) {
            fs::copy(&found, &env_path).map_err(|e| {
                format!("Gagal menyalin .env ke {}: {e}", env_path.display())
            })?;
        }
    }

    if !env_path.exists() {
        return Err(format!(
            "Konfigurasi server belum ada. Salin file .env ke {} lalu pilih mode Server lagi.",
            env_path.display()
        ));
    }

    // ── Backend writable ──
    // Selalu salin kode backend agar perubahan kode terbaru ikut terpakai.
    // Data (storage/uploads) tidak ditimpa — hanya file yang belum ada di dest.
    let target = root.join("backend");
    let version = env!("CARGO_PKG_VERSION");

    fs::create_dir_all(&target).map_err(|e| format!("Gagal membuat folder backend: {e}"))?;
    copy_backend_dir(source, &target, true).map_err(|e| {
        format!(
            "Gagal menyalin backend dari {} ke {}: {e}",
            source.display(),
            target.display()
        )
    })?;
    let _ = fs::write(root.join("backend.version"), version);

    for dir in [
        "storage/logs",
        "storage/private/encrypted-files",
        "storage/auth_photos",
        "uploads/candidates",
    ] {
        fs::create_dir_all(target.join(dir))
            .map_err(|e| format!("Gagal membuat folder {dir}: {e}"))?;
    }

    Ok((target, env_path))
}

/// Jalankan PHP backend sesuai mode: client = tidak jalan, standalone = 127.0.0.1,
/// server = 0.0.0.0 (bisa diakses PC lain di LAN).
fn spawn_php_backend(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let log_dir = pin_data_dir(
        app.path()
            .app_log_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("truecount")),
    );

    let log_state = app.try_state::<AppLog>();
    let note = |msg: &str| {
        if let Some(log) = log_state.as_ref() {
            app_log(log, msg);
        }
        eprintln!("[TrueCount] {msg}");
    };

    let bind_addr = match config.mode.as_str() {
        "server" => "0.0.0.0:8000",
        "standalone" => "127.0.0.1:8000",
        _ => {
            note("[spawn] Mode client - backend PHP lokal tidak dijalankan.");
            return Ok(());
        }
    };

    // Jangan spawn kalau backend sudah jalan
    if port_in_use(8000) {
        note("[spawn] Port 8000 sudah dipakai - backend sudah jalan, skip spawn.");
        return Ok(());
    }
    note(&format!("[spawn] Port 8000 bebas - spawn PHP di {bind_addr}..."));

    let source_dir = clean_path(&resolve_backend_dir(app));
    note(&format!("[spawn] backend sumber: {}", source_dir.display()));

    if !source_dir.join("index.php").exists() {
        let msg = format!("index.php tidak ditemukan di {}", source_dir.display());
        note(&format!("[spawn] ERROR: {msg}"));
        return Err(msg);
    }

    let (backend_dir, env_path) = prepare_runtime_backend(app, &source_dir)?;
    note(&format!("[spawn] backend runtime: {}", backend_dir.display()));
    note(&format!("[spawn] env: {}", env_path.display()));

    let router = backend_dir.join("index.php");
    if !router.exists() {
        let msg = format!("index.php tidak ditemukan di {}", backend_dir.display());
        note(&format!("[spawn] ERROR: {msg}"));
        return Err(msg);
    }

    let mut cmd = Command::new("php");
    cmd.env("TC_ENV_PATH", &env_path);
    cmd.args(["-S", bind_addr, "-t"])
        .arg(&backend_dir)
        .arg(&router);

    // Sembunyikan window konsol PHP di Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    // Arahkan output PHP ke php.log agar error-nya terlihat
    match OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("php.log"))
    {
        Ok(file) => {
            if let Ok(stdout) = file.try_clone() {
                cmd.stdout(Stdio::from(file));
                cmd.stderr(Stdio::from(stdout));
            }
        }
        Err(e) => note(&format!("[spawn] WARN: tidak bisa buka php.log: {e}")),
    }

    match cmd.spawn() {
        Ok(child) => {
            note(&format!("[spawn] PHP berhasil di-spawn di {bind_addr} (pid {})", child.id()));
            if let Some(state) = app.try_state::<PhpServer>() {
                if let Ok(mut guard) = state.0.lock() {
                    *guard = Some(child);
                    return Ok(());
                }
            }
            // State tidak tersedia (seharusnya tidak terjadi): bunuh agar tidak zombie.
            let mut child = child;
            let _ = child.kill();
            Err("Gagal menyimpan proses PHP.".to_string())
        }
        Err(e) => {
            note(&format!("[spawn] ERROR: gagal menjalankan `php`: {e}"));
            note("[spawn] Cek: apakah `php` ada di PATH? (coba `where php` di terminal)");
            Err(format!(
                "Gagal menjalankan PHP: {e}. Pastikan `php` ada di PATH."
            ))
        }
    }
}

/// Cari folder backend dari beberapa kandidat lokasi.
fn resolve_backend_dir(app: &tauri::AppHandle) -> PathBuf {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1) Berbasis lokasi exe (raw exe dari target/release atau target/debug)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // release/debug → target → src-tauri → frontend → repo root
            candidates.push(dir.join("../../../../backend"));
            candidates.push(dir.join("../../../backend"));
            candidates.push(dir.join("../../backend"));
            candidates.push(dir.join("backend"));
        }
    }

    // 2) Berbasis working directory
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("backend"));
        candidates.push(cwd.join("../../backend"));
    }

    // 3) Folder backend di resource dir (installer / hasil salin Tauri).
    //    Saat `tauri dev`, resource disalin ke `target/debug/backend` dan bisa
    //    tertinggal dari kode di repo. Di debug, taruh paling akhir supaya
    //    backend sumber di repo yang dipakai; di release tetap paling utama.
    if let Ok(dir) = app
        .path()
        .resolve("backend", tauri::path::BaseDirectory::Resource)
    {
        if cfg!(debug_assertions) {
            candidates.push(dir);
        } else {
            candidates.insert(0, dir);
        }
    }

    let log_state = app.try_state::<AppLog>();
    if let Some(log) = log_state {
        for c in &candidates {
            app_log(&log, &format!("[spawn] kandidat: {} (index.php={})", c.display(), c.join("index.php").exists()));
        }
    }

    for c in candidates {
        if c.join("index.php").exists() {
            return c;
        }
    }

    // Fallback: resource dir (biar error message selanjutnya jelas)
    app.path()
        .resolve("backend", tauri::path::BaseDirectory::Resource)
        .unwrap_or_default()
}
