use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, RunEvent};

/// Child process PHP server — di-kill saat aplikasi ditutup.
struct PhpServer(Mutex<Option<Child>>);

/// Log file app (bukan log PHP).
struct AppLog(Mutex<std::fs::File>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::<tauri::Wry>::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // ── Siapkan logger ──────────────────────────────────────────
            let log_dir = app
                .path()
                .app_log_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("truecount"));
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

            // ── Spawn backend PHP ──────────────────────────────────────
            spawn_php_backend(app.handle());

            // Buka DevTools otomatis di debug build
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
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

/// Jalankan PHP backend di 127.0.0.1:8000 tanpa window konsol.
fn spawn_php_backend(app: &tauri::AppHandle) {
    let log_dir = app
        .path()
        .app_log_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("truecount"));

    let log_state = app.try_state::<AppLog>();
    let note = |msg: &str| {
        if let Some(log) = log_state.as_ref() {
            app_log(log, msg);
        }
        eprintln!("[TrueCount] {msg}");
    };

    // Jangan spawn kalau backend sudah jalan
    if port_in_use(8000) {
        note("[spawn] Port 8000 sudah dipakai — backend sudah jalan, skip spawn.");
        return;
    }
    note("[spawn] Port 8000 bebas — mencoba spawn PHP...");

    let backend_dir = clean_path(&resolve_backend_dir(app));
    note(&format!("[spawn] backend_dir terpilih: {}", backend_dir.display()));

    let router = backend_dir.join("index.php");
    if !router.exists() {
        note(&format!("[spawn] ERROR: index.php tidak ditemukan di {}", backend_dir.display()));
        return;
    }

    let mut cmd = Command::new("php");
    cmd.args(["-S", "127.0.0.1:8000", "-t"])
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
            note(&format!("[spawn] PHP berhasil di-spawn (pid {})", child.id()));
            app.manage(PhpServer(Mutex::new(Some(child))));
        }
        Err(e) => {
            note(&format!("[spawn] ERROR: gagal menjalankan `php`: {e}"));
            note("[spawn] Cek: apakah `php` ada di PATH? (coba `where php` di terminal)");
        }
    }
}

/// Cari folder backend dari beberapa kandidat lokasi.
fn resolve_backend_dir(app: &tauri::AppHandle) -> PathBuf {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1) Production: folder backend di dalam resource dir (installer)
    if let Ok(dir) = app
        .path()
        .resolve("backend", tauri::path::BaseDirectory::Resource)
    {
        candidates.push(dir);
    }

    // 2) Berbasis lokasi exe (raw exe dari target/release atau target/debug)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            // release/debug → target → src-tauri → frontend → repo root
            candidates.push(dir.join("../../../../backend"));
            candidates.push(dir.join("../../../backend"));
            candidates.push(dir.join("../../backend"));
            candidates.push(dir.join("backend"));
        }
    }

    // 3) Berbasis working directory
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("backend"));
        candidates.push(cwd.join("../../backend"));
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
