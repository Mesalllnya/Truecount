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
│   │   ├── auth/           # register · login · logout · me · change-password · webauthn (login/register) · security-setup · security-status · attempts (log/reset/list/photo)
│   │   ├── election/       # create/list/show/update/delete · candidates (CRUD + photo) · voters (list/register/delete) · results · vote · blockchain (seal/verify)
│   │   ├── invites/        # create/list/verify/revoke
│   │   ├── mfa/usb/        # register (start/verify) · authenticate (start/verify) · list/revoke/label
│   │   ├── users/          # voters · search
│   │   └── encrypted-messages/ # create · get
│   ├── config/             # database.php · app.php · env.php
│   ├── helpers/            # response.php · jwt.php · logger.php · datetime.php · webauthn.php · election_scheduler.php
│   ├── middleware/         # auth.php (requireAuth / requireAdmin)
│   ├── services/crypto/    # AESGCMService · BallotService · BallotTallyService · BlockchainService · ChaCha20Poly1305Service · EncryptedMessageService · FileEncryptionService · SteganographyService · VigenereCipherService
│   └── index.php           # Entry point + router
│
├── database/
│   ├── migrations/
│   │   ├── 001_init.sql        # 10 tabel lengkap
│   │   ├── 002_invites.sql
│   │   ├── 003_usb_tokens.sql
│   │   ├── 004_usb_challenges.sql
│   │   ├── 005_webauthn_challenges.sql
│   │   ├── 006_biometric_last_used.sql
│   │   ├── 007_auth_attempts.sql · 007b_add_aes_gcm_tag.sql · 007_fix_biometric_credentials_binary.sql
│   │   ├── 008_sprint2_marker.sql
│   │   ├── 009_add_photo_path_to_auth_attempts.sql · 009_add_photo_file_id_to_candidates.sql
│   │   ├── 010_add_crypto_version.sql
│   │   └── 012_add_dev_role.sql
│   ├── seeds/
│   │   ├── 001_admin.sql       # Akun admin default
│   │   ├── 002_dummy_users.sql # pemilih1, pemilih2
│   │   └── 003_dev_user.sql    # Akun dev default (Dev@1234)
│   ├── migrate.php         # CLI runner (--seed, --fresh)
│   └── generate_test_token.php # CLI generate file token USB (.truecount_token)
│
├── frontend/               # React + Vite
│   ├── public/             # Aset statis (gambar artsy, logo, cursor set)
│   ├── src/
│   │   ├── pages/          # LandingPage · AboutPage · LoginPage · RegisterPage · SecuritySetupPage · DashboardPage · VotePage · ResultsPage · ProfileSettingsPage · UsbTokenTestPage · UserSecurityLogPage · EncryptedMessagesPage
│   │   ├── components/     # Nav · DashNav · AuthGuard · ElectionModals · UsbTokenPanel · HealthMonitor · Skeleton (ui)
│   │   ├── hooks/          # useAuth · useAuthSession · useAuthSecurity · useFaceDetection · useUsbToken · useWebAuthn
│   │   ├── styles/         # cursor.css (kursor kustom)
│   │   ├── utils/          # webauthn.ts
│   │   ├── index.css · main.jsx · App.jsx · App.css
│   │   └── src-tauri/      # Tauri (desktop wrapper) — main.rs · lib.rs · tauri.conf.json · Cargo.toml
│   ├── package.json
│   └── vite.config.js
│
├── tests/
│   ├── api_test.php               # Test otomatis (auth, invite, register via undangan, hak akses, validasi, method)
│   ├── usb_register_e2e_test.php  # E2E register USB token
│   ├── usb_manage_test.php        # Kelola USB token
│   ├── run-all-crypto-tests.ps1   # Runner tes kripto
│   ├── crypto/                    # test-aes · test-aes-aad · test-chacha20 · test-encrypted-message · *-aad · *-chacha · test-file-encryption · *-metadata · *-tampering · test-steganography · *-capacity · *-persistence · *-psnr · *-tampering · test-tampering-db · test-vigenere · check-encryption-keys.php · fixtures/
│   └── blockchain/                # test-blockchain-tampering · test-blockchain-hardening · test-ballot-integrity · test-seal-invalid-chain.php
│
├── docs/
│   ├── deploy/           # deploy.md  (Panduan deploy web + desktop)
│   ├── desktop/          # desktop.md (Panduan konversi ke desktop app)
│   ├── admin/            # PANDUAN_ADMIN.md (Panduan operasional admin/panitia)
│   ├── dev/              # knowledge_transfer.md (Konteks proyek untuk AI) · pembagian_jobdesk_secure_e_voting.md (Pembagian tugas tim)
│   └── project/          # (kosong — pembagian_jobdesk pindah ke docs/dev/)
│
├── storage/              # Log aplikasi + foto kamera percobaan login (auth_photos/)
│
├── scripts/
│   ├── free-ports.ps1    # Bebaskan port 5173/5183/8000
│   └── check_db.php      # Cek kondisi database
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

