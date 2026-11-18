# TrueCount — Server 1 Laptop + Client Desktop

> **Status:** Rencana (belum dieksekusi)
> **Terakhir diperbarui:** 18 November 2026
> **Topologi:** 1 laptop menjadi server, N PC peserta menjalankan aplikasi desktop yang terhubung ke laptop itu.
> **Dokumen terkait:** [`deploy.md`](deploy.md) · [`deploy-to-cloud-plan.md`](deploy-to-cloud-plan.md) (ditunda) · [`../desktop/desktop.md`](../desktop/desktop.md)

---

## 0. Ringkasan Eksekutif

### 0.1 Topologi yang dituju

```
        LAN (satu Wi-Fi / satu switch)
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ PC peserta │  │ PC peserta │  │ PC peserta │
   │ app Tauri  │  │ app Tauri  │  │ app Tauri  │
   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
         │  http://192.168.1.10:8000
         └───────────────┼───────────────┘
                         ▼
        ┌──────────────────────────────────┐
        │ LAPTOP KAMU (server)             │
        │  PHP API  0.0.0.0:8000           │
        │  MySQL    127.0.0.1:3306         │
        │  storage/ + .env                 │
        └──────────────────────────────────┘
```

Satu database, satu sumber kebenaran, semua client menulis ke laptop yang sama.

### 0.2 Masalah utama: build yang sudah terpasang tidak bisa diarahkan ke laptop

Aplikasi yang sekarang terpasang **hardcode** `http://localhost:8000`:

```
frontend/src/hooks/useAuth.ts:4
frontend/src/hooks/useAuthSession.tsx:5
frontend/src/hooks/useAuthSecurity.tsx:6
frontend/src/hooks/useDevApi.ts:3
frontend/src/hooks/useUsbToken.ts:309
frontend/src/hooks/useWebAuthn.ts:124,215,281,323
frontend/src/components/HealthMonitor.jsx:3
frontend/src/components/ElectionModals.jsx:3
frontend/src/pages/*.jsx (9 file)
```

Di PC peserta, `localhost:8000` berarti **PC peserta itu sendiri**, bukan laptopmu. Ditambah lagi `frontend/src-tauri/src/lib.rs:147` men-spawn PHP lokal di `127.0.0.1:8000` kalau port bebas.

Artinya, dengan build sekarang:

- Tiap peserta menjalankan **PHP + database sendiri**.
- Suara mereka masuk ke database masing-masing, **bukan ke laptopmu**.
- Tidak ada pemilihan bersama.

