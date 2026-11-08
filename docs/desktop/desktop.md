# TrueCount - Panduan Desktop (Tauri)

Dokumen ini menjelaskan cara mengkonversi TrueCount dari web app menjadi aplikasi desktop native menggunakan **Tauri v2** (pembungkus Rust ringan - jauh lebih kecil dari Electron).

---

## Arsitektur Desktop

```
┌─────────────────────────────────────────┐
│  Tauri Window (native OS frame)         │
│  ┌───────────────────────────────────┐  │
│  │  WebView (React + Vite)           │  │
│  │  fetch() → localhost:8000 (PHP)   │  │
│  └───────────────────────────────────┘  │
│  Rust backend                          │
│    └─ spawn otomatis: php -S 8000      │
└─────────────────────────────────────────┘
         ↕
    PHP built-in server
    (di-spawn otomatis oleh Rust saat app start)
```

> **Catatan:** Backend PHP di-spawn otomatis oleh Rust saat aplikasi dijalankan
> (dengan `CREATE_NO_WINDOW`, tanpa konsol), dan di-kill saat app ditutup.
> Folder `backend/` di-bundle ke dalam installer sebagai resource Tauri.
> Syarat: `php` harus terinstall di sistem user dan ada di PATH.

---

## Prasyarat

### 1. Rust & Cargo

```bash
# Semua platform
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable
```

### 2. Build Tools per Platform

| Platform | Kebutuhan |
| --- | --- |
| **Windows** | [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) atau Visual Studio dengan "Desktop development with C++" |
| **macOS** | `xcode-select --install` |
| **Linux** | `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libayatana-appindicator3-dev librsvg2-dev` |