| Username | Password | Role | Email | Keterangan |
| --- | --- | --- | --- | --- |
| `admin` | `Admin@1234` | admin | admin@truecount.local | Akun utama |
| `pemilih1` | `Pemilih@123` | voter | pemilih1@truecount.local | Testing pemilihan |
| `pemilih2` | `Pemilih@123` | voter | pemilih2@truecount.local | Testing pemilihan |
| `dev` | `Dev@1234` | dev | dev@truecount.local | Akses halaman dev (`/dev`) |

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

# Build installer (.msi + .exe NSIS di Windows)
npm run desktop:build
```

Backend PHP di-spawn otomatis saat app start (tanpa konsol) dan di-kill saat app ditutup. Kalau port 8000 sudah dipakai server lain, app akan memakai server yang sudah ada.

Log aplikasi (jika troubleshooting): `%LOCALAPPDATA%\com.truecount.app\logs\` (Windows) - berisi `truecount.log` dan `php.log`.

Lihat [`docs/desktop/desktop.md`](docs/desktop/desktop.md) untuk panduan lengkap.

## API Endpoints

Base URL: `http://localhost:8000`

| Method | Path | Auth | Keterangan |
|--------|------|------|------------|
| GET | `/health` | - | Health check |
| POST | `/auth/register` | Undangan | Daftar akun - wajib `invite_token` |
| POST | `/auth/login` | - | Login, dapat JWT |
| POST | `/auth/logout` | - | Logout |
| GET | `/auth/me` | JWT | Info user dari token |
| POST | `/auth/change-password` | JWT | Ganti password (Argon2id) |
| GET | `/auth/security-setup` | JWT | Cek status keamanan user (wajib setup) |
| POST | `/auth/security-status` | - | Cek status keamanan by identifier (publik) |
| POST | `/auth/attempts/log` | - | Log attempt login (internal backend) |
| POST | `/auth/attempts/reset` | - | Reset failed attempts |
| GET | `/auth/attempts/list` | JWT (admin) | Daftar percobaan login (audit admin) |
| GET | `/auth/attempts/{id}/photo` | JWT (admin) | Foto kamera percobaan login |
| POST | `/auth/webauthn/login/start` | - | Login Windows Hello - mulai |
| POST | `/auth/webauthn/login/verify` | - | Login Windows Hello - verifikasi |
| POST | `/auth/webauthn/register/start` | JWT | Register Windows Hello - mulai |
| POST | `/auth/webauthn/register/verify` | JWT | Register Windows Hello - verifikasi |
| GET | `/auth/webauthn/list` | JWT | Daftar Windows Hello |
| POST | `/auth/webauthn/{id}/revoke` | JWT | Hapus Windows Hello |
| GET | `/invites` | JWT (admin) | Daftar undangan + statistik status |
| POST | `/invites` | JWT (admin) | Buat undangan pendaftaran |
| GET | `/invites/verify` | - | Cek status undangan (`?token=...`) |
| POST | `/invites/{id}/revoke` | JWT (admin) | Batalkan undangan |
| POST | `/mfa/usb/register/start` | JWT | MFA USB register - generate challenge |
| POST | `/mfa/usb/register/verify` | JWT | MFA USB register - verifikasi ECDSA |
| POST | `/mfa/usb/authenticate/start` | - (identifier) | MFA USB login - mulai challenge |
| POST | `/mfa/usb/authenticate/verify` | - | MFA USB login - verifikasi signature → JWT |
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
| GET | `/users/voters` | JWT (admin) | Daftar semua voter aktif di sistem |
| GET | `/users/search?q=` | JWT (admin) | Cari pengguna (admin) |
| POST | `/encrypted-messages` | JWT | Buat pesan terenkripsi |
| GET | `/encrypted-messages/:id` | JWT | Ambil pesan terenkripsi |

Pendaftaran publik **ditutup** - akun hanya bisa dibuat lewat tautan undangan yang dibuat admin (`/daftar?undangan=<token>`).

### Error Format

Semua error menggunakan format: `{ "error": "Pesan error dalam Bahasa Indonesia." }`

### HTTP Status Codes yang dipakai

