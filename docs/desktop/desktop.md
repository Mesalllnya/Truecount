# TrueCount - Panduan Desktop (Tauri)

Dokumen ini menjelaskan cara mengkonversi TrueCount dari web app menjadi aplikasi desktop native menggunakan **Tauri v2** (pembungkus Rust ringan - jauh lebih kecil dari Electron).

---

## Arsitektur Desktop

```
┌─────────────────────────────────────────┐
│  Tauri Window (native OS frame)         │
│  ┌───────────────────────────────────┐  │
│  │  WebView (React + Vite)           │  │
│  │  fetch() → alamat server (LAN)    │  │
│  └───────────────────────────────────┘  │
│  Rust backend                          │
│    └─ spawn PHP sesuai mode            │
└─────────────────────────────────────────┘
         ↕ (client: lewat LAN)
    PHP server di laptop penyelenggara
```

> **Catatan:** Rust membaca `app_config.json` saat start dan menentukan perilaku:
> - **Client** - tidak spawn PHP; semua request ke laptop server.
> - **Server** - spawn `php -S 0.0.0.0:8000` agar bisa diakses PC lain di LAN.
> - **Standalone** - spawn `php -S 127.0.0.1:8000` hanya untuk laptop itu.
>
> Folder `backend/` di-bundle ke installer sebagai resource Tauri. Syarat mode
> server/standalone: `php` terinstall dan ada di PATH.

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

## Konfigurasi Runtime: Client / Server / Standalone

Alamat server disimpan di `app_config.json`, bukan di dalam kode. Jadi satu installer
bisa dipakai untuk laptop server maupun PC peserta, dan alamatnya bisa diubah tanpa build ulang.

| Mode | PHP lokal | Bind | Dipakai untuk |
| --- | --- | --- | --- |
| `client` | tidak dijalankan | - | PC peserta, request ke laptop server |
| `server` | dijalankan | `0.0.0.0:8000` | Laptop penyelenggara (bisa diakses LAN) |
| `standalone` | dijalankan | `127.0.0.1:8000` | Laptop tunggal / dev |

### Cara membuka halaman config

Halaman `/__server` sengaja tidak punya link di navigasi:

- **Keyboard:** `Ctrl + Shift + Alt + S` (berlaku di route mana pun).
- **Console DevTools:** `__tcServerConfig()`.

Isi alamat (host + port saja), tekan **Tes koneksi**, lalu **Simpan & muat ulang**.
Tes koneksi memanggil `/health` dan menampilkan `server_label`, `server_id`,
status database, dan waktu server.

### Lokasi & isi file

| OS | Lokasi |
| --- | --- |
| Windows | `%APPDATA%\com.truecount.app\app_config.json` |
| macOS | `~/Library/Application Support/com.truecount.app/app_config.json` |
| Linux | `~/.config/com.truecount.app/app_config.json` |

```json
{
  "mode": "client",
  "serverUrl": "http://192.168.2.102:8000"
}
```

File ini hanya menyimpan alamat server. Kredensial database dan `.env` **tidak**
pernah ikut ke client.

### Default saat build

`frontend/.env` (jangan di-commit):

```env
VITE_DEFAULT_SERVER_URL=http://192.168.2.102:8000
# VITE_DEFAULT_MODE=client
```

- Production build default `client`; dev build (`npm run dev` / `desktop:dev`) default `standalone`.
- Kalau `app_config.json` belum ada, frontend memakai `VITE_DEFAULT_SERVER_URL`.
- Nilai yang sudah disimpan lewat halaman config menang atas default build.
- Mode `standalone` selalu memakai `http://localhost:8000`, karena PHP hanya listen loopback.

### Perubahan saat mode disimpan

`set_app_config` di Rust akan:

1. Menulis `app_config.json`.
2. Menghentikan child PHP lama (kalau ada) dan menunggu port 8000 bebas.
3. Menjalankan ulang PHP hanya kalau mode berubah, atau PHP seharusnya jalan tapi mati.
4. Mode `client` tidak menjalankan PHP sama sekali.

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