**Jadi "sudah install app" saja belum cukup.** Ada beberapa jalan keluar, dibahas di [Bagian 10](#10-migrasi-untuk-app-yang-sudah-terpasang).

### 0.3 Keputusan yang diusulkan

> **Jalur migrasi yang dipilih: A — build baru.** Lihat [Bagian 10](#10-migrasi-untuk-app-yang-sudah-terpasang). Opsi B (`netsh portproxy`) tetap didokumentasikan sebagai jaring pengaman kalau build baru belum siap.

1. **Build ulang aplikasi** dengan mode `client` dan alamat server yang bisa diubah runtime (bukan build-time saja).
2. **Alamat server disimpan lokal di tiap app** (`app_config.json`), diubah lewat **route rahasia** di dalam app — ini persis "halaman config server IP" yang diminta.
3. **DB, JWT, encryption key tetap hanya di laptop server** (`.env`), diubah lewat halaman setup PHP yang terpisah.
4. **Laptop server bind ke `0.0.0.0:8000`**, firewall dibuka khusus profil Private, MySQL tetap `127.0.0.1`.
5. **WebAuthn di desktop tidak diandalkan**; pakai USB token yang memang sudah berjalan lokal di Tauri.

**Estimasi:** 2–3 hari untuk build yang benar; 1–2 jam untuk tambal darurat `netsh portproxy` kalau tidak sempat rebuild.

---

## 1. Tujuan & Ruang Lingkup

### 1.1 Tujuan

- [ ] Semua client desktop menulis ke satu database di laptop server.
- [ ] Alamat server bisa diubah di tiap client tanpa build ulang, lewat route rahasia.
- [ ] Server tetap bisa dijalankan sebagai standalone (offline) untuk development.
- [ ] Client tidak pernah menyimpan kredensial DB.
- [ ] Ada indikator jelas di UI bahwa client terhubung ke server yang benar.
- [ ] Ada jalur darurat untuk app yang sudah terpasang tanpa rebuild.

### 1.2 Di luar ruang lingkup

- Akses lewat internet.
- Sinkronisasi antar-server / multi-master.
- Update otomatis (auto-updater) untuk client.
- HTTPS dengan CA internal di semua client.
- Mobile app.

### 1.3 Definisi sukses

- Di PC peserta, app menampilkan "Terhubung ke: Laptop Demo" dan health check `ok`.
- Vote dari dua PC berbeda muncul di hasil yang sama di laptop server.
- Mengubah alamat server lewat route rahasia langsung berlaku setelah reload, tanpa reinstall.
- Mencabut kabel LAN / mematikan Wi-Fi membuat app menampilkan error koneksi, **bukan** diam-diam memakai database lokal.
- Database tidak bisa diakses dari PC lain (`Test-NetConnection <laptop> -Port 3306` gagal).

---

## 2. Kenyataan Teknis

### 2.1 Tiga mode aplikasi

| Mode | PHP lokal | Database | Dipakai oleh |
|---|---|---|---|
| `server` | ✅ spawn, bind `0.0.0.0:8000` | MySQL laptop | Laptop kamu |
| `client` | ❌ tidak spawn | MySQL laptop lewat API | Semua peserta |
| `standalone` | ✅ spawn, bind `127.0.0.1:8000` | MySQL lokal | Development / offline |

Satu installer, tiga mode. Mode disimpan di `app_config.json`.

### 2.2 `php -S` di Windows hanya satu thread

Sekarang ini penting, karena banyak client memukul satu server.

- `php -S` memproses **satu request pada satu waktu**.
- `PHP_CLI_SERVER_WORKERS` tidak berfungsi di Windows.
- Login memakai Argon2id (±150–400 ms). 10 login bersamaan = antrean 2–4 detik.

| Jumlah client aktif | Rekomendasi |
|---|---|
| ≤ 8 | `php -S` cukup, terima antrean pendek |
| 9–30 | Apache (Laragon) atau nginx + PHP-FPM |
| > 30 | Apache/nginx + naikkan `pm.max_children`, pertimbangkan rate limit |

Jangan menunggu hari-H untuk menguji ini. Uji dengan jumlah client sebenarnya.

### 2.3 WebAuthn di desktop punya origin berbeda

- Web desktop di laptop: `http://localhost:8000` → RP ID `localhost`.
- App Tauri di Windows: `http://tauri.localhost` → RP ID harus `tauri.localhost`.
- Backend sekarang mengembalikan `rp.id = 'localhost'` dan mengharapkan origin `http://localhost:5173`. **Tidak cocok** untuk client desktop.

Konsekuensi:

- Credential WebAuthn **tidak bisa dipakai lintas origin**.
- Credential yang dibuat di satu PC tidak pindah ke PC lain (platform authenticator lokal).
- Memperbaiki ini butuh RP ID dinamis per origin + verifikasi `rpIdHash`.

**Rekomendasi demo:** gunakan **USB token** untuk MFA di desktop (sudah berjalan di Rust/Tauri), dan biarkan WebAuthn hanya untuk browser di laptop. Ini menghilangkan seluruh masalah origin.

### 2.4 USB token tetap lokal

`frontend/src/hooks/useUsbToken.ts` hanya aktif di Tauri. Token dibaca dari PC peserta, tidak dikirim ke server. Ini tidak terpengaruh oleh perubahan alamat server.

### 2.5 Client tidak boleh punya `.env`

`backend/config/env.php` mencari `.env` di `dirname(__DIR__, 2)` relatif terhadap folder `backend`. Di installer, folder `backend/` di-bundle sebagai resource, tetapi `.env` **tidak** ikut di-bundle (`tauri.conf.json:42`).

Artinya:

- Client mode **tidak boleh** menjalankan PHP lokal, karena akan gagal / memakai konfigurasi salah.
- `.env` hanya ada di laptop server.

### 2.6 Wi-Fi kampus sering memblokir antar-client

Banyak jaringan Wi-Fi tamu/kampus mengaktifkan **client isolation** (AP isolation). Di jaringan itu, PC peserta tidak bisa menghubungi laptopmu walaupun satu SSID.

Gejala: `ping` gagal, `Test-NetConnection` timeout, app error koneksi.

Solusi:

- Pakai hotspot dari laptop / router sendiri.
- Atau minta IT mematikan client isolation.
- Atau pakai kabel + switch.

Uji ini **sebelum** hari-H.

### 2.7 HTTP di LAN berarti token dan password tidak terenkripsi

Semua request client → laptop lewat HTTP biasa. Di jaringan yang kamu kontrol, ini pragmatis untuk demo. Jangan pakai data nyata, dan jangan lakukan di Wi-Fi publik.

HTTPS di LAN mungkin, tetapi harus install CA di tiap client. Itu menambah kompleksitas dan tidak sepadan untuk demo tertutup.

---

## 3. Arsitektur Target

### 3.1 Peta komponen

| Komponen | Lokasi | Keterangan |
|---|---|---|
| MySQL | Laptop server | Bind `127.0.0.1`, tidak diekspos |
| PHP API | Laptop server | Bind `0.0.0.0:8000` (mode server) |
| `storage/` | Laptop server | Foto, file terenkripsi, log |
| `.env` | Laptop server | DB, JWT, encryption, setup token |
| App desktop | Tiap PC peserta | Mode `client`, API base = `http://<laptop>:8000` |
| `app_config.json` | Tiap PC peserta | `mode`, `serverUrl` |
| USB token | Tiap PC peserta | MFA lokal |

### 3.2 Peta URL (dari sudut pandang client)

| URL | Fungsi |
|---|---|
| `http://<laptop>:8000/health` | Cek koneksi + identitas server |
| `http://<laptop>:8000/auth/*` | Login, register, WebAuthn |
| `http://<laptop>:8000/invites/*` | Undangan |
| `http://<laptop>:8000/elections/*` | Pemilihan, kandidat, vote |
| `http://<laptop>:8000/results/*` | Hasil |
| `http://<laptop>:8000/elections/blockchain/*` | Seal & verify |
| `http://<laptop>:8000/encrypted-messages/*` | Pesan terenkripsi |

Tidak ada prefix `/api` di desktop, karena frontend memanggil `http://<server>:8000/<path>` langsung. Prefix `/api` hanya relevan kalau nanti ada reverse proxy.

### 3.3 Peta URL (dari sudut pandang laptop)

| URL | Fungsi |
|---|---|
| `http://localhost:8000/` | Frontend, kalau dijalankan lewat Vite |
| `http://localhost:8000/<SETUP_PATH>?k=...` | Halaman config server (DB, secret) |
| `http://localhost:8000/health` | Health check |

### 3.4 Alur data satu vote

```
Client A (Tauri)
  → POST http://192.168.1.10:8000/votes
  → PHP di laptop validasi JWT, cek sudah vote, enkripsi ballot
  → INSERT ke MySQL laptop
  → tulis blok chain
  → response 200 ke Client A

Client B membuka hasil
  → GET http://192.168.1.10:8000/results/:id
  → membaca database yang sama
```

---

## 4. Tiga Lapisan Konfigurasi

| Lapisan | File | Isi | Dibaca oleh | Diubah lewat |
|---|---|---|---|---|
| **Client** | `app_config.json` di app config dir | `mode`, `serverUrl` | Rust + frontend | Route rahasia di app |
| **Server** | `.env` di laptop | DB, JWT, encryption, setup token, WebAuthn | PHP | Halaman setup PHP |
| **Build-time** | `VITE_*` | default `serverUrl`, default mode | Vite saat build | Rebuild |

### 4.1 Aturan tegas

- Client **tidak pernah** menyimpan `DB_PASS`, `JWT_SECRET`, atau encryption key.
- Server **tidak pernah** mengirim secret ke client.
- `app_config.json` hanya berisi alamat server dan mode. Kalau bocor, risikonya rendah.
- route rahasia client **tidak butuh token** karena hanya mengubah alamat lokal. Pengamannya adalah tidak adanya tombol dan tidak adanya link.

### 4.2 Contoh `app_config.json`

```json
{
  "mode": "client",
  "serverUrl": "http://192.168.1.10:8000"
}
```

Lokasi (Windows): `%APPDATA%\com.truecount.app\app_config.json` (mengikuti `app_config_dir` Tauri).

### 4.3 Contoh `.env` server

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=truecount_db
DB_USER=truecount_user
DB_PASS=...

APP_ENV=demo
FRONTEND_ORIGIN=http://localhost:8000

JWT_SECRET=...
JWT_EXPIRE=3600
INVITE_EXPIRE_DAYS=7

ENCRYPTION_KEY_B64=...
CHACHA20_KEY_B64=...

# Identitas server (baru)
SERVER_ID=2f8c1a...
SERVER_LABEL=Laptop Demo

# Halaman setup server (baru)
SETUP_PATH=/__tc-setup
SETUP_TOKEN=...
SETUP_ALLOW_REMOTE=false

# WebAuthn (hanya untuk browser di laptop)
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:8000
```

---

## 5. Halaman Config Client (yang diminta)

### 5.1 Fungsi

Mengubah **alamat server** di app yang sudah terpasang, tanpa rebuild.

### 5.2 Akses: route rahasia + shortcut

Di dalam app Tauri tidak ada address bar, jadi route saja tidak bisa diketik. Pakai kombinasi:

| Lapis | Detail |
|---|---|
| Route | `/__server` — tidak ada di `Nav`, tidak ada link |
| Shortcut | `Ctrl + Shift + Alt + S` dari halaman mana pun |
| Alternatif | Klik 5× pada teks versi di halaman Pengaturan |

Shortcut didaftarkan global di `App.jsx`, jadi tetap berfungsi walau server tidak bisa dihubungi (halaman error sekalipun).

### 5.3 Field

| Field | Tipe | Validasi |
|---|---|---|
| Mode | pilihan: `client` / `standalone` / `server` | wajib |
| Server URL | teks | `http(s)://host[:port]`, tanpa path, tanpa trailing slash |
| Test koneksi | tombol | `GET <url>/health`, timeout 3 detik |
| Simpan | tombol | tulis `app_config.json`, lalu reload |
| Reset | tombol | kembali ke default build |

### 5.4 Perilaku test koneksi

Tampilkan hasil mentah yang berguna:

```
Status      : ok
App         : TrueCount
Database    : connected
Server ID   : 2f8c1a
Label       : Laptop Demo
Waktu server: 2026-11-18T09:41:22+07:00
```

Kalau `database: disconnected`, tampilkan peringatan: server hidup tetapi DB-nya bermasalah — hubungi operator.

### 5.5 Wireframe

```
┌────────────────────────────────────────────────────────┐
│  Konfigurasi Client                                    │
├────────────────────────────────────────────────────────┤
│  Mode      (•) Client   ( ) Standalone   ( ) Server    │
│                                                        │
│  Server    [http://192.168.1.10:8000       ]           │
│                                                        │
│  [ Test koneksi ]                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ok · database connected · Laptop Demo (2f8c1a)   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [ Simpan & muat ulang ]   [ Reset ]                   │
├────────────────────────────────────────────────────────┤
│  Database dan kredensial dikelola di server.           │
│  Halaman ini hanya menyimpan alamat server di PC ini.  │
└────────────────────────────────────────────────────────┘
```

### 5.6 Kenapa tidak butuh token

Halaman ini hanya mengubah alamat tujuan di PC itu sendiri. Kalau seseorang membukanya, dia hanya bisa mengubah client-nya sendiri — bukan server. Yang perlu dijaga justru **halaman setup server**.

### 5.7 Kalau server URL salah

App tetap bisa dibuka, route config tetap bisa diakses, dan halaman config tidak butuh API. Ini penting: jangan sampai kesalahan alamat membuat halaman perbaikan ikut tidak bisa dibuka.

---

## 6. Halaman Config Server (di laptop)

### 6.1 Fungsi

Mengubah `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `APP_ENV`, `FRONTEND_ORIGIN`, dan melihat status server.

### 6.2 Kenapa PHP, bukan React

```
Halaman React → butuh bundle → butuh API
Halaman admin → butuh login → butuh tabel users → butuh database
```

Kalau `DB_HOST` salah, halaman React tidak bisa login untuk memperbaikinya. Halaman PHP tidak menyentuh DB saat render, jadi selalu bisa dibuka.

### 6.3 Akses

```
http://127.0.0.1:8000/__tc-setup?k=<SETUP_TOKEN>
```

- Path dari `SETUP_PATH`.
- Token dari `SETUP_TOKEN`, dibandingkan `hash_equals`.
- Default hanya dari `127.0.0.1`; `SETUP_ALLOW_REMOTE=true` membuka sementara.
- Gagal salah satu → **404 biasa**, bukan pesan "token salah".

### 6.4 Isi halaman

| Bagian | Field |
|---|---|
| Status | waktu server, versi PHP, `.env` writable, status DB |
| Database | host, port, nama, user, password (masked) |
| Aplikasi | `APP_ENV`, `FRONTEND_ORIGIN`, `INVITE_EXPIRE_DAYS` |
| Server | `SERVER_LABEL`, `SERVER_ID` (read-only), alamat LAN yang terdeteksi |
| Keamanan | `JWT_SECRET` (fingerprint + regenerate), encryption keys (read-only) |
| Aksi | test DB, backup `.env`, simpan |

### 6.5 Password tidak pernah dikirim balik

- Halaman hanya menampilkan `•••••••• (tersimpan)`.
- Field kosong saat submit = pertahankan password lama.
- Test koneksi memakai nilai yang sedang diketik, tanpa menyimpan.

### 6.6 Simpan atomik

```
1. Validasi
2. Test koneksi dengan nilai baru
3. Gagal → jangan tulis
4. Berhasil → copy .env → .env.bak.<timestamp>
5. tulis .env.tmp.<random> → rename ke .env
6. audit log (nama key saja, bukan nilai)
```

Kode penulis `.env`, validasi, dan audit log sama seperti rencana sebelumnya; lihat [Lampiran B](#b-sketsa-penulis-env).

---

## 7. Implementasi Runtime Config di Tauri

### 7.1 Struct & command Rust

`frontend/src-tauri/src/lib.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct AppConfig {
    mode: String,       // "server" | "client" | "standalone"
    server_url: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            mode: "standalone".into(),
            server_url: "http://localhost:8000".into(),
        }
    }
}

