# TrueCount - Panduan Deploy

Dokumen ini mencakup dua skenario:

- **[Lokal / Development](#1-lokal--development)** - untuk pengerjaan sehari-hari di laptop masing-masing.
- **[Server / Production](#2-server--production)** - untuk demo akhir atau hosting publik.

> **Deploy backend + MySQL dengan Docker:** lihat [`docker.md`](docker.md) untuk `Dockerfile`, `docker-compose.yml`, volume storage, dan contoh pod/Kubernetes.
>
> Untuk demo di laptop sendiri, langkah manual di bawah bisa diringkas dengan [`scripts/deploy-server.ps1`](../../scripts/deploy-server.ps1) - lihat [2.11 Script deploy server lokal (Windows)](#211-script-deploy-server-lokal-windows).
>
> **Konfigurasi client/server/standalone di aplikasi desktop:** lihat [`../desktop/desktop.md`](../desktop/desktop.md#konfigurasi-runtime-client--server--standalone).
>
> **Dokumen rencana (arsip):** topologi 1 laptop + client desktop ada di [`demo-server-config-plan.md`](../archive/demo-server-config-plan.md); rencana cloud/VPS ada di [`deploy-to-cloud-plan.md`](../archive/deploy-to-cloud-plan.md). Keduanya bukan acuan lagi.

---

## Prasyarat Umum

| Kebutuhan         | Versi Minimum | Catatan                                      |
|-------------------|---------------|----------------------------------------------|
| PHP               | 8.1           | Butuh ekstensi: `pdo_mysql`, `mbstring`, `openssl` |
| MySQL / MariaDB   | 8.0 / 10.6    | Bisa pakai XAMPP, Laragon, atau native       |
| Node.js + npm     | 18 LTS        | Untuk build React                            |
| Composer          | 2.x           | Jika nanti ada dependensi PHP                |
| Git               | 2.x           | Untuk clone & version control                |

> **Windows:** Disarankan pakai [Laragon](https://laragon.org/) - sudah bundle PHP 8, MySQL, dan Apache dalam satu installer.
> **Mac/Linux:** Gunakan Homebrew atau package manager distro masing-masing.

---

## 1. Lokal / Development

### 1.1 Clone Repository

```bash
git clone <url-repo> truecount
cd truecount
```

### 1.2 Konfigurasi Environment

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Mac / Linux
cp .env.example .env
```

Buka `.env` dan sesuaikan:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=truecount_db
DB_USER=root
DB_PASS=            # kosong jika XAMPP/Laragon default

APP_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

JWT_SECRET=ganti-ini-dengan-string-acak-minimal-32-karakter
JWT_EXPIRE=3600

# Kunci enkripsi (wajib untuk pesan terenkripsi & foto identitas)
ENCRYPTION_KEY_B64=GENERATE_DULU   # php -r "echo base64_encode(random_bytes(32));"
CHACHA20_KEY_B64=GENERATE_DULU     # php -r "echo base64_encode(random_bytes(32));"

# Masa berlaku undangan pendaftaran (hari)
INVITE_EXPIRE_DAYS=7
```

> **⚠️ `DB_HOST` harus `127.0.0.1`, jangan `localhost`.** Di Windows, `localhost` di-resolve ke IPv6 (`::1`) lebih dulu sehingga setiap koneksi MySQL mundur **±2 detik** sebelum fallback ke IPv4. Efeknya `/health` dan semua request jadi lambat, dan aplikasi desktop terus-menerus dinyatakan "tidak dapat terhubung" karena check timeout (lihat `docs/dev/knowledge_transfer.md` poin 25).

> **Tips:** Buat JWT_SECRET dari terminal:
>
> ```bash
> # Linux / Mac
> openssl rand -hex 32
>
> # PHP (semua platform)
> php -r "echo bin2hex(random_bytes(32));"
> ```

### 1.3 Setup Database

```bash
# Jalankan semua migration (buat tabel)
php database/migrate.php

# Atau migration + seed akun admin default
php database/migrate.php --seed

# Jika ingin reset dari awal (DROP semua tabel lalu buat ulang)
php database/migrate.php --fresh --seed
```

Akun admin default (setelah `--seed`):

| Field    | Value              |
|----------|--------------------|
| Username | `admin`            |
| Email    | `admin@truecount.local` |
| Password | `Admin@1234`       |
| Role     | `admin`            |

Akun developer default (setelah `--seed`):

| Field    | Value              |
|----------|--------------------|
| Username | `dev`              |
| Email    | `dev@truecount.local` |
| Password | `Dev@1234`         |
| Role     | `dev`              |

> ⚠️ **Ganti password admin dan dev** setelah pertama kali login.

### 1.4 Jalankan Backend (PHP Built-in Server)

```bash
php -S localhost:8000 -t backend backend/index.php
```

Verifikasi: buka `http://localhost:8000/health` - harus muncul `{"status":"ok"}`.

### 1.5 Jalankan Frontend (Vite Dev Server)

```bash
cd frontend
npm install       # hanya pertama kali atau setelah pull
npm run dev       # http://localhost:5173

# Alternatif: jalankan backend PHP + frontend sekaligus dalam satu terminal
npm run dev:full
```

Frontend tersedia di `http://localhost:5173`.

**Akses dari HP / PC lain (LAN) — dua mode:**

| Perintah | URL yang dibuka di client | Kamera di browser |
|---|---|---|
| `npm run dev -- --host` | `http://<ip-lan>:5173` | ❌ (browser hanya mengizinkan kamera di HTTPS/localhost) |
| `npm run dev:https` | `https://<ip-lan>:5173` | ✅ (self-signed — terima peringatan sertifikat sekali) |

`npm run dev:https` menjalankan Vite dengan **HTTPS self-signed** dan **mem-proxy route API ke PHP (`127.0.0.1:8000`)** sehingga halaman & API berada di origin yang sama — alamat server di aplikasi cukup diisi sama dengan URL halaman (`https://<ip-lan>:5173`).

> **Aturan emas:** skema harus cocok — `dev -- --host` ↔ `http://`, `dev:https` ↔ `https://`. Salah pasangan → browser menampilkan *"not send any data"* / *"tidak dapat menerima apa-apa"*.
>
> **Untuk demo dengan aplikasi desktop (Tauri) mode ini tidak diperlukan** — webview aplikasi adalah secure context, kamera jalan tanpa HTTPS.

### 1.6 Ringkasan Port Lokal

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | <http://localhost:5173>      |
| Backend   | <http://localhost:8000>      |
| MySQL     | localhost:3306             |

---

## 2. Server / Production

Skenario ini menggunakan VPS / shared hosting dengan Apache atau Nginx.

### 2.1 Persiapan Server

Pastikan server sudah terinstall:

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install php8.1 php8.1-pdo php8.1-mysql php8.1-mbstring php8.1-openssl \
                 mysql-server nginx nodejs npm git -y
```

Cek versi:

```bash
php -v
mysql --version
node -v
npm -v
```

### 2.2 Upload Kode

```bash
# Clone langsung di server
git clone <url-repo> /var/www/truecount
cd /var/www/truecount
```

Atau upload via SCP/FTP, lalu pastikan semua file ada.

### 2.3 Konfigurasi Environment di Server

```bash
cp .env.example .env
nano .env   # atau vim .env
```

Nilai yang **wajib** diganti di production:

```env
APP_ENV=production
FRONTEND_ORIGIN=https://domain-kamu.com

DB_HOST=127.0.0.1
DB_NAME=truecount_db
DB_USER=truecount_user   # buat user khusus, jangan pakai root
DB_PASS=password-kuat-disini

JWT_SECRET=string-acak-minimal-64-karakter-untuk-production

# Kunci enkripsi — WAJIB diganti & disimpan aman.
# Kalau hilang/berubah, foto ID & pesan terenkripsi lama tidak bisa dibuka.
ENCRYPTION_KEY_B64=<base64 32 byte acak>
CHACHA20_KEY_B64=<base64 32 byte acak>
```

> Buat nilai acak dengan `php -r "echo base64_encode(random_bytes(32));"` (jalankan dua kali, satu untuk tiap variabel). Jangan pakai nilai contoh dari `.env.example`.

### 2.4 Buat User MySQL Khusus

```sql
-- Login sebagai root MySQL
CREATE DATABASE truecount_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'truecount_user'@'localhost' IDENTIFIED BY 'password-kuat-disini';
GRANT ALL PRIVILEGES ON truecount_db.* TO 'truecount_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2.5 Jalankan Migration

```bash
php database/migrate.php --seed
```

### 2.6 Build Frontend

```bash
cd /var/www/truecount/frontend
npm install
npm run build
# Output ada di frontend/dist/
```

### 2.7 Konfigurasi Nginx

Buat file konfigurasi Nginx:

```bash
sudo nano /etc/nginx/sites-available/truecount
```

Isi dengan:

```nginx
server {
    listen 80;
    server_name domain-kamu.com www.domain-kamu.com;

    # ── Frontend (React build) ──────────────────────────
    root /var/www/truecount/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }

    # ── Backend PHP API ─────────────────────────────────
    location /api/ {
        alias /var/www/truecount/backend/;
        try_files $uri $uri/ /api/index.php?$query_string;

        location ~ \.php$ {
            fastcgi_pass unix:/run/php/php8.1-fpm.sock;
            fastcgi_index index.php;
            fastcgi_param SCRIPT_FILENAME $request_filename;
            include fastcgi_params;
        }
    }

    # ── Blokir akses ke file sensitif ───────────────────
    location ~ /\.(env|git) {
        deny all;
        return 404;
    }
}
```

Aktifkan dan reload:

```bash
sudo ln -s /etc/nginx/sites-available/truecount /etc/nginx/sites-enabled/
sudo nginx -t          # validasi config
sudo systemctl reload nginx
```

### 2.8 Konfigurasi Apache (Alternatif)

Jika menggunakan Apache dengan `mod_php`, buat `.htaccess` di `backend/`:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.php [QSA,L]
```

Dan pastikan `AllowOverride All` aktif di konfigurasi virtual host Apache.

### 2.9 HTTPS dengan Let's Encrypt (Direkomendasikan)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d domain-kamu.com -d www.domain-kamu.com
```

Certbot otomatis mengupdate konfigurasi Nginx dan menjadwalkan renewal.

### 2.10 Permission File

```bash
# Backend tidak boleh diakses langsung dari web
sudo chown -R www-data:www-data /var/www/truecount/backend
sudo chmod -R 755 /var/www/truecount/backend

# Storage root: foto auth, foto ID (KTP/SIM), file & pesan terenkripsi, log.
# Default di <backend>/storage — atau lokasi TC_STORAGE_ROOT kalau di-set di .env.
sudo mkdir -p /var/www/truecount/backend/storage/{auth_photos,id_photos,logs,private/encrypted-files,private/candidate-photos}
sudo chown -R www-data:www-data /var/www/truecount/backend/storage
sudo chmod -R 750 /var/www/truecount/backend/storage

# Frontend dist bisa dibaca oleh Nginx
sudo chown -R www-data:www-data /var/www/truecount/frontend/dist
```

### 2.11 Script deploy server lokal (Windows)

Untuk demo **1 laptop sebagai server + N PC peserta sebagai client**, langkah manual di atas bisa diringkas menjadi satu script:

```powershell
.\scripts\deploy-server.ps1 -Migrate -SeedAdmin -OpenFirewall
```

Script ini hanya untuk Windows (PowerShell 5.1+) dan memakai `php -S`, bukan Nginx/Apache. Cocok untuk demo tertutup di jaringan lokal.

#### Yang dilakukan script

1. **Preflight** - cek PHP >= 8.1 di PATH, ekstensi `pdo_mysql`, `mbstring`, `openssl`, `gd`, `fileinfo`, dan MySQL/MariaDB berjalan.
2. **Siapkan `.env`** - kalau belum ada, salin dari `.env.example` lalu buat otomatis `JWT_SECRET`, `ENCRYPTION_KEY_B64`, `CHACHA20_KEY_B64`, `SERVER_ID`, `SETUP_TOKEN`. Kalau `.env` sudah ada, hanya key yang hilang/kosong yang dilengkapi (dengan backup `.env.bak.<timestamp>`). Nilai `DB_HOST` selalu dipaksa `127.0.0.1` (bukan `localhost` — di Windows `localhost` menambah delay ±2 detik per koneksi MySQL), dan `.env` lama yang masih `DB_HOST=localhost` otomatis dibetulkan (dengan backup).
3. **Cek port** - kalau port dipakai, script berhenti dan menyarankan `scripts/free-ports.ps1`. Dengan `-Force`, proses pemilik port dihentikan.
4. **Migrasi** (`-Migrate`) - `php database/migrate.php`, tanpa `--seed` dan tanpa `--fresh`. Migration yang sudah berhasil dicatat di tabel `schema_migrations`, jadi aman dijalankan berulang; database lama yang belum punya catatan akan ditandai otomatis saat objeknya sudah ada.
5. **Seed admin** (`-SeedAdmin`) - `php scripts/seed_admin.php`, hanya akun admin dan idempoten (`ON DUPLICATE KEY UPDATE`).
6. **Build frontend** (`-BuildFrontend`) - `npm run build` di `frontend/`.
7. **Firewall** (`-OpenFirewall`) - rule inbound TCP port API, profil **Private** saja. Butuh PowerShell Administrator.
8. **Nyalakan server** - `php -S 0.0.0.0:8000 -t backend backend/index.php`, lalu polling `/health` (timeout 5 detik) dan menampilkan status database.

#### Parameter

| Parameter | Default | Fungsi |
|---|---|---|
| `-Port` | `8000` | Port API |
| `-BindAddress` | `0.0.0.0` | `127.0.0.1` kalau hanya untuk laptop sendiri |
| `-Migrate` | off | Jalankan migration |
| `-SeedAdmin` | off | Seed akun admin saja |
| `-BuildFrontend` | off | Build frontend produksi |
| `-OpenFirewall` | off | Rule inbound profil Private |
| `-SkipChecks` | off | Lewati cek ekstensi & MySQL (tidak disarankan) |
| `-Force` | off | Izinkan menghentikan proses yang memakai port |
| `-RecreateEnv` | off | Buat ulang `.env` (konfirmasi `OVERWRITE`) |
| `-CheckOnly` | off | Preflight + siapkan `.env`, jangan nyalakan server |
| `-Stop` | off | Hentikan proses yang listen di port tersebut |

#### Output yang ditampilkan

```
================= TrueCount Demo Server =================
  Bind     : 0.0.0.0:8000
  Lokal    : http://localhost:8000/
  LAN      : http://192.168.1.10:8000/
  Health   : http://localhost:8000/health
  Setup    : http://localhost:8000/__tc-setup?k=<SETUP_TOKEN>
=========================================================
```

`SETUP_TOKEN` **tidak** dicetak; ambil dari `.env`.

#### Mengarahkan client desktop (Tauri)

Build client sekali dengan alamat default laptop server:

```env
# frontend/.env
VITE_DEFAULT_SERVER_URL=http://<ip-laptop>:8000
```

```powershell
cd frontend
npm run desktop:build
```

Di tiap PC peserta, alamat masih bisa diubah tanpa rebuild:

- Tekan **Ctrl + Shift + Alt + S**, atau jalankan `__tcServerConfig()` di DevTools console.
- Mode **Client** = tanpa PHP lokal; mode **Server** = PHP laptop listen `0.0.0.0:8000`; mode **Standalone** = `127.0.0.1:8000`.
- Tekan **Tes koneksi** untuk memastikan `/health` menjawab dan database `connected`.
- **Simpan & sambungkan** menyimpan `app_config.json` di folder config aplikasi, lalu **langsung mencoba koneksi dari halaman itu** (3× percobaan otomatis) tanpa melempar user ke landing page — hasilnya tampil di panel Status koneksi. Tombol **Buka beranda** tersedia kalau ingin melanjutkan.

Server `/health` mengembalikan `server_id`, `server_label`, dan `time`, sehingga client bisa memastikan terhubung ke laptop yang benar. Query log seperti `?token=` disamarkan menjadi `***`.

#### Keamanan

- Script tidak pernah membuka port 3306 dan tidak membuat rule firewall untuk profil Public.
- Script **memperingatkan** kalau MySQL ternyata listen di `0.0.0.0:3306`. Perbaikannya manual: set `bind-address = 127.0.0.1` di `my.ini`, lalu restart MySQL. Cek dari PC lain dengan `Test-NetConnection <ip-laptop> -Port 3306` (harus gagal).
- Secret tidak dicetak ke console maupun log.
- `.env` yang sudah ada tidak ditimpa. `-RecreateEnv` membuat kunci enkripsi baru sehingga **data lama tidak bisa dibuka**.
- `migrate.php --fresh` dan `--seed` tidak pernah dijalankan otomatis.

#### Catatan performa

`php -S` memproses satu request pada satu waktu dan `PHP_CLI_SERVER_WORKERS` tidak berfungsi di Windows. Untuk **lebih dari 8 client aktif**, gunakan Apache (Laragon) atau Nginx + PHP-FPM dengan document root `backend/`.

#### Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `php tidak ditemukan di PATH` | PHP belum di PATH | Tambahkan folder PHP ke PATH, buka terminal baru |
| `Ekstensi PHP belum aktif` | `extension=` dimatikan di `php.ini` | Aktifkan ekstensi, restart terminal |
| `MySQL/MariaDB tidak berjalan` | Service/Laragon mati | Nyalakan service, atau jalankan Laragon |
| `Database belum siap` | DB belum dibuat / `DB_*` salah | Jalankan dengan `-Migrate`, cek `.env` |
| `Port 8000 masih dipakai` | PHP/server lain jalan | `.\scripts\free-ports.ps1` atau `-Force` |
| `-OpenFirewall butuh Administrator` | Terminal tidak elevated | Buka PowerShell as Administrator |
| Client tidak bisa connect | Firewall / AP isolation | Cek rule Private, coba hotspot sendiri |
| Peringatan `MySQL listen di 0.0.0.0:3306` | `bind-address` masih dikomentari | Set `bind-address=127.0.0.1` di `my.ini` lalu restart MySQL. XAMPP: `<folder-xampp>\mysql\bin\my.ini` |

---

## 3. Checklist Sebelum Demo / Go-Live

### Keamanan

- [ ] `APP_ENV` di-set ke `production`
- [ ] `JWT_SECRET` diganti dengan string acak panjang (≥ 64 karakter)
- [ ] Password database tidak kosong
- [ ] File `.env` **tidak** ikut ter-commit ke Git
- [ ] Akun admin default sudah diganti password-nya
- [ ] Akses ke `.env`, `.git`, `database/` diblokir di web server
- [ ] Folder `backend/storage/` (atau `TC_STORAGE_ROOT`) **tidak** bisa diakses langsung dari web
- [ ] HTTPS sudah aktif

### Fungsionalitas

- [ ] Migration berhasil - semua tabel terbuat (cek `php database/migrate.php` tanpa error)
- [ ] Health check `GET /health` mengembalikan `200 OK`
- [ ] `ENCRYPTION_KEY_B64` dan `CHACHA20_KEY_B64` sudah diisi nilai acak (bukan `GENERATE_DULU`)
- [ ] Registrasi lewat undangan berhasil (termasuk **foto KTP/SIM**) — pendaftaran publik memang ditutup
- [ ] Foto ID bisa dibuka lagi di halaman **Profil** setelah akun dibuat
- [ ] Login berhasil dan mendapatkan JWT
- [ ] Frontend bisa berkomunikasi dengan backend (tidak ada error CORS)
- [ ] Halaman Dashboard hanya bisa diakses setelah login

### Performa

- [ ] Frontend sudah di-build (`npm run build`), bukan dev server
- [ ] Tidak ada `console.log` sensitif yang tertinggal
- [ ] Error PHP tidak ditampilkan ke browser (`display_errors = Off` di php.ini)

---

## 4. Troubleshooting Umum

| Masalah | Kemungkinan Penyebab | Solusi |
| --- | --- | --- |
| `CORS error` di browser | `FRONTEND_ORIGIN` di `.env` tidak cocok | Pastikan isinya persis sama dengan URL frontend (termasuk port). Origin IP LAN (10.x / 172.16–31.x / 192.168.x) sudah diizinkan otomatis sejak 20 Nov 2026 |
| "Tidak dapat terhubung ke server" padahal `/health` jalan di browser | Dulu: `DB_HOST=localhost` membuat `/health` ~2 detik sehingga selalu melewati timeout 2 detik | Pakai `DB_HOST=127.0.0.1` (cek `.env` — sudah otomatis dibetulkan `deploy-server.ps1`) |
| App/browser tidak bisa connect, padahal request muncul di log server | CORS menolak origin pemanggil (kasus lama untuk akses via IP LAN) | Update `backend/helpers/response.php` ke versi terbaru (origin IP privat diizinkan) |
| Browser HP: *"not send any data"* / *"tidak dapat menerima apa-apa"* | Salah pasangan skema: `https://` ke server http (atau sebaliknya) | Samakan: `dev -- --host` ↔ `http://`, `dev:https` ↔ `https://` |
| Membuka `/health` malah "ketendang" ke landing page | Request tidak kena proxy API (server lama tanpa config baru) | Restart frontend dengan config terbaru; pastikan banner Vite sesuai mode (`https://` untuk `dev:https`) |
| Kamera tidak muncul di browser (HP/PC) | Halaman dibuka via `http://<ip-lan>` — browser menonaktifkan kamera di non-secure context | Pakai `npm run dev:https`, **atau** pakai aplikasi desktop TrueCount (kamera jalan tanpa HTTPS) |
| Foto (paslon / log keamanan) tidak tampil di PC lain | File foto hanya ada di laptop server, atau server tidak sedang jalan | Foto dilayani via API dari server — pastikan app mode Server/deploy-server hidup dan file storage tidak terpecah antar folder (lihat `desktop.md` bagian storage root) |
| Client tidak bisa menjangkau server dari perangkat lain | Firewall port 8000 tertutup, atau perangkat beda jaringan/SSID | `.\scripts\deploy-server.ps1 -OpenFirewall` (Admin, profil Private); pastikan semua perangkat satu Wi-Fi yang sama (SSID kembar seperti "X" vs "X Wi-Fi" sering menipu) |
| `PDOException: could not find driver` | Ekstensi `pdo_mysql` PHP belum aktif | Aktifkan di `php.ini`: `extension=pdo_mysql` |
| `Access denied for user` MySQL | User / password salah | Cek `.env` dan cocokkan dengan user MySQL |
| Migration gagal di tengah jalan | Ada syntax error di SQL atau tabel sudah ada | Jalankan `php database/migrate.php --fresh` |
| React blank page di production | Build belum dijalankan atau path API salah | Jalankan `npm run build`, cek `VITE_API_URL` di frontend |
| JWT expired terus | `JWT_EXPIRE` terlalu kecil | Naikkan nilai (dalam detik), default 3600 = 1 jam |

---

## 5. Environment Variables - Referensi Lengkap

| Variable          | Default                        | Keterangan                                    |
|-------------------|--------------------------------|-----------------------------------------------|
| `DB_HOST`         | `127.0.0.1`                    | Host MySQL — **pakai `127.0.0.1`, bukan `localhost`** (di Windows `localhost` di-resolve ke IPv6 lebih dulu → delay ±2 detik per koneksi) |
| `TC_STORAGE_ROOT` | *(kosong = `backend/storage`)* | Lokasi folder storage: foto auth, foto ID (KTP/SIM), file terenkripsi (`private/encrypted-files`), dan log. **Harus path absolut** di `.env` agar sama di Tauri dan `deploy-server.ps1`. Contoh Windows: `D:/proyek/truecount/backend/storage` |
| `DB_PORT`         | `3306`                         | Port MySQL                                    |
| `DB_NAME`         | `truecount_db`                 | Nama database                                 |
| `DB_USER`         | `root`                         | User MySQL                                    |
| `DB_PASS`         | *(kosong)*                     | Password MySQL                                |
| `APP_ENV`         | `development`                  | `development` atau `production`               |
| `FRONTEND_ORIGIN` | `http://localhost:5173`        | Origin yang diizinkan CORS                    |
| `JWT_SECRET`      | *(wajib diganti)*              | Secret key untuk signing JWT                  |
| `JWT_EXPIRE`      | `3600`                         | Durasi token JWT dalam detik                  |
| `INVITE_EXPIRE_DAYS` | `7`                         | Masa berlaku link undangan pendaftaran (hari) |
| `ENCRYPTION_KEY_B64` | *(wajib diganti)*           | Kunci AES-256-GCM (base64 32 byte) untuk foto auth/ID & pesan AES |
| `CHACHA20_KEY_B64` | *(wajib diganti)*             | Kunci ChaCha20-Poly1305 (base64 32 byte) untuk file/pesan suara |
| `SERVER_ID`       | *(dibuat script)*              | Identitas server demo, dipakai client memastikan server benar |
| `SERVER_LABEL`    | `Laptop Demo`                  | Label server yang ditampilkan di client           |
| `WEBAUTHN_RP_ID`  | `localhost`                    | Relying Party ID WebAuthn (domain saat production) |
| `WEBAUTHN_ORIGIN` | `http://localhost:8000`        | Origin WebAuthn (samakan dengan URL aplikasi)     |

> **Catatan kunci enkripsi:** `ENCRYPTION_KEY_B64` dan `CHACHA20_KEY_B64` harus dibuat dengan `php -r "echo base64_encode(random_bytes(32));"`. Kalau nilainya berubah setelah data ada, foto ID dan pesan/file terenkripsi lama **tidak bisa didekripsi**. Simpan di tempat aman dan jangan commit `.env`.

## 6. Deploy Desktop (Tauri)

Untuk panduan lengkap konversi ke aplikasi desktop, lihat [`desktop.md`](../desktop/desktop.md).

Ringkasan cepat:

```bash
# Prasyarat: Rust + Build Tools + PHP di PATH (lihat [`desktop.md`](../desktop/desktop.md))
cd frontend
npm run desktop:dev      # dev mode dengan window desktop (PHP di-spawn otomatis)
npm run desktop:build    # build installer (.exe / .dmg / .deb)
```

Backend PHP di-spawn otomatis oleh app (port 8000, tanpa konsol) dan di-kill saat app ditutup.
Folder `backend/` ikut ter-bundle di installer sebagai resource.

Output installer ada di `frontend/src-tauri/target/release/bundle/`.

| Tambahan Troubleshoot Desktop | Penyebab | Solusi |
| --- | --- | --- |
| `error: linker 'link.exe' not found` | Build Tools belum terinstall | Install Microsoft C++ Build Tools |
| "Tidak dapat terhubung ke server" | PHP gagal spawn / error backend / MySQL mati | Cek `%LOCALAPPDATA%\com.truecount.app\logs\truecount.log` + `php.log`; pastikan service MySQL jalan |
| Log: `gagal menjalankan php` | `php` tidak ada di PATH mesin user | Install PHP 8.1+, verifikasi `where php` |
| Log: `Failed opening required '\\?\C:\...'` | Extended path `\\?\` tidak di-strip | Sudah ditangani di `lib.rs` (`clean_path`); jangan hapus |
| `Entry Point Not Found: TaskDialogIndirect` | Fitur `dialog` Tauri butuh Windows baru | Sudah ditangani: `default-features = false` di `Cargo.toml` |
| Build gagal `transformWithEsbuild` | Vite 8 tidak bundle esbuild | `npm install -D esbuild terser` di `frontend/` |
| Window putih / blank | PHP server tidak jalan | Sekarang auto-spawn - cek `php.log` di folder log di atas |
| `tauri: command not found` | `@tauri-apps/cli` belum terinstall | `npm install` di folder `frontend/` |
| Build gagal `icons not found` | Folder `src-tauri/icons/` kosong | `npx tauri icon public/raise_hand.jpg --fit cover` |

---

---

> Dokumen ini akan diperbarui setiap sprint baru menambahkan endpoint atau konfigurasi baru.