- `200` - OK
- `201` - Created (register berhasil / undangan dibuat)
- `401` - Unauthorized (token invalid / credentials salah)
- `403` - Forbidden (akun nonaktif / bukan admin / daftar tanpa undangan)
- `404` - Not found (endpoint atau undangan tidak ada)
- `405` - Method not allowed
- `409` - Conflict (username/email duplikat)
- `422` - Unprocessable Entity (validasi gagal)

## URL Routing Frontend

| Path | Halaman | Keterangan |
|------|---------|------------|
| `/` | Landing Page | Halaman utama |
| `/tentang` | About Page | Tentang aplikasi (proyek, tim, stack) |
| `/masuk` | Login | Login (`/login` alias → redirect) |
| `/daftar` | Register | Pendaftaran invite-only, wajib `?undangan=<token>` (`/register` alias → redirect) |
| `/atur-keamanan` | Security Setup | Setup keamanan wajib (Windows Hello/Dongle) sebelum akses dashboard |
| `/dasbor` | Dashboard | Panel undangan admin + easter egg (`/dashboard` alias → redirect) |
| `/pilih` | Halaman Pemilihan | Kandidat, tombol besar berwarna (Sprint 2) |
| `/hasil/:id` | Hasil Pemilihan | Tally suara + verifikasi blockchain (Sprint 2) |
| `/pengaturan` | Profile Settings | Change password, Windows Hello, USB token management |
| `/usb-token-test` | USB Token Test | Deteksi, decrypt, challenge-response |
| `/pesan-terenkripsi` | Encrypted Messages | Buat & lihat pesan terenkripsi (Sprint 3) |
| `/log-keamanan/:userId` | Log Keamanan Pengguna | Riwayat percobaan login + foto kamera (audit admin) |
| `*` | Redirect → `/` | Catchall |

Semua route terlindungi (`/dasbor`, `/pilih`, `/pengaturan`, dll.) dipelihara oleh `AuthGuard` yang redirect ke `/atur-keamanan` jika user belum setup Windows Hello atau Dongle.

## Test Otomatis

```bash
# Backend harus jalan di localhost:8000
php tests/api_test.php
```

Output: test case - auth, invite (buat/daftar/verifikasi), register via undangan, hak akses, validasi, method check.

Tes tambahan:
- `tests/usb_register_e2e_test.php` - E2E register USB token
- `tests/usb_manage_test.php` - Kelola USB token
- `tests/run-all-crypto-tests.ps1` - Runner tes kripto (AES, ChaCha20, Vigenere, steganografi, file encryption, blockchain)

## Deploy

Panduan lengkap (web + desktop): [`docs/deploy/deploy.md`](docs/deploy/deploy.md)

## Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [`docs/admin/PANDUAN_ADMIN.md`](docs/admin/PANDUAN_ADMIN.md) | **Panduan operasional admin/panitia** (undangan, USB token, troubleshooting) |
| [`docs/deploy/deploy.md`](docs/deploy/deploy.md) | Setup lokal, server, Nginx, HTTPS, checklist |
| [`docs/desktop/desktop.md`](docs/desktop/desktop.md) | Konversi ke .exe / .dmg / .deb via Tauri |
| [`docs/dev/knowledge_transfer.md`](docs/dev/knowledge_transfer.md) | Konteks lengkap untuk AI / onboarding |
| [`docs/dev/pembagian_jobdesk_secure_e_voting.md`](docs/dev/pembagian_jobdesk_secure_e_voting.md) | Pembagian tugas tim |

## Tim Pengembang

Project ini dibuat untuk menuntaskan **Proyek Akhir Mata Kuliah Kriptografi**.

| # | Nama | Peran | Fokus Sprint |
|---|------|-------|--------------|
| 1 | **Rio Meidi Ataurrahman** | Authentication & User Management | Sprint 1 (Auth, Invite, Dashboard) · Sprint 4 (MFA: WebAuthn, USB Token) · Sprint 4b (Auth Security Layer: Session Mgmt, Failed Attempts, Camera Enforcement) |
| 2 | **Muhamad Ifsal Fadhilah** | Election Management & Voting System | Sprint 2 (Election CRUD, Voting, Results) ✅ SELESAI |
| 3 | **Erlan Rifqi Davin D** | Cryptography & Advanced Security | Sprint 3 (Vigenere, AES-256-GCM, ChaCha20, Blockchain, Steganografi) ✅ SELESAI |

> **Anggota:** Mahasiswa S1 Informatika UPN "Veteran" Yogyakarta Angkatan 2024