fn app_config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("app_config.json"))
}

fn load_app_config(app: &tauri::AppHandle) -> AppConfig {
    app_config_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn get_app_config(app: tauri::AppHandle) -> AppConfig {
    load_app_config(&app)
}

#[tauri::command]
fn set_app_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = app_config_path(&app)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}
```

### 7.2 Spawn PHP hanya untuk mode yang tepat

```rust
fn spawn_php_backend(app: &tauri::AppHandle, bind: &str) {
    // ...
    cmd.args(["-S", bind, "-t"])
        .arg(&backend_dir)
        .arg(&router);
    // ...
}

// di setup():
let cfg = load_app_config(&app.handle());
match cfg.mode.as_str() {
    "client" => { /* tidak spawn */ }
    "server"   => spawn_php_backend(&app.handle(), "0.0.0.0:8000"),
    _          => spawn_php_backend(&app.handle(), "127.0.0.1:8000"),
}
```

Daftarkan command:

```rust
.invoke_handler(tauri::generate_handler![
    get_app_config,
    set_app_config,
    // ... command yang sudah ada
])
```

### 7.3 Frontend membaca config sebelum render

`frontend/src/lib/appConfig.ts`:

```ts
import { invoke } from '@tauri-apps/api/core'

export type AppMode = 'server' | 'client' | 'standalone'

