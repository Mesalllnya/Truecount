# TrueCount — Panduan Desktop (Tauri)

Dokumen ini menjelaskan cara mengkonversi TrueCount dari web app menjadi aplikasi desktop native menggunakan **Tauri v2** (pembungkus Rust ringan — jauh lebih kecil dari Electron).

---

## Arsitektur Desktop

```
┌─────────────────────────────────────────┐
│  Tauri Window (native OS frame)         │
│  ┌───────────────────────────────────┐  │
│  │  WebView (React + Vite)           │  │
│  │  fetch() → localhost:8000 (PHP)   │  │
│  └───────────────────────────────────┘  │
│  Rust backend (tauri commands)          │
└─────────────────────────────────────────┘
         ↕
   PHP built-in server
   (dijalankan terpisah / di-bundle)
```

> **Catatan:** Backend PHP tetap berjalan sebagai proses terpisah. Di Sprint 4+, PHP bisa di-spawn otomatis dari Rust menggunakan `tauri::async_runtime`.

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
|---|---|
| **Windows** | [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) atau Visual Studio dengan "Desktop development with C++" |
| **macOS**   | `xcode-select --install` |
| **Linux**   | `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libayatana-appindicator3-dev librsvg2-dev` |

Panduan resmi: [https://v2.tauri.app/start/prerequisites/](https://v2.tauri.app/start/prerequisites/)

### 3. Verifikasi

```bash
rustc --version
cargo --version
```

---

## Struktur File Tauri (sudah ada di repo)

```
frontend/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Entry point binary
│   │   └── lib.rs           # App builder + setup
│   ├── icons/               # Icon aplikasi (isi manual, lihat bawah)
│   ├── tauri.conf.json      # Konfigurasi window, bundle, identifier
│   ├── Cargo.toml           # Dependensi Rust
│   └── build.rs             # Build script
└── package.json             # Script: desktop:dev · desktop:build
```

---

## Cara Menjalankan (Dev Mode)

```bash
# Terminal 1 — Backend PHP
php -S localhost:8000 -t backend backend/index.php

# Terminal 2 — React + Tauri window
cd frontend
npm run desktop:dev
```

Vite dev server berjalan di `http://127.0.0.1:5173`, Tauri membuka window yang menunjuk ke sana.
Hot reload React tetap berfungsi seperti biasa.

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
    "title": "TrueCount — Secure E-Voting",
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

Buat file `frontend/src-tauri/icons/` dengan nama persis:

```
icons/
├── 32x32.png
├── 128x128.png
├── 128x128@2x.png
├── icon.icns     (macOS)
└── icon.ico      (Windows)
```

Cara paling mudah — gunakan CLI Tauri:

```bash
# Siapkan satu file PNG 1024×1024 sebagai source
cd frontend
npx tauri icon path/to/icon-1024.png
```

---

## Auto-start PHP dari Tauri (Opsional — Sprint 4+)

Untuk menjadikan aplikasi benar-benar standalone tanpa terminal terpisah, tambahkan ke `lib.rs`:

```rust
use std::process::Command;

.setup(|_app| {
    // Spawn PHP server di background
    Command::new("php")
        .args(["-S", "127.0.0.1:8000", "-t", "backend", "backend/index.php"])
        .spawn()
        .expect("Gagal menjalankan PHP server");
    Ok(())
})
```

> Path `backend/` harus relatif terhadap lokasi binary. Gunakan `app.path().resource_dir()` untuk path absolut saat production.

---

## Perbedaan Web vs Desktop

| Aspek | Web | Desktop (Tauri) |
|---|---|---|
| Distribusi | URL | Installer .exe/.dmg/.deb |
| Offline | Perlu server | Bisa standalone (dengan PHP spawn) |
| Update | Deploy ulang | Tauri Updater plugin |
| Ukuran binary | — | ~6–15 MB (jauh lebih kecil dari Electron ~120 MB) |
| Performance | Browser | WebView native OS |
| `window.localStorage` | ✅ | ✅ |
| Native dialog/file | ❌ | ✅ via Tauri plugins |

---

## Checklist Sebelum Build Production

- [ ] Isi semua file icon di `src-tauri/icons/`
- [ ] Ganti `identifier` di `tauri.conf.json` jika dipublikasikan (`com.namakamu.truecount`)
- [ ] Pastikan backend URL di frontend `LoginPage.jsx` dan `RegisterPage.jsx` menggunakan `http://127.0.0.1:8000` (bukan `localhost`)
- [ ] `npm run build` berhasil tanpa error sebelum `desktop:build`
- [ ] Test di OS target sebelum distribusi
