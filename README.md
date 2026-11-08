# TrueCount - Secure E-Voting System

Aplikasi web **dan desktop** pemungutan suara yang aman untuk keperluan akademik.

## Tech Stack

| Layer      | Teknologi                                    |
|------------|----------------------------------------------|
| Frontend   | React 19 + Vite 8                            |
| Desktop    | Tauri v2 (Rust) - opsional, wrap React       |
| Backend    | PHP 8.1+ (Native, no framework)              |
| Database   | MySQL 8 / MariaDB 10.6                       |
| Auth       | JWT HS256 + Argon2id                         |
| Font       | Plus Jakarta Sans                            |

## Struktur Proyek

```
Truecount/
├── backend/                # PHP API
│   ├── api/
│   │   ├── auth/           # register.php · login.php · logout.php · me.php
│   │   └── election/       # Sprint 2
│   ├── config/             # database.php · app.php
│   ├── helpers/            # response.php · jwt.php
│   ├── middleware/         # auth.php (requireAuth)
│   ├── models/             # Sprint 2+
│   ├── services/           # Sprint 2+
│   └── index.php           # Entry point + router
│
├── database/
│   ├── migrations/
│   │   └── 001_init.sql    # 10 tabel lengkap
│   ├── seeds/
│   │   └── 001_admin.sql   # Akun admin default
│   └── migrate.php         # CLI runner (--seed, --fresh)
│
├── frontend/               # React + Vite
│   ├── public/             # Aset statis (gambar artsy)
│   ├── src/
│   │   ├── pages/          # LandingPage · LoginPage · RegisterPage · DashboardPage
│   │   ├── components/     # Sprint 2+
│   │   ├── services/       # Sprint 2+
│   │   ├── context/        # Sprint 2+
│   │   └── hooks/          # Sprint 2+
│   ├── src-tauri/          # Tauri (desktop wrapper)
│   │   ├── src/            # main.rs · lib.rs
│   │   ├── tauri.conf.json
│   │   └── Cargo.toml
│   ├── package.json
│   └── vite.config.js
│
├── tests/
│   └── api_test.php        # Test otomatis 20 kasus
│
├── docs/
│   ├── deploy/
│   │   └── deploy.md       # Panduan deploy web + desktop
│   ├── desktop/
│   │   └── desktop.md      # Panduan konversi ke desktop app
│   ├── admin/
│   │   └── PANDUAN_ADMIN.md # Panduan operasional admin/panitia
│   ├── dev/
│   │   └── knowledge_transfer.md  # Konteks proyek untuk AI
│   └── project/
│       └── pembagian_jobdesk_secure_e_voting.md  # Pembagian tugas tim
│
├── .env.example
└── README.md
```

## Quick Start - Web

### 1. Setup

```bash
cp .env.example .env        # isi DB_PASS, JWT_SECRET
```

### 2. Database

```bash
php database/migrate.php --seed
```

### Akun Default & Dummy

| Username | Password | Role | Keterangan |
| --- | --- | --- | --- |
| `admin` | `Admin@1234` | admin | Akun utama |
| `rio` | `Rio@12345` | voter | Testing MFA USB token |
| `pemilih1` | `Pemilih@123` | voter | Testing pemilihan |
| `pemilih2` | `Pemilih@123` | voter | Testing pemilihan |

### 3. Backend + Frontend

Dua cara:

**Cara cepat - satu terminal menjalankan PHP + Vite sekaligus:**

```bash
cd frontend
npm install
npm run dev:full     # PHP :8000 + Vite :5173 sekaligus
```

**Cara terpisah (2 terminal):**

```bash
# Terminal 1 - backend
php -S localhost:8000 -t backend backend/index.php

# Terminal 2 - frontend
cd frontend
npm install
npm run dev     # http://localhost:5173
```

## Quick Start - Desktop (Tauri)

