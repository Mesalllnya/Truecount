# TrueCount — Panduan Deploy

Dokumen ini mencakup dua skenario:

- **[Lokal / Development](#1-lokal--development)** — untuk pengerjaan sehari-hari di laptop masing-masing.
- **[Server / Production](#2-server--production)** — untuk demo akhir atau hosting publik.

---

## Prasyarat Umum

| Kebutuhan         | Versi Minimum | Catatan                                      |
|-------------------|---------------|----------------------------------------------|
| PHP               | 8.1           | Butuh ekstensi: `pdo_mysql`, `mbstring`, `openssl` |
| MySQL / MariaDB   | 8.0 / 10.6    | Bisa pakai XAMPP, Laragon, atau native       |
| Node.js + npm     | 18 LTS        | Untuk build React                            |
| Composer          | 2.x           | Jika nanti ada dependensi PHP                |
| Git               | 2.x           | Untuk clone & version control                |

> **Windows:** Disarankan pakai [Laragon](https://laragon.org/) — sudah bundle PHP 8, MySQL, dan Apache dalam satu installer.
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
DB_HOST=localhost
DB_PORT=3306
DB_NAME=truecount_db
DB_USER=root
DB_PASS=            # kosong jika XAMPP/Laragon default

APP_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

JWT_SECRET=ganti-ini-dengan-string-acak-minimal-32-karakter
JWT_EXPIRE=3600
```

> **Tips:** Buat JWT_SECRET dari terminal:
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

> ⚠️ **Ganti password admin** setelah pertama kali login.

### 1.4 Jalankan Backend (PHP Built-in Server)

```bash
php -S localhost:8000 -t backend backend/index.php
```

Verifikasi: buka `http://localhost:8000/health` — harus muncul `{"status":"ok"}`.

### 1.5 Jalankan Frontend (Vite Dev Server)

```bash
cd frontend
npm install       # hanya pertama kali atau setelah pull
npm run dev
```

Frontend tersedia di `http://localhost:5173`.

### 1.6 Ringkasan Port Lokal

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173      |
| Backend   | http://localhost:8000      |
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

DB_HOST=localhost
DB_NAME=truecount_db
DB_USER=truecount_user   # buat user khusus, jangan pakai root
DB_PASS=password-kuat-disini

JWT_SECRET=string-acak-minimal-64-karakter-untuk-production
```

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
sudo chmod -R 700 /var/www/truecount/backend/storage

# Frontend dist bisa dibaca oleh Nginx
sudo chown -R www-data:www-data /var/www/truecount/frontend/dist
```

---

## 3. Checklist Sebelum Demo / Go-Live

### Keamanan

- [ ] `APP_ENV` di-set ke `production`
- [ ] `JWT_SECRET` diganti dengan string acak panjang (≥ 64 karakter)
- [ ] Password database tidak kosong
- [ ] File `.env` **tidak** ikut ter-commit ke Git
- [ ] Akun admin default sudah diganti password-nya
- [ ] Akses ke `.env`, `.git`, `database/` diblokir di web server
- [ ] HTTPS sudah aktif

### Fungsionalitas

- [ ] Migration berhasil — semua 10 tabel terbuat
- [ ] Health check `GET /health` mengembalikan `200 OK`
- [ ] Register akun baru berhasil
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
|---|---|---|
| `CORS error` di browser | `FRONTEND_ORIGIN` di `.env` tidak cocok | Pastikan isinya persis sama dengan URL frontend (termasuk port) |
| `PDOException: could not find driver` | Ekstensi `pdo_mysql` PHP belum aktif | Aktifkan di `php.ini`: `extension=pdo_mysql` |
| `Access denied for user` MySQL | User / password salah | Cek `.env` dan cocokkan dengan user MySQL |
| Migration gagal di tengah jalan | Ada syntax error di SQL atau tabel sudah ada | Jalankan `php database/migrate.php --fresh` |
| React blank page di production | Build belum dijalankan atau path API salah | Jalankan `npm run build`, cek `VITE_API_URL` di frontend |
| JWT expired terus | `JWT_EXPIRE` terlalu kecil | Naikkan nilai (dalam detik), default 3600 = 1 jam |

---

## 5. Environment Variables — Referensi Lengkap

| Variable          | Default                        | Keterangan                                    |
|-------------------|--------------------------------|-----------------------------------------------|
| `DB_HOST`         | `localhost`                    | Host MySQL                                    |
| `DB_PORT`         | `3306`                         | Port MySQL                                    |
| `DB_NAME`         | `truecount_db`                 | Nama database                                 |
| `DB_USER`         | `root`                         | User MySQL                                    |
| `DB_PASS`         | *(kosong)*                     | Password MySQL                                |
| `APP_ENV`         | `development`                  | `development` atau `production`               |
| `FRONTEND_ORIGIN` | `http://localhost:5173`        | Origin yang diizinkan CORS                    |
| `JWT_SECRET`      | *(wajib diganti)*              | Secret key untuk signing JWT                  |
| `JWT_EXPIRE`      | `3600`                         | Durasi token JWT dalam detik                  |


## 6. Deploy Desktop (Tauri)

Untuk panduan lengkap konversi ke aplikasi desktop, lihat [`desktop.md`](desktop.md).

Ringkasan cepat:

```bash
# Prasyarat: Rust + Build Tools (lihat desktop.md)
cd frontend
npm run desktop:dev      # dev mode dengan window desktop
npm run desktop:build    # build installer (.exe / .dmg / .deb)
```

Output installer ada di `frontend/src-tauri/target/release/bundle/`.

| Tambahan Troubleshoot Desktop | Penyebab | Solusi |
|---|---|---|
| `error: linker 'link.exe' not found` | Build Tools belum terinstall | Install Microsoft C++ Build Tools |
| Window putih / blank | PHP server belum jalan | Jalankan `php -S localhost:8000` dulu |
| `tauri: command not found` | `@tauri-apps/cli` belum terinstall | `npm install` di folder `frontend/` |
| Build gagal `icons not found` | Folder `src-tauri/icons/` kosong | Jalankan `npx tauri icon icon.png` |

---


---

> Dokumen ini akan diperbarui setiap sprint baru menambahkan endpoint atau konfigurasi baru.