export interface AppConfig {
  mode: AppMode
  serverUrl: string
}

const isTauri = '__TAURI_INTERNALS__' in window

let config: AppConfig = {
  mode: isTauri ? 'standalone' : 'server',
  serverUrl: isTauri
    ? 'http://localhost:8000'
    : import.meta.env.VITE_API_URL ?? '',
}

export async function loadAppConfig(): Promise<void> {
  if (!isTauri) return
  config = await invoke<AppConfig>('get_app_config')
}

export function getAppConfig(): AppConfig {
  return config
}

export async function saveAppConfig(next: AppConfig): Promise<void> {
  if (isTauri) await invoke('set_app_config', { config: next })
  config = next
}

export function apiBase(): string {
  const base = config.mode === 'client' ? config.serverUrl : config.serverUrl || 'http://localhost:8000'
  return base.replace(/\/+$/, '')
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
}
```

`frontend/src/main.jsx`:

```jsx
import { loadAppConfig } from './lib/appConfig'

loadAppConfig().then(() => {
  createRoot(document.getElementById('root')).render(<App />)
})
```

### 7.4 Semua pemanggilan API memakai `apiUrl()`

Ganti 28 titik `http://localhost:8000` dengan `apiUrl('/...')`. Ini prasyarat mutlak; tanpa ini, config tidak berpengaruh.

### 7.5 Default alamat server saat build

Supaya peserta tidak perlu mengisi apa pun, bake alamat laptop sebagai default:

```powershell
cd frontend
$env:VITE_DEFAULT_SERVER_URL = "http://192.168.1.10:8000"
npm run desktop:build
```

Di Rust, `Default` bisa membaca env build:

```rust
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            mode: option_env!("TRUECOUNT_DEFAULT_MODE").unwrap_or("client").into(),
            server_url: option_env!("TRUECOUNT_DEFAULT_SERVER_URL")
                .unwrap_or("http://localhost:8000").into(),
        }
    }
}
```

Atau lebih sederhana: simpan default di frontend lewat `import.meta.env.VITE_DEFAULT_SERVER_URL`, lalu kirim ke Rust saat pertama kali dibuka.

### 7.6 Identitas server di `/health`

Tambahkan agar client bisa memastikan terhubung ke server yang benar:

```php
// backend/config/app.php
define('SERVER_ID',    $_ENV['SERVER_ID'] ?? '');
define('SERVER_LABEL', $_ENV['SERVER_LABEL'] ?? 'TrueCount Server');

// backend/index.php, di handler /health
jsonResponse([
    'status'      => $dbOk ? 'ok' : 'degraded',
    'app'         => 'TrueCount',
    'database'    => $dbOk ? 'connected' : 'disconnected',
    'server_id'   => SERVER_ID,
    'server_label'=> SERVER_LABEL,
    'time'        => date('c'),
]);
```