Panduan resmi: [https://v2.tauri.app/start/prerequisites/](https://v2.tauri.app/start/prerequisites/)

### 3. Verifikasi

```bash
rustc --version
cargo --version
php --version     # wajib - dipakai untuk spawn backend otomatis
```

---

## Struktur File Tauri (sudah ada di repo)

```
frontend/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Entry point + windows_subsystem (tanpa konsol)
│   │   └── lib.rs           # App builder + auto-spawn PHP + logger
│   ├── icons/               # ✅ Sudah terisi (generate dari raise_hand.jpg)
│   ├── tauri.conf.json      # Konfigurasi window, bundle, resources (backend)
│   ├── Cargo.toml           # Dependensi Rust (tauri: wry, default-features=false)
│   └── build.rs             # Build script
└── package.json             # Script: desktop:dev · desktop:build
```

---

## Cara Menjalankan (Dev Mode)

```bash
# Cukup satu terminal - PHP backend di-spawn otomatis oleh app
cd frontend
npm run desktop:dev
```

Vite dev server berjalan di `http://127.0.0.1:5173`, Tauri membuka window yang menunjuk ke sana.
Hot reload React tetap berfungsi seperti biasa.

> Jika port 8000 sudah dipakai (misal kamu menjalankan `php -S` manual untuk web dev),
> app akan memakai server yang sudah ada dan tidak spawn yang baru.
> Kalau tetap ingin menjalankan PHP manual: `php -S localhost:8000 -t backend backend/index.php`.

---

## Cara Build Installer

```bash
cd frontend
npm run desktop:build
```

Output ada di `frontend/src-tauri/target/release/bundle/`:

| Platform | Output |
|---|---|
| Windows  | `msi/TrueCount_x.x.x_x64_en-US.msi` dan `nsis/TrueCount_x.x.x_x64-setup.exe` |
| macOS    | `dmg/TrueCount_x.x.x_x64.dmg` |
| Linux    | `deb/truecount_x.x.x_amd64.deb` dan `rpm/truecount-x.x.x.x86_64.rpm` |

---

## Konfigurasi Window (`tauri.conf.json`)

```json
"app": {
  "windows": [{
    "title": "TrueCount - Secure E-Voting",
    "width": 1280,
    "height": 800,
    "minWidth": 900,
    "minHeight": 600,
    "resizable": true,
    "center": true
  }]
}
```

Untuk mengubah ukuran default, edit nilai `width`/`height` di [`frontend/src-tauri/tauri.conf.json`](../frontend/src-tauri/tauri.conf.json).

---

## Menambahkan Icon Aplikasi

> ✅ **Sudah selesai** - icons sudah di-generate dari `frontend/public/raise_hand.jpg`
> dengan perintah di bawah. Skip seksi ini kecuali mau ganti logo.

File di `frontend/src-tauri/icons/` dengan nama persis:

```
icons/
├── 32x32.png
├── 128x128.png
├── 128x128@2x.png
├── icon.icns     (macOS)
└── icon.ico      (Windows)
```

Cara generate ulang - gunakan CLI Tauri:

```bash
# Siapkan satu file PNG 1024×1024 sebagai source.
# Kalau source tidak square, tambahkan --fit cover / --fit contain.
cd frontend
npx tauri icon path/to/icon-1024.png
npx tauri icon public/raise_hand.jpg --fit cover
```

---

## Auto-start PHP dari Tauri - ✅ Sudah Diimplementasi

PHP backend sekarang di-spawn otomatis di `lib.rs` (bukan lagi rencana Sprint 4+).
Ringkasan perilaku:

1. **Cek port** - kalau `127.0.0.1:8000` sudah ada server, spawn di-skip.
2. **Cari folder backend** - urutan: resource dir (installer) → relatif lokasi exe → cwd (dev).
3. **Spawn** - `php -S 127.0.0.1:8000 -t <backend> <backend>/index.php` dengan
   `CREATE_NO_WINDOW` (Windows) sehingga tidak muncul konsol.
4. **Cleanup** - saat app keluar (`RunEvent::Exit`), child PHP di-kill.
5. **Path `\\?\`** - Tauri mengembalikan extended-length path; prefix `\\?\`
   di-strip dulu, karena PHP tidak bisa membuka file dengan prefix itu.
6. **Output PHP** diarahkan ke `php.log` (lihat bawah).

```rust
// src-tauri/src/lib.rs (ringkasan)
if port_in_use(8000) { return; }                      // skip kalau sudah jalan
let dir = clean_path(&resolve_backend_dir(app));      // hapus prefix \\?\
Command::new("php")
    .args(["-S", "127.0.0.1:8000", "-t"])
    .arg(&dir).arg(dir.join("index.php"))
    .creation_flags(0x08000000)                       // CREATE_NO_WINDOW
    .spawn();
```

> **Syarat:** `php` harus terinstall di mesin user dan ada di PATH.
> Bundling `php.exe` sebagai sidecar binary masih merupakan rencana (Sprint 4).

### Konfigurasi penting yang sudah diterapkan

| File | Setting | Alasan |
| --- | --- | --- |
| `Cargo.toml` | `tauri = { features = ["wry"], default-features = false }` | Fitur `dialog` Tauri butuh `TaskDialogIndirect` yang tidak ada di Windows lama → error "Entry Point Not Found" |
| `main.rs` | `windows_subsystem = "windows"` | Release build tanpa window konsol |
| `lib.rs` | `tauri::Builder::<tauri::Wry>::default()` | Type runtime explicit karena `default-features = false` |
| `tauri.conf.json` | `"resources": { "../../backend": "backend" }` | Folder backend ikut ter-bundle di installer |
| `vite.config.js` | `minify: 'terser'`, target `['es2020', 'chrome90', 'safari13']` | Vite 8 tidak bundle esbuild lagi; minifier esbuild & target lama tidak kompatibel |
| `backend/helpers/response.php` | CORS multi-origin | WebView Tauri kirim origin `http://tauri.localhost` (Windows) / `tauri://localhost` (macOS/Linux) |

### Logging

| File | Lokasi | Isi |
| --- | --- | --- |
| `truecount.log` | `%LOCALAPPDATA%\com.truecount.app\logs\` (Windows) | Log app: exe path, kandidat folder backend, hasil spawn |
| `php.log` | `%LOCALAPPDATA%\com.truecount.app\logs\` (Windows) | Output PHP server - error DB, PHP warning, fatal error |

Kalau muncul "Tidak dapat terhubung ke server", cek kedua file ini - biasanya penyebabnya
langsung terlihat (PHP tidak ditemukan, port bentrok, atau error koneksi MySQL).

---

## Perbedaan Web vs Desktop

| Aspek | Web | Desktop (Tauri) |
| --- | --- | --- |
| Distribusi | URL | Installer .exe/.dmg/.deb |
| Offline | Perlu server | ✅ Auto-spawn PHP (syarat: `php` ada di PATH user) |
| Update | Deploy ulang | Tauri Updater plugin |
| Ukuran binary | - | ~6–15 MB (jauh lebih kecil dari Electron ~120 MB) |
| Performance | Browser | WebView native OS |
| `window.localStorage` | ✅ | ✅ |
| Native dialog/file | ❌ | ✅ via Tauri plugins |

---

## Checklist Sebelum Build Production

- [x] Isi semua file icon di `src-tauri/icons/` (dari `raise_hand.jpg`)
- [x] Backend URL frontend `LoginPage.jsx` / `RegisterPage.jsx` → `http://localhost:8000`
- [ ] Ganti `identifier` di `tauri.conf.json` jika dipublikasikan (`com.namakamu.truecount`)
- [ ] Pastikan `php` terinstall & ada di PATH mesin target
- [ ] `npm run build` berhasil tanpa error sebelum `desktop:build`
- [ ] Test di OS target sebelum distribusi

---

## Troubleshooting Desktop

| Masalah | Penyebab umum | Solusi |
| --- | --- | --- |
| "Tidak dapat terhubung ke server" | PHP gagal spawn / error backend | Cek `%LOCALAPPDATA%\com.truecount.app\logs\truecount.log` dan `php.log` |
| Log: "gagal menjalankan `php`" | `php` tidak ada di PATH | Install PHP 8.1+ dan pastikan `where php` ditemukan |
| Log: `Failed opening required '\\?\C:\...'` | Extended path belum di-strip | Pastikan `clean_path()` dipanggil sebelum spawn (sudah di `lib.rs`) |
| "Entry Point Not Found: TaskDialogIndirect" | Fitur `dialog` Tauri aktif (Windows lama) | Pastikan `default-features = false` di `Cargo.toml` |
| Build error `transformWithEsbuild` / `esbuild` | Vite 8 tidak bundle esbuild | `npm install -D esbuild terser` di `frontend/` |
| Build error transform destructuring | Target build terlalu lama (`es2021`) | Pakai target `['es2020', 'chrome90', 'safari13']` di `vite.config.js` |
| Build gagal `Couldn't find a .ico icon` | Folder `icons/` kosong | `npx tauri icon public/raise_hand.jpg --fit cover` |
| Tombol "Dongle Keamanan" disabled di login (desktop) | Deteksi `isTauri` pakai `window.__TAURI__` yang butuh `withGlobalTauri: true` (belum ada di `tauri.conf.json`) | Sudah fix di `LoginPage.jsx` baris 355: ganti ke `'__TAURI_INTERNALS__' in window` (selalu tersedia di Tauri) |
| Terminal muncul-menutup tiap detik (Windows) | `list_removable_drives()` jalankan PowerShell tanpa `CREATE_NO_WINDOW`, jadi jendela konsol muncul saat scan USB tiap 2 detik | Sudah fix di `usb_token.rs`: tambah `cmd.creation_flags(0x08000000)` |
| Icon app masih default | Icon di `src-tauri/icons/` masih default Tauri | Copy `public/icon/TrueCount_logo_transparent.png` → `src-tauri/icons/icon.png`, lalu `npx tauri icon src-tauri/icons/icon.png` untuk generate `.ico`/`.icns` dll. |
