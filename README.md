<p align="center">
  <img src="frontend/public/logo/TrueCount_navLogo_lightmode.svg#gh-light-mode-only" width="200" />
  <img src="frontend/public/logo/TrueCount_navLogo_darkmode.svg#gh-dark-mode-only" width="200" />
</p>

# TrueCount

Secure e-voting system untuk pemilihan akademik. Tersedia sebagai aplikasi web dan desktop (Tauri) dengan backend PHP native.

- [x] Enkripsi ujung-ke-ujung (AES-256-GCM, ChaCha20-Poly1305)
- [x] Autentikasi multi-faktor (WebAuthn / Windows Hello, token USB — token USB khusus role admin)
- [x] Audit blockchain untuk integritas suara
- [x] Kamera aman untuk verifikasi identitas saat login
- [x] Mode server / standalone untuk demo jaringan lokal
- [x] Backend PHP 8.1+ native, tanpa framework

## Dokumentasi

| Dokumen | Isi |
|---------|-----|
| [`docs/deploy/deploy.md`](docs/deploy/deploy.md) | Setup lokal, server, Nginx, HTTPS, checklist |
| [`docs/deploy/docker.md`](docs/deploy/docker.md) | Deploy backend + MySQL dengan Docker Compose / pod |
| [`docs/desktop/desktop.md`](docs/desktop/desktop.md) | Konversi ke .exe / .dmg / .deb via Tauri |
| [`docs/admin/PANDUAN_ADMIN.md`](docs/admin/PANDUAN_ADMIN.md) | Panduan operasional admin dan panitia |
| [`docs/dev/knowledge_transfer.md`](docs/dev/knowledge_transfer.md) | Konteks lengkap untuk AI dan onboarding |
| [`docs/dev/user-flow.md`](docs/dev/user-flow.md) | Alur pengguna per peran + diagram Mermaid |
| [`docs/archive/README.md`](docs/archive/README.md) | Dokumen rencana yang sudah selesai/ditunda (arsip) |

## Cara Kerja

TrueCount adalah kombinasi dari beberapa komponen open source dan teknologi kriptografi modern.

- **PostgreSQL / MySQL** — penyimpanan data terstruktur dengan integritas transaksional.
- **PHP (native)** — backend API tanpa framework, routing melalui `backend/index.php`.
- **React 19 + Vite 8** — frontend web yang di-wrap oleh Tauri untuk aplikasi desktop.
- **Tauri v2 (Rust)** — wrapper desktop yang menyediakan webview native dan spawn backend PHP otomatis.
- **WebAuthn / Windows Hello** — autentikasi biometrik berbasis kunci publik.
- **AES-256-GCM + ChaCha20-Poly1305** — enkripsi suara dan pesan di sisi klien sebelum dikirim ke server.
- **Blockchain audit** — setiap peristiwa pemilihan dicatat dan dirantai untuk deteksi manipulasi.

## Quick Start

### Web

```bash
# 1. Salin dan sesuaikan environment
cp .env.example .env
# Isi DB_PASS dan JWT_SECRET. Pastikan DB_HOST=127.0.0.1 (bukan localhost).

# 2. Jalankan migrasi database
php database/migrate.php --seed

# 3. Jalankan backend dan frontend
cd frontend
npm install
npm run dev:full   # PHP :8000 + Vite :5173 sekaligus
```

### Desktop (Tauri)