Client menampilkan `server_label` + 6 karakter `server_id` di halaman config dan di banner kecil. Kalau dua PC menampilkan ID berbeda, mereka tidak terhubung ke server yang sama.

### 7.7 Jangan biarkan client jatuh ke database lokal

Kalau mode `client` tetapi server tidak bisa dihubungi:

- `HealthMonitor` menampilkan status merah.
- Halaman vote diblokir dengan pesan "Tidak terhubung ke server pemilihan".
- **Jangan** fallback ke `localhost:8000`.

Ini mencegah suara masuk ke database lokal yang salah.

---

## 8. Perubahan Kode

| Kode | Pekerjaan | File |
|---|---|---|
| C1 | Sentralisasi API base + `apiUrl()` | `frontend/src/lib/appConfig.ts` (baru) + 16 file |
| C2 | Load config sebelum render | `frontend/src/main.jsx` |
| C3 | Rust: `AppConfig`, command, spawn per mode | `frontend/src-tauri/src/lib.rs` |
| C4 | Route rahasia + shortcut + halaman client config | `frontend/src/App.jsx`, `frontend/src/pages/ClientConfigPage.jsx` |
| C5 | Banner identitas server | `frontend/src/components/*` |
| C6 | Blokir vote saat server tidak terhubung | `frontend/src/pages/VotePage.jsx` |
| C7 | `/health` + `SERVER_ID`/`SERVER_LABEL` | `backend/config/app.php`, `backend/index.php` |
| C8 | Halaman setup server (PHP) | `backend/setup/*` + route di `backend/index.php` |
| C9 | Redaksi token di log | `backend/index.php:17` |
| C10 | CORS tetap mengizinkan origin Tauri di mode demo | `backend/helpers/response.php` |
| C11 | `.env.example` + `.gitignore` | root |

### 8.1 C10 — CORS untuk client

`backend/helpers/response.php` sekarang sudah mengizinkan:

```php
$allowedOrigins = [
    FRONTEND_ORIGIN,
    'http://tauri.localhost',   // Windows WebView2
    'tauri://localhost',        // macOS / Linux
];
```

Yang harus dipastikan:

- Jangan membatasi ke `FRONTEND_ORIGIN` saja saat `APP_ENV=demo`.
- Tetap kirim `Access-Control-Allow-Private-Network: true` (sudah ada).
- `OPTIONS` tetap 204 (sudah ada).

### 8.2 C11 — `.env.example`

Tambahkan:

```env
SERVER_ID=
SERVER_LABEL=Laptop Demo

SETUP_PATH=/__tc-setup
SETUP_TOKEN=
SETUP_ALLOW_REMOTE=false

WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:8000
```

---

## 9. Setup Laptop Server

### 9.1 Prasyarat

| Komponen | Catatan |
|---|---|
| PHP 8.1+ | `pdo_mysql`, `mbstring`, `openssl`, `gd`, `fileinfo` |
| MySQL 8 / MariaDB | Bind `127.0.0.1` |
| Node.js | Hanya untuk build frontend |
| IP statis | DHCP reservation di router, atau set manual |

### 9.2 Jalankan server

**Opsi A — mode server lewat app desktop**

Set `app_config.json` laptop menjadi:

```json
{ "mode": "server", "serverUrl": "http://localhost:8000" }
```

App akan spawn `php -S 0.0.0.0:8000`.

**Opsi B — terminal**

```powershell
php -S 0.0.0.0:8000 -t backend backend/index.php
```

**Opsi C — Apache (Laragon) untuk banyak client**

Arahkan document root ke `backend/`, aktifkan `mod_rewrite`, lalu pastikan semua request masuk ke `index.php`. Ini memberi banyak worker dan jauh lebih tahan antrean.

### 9.3 Firewall

```powershell
New-NetFirewallRule `
  -DisplayName "TrueCount API 8000" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 8000 `
  -Profile Private `
  -Action Allow
```

- Batasi ke profil **Private** (jangan Public).
- Jangan membuka 3306.
- Cek dari PC lain: `Test-NetConnection 192.168.1.10 -Port 8000`.

### 9.4 MySQL tetap lokal

```ini
# my.ini
bind-address = 127.0.0.1
```

Verifikasi dari PC lain:

```powershell
Test-NetConnection 192.168.1.10 -Port 3306   # harus gagal
```

### 9.5 IP statis

- Catat IP laptop: `192.168.1.10` (contoh).
- Set DHCP reservation di router supaya tidak berubah.
- Kalau IP berubah, semua client harus diubah lewat route rahasia.

---

## 10. Migrasi untuk App yang Sudah Terpasang

Ada empat pilihan. Pilih satu sebelum hari-H.

### 10.1 Perbandingan

| Opsi | Effort | App lama tetap jalan | USB token | Data terkumpul | Catatan |
|---|---|---|---|---|---|
| **A. Build baru + config route** | 2–3 hari | ❌ harus reinstall | ✅ | ✅ | **✅ Dipilih** |
| **B. `netsh portproxy`** | 1–2 jam | ✅ | ✅ | ✅ | Jaring pengaman, rapuh |
| **C. Browser ke web server laptop** | 0,5 hari | ✅ (tanpa app) | ❌ | ✅ | WebAuthn/kamera bermasalah |
| **D. Biarkan tiap PC punya DB sendiri** | 0 | ✅ | ✅ | ❌ | **Bukan pemilihan bersama** |

### 10.2 Opsi A — build baru (rekomendasi)

1. Kerjakan C1–C6 dan C10.
2. Build dengan default `serverUrl` = IP laptop.
3. Distribusikan installer baru; minta semua peserta uninstall yang lama lalu install.
4. Setelah install, app langsung menunjuk laptop.

Risiko: butuh waktu dan koordinasi reinstall. Tapi ini satu-satunya solusi yang benar dan sekaligus memberi route config yang diminta.

### 10.3 Opsi B — `netsh portproxy` (tanpa rebuild)

Ide: buat `localhost:8000` di tiap PC peserta **diteruskan** ke laptop.

Di **setiap PC peserta**, buka PowerShell **as Administrator**:

```powershell
# Hentikan PHP lokal kalau sedang jalan
Get-Process php -ErrorAction SilentlyContinue | Stop-Process -Force