> Prasyarat tambahan: [Rust](https://rustup.rs/) + [Build Tools](https://v2.tauri.app/start/prerequisites/)
>
> + **PHP terinstall di PATH** (backend di-spawn otomatis oleh app, port 8000).

```bash
cd frontend
npm install

# Jalankan React + Tauri window sekaligus (PHP di-spawn otomatis)
npm run desktop:dev

# Build installer (.exe / .dmg / .deb)
npm run desktop:build
```

Backend PHP di-spawn otomatis saat app start (tanpa konsol) dan di-kill saat app ditutup.
Kalau port 8000 sudah dipakai server lain, app akan memakai server yang sudah ada.

Log aplikasi (jika troubleshooting): `%LOCALAPPDATA%\com.truecount.app\logs\` (Windows) - berisi `truecount.log` dan `php.log`.

Lihat [`docs/desktop/desktop.md`](docs/desktop/desktop.md) untuk panduan lengkap.

## API Endpoints (Sprint 2)

| Method | Endpoint          | Auth  | Keterangan                              |
|--------|-------------------|-------|-----------------------------------------|
| GET    | /health           | -     | Health check                            |
| POST   | /auth/register    | Undangan | Daftar akun - wajib `invite_token`  |
| POST   | /auth/login       | -     | Login, dapat JWT                        |
| POST   | /auth/logout      | -     | Logout                                  |
| GET    | /auth/me          | JWT   | Info user dari token                    |
| GET    | /invites          | Admin | Daftar undangan + statistik status      |
| POST   | /invites          | Admin | Buat undangan pendaftaran               |
| GET    | /invites/verify   | -     | Cek status undangan (`?token=...`)      |

Pendaftaran publik **ditutup** - akun hanya bisa dibuat lewat tautan undangan
yang dibuat admin (`/daftar?undangan=<token>`).

## Test Otomatis

```bash
# Backend harus jalan di localhost:8000
php tests/api_test.php
```

Output: 41 test case - auth, invite (buat/daftar/verifikasi), register via undangan, hak akses, validasi, method check.

## URL Routing

| Path       | Halaman         |
|------------|-----------------|
| `/`        | Landing Page    |
| `/masuk`   | Login           |
| `/daftar`  | Register - hanya lewat undangan (`?undangan=<token>`) |
| `/dasbor`  | Dashboard (panel undangan untuk admin) |
| `/pilih`   | Halaman Pemilihan (demo kandidat) |

Alias lama (`/login`, `/register`, `/dashboard`) redirect otomatis.

## Deploy

Panduan lengkap (web + desktop): [`docs/deploy/deploy.md`](docs/deploy/deploy.md)

## Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [`docs/admin/PANDUAN_ADMIN.md`](docs/admin/PANDUAN_ADMIN.md) | **Panduan operasional admin/panitia** (undangan, USB token, troubleshooting) |
| [`docs/deploy/deploy.md`](docs/deploy/deploy.md) | Setup lokal, server, Nginx, HTTPS, checklist |
| [`docs/desktop/desktop.md`](docs/desktop/desktop.md) | Konversi ke .exe / .dmg / .deb via Tauri |
| [`docs/dev/knowledge_transfer.md`](docs/dev/knowledge_transfer.md) | Konteks lengkap untuk AI / onboarding |
| [`docs/project/pembagian_jobdesk_secure_e_voting.md`](docs/project/pembagian_jobdesk_secure_e_voting.md) | Pembagian tugas tim |

## Tim Pengembang

Project ini dibuat untuk menuntaskan **Proyek Akhir Mata Kuliah Kriptografi**.

| # | Nama | Peran | Fokus Sprint |
| --- | ------ | ------- | -------------- |
| 1 | **Rio Meidi Ataurrahman** | Authentication & User Management | Sprint 1 (Auth, Invite, Dashboard) · Sprint 4 (MFA: WebAuthn, USB Token) |
| 2 | **[Nama Orang 2]** | Election Management & Voting System | Sprint 2 (Election CRUD, Voting, Results) |
| 3 | **[Nama Orang 3]** | Cryptography & Advanced Security | Sprint 3 (Vigenere, AES-256-GCM, ChaCha20, Blockchain, Steganografi) |

> **Anggota:** Mahasiswa S1 Informatika UPN "Veteran" Yogyakarta Angkatan 2024