Prasyarat: [Rust](https://rustup.rs/) dan [Build Tools](https://v2.tauri.app/start/prerequisites/). PHP harus tersedia di PATH.

```bash
cd frontend
npm install
npm run desktop:dev     # Window development (PHP di-spawn otomatis)
npm run desktop:build   # Build installer (.msi / .exe NSIS di Windows)
```

Backend PHP di-spawn otomatis saat aplikasi desktop dibuka dan dihentikan saat ditutup.

### Server Demo (Satu Laptop)

Topologi demo: laptopmu menjadi server, PC peserta menjalankan aplikasi desktop yang terhubung ke laptop itu.

```powershell
.\scripts\deploy-server.ps1 -CheckOnly
.\scripts\deploy-server.ps1 -Migrate -SeedAdmin -OpenFirewall
.\scripts\deploy-server.ps1 -Stop
```

Lihat [`docs/deploy/deploy.md`](docs/deploy/deploy.md) untuk panduan lengkap.

## Struktur Proyek

```
Truecount/
├── backend/                 # PHP API
│   ├── api/                 # Endpoint: auth, elections, invites, mfa/usb, users, voice-messages, encrypted-messages
│   ├── config/              # Konfigurasi database, app, env
│   ├── helpers/             # Utility: response, jwt, logger, storage, webauthn
│   ├── middleware/          # requireAuth, requireAdmin
│   ├── services/crypto/     # AES-GCM, ChaCha20-Poly1305, blockchain, steganografi
│   └── index.php            # Entry point + router
├── database/
│   ├── migrations/          # 13 file migrasi SQL
│   ├── seeds/               # Seed: admin, dummy users, dev
│   └── migrate.php          # CLI runner (--seed, --fresh)
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── pages/           # Landing, Masuk, Daftar, Dasbor, Pilih, Hasil, Pengaturan, dll.
│   │   ├── components/      # Nav, AuthGuard, ElectionModals, HealthMonitor, dll.
│   │   ├── hooks/           # useAuth, useAuthSecurity, useUsbToken, useWebAuthn
│   │   └── src-tauri/       # Tauri (desktop wrapper)
│   └── vite.config.js
├── tests/                   # Uji API, USB, kripto, blockchain
├── docs/
│   ├── deploy/              # Panduan deploy lokal & server
│   ├── desktop/             # Panduan konversi ke desktop
│   ├── admin/               # Panduan operasional admin
│   └── dev/                 # Konteks proyek untuk AI & onboarding
├── scripts/
│   ├── deploy-server.ps1    # Deploy + start server demo (LAN)
│   ├── free-ports.ps1       # Bebaskan port 5173 / 5183 / 8000
│   └── check_db.php         # Cek kondisi database
└── .env.example
```

## API Endpoints

Base URL: `http://localhost:8000`

| Method | Path | Auth | Keterangan |
|--------|------|------|------------|
| GET | `/health` | — | Health check |
| POST | `/auth/register` | Undangan | Daftar akun, wajib `invite_token` |
| POST | `/auth/login` | — | Login, dapat JWT |
| POST | `/auth/logout` | — | Logout |
| GET | `/auth/me` | JWT | Info user dari token |
| POST | `/auth/change-password` | JWT | Ganti password (Argon2id) |
| GET | `/auth/security-setup` | JWT | Cek status keamanan user |
| POST | `/auth/security-status` | — | Cek status keamanan by identifier (publik) |
| GET | `/auth/attempts/list` | JWT (admin) | Daftar percobaan login (audit admin) |
| GET | `/auth/attempts/{id}/photo` | JWT (admin) | Foto kamera percobaan login |
| POST | `/auth/webauthn/login/start` | — | Login Windows Hello — mulai |
| POST | `/auth/webauthn/login/verify` | — | Login Windows Hello — verifikasi |
| POST | `/auth/webauthn/register/start` | JWT | Register Windows Hello — mulai |
| POST | `/auth/webauthn/register/verify` | JWT | Register Windows Hello — verifikasi |
| GET | `/auth/webauthn/list` | JWT | Daftar Windows Hello |
| POST | `/auth/webauthn/{id}/revoke` | JWT | Hapus Windows Hello |
| GET | `/invites` | JWT (admin) | Daftar undangan + statistik |
| POST | `/invites` | JWT (admin) | Buat undangan pendaftaran |
| GET | `/invites/verify` | — | Cek status undangan (`?token=...`) |
| POST | `/invites/{id}/revoke` | JWT (admin) | Batalkan undangan |
| POST | `/mfa/usb/register/start` | JWT | MFA USB register — generate challenge |
| POST | `/mfa/usb/register/verify` | JWT | MFA USB register — verifikasi ECDSA |
| POST | `/mfa/usb/authenticate/start` | — (identifier) | MFA USB login — mulai challenge |
| POST | `/mfa/usb/authenticate/verify` | — | MFA USB login — verifikasi signature → JWT |
| GET | `/mfa/usb/list` | JWT | Daftar token USB user |
| POST | `/mfa/usb/{id}/revoke` | JWT | Nonaktifkan token USB |
| POST | `/mfa/usb/{id}/label` | JWT | Update label token USB |
| GET | `/elections` | JWT | Daftar pemilihan |
| POST | `/elections` | JWT (admin) | Buat pemilihan baru |
| GET | `/elections/:id` | JWT | Detail pemilihan + kandidat |
| PUT | `/elections/:id` | JWT (admin) | Ubah pemilihan |
| DELETE | `/elections/:id` | JWT (admin) | Hapus pemilihan |
| GET | `/elections/:id/candidates` | JWT | Daftar kandidat |
| POST | `/elections/:id/candidates` | JWT (admin) | Tambah kandidat |
| GET | `/elections/:id/candidates/:cid/photo` | JWT | Foto kandidat terenkripsi |
| POST | `/elections/:id/candidates/:cid/photo` | JWT (admin) | Upload foto kandidat |
| PUT | `/elections/:id/candidates/:cid` | JWT (admin) | Ubah kandidat |
| DELETE | `/elections/:id/candidates/:cid` | JWT (admin) | Hapus kandidat |
| GET | `/elections/:id/voters` | JWT (admin) | Daftar voter terdaftar |
| POST | `/elections/:id/voters` | JWT (admin) | Daftarkan voter ke pemilihan |
| DELETE | `/elections/:id/voters/:userId` | JWT (admin) | Keluarkan voter dari pemilihan |
| GET | `/elections/:id/results` | JWT | Hasil tally pemilihan |
| POST | `/elections/:id/vote` | JWT | Kirim suara (voter) |
| POST | `/elections/blockchain/seal` | JWT (admin) | Seal block blockchain |
| GET | `/elections/blockchain/verify` | JWT | Verifikasi integritas blockchain |
| GET | `/users/voters` | JWT (admin) | Daftar semua voter aktif |
| GET | `/users/search?q=` | JWT (admin) | Cari pengguna (admin) |
| GET | `/voice-messages/admins` | JWT (admin) | Daftar admin aktif penerima pesan suara |
| POST | `/voice-messages` | JWT (admin) | Kirim pesan suara (multipart) |
| GET | `/voice-messages/inbox` | JWT (admin) | Daftar pesan suara yang diterima |
| POST | `/voice-messages/:id/read` | JWT (admin) | Tandai pesan suara sudah dibaca |
| GET | `/voice-messages/:id/audio` | JWT (admin) | Putar audio pesan suara (hanya penerima) |
| POST | `/encrypted-messages` | JWT | Buat pesan terenkripsi |
| GET | `/encrypted-messages/:id` | JWT | Ambil pesan terenkripsi |
| GET | `/dev/flow` | JWT (admin / dev) | Data flow aplikasi untuk halaman dev |
| GET | `/dev/crypto` | JWT (admin / dev) | Data algoritma kriptografi untuk halaman dev |

Pendaftaran publik ditutup. Akun hanya bisa dibuat lewat tautan undangan yang dibuat admin (`/daftar?undangan=<token>`).

### Format Error

Semua error menggunakan format:

```json
{ "error": "Pesan error dalam Bahasa Indonesia." }
```

### Kode Status HTTP

| Kode | Keterangan |
|------|------------|
| 200 | OK |
| 201 | Created |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 405 | Method not allowed |
| 409 | Conflict |
| 422 | Unprocessable Entity |

## Test Otomatis

Backend harus berjalan di `localhost:8000`.

```bash
php tests/api_test.php
```

Output mencakup test case: auth, invite (buat / daftar / verifikasi), register via undangan, hak akses, validasi, dan method check.

Tes tambahan:

- `tests/usb_register_e2e_test.php` — E2E register USB token
- `tests/usb_manage_test.php` — Kelola USB token
- `tests/run-all-crypto-tests.ps1` — Runner tes kripto (AES, ChaCha20, Vigenere, steganografi, file encryption, blockchain)

## Stack

| Lapisan | Teknologi |
|---------|-----------|
| Frontend | React 19 + Vite 8 |
| Desktop | Tauri v2 (Rust) |
| Backend | PHP 8.1+ (native, tanpa framework) |
| Database | MySQL 8 / MariaDB 10.6 |
| Autentikasi | JWT HS256 + Argon2id |
| Font | Plus Jakarta Sans |

## Tim Pengembang

Project ini dibuat untuk **Proyek Akhir Mata Kuliah Kriptografi**.

| Nama | Peran | Fokus Sprint |
|------|-------|--------------|
| Rio Meidi Ataurrahman | Authentication & User Management | Sprint 1, 4, 4b |
| Muhamad Ifsal Fadhilah | Election Management & Voting System | Sprint 2 |
| Erlan Rifqi Davin D | Cryptography & Advanced Security | Sprint 3 |

> Mahasiswa S1 Informatika UPN "Veteran" Yogyakarta, Angkatan 2024.