# Pastikan layanan IP Helper aktif (dibutuhkan portproxy)
Set-Service iphlpsvc -StartupType Automatic
Start-Service iphlpsvc

# Teruskan IPv4 loopback → laptop
netsh interface portproxy delete v4tov4 listenaddress=127.0.0.1 listenport=8000 2>$null
netsh interface portproxy add    v4tov4 listenaddress=127.0.0.1 listenport=8000 connectaddress=192.168.1.10 connectport=8000

# Teruskan IPv6 loopback → laptop (karena "localhost" bisa resolve ke ::1)
netsh interface portproxy delete v6tov4 listenaddress=::1 listenport=8000 2>$null
netsh interface portproxy add    v6tov4 listenaddress=::1 listenport=8000 connectaddress=192.168.1.10 connectport=8000

# Verifikasi
netsh interface portproxy show all
curl.exe http://localhost:8000/health
```

Kenapa ini bisa bekerja:

- App mengecek `127.0.0.1:8000`; karena portproxy menerima koneksi, `port_in_use()` menganggap backend sudah jalan dan **tidak spawn PHP lokal** (`lib.rs:147`).
- Frontend memanggil `localhost:8000` → diteruskan ke laptop.
- CORS tetap aman karena origin tetap `http://tauri.localhost`.

Keterbatasan:

- Butuh admin di tiap PC.
- IP laptop berubah → rule harus dibuat ulang.
- Kalau `localhost` resolve ke `::1`, rule v6 wajib ada.
- Antivirus / kebijakan kampus bisa memblokir `netsh portproxy`.
- Tidak ada indikator di UI bahwa client memakai server lain; verifikasi lewat `curl` dan `server_id`.

Cocok sebagai **tambal darurat**, bukan solusi permanen.

### 10.4 Opsi C — browser ke web server laptop

Laptop menyajikan frontend:

```powershell
cd frontend
$env:VITE_API_URL = "/api"
npm run build
cd ..
php -S 0.0.0.0:8080 -t frontend/dist scripts/serve-demo.php
```

`scripts/serve-demo.php` (perlu dibuat):

```php
<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$dist = __DIR__ . '/../frontend/dist';

if (str_starts_with($path, '/api')) {
    require __DIR__ . '/../backend/index.php';
    return true;
}

$file = realpath($dist . $path);
if ($file && str_starts_with($file, realpath($dist)) && is_file($file)) {
    return false; // biarkan built-in server menyajikan file statis
}

readfile($dist . '/index.html');
return true;
```

Peserta membuka `http://192.168.1.10:8080`.

Masalah:

- WebAuthn dan kamera **tidak jalan** di `http://192.168.x.x` (bukan secure context).
- USB token tidak tersedia di browser.
- Kalau alur login mewajibkan MFA (WebAuthn/USB), peserta **tidak bisa menyelesaikannya**.
- Token JWT lewat HTTP di LAN.

Opsi ini hanya masuk akal kalau akun peserta memang diizinkan login tanpa MFA.

### 10.5 Opsi D — biarkan seperti sekarang

Tiap PC menjalankan PHP + MySQL lokal. Data tersebar, hasil tidak pernah bertemu. **Ini bukan pemilihan bersama**, hanya demo UI per orang.

---

## 11. Keamanan

| Ancaman | Dampak | Mitigasi |
|---|---|---|
| Port 3306 terbuka | Attacker baca/ubah suara | Bind `127.0.0.1`, firewall tidak membuka 3306 |
| HTTP di LAN disadap | JWT/password terbaca | Jaringan privat, tanpa data nyata, sesi pendek |
| Client diarahkan ke server palsu | Kredensial dikirim ke attacker | Default `serverUrl` di-bake; tampilkan `server_id`; route config tersembunyi |
| Halaman setup server diakses dari LAN | DB bisa diubah | Loopback-only + token 128-bit + 404 seragam |
| Token setup bocor lewat log | Akses setup | Redaksi `k=` di `backend/index.php:17` |
| Password DB tampil di UI | Kredensial bocor | Masked, tidak pernah dikirim balik |
| `.env` rusak saat simpan | Server mati | Tulis atomik + backup otomatis |
| Regenerate encryption key | Data lama hilang | Field read-only |
| Client fallback ke DB lokal | Suara hilang | Blokir vote saat server tidak terhubung |
| Login brute force | Akun diambil alih | Rate limit + audit log |

### 11.1 Yang tidak boleh

- ❌ Menaruh `DB_PASS` di `app_config.json` client.
- ❌ Mengekspos MySQL ke LAN.
- ❌ Memakai `0.0.0.0` untuk MySQL.
- ❌ Membuka halaman setup server dari LAN tanpa token.
- ❌ Menyimpan token setup di README atau chat.
- ❌ Menganggap "tidak ada tombol" sebagai pengaman. Pengamannya adalah token + loopback.

---

## 12. Testing

### 12.1 Dua PC

Siapkan laptop server + minimal satu PC client.