> ✅ **Sudah selesai** - icons sudah di-generate dari `frontend/public/icon/TrueCount_logo_transparent.png`
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
npx tauri icon public/icon/TrueCount_logo_transparent.png --fit cover
```

---

## Auto-start PHP dari Tauri - ✅ Sudah Diimplementasi (mode-aware)

PHP backend di-spawn otomatis di `lib.rs`, tetapi sekarang mengikuti `app_config.json`:

1. **Baca config** - `app_config.json`; kalau belum ada pakai default build.
2. **Tentukan bind** - `client` = tidak spawn, `server` = `0.0.0.0:8000`,
   `standalone` = `127.0.0.1:8000`.
3. **Cek port** - kalau `127.0.0.1:8000` sudah ada server, spawn di-skip.
4. **Cari folder backend** - urutan: resource dir (installer) → relatif lokasi exe → cwd (dev).
5. **Spawn** - `php -S <bind> -t <backend> <backend>/index.php` dengan
   `CREATE_NO_WINDOW` (Windows) sehingga tidak muncul konsol.
6. **Cleanup** - saat app keluar (`RunEvent::Exit`), child PHP di-kill.

```rust
// src-tauri/src/lib.rs (ringkasan)
let config = load_app_config(app.handle());           // client|server|standalone
let bind = match config.mode.as_str() {
    "server" => "0.0.0.0:8000",
    "standalone" => "127.0.0.1:8000",
    _ => return,                                     // client: tanpa PHP lokal
};
if port_in_use(8000) { return; }
let dir = clean_path(&resolve_backend_dir(app));      // hapus prefix \\?\
Command::new("php")
    .args(["-S", bind, "-t"])
    .arg(&dir).arg(dir.join("index.php"))
    .creation_flags(0x08000000)                       // CREATE_NO_WINDOW
    .spawn();
```

> **Syarat mode server/standalone:** `php` harus terinstall di mesin user dan ada di PATH.
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
| Offline | Perlu server | ✅ Mode server/standalone auto-spawn PHP (syarat: `php` ada di PATH user) |
| Update | Deploy ulang | Tauri Updater plugin |
| Ukuran binary | - | ~6–15 MB (jauh lebih kecil dari Electron ~120 MB) |
| Performance | Browser | WebView native OS |
| `window.localStorage` | ✅ | ✅ |
| Native dialog/file | ❌ | ✅ via Tauri plugins |

---

## Checklist Sebelum Build Production

- [x] Isi semua file icon di `src-tauri/icons/` (dari `TrueCount_logo_transparent.png`)
- [x] Semua URL backend lewat `apiUrl()` / `appConfig.ts` (tidak ada `localhost:8000` hardcode di halaman)
- [x] Halaman config tersembunyi `/__server` (mode client/server/standalone)
- [ ] Isi `frontend/.env` → `VITE_DEFAULT_SERVER_URL=http://<ip-laptop>:8000` sebelum build client
- [ ] Ganti `identifier` di `tauri.conf.json` jika dipublikasikan (`com.namakamu.truecount`)
- [ ] Pastikan `php` terinstall & ada di PATH mesin target (mode server/standalone)
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
| Build gagal `Couldn't find a .ico icon` | Folder `icons/` kosong | `npx tauri icon public/icon/TrueCount_logo_transparent.png --fit cover` |
| Tombol "Dongle Keamanan" disabled di login (desktop) | Deteksi `isTauri` pakai `window.__TAURI__` yang butuh `withGlobalTauri: true` (belum ada di `tauri.conf.json`) | Sudah fix di `LoginPage.jsx` baris 355: ganti ke `'__TAURI_INTERNALS__' in window` (selalu tersedia di Tauri) |
| Terminal muncul-menutup tiap detik (Windows) | `list_removable_drives()` jalankan PowerShell tanpa `CREATE_NO_WINDOW`, jadi jendela konsol muncul saat scan USB tiap 2 detik | Sudah fix di `usb_token.rs`: tambah `cmd.creation_flags(0x08000000)` |
| Icon app masih default | Icon di `src-tauri/icons/` masih default Tauri | Copy `public/icon/TrueCount_logo_transparent.png` → `src-tauri/icons/icon.png`, lalu `npx tauri icon src-tauri/icons/icon.png` untuk generate `.ico`/`.icns` dll. |
| Kamera tetap menyala setelah keluar halaman login | Stream kamera bocor: dua pemeriksaan kamera tumpang tindih (StrictMode dev / interval recheck) meninggalkan stream orphan yang track-nya tetap live | Sudah diatasi: (1) `checkCamera` concurrency-safe (guard `runId` — stream dari run basi langsung dihentikan), (2) registry global `activeCameraStreams` + `stopAllCameraStreams()`, (3) route guard di `App.jsx` mematikan semua stream kamera setiap kali route ≠ `/masuk`, (4) cleanup unmount + `pagehide` memanggil `stopAllCameraStreams()`. Kamera kini **hanya nyala di halaman Masuk**. |