- [ ] `http://localhost:8000/health` di laptop → `ok`, `connected`, `server_id` terisi.
- [ ] Dari PC client: `Test-NetConnection <ip-laptop> -Port 8000` → `TcpTestSucceeded: True`.
- [ ] Dari PC client: `Test-NetConnection <ip-laptop> -Port 3306` → gagal.
- [ ] App client menampilkan `server_label` + `server_id` yang sama dengan laptop.
- [ ] Login di client berhasil.
- [ ] Vote di client muncul di hasil yang dibuka dari laptop.
- [ ] Vote kedua dari user yang sama ditolak.
- [ ] Cabut jaringan client → muncul error, vote diblokir, tidak ada fallback lokal.
- [ ] Buka route rahasia client → ubah URL salah → test gagal → kembali ke URL benar.
- [ ] Ubah URL benar → simpan → reload → tersambung.
- [ ] `app.log` server mencatat request dari IP client.

### 12.2 Banyak client

- [ ] 5 client login bersamaan → ukur waktu respons.
- [ ] 10 client vote bersamaan → tidak ada vote hilang.
- [ ] `SHOW PROCESSLIST` di MySQL tidak menunjukkan penumpukan.
- [ ] Kalau antrean > 3 detik, pindah ke Apache.

### 12.3 Halaman setup server

- [ ] Tanpa token → 404.
- [ ] Token salah → 404, body identik.
- [ ] Dari IP LAN → ditolak (loopback-only).
- [ ] MySQL dimatikan → halaman tetap terbuka.
- [ ] Test DB salah → error, tidak tersimpan.
- [ ] Simpan valid → `.env.bak.*` terbentuk.
- [ ] Password DB tidak muncul di HTML/response.
- [ ] `app.log` tidak memuat token.

---

## 13. Runbook Hari-H

### 13.1 Sebelum peserta datang

- [ ] Laptop server: MySQL jalan, `.env` benar.
- [ ] PHP server jalan di `0.0.0.0:8000`.
- [ ] Firewall rule 8000 aktif (Private).
- [ ] IP laptop sudah static / reservation.
- [ ] Database + kandidat + pemilihan siap.
- [ ] Semua akun demo punya USB token terdaftar **atau** MFA sudah diatur.
- [ ] Satu PC client sudah dites end-to-end.
- [ ] `server_id` dicatat untuk verifikasi.
- [ ] Backup `.env`, DB, `storage/` dibuat.

### 13.2 Saat peserta datang

- [ ] Pastikan semua PC di jaringan yang sama.
- [ ] Buka app, cek banner server (label + ID).
- [ ] Kalau salah, buka `Ctrl+Shift+Alt+S`, isi URL laptop, test, simpan.
- [ ] Login dan vote percobaan dengan satu akun uji.
- [ ] Hapus vote uji sebelum pemilihan resmi (atau pakai pemilihan terpisah).

### 13.3 Setelah demo

- [ ] Regenerate `SETUP_TOKEN`.
- [ ] Ganti password akun demo.
- [ ] Backup database final.
- [ ] Kalau memakai portproxy, hapus rule di tiap client:

```powershell
netsh interface portproxy reset
```

- [ ] Simpan `.env` di tempat aman.

---

## 14. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| App lama hardcode localhost | Data tidak terkumpul | Rebuild (A) atau portproxy (B) |
| Wi-Fi client isolation | Client tidak bisa connect | Hotspot/router sendiri; uji sebelum hari-H |
| `php -S` single-thread | Antrean saat ramai | Apache/nginx kalau client > 8 |
| IP laptop berubah | Semua client putus | DHCP reservation; route config untuk memperbaiki |
| WebAuthn origin mismatch di desktop | MFA gagal | Pakai USB token |
| Client jatuh ke DB lokal | Suara hilang | Blokir vote saat server unreachable |
| HTTP disadap | Kredensial bocor | Jaringan privat; tanpa data nyata |
| Portproxy rapuh | Koneksi putus | Hanya darurat; rebuild tetap target |
| `frontend/dist` / installer basi | Fitur config tidak ada | Pastikan build baru benar-benar terdistribusi |
| Peserta install versi lama | Tidak bisa config | Cek versi di halaman config |

---

## 15. Timeline

### 15.1 Jalur A — build baru (rekomendasi)

| Pekerjaan | Estimasi |
|---|---|
| C1 sentralisasi API base (28 titik) | 0,5 hari |
| C3 Rust config + spawn per mode | 0,5 hari |
| C4 route rahasia + halaman client config | 0,5 hari |
| C7 health identity + C5 banner | 0,25 hari |
| C8 halaman setup server | 1 hari |
| C9/C10/C11 | 0,25 hari |
| Testing 2 PC + banyak client | 0,5 hari |
| **Total** | **2–3 hari** |

### 15.2 Jalur B — portproxy

| Pekerjaan | Estimasi |
|---|---|
| Setup server + firewall | 0,5 jam |
| Uji portproxy di 1 client | 0,5 jam |
| Terapkan ke semua client | 0,5–1 jam |
| **Total** | **1–2 jam** |

---

## 16. Keputusan yang Masih Terbuka

Sudah diputuskan:

- ✅ Jalur migrasi: **A — build baru** dengan runtime server URL.
- ✅ Alamat server disimpan di client (`app_config.json`), bukan di bundle.
- ✅ Secret (DB, JWT, encryption) hanya di laptop server.

Belum diputuskan:

- [ ] Berapa jumlah PC client yang akan dipakai? (menentukan `php -S` vs Apache)
- [ ] IP laptop sudah static? Berapa? (dipakai sebagai default `serverUrl` saat build)
- [ ] MFA client: **USB token** atau WebAuthn? (rekomendasi: USB token)
- [ ] Apakah laptop juga menjalankan app desktop (mode server), atau cukup PHP + terminal?
- [ ] Nama route rahasia client: `/__server` atau yang lain?
- [ ] Shortcut: `Ctrl+Shift+Alt+S` atau kombinasi lain?
- [ ] Perlu tampilkan `server_id` di UI utama, atau cukup di halaman config?

---

## 17. Urutan Eksekusi yang Disarankan

1. **Putuskan jalur migrasi.** Kalau peserta sudah terlanjur install dan waktu mepet, siapkan portproxy sebagai jaring pengaman, tetapi tetap kerjakan build baru.
2. **C1** — sentralisasi `apiUrl()`. Tanpa ini semua usaha config sia-sia.
3. **C3** — Rust `AppConfig` + spawn per mode.
4. **C4** — route rahasia client + halaman config.
5. **C7 + C5** — identitas server di `/health` + banner.
6. **C8** — halaman setup server.
7. **C10/C11** — CORS, `.env.example`, `.gitignore`.
8. Testing 2 PC, lalu testing banyak client.
9. Distribusi installer + checklist hari-H.

---

## 18. Lampiran

### A. Perintah cepat

```powershell
# Laptop server
php -S 0.0.0.0:8000 -t backend backend/index.php

# Cek dari laptop
curl.exe http://localhost:8000/health

# Cek dari PC client
Test-NetConnection 192.168.1.10 -Port 8000
curl.exe http://192.168.1.10:8000/health

# Build installer dengan default alamat server
cd frontend
$env:VITE_DEFAULT_SERVER_URL = "http://192.168.1.10:8000"
npm run desktop:build
```

### B. Sketsa penulis `.env`

```php
function writeEnvFile(string $path, array $changes): void
{
    $original = file($path, FILE_IGNORE_NEW_LINES);
    $seen = [];
    $out  = [];

    foreach ($original as $line) {
        if (preg_match('/^\s*([A-Z0-9_]+)\s*=/', $line, $m)
            && array_key_exists($m[1], $changes)) {
            $out[] = $m[1] . '=' . formatEnvValue($changes[$m[1]]);
            $seen[$m[1]] = true;
        } else {
            $out[] = $line;
        }
    }

    foreach ($changes as $key => $value) {
        if (!isset($seen[$key])) {
            $out[] = $key . '=' . formatEnvValue($value);
        }
    }

    copy($path, $path . '.bak.' . date('Ymd-His'));

    $tmp = $path . '.tmp.' . bin2hex(random_bytes(6));
    file_put_contents($tmp, implode(PHP_EOL, $out) . PHP_EOL, LOCK_EX);
    rename($tmp, $path);
}

function formatEnvValue(string $value): string
{
    if ($value === '' || preg_match('/[\s#"\'\\\\]/', $value)) {
        return '"' . addcslashes($value, '"\\') . '"';
    }
    return $value;
}
```

### C. Validasi field server

```php
$errors = [];

if (!preg_match('/^[A-Za-z0-9.\-]{1,253}$/', $in['DB_HOST'] ?? '')) {
    $errors['DB_HOST'] = 'Host tidak valid.';
}

$port = filter_var($in['DB_PORT'] ?? '', FILTER_VALIDATE_INT);
if ($port === false || $port < 1 || $port > 65535) {
    $errors['DB_PORT'] = 'Port harus 1–65535.';
}

if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $in['DB_NAME'] ?? '')) {
    $errors['DB_NAME'] = 'Nama database tidak valid.';
}

if (!preg_match('/^[A-Za-z0-9_.\-]{1,64}$/', $in['DB_USER'] ?? '')) {
    $errors['DB_USER'] = 'User database tidak valid.';
}
```

### D. Redaksi token di log

`backend/index.php:17` mencatat `REQUEST_URI` sebelum routing, sehingga token setup bocor ke `app.log`. Ganti dengan:

```php
$safeUri = preg_replace('/([?&]k=)[^&]*/i', '$1***', $_SERVER['REQUEST_URI'] ?? '-');

tc_log_info(sprintf(
    '%s %s | origin=%s | ip=%s',
    $_SERVER['REQUEST_METHOD'] ?? '-',
    $safeUri,
    $_SERVER['HTTP_ORIGIN'] ?? '-',
    $_SERVER['REMOTE_ADDR'] ?? '-'
));
```

### E. File yang disentuh

| File | Perubahan |
|---|---|
| `frontend/src/lib/appConfig.ts` | **Baru** — config + `apiUrl()` |
| 16 file frontend | Ganti hardcode `localhost:8000` |
| `frontend/src/main.jsx` | Load config sebelum render |
| `frontend/src/App.jsx` | Route `/__server` + shortcut |
| `frontend/src/pages/ClientConfigPage.jsx` | **Baru** |
| `frontend/src-tauri/src/lib.rs` | `AppConfig`, command, spawn per mode |
| `frontend/src-tauri/tauri.conf.json` | Tetap; resources `backend/` |
| `backend/index.php` | `/health` identity, route setup, redaksi token |
| `backend/config/app.php` | `SERVER_ID`, `SERVER_LABEL`, WebAuthn env |
| `backend/helpers/response.php` | Pastikan origin Tauri tetap diizinkan |
| `backend/setup/*` | **Baru** — halaman config server |
| `.env.example` | `SERVER_*`, `SETUP_*`, `WEBAUTHN_*` |
| `.gitignore` | `.env.bak.*`, `.env.tmp.*` |

### F. Contoh `app_config.json`

Client:

```json
{
  "mode": "client",
  "serverUrl": "http://192.168.1.10:8000"
}
```

Laptop server:

```json
{
  "mode": "server",
  "serverUrl": "http://localhost:8000"
}
```

Development:

```json
{
  "mode": "standalone",
  "serverUrl": "http://localhost:8000"
}
```

---

> **Catatan akhir:** Kunci perubahan ini adalah memindahkan "alamat server" dari kode yang di-hardcode ke konfigurasi lokal tiap app, sambil tetap menjaga seluruh secret di laptop server. Tanpa rebuild, app yang sudah terpasang tidak bisa diarahkan ke laptop; `netsh portproxy` hanya tambal darurat.
