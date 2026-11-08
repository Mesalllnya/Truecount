# TrueCount - Knowledge Transfer

> **Untuk AI / developer baru:** Baca dokumen ini sebelum menyentuh kode apapun.
> Berisi semua keputusan desain, konvensi, state proyek saat ini, dan konteks yang tidak terlihat dari kode saja.
>
> **Dokumentasi pengguna** (bukan untuk AI): lihat [`PANDUAN_ADMIN.md`](../admin/PANDUAN_ADMIN.md) — panduan operasional untuk admin/panitia. Dokumen ini (knowledge_transfer.md) khusus context untuk AI/developer.

---

## 1. Identitas Proyek

| Atribut | Nilai |
| --- | --- |
| **Nama** | TrueCount |
| **Tipe** | Aplikasi e-voting akademik (bukan production-critical) |
| **Bahasa UI** | Indonesia (Bahasa Indonesia penuh, termasuk path URL) |
| **Status** | Sprint 1 selesai |
| **Repositori** | Monorepo - backend PHP + frontend React dalam satu folder |
| **Tujuan** | Proyek Akhir Mata Kuliah Kriptografi |
| **Universitas** | UPN "Veteran" Yogyakarta - Program Studi Informatika |
| **Angkatan** | 2024 |

### Tim Pengembang

| # | Nama | Peran | Fokus Sprint |
| --- | ------ | ------- | -------------- |
| 1 | **Rio Meidi Ataurrahman** | Authentication & User Management | Sprint 1 (Auth, Invite, Dashboard) · Sprint 4 (MFA: WebAuthn, USB Token) |
| 2 | **[Nama Orang 2]** | Election Management & Voting System | Sprint 2 (Election CRUD, Voting, Results) |
| 3 | **[Nama Orang 3]** | Cryptography & Advanced Security | Sprint 3 (Vigenere, AES-256-GCM, ChaCha20, Blockchain, Steganografi) |

---

## 2. Tech Stack & Versi

### Frontend

| Package | Versi | Catatan |
| --- | --- | --- |
| React | 19.x | Pakai function components + hooks |
| Vite | 8.x | Dev server port **5173**, HMR port 5183 |
| esbuild | 0.28.x | DevDependency - Vite 8 TIDAK lagi bundle esbuild, harus diinstall terpisah |
| terser | 5.x | Minifier production build (esbuild minify tidak kompatibel dengan target lama) |
| concurrently | 9.x | Jalankan PHP + Vite sekaligus: `npm run dev:full` |
| react-router-dom | 7.x | URL Bahasa Indonesia: `/masuk`, `/daftar`, `/dasbor` |
| axios | 1.x | Diinstall tapi belum dipakai - fetch native dipakai di Sprint 1 |
| @tauri-apps/cli | 2.x | Desktop wrapper, opsional |
| @tauri-apps/api | 2.x | JS bindings untuk Tauri commands |

**Script npm penting:**

- `npm run dev` - hanya frontend Vite (backend PHP HARUS dijalankan manual)
- `npm run dev:backend` - hanya backend PHP di :8000
- `npm run dev:full` - PHP + Vite sekaligus dalam satu terminal (pakai concurrently)
- `npm run free-ports` - bebasin port 5173/5183/8000 kalau kena "Port already in use" (script: `scripts/free-ports.ps1`)

### Backend

| Teknologi | Versi | Catatan |
| --- | --- | --- |
| PHP | 8.1+ | Native, tanpa framework |
| MySQL | 8.0+ | atau MariaDB 10.6+ |
| JWT | HS256 | Implementasi custom di `helpers/jwt.php` - tanpa library |
| Password hash | Argon2id | `password_hash(..., PASSWORD_ARGON2ID)` |

---

## 3. Desain System

### Font

- **Plus Jakarta Sans** - diload via Google Fonts di `index.html`
- Weight yang dipakai: 300 (italic accent), 400, 500, 600, 700, 800

### Palette

| Token CSS | Nilai | Penggunaan |
| --- | --- | --- |
| `--red` | `#F13C35` | CTA, aksen, error state, icon hover |
| `--red-dark` | `#c72e27` | Hover state button merah |
| `--black` | `#0d0d0d` | Teks utama, background dark section |
| `--cream` | `#fafaf8` | Background halaman utama |
| `--white` | `#ffffff` | Card, nav |
| `--border` | `#e4e4e1` | Divider, input border |
| `--muted` | `#6a6a67` | Teks sekunder |

### Design Language

- **Artsy / editorial** - terinspirasi gambar halftone pop-art (`raise_hand.jpg`)
- Heading besar dengan weight 800, line-height < 1.0, letter-spacing negatif
- Kata kunci di h1 hero dibuat *italic* weight 300 warna merah
- Animasi purposeful: `heroIn` (slide up), `rippleGrow` (easter egg), `tagPop` (spring)
- Semua section-reveal pakai `IntersectionObserver` dengan threshold 0.12–0.15

---

## 4. Struktur File Kunci

### Backend

```
backend/index.php           - Router utama, match() berdasarkan $uri + access log + exception handler
backend/helpers/response.php - jsonResponse() + CORS multi-origin (FRONTEND_ORIGIN + origin Tauri)
backend/helpers/logger.php   - tc_log() file logger → backend/storage/logs/app.log
backend/helpers/jwt.php      - generateJwt() + verifyJwt() - HS256 manual
backend/config/database.php  - getDB() singleton PDO
backend/config/app.php       - Konstanta JWT_SECRET, JWT_EXPIRE, ARGON2_*
backend/middleware/auth.php  - requireAuth() → return payload atau exit 401
backend/api/auth/register.php   - invite-gated (wajib invite_token valid)
backend/api/auth/login.php
backend/api/auth/logout.php
backend/api/auth/me.php
backend/api/auth/change_password.php     - POST /auth/change-password - ganti password
backend/api/auth/webauthn_login_start.php  - POST /auth/webauthn/login/start - login Windows Hello
backend/api/auth/webauthn_login_verify.php - POST /auth/webauthn/login/verify - verify Windows Hello
backend/api/auth/webauthn_register_start.php - POST /auth/webauthn/register/start - register Windows Hello
backend/api/auth/webauthn_register_verify.php - POST /auth/webauthn/register/verify - verify register WebAuthn
backend/api/auth/webauthn_list.php       - GET /auth/webauthn/list - daftar Windows Hello
backend/api/auth/webauthn_revoke.php     - POST /auth/webauthn/{id}/revoke - hapus Windows Hello
backend/api/invites/create.php  - POST /invites (admin) buat undangan
backend/api/invites/list.php    - GET /invites (admin) daftar + stats status
backend/api/invites/verify.php  - GET /invites/verify?token= (publik)
backend/api/mfa/usb/register_start.php  - POST /mfa/usb/register/start - generate challenge
backend/api/mfa/usb/register_verify.php - POST /mfa/usb/register/verify - verify ECDSA + simpan credential
backend/api/mfa/usb/list.php    - GET /mfa/usb/list - daftar token user
backend/api/mfa/usb/revoke.php  - POST /mfa/usb/{id}/revoke - nonaktifkan token
backend/api/mfa/usb/label.php   - POST /mfa/usb/{id}/label - update label
```

### Frontend

```
frontend/src/App.jsx            - BrowserRouter + Routes
frontend/src/hooks/
  useUsbToken.ts          - Hook USB token: listen event Tauri, decrypt, sign, register API
  useWebAuthn.ts          - Hook WebAuthn (Windows Hello): login & register flow
  useAuth.ts              - Hook auth umum: changePassword, webauthn register/list/revoke
frontend/src/pages/
  LandingPage.jsx + .css        - Hero dengan raise_hand.jpg + nav link tengah, tombol Masuk (ikon) di kanan
  LoginPage.jsx                 - Form login (card center), fetch ke /auth/login + status dongle (DETEKSI USB ASLI via scanForTokens, polling 2 detik - hanya deteksi, TIDAK mengubah flow login) + banner sukses registrasi
  RegisterPage.jsx              - Form register INVITE-ONLY: verifikasi ?undangan=<token> via GET /invites/verify, state "pendaftaran ditutup" tanpa token
  AuthPage.css                  - Shared CSS untuk Login + Register + state panel undangan
  DashboardPage.jsx + .css      - Dasbor + easter egg 5-klik + auth guard; admin lihat panel undangan (stats + tabel status + form buat undangan + salin tautan)
  VotePage.jsx + .css          - Halaman pemilihan (/pilih): kandidat demo, tombol besar berwarna + ikon SVG + auth guard
  ProfileSettingsPage.jsx + .css - Halaman pengaturan (/pengaturan): change password, Windows Hello, USB token management
  UsbTokenTestPage.jsx + .css  - Halaman test USB token (/usb-token-test): deteksi, decrypt, challenge-response
frontend/src/components/
  HealthMonitor.jsx             - Render null; polling /health di background, error → console (bukan UI)
  UsbTokenPanel.jsx + .css      - Panel kelola USB token (digunakan di ProfileSettingsPage): daftar, register (modal flow), revoke, label
frontend/src/index.css          - Reset global + font family
frontend/src/main.jsx           - ReactDOM.createRoot - tidak diubah
```

### Database

```
database/migrations/001_init.sql  - 10 tabel (lihat seksi DB)
database/seeds/001_admin.sql      - Admin: username=admin, password=Admin@1234
database/seeds/002_dummy_users.sql - User dummy: rio, pemilih1, pemilih2 (lihat seksi 4.5)
database/migrate.php              - php database/migrate.php [--seed] [--fresh]
```

### Akun User (untuk testing)

| Username | Password | Role | Email | Keterangan |
| --- | --- | --- | --- | --- |
| `admin` | `Admin@1234` | admin | admin@truecount.local | Akun utama (seed 001) |
| `rio` | `Rio@12345` | voter | rio@truecount.local | Dummy - testing MFA USB token |
| `pemilih1` | `Pemilih@123` | voter | pemilih1@truecount.local | Dummy - testing pemilihan |
| `pemilih2` | `Pemilih@123` | voter | pemilih2@truecount.local | Dummy - testing pemilihan |

- Semua password di-hash dengan **Argon2id** (memory=65536, time=4, threads=2)
- Seed dijalankan via `php database/migrate.php --seed`
- User `tc_test_*`, `bound_*`, dll. adalah **sisa test suite** (`tests/api_test.php`) — kalau muncul, hapus dengan:
  ```sql
  DELETE FROM users WHERE username LIKE 'tc_test_%' OR username LIKE 'bound_%';
  ```

---

## 5. URL Routing Frontend

| Path | Komponen | Keterangan |
| --- | --- | --- |
| `/` | `LandingPage` | Halaman utama |
| `/masuk` | `LoginPage` | Login |
| `/daftar` | `RegisterPage` | Pendaftaran - invite-only, wajib query `?undangan=<token>`; tanpa token tampil state "hanya melalui undangan" |
| `/dasbor` | `DashboardPage` | Dasbor (blank + easter egg, ada auth guard) |
| `/pilih` | `VotePage` | Halaman pemilihan - demo kandidat, tombol besar berwarna (Sprint 2, ada auth guard) |
| `/pengaturan` | `ProfileSettingsPage` | Pengaturan profil: change password, Windows Hello, USB token |
| `/login` | Redirect → `/masuk` | Alias lama |
| `/register` | Redirect → `/daftar` | Alias lama |
| `/dashboard` | Redirect → `/dasbor` | Alias lama |
| `*` | Redirect → `/` | Catchall |

---

## 6. API Endpoints

Base URL: `http://localhost:8000`

| Method | Path | Auth | Request Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/health` | - | - | `{status, app, database, ip}` - status `ok`/`degraded`, dipakai indikator status di frontend |
| POST | `/auth/register` | Invite token | `{username, email, password, invite_token}` | `201 {message, user}` - publik TIDAK bisa daftar bebas |
| POST | `/auth/login` | - | `{identifier, password}` | `200 {message, token, user}` |
| POST | `/auth/logout` | - | - | `200 {message}` |
| GET | `/auth/me` | Bearer JWT | - | `200 {user}` |
| POST | `/auth/change-password` | Bearer JWT | `{current_password, new_password}` | `200 {message}` - ganti password (Argon2id) |
| POST | `/auth/webauthn/register/start` | Bearer JWT | `{display_name?}` | `200 {challenge, challenge_id, user, rp}` - mulai register Windows Hello |
| POST | `/auth/webauthn/register/verify` | Bearer JWT | `{challenge_id, credential_id, attestation_object, client_data_json}` | `201 {message, credential_id}` - verifikasi registrasi WebAuthn |
| GET | `/auth/webauthn/list` | Bearer JWT | - | `200 {credentials}` - daftar Windows Hello user |
| POST | `/auth/webauthn/{id}/revoke` | Bearer JWT | - | `200 {message}` - hapus Windows Hello |
| GET | `/invites` | Bearer JWT (admin) | - | `200 {stats, invites}` - status: `menunggu`/`diterima`/`kedaluwarsa`/`dibatalkan` |
| POST | `/invites` | Bearer JWT (admin) | `{email?, role?}` | `201 {message, invite}` - `invite.link` = `/daftar?undangan=<token>` |
| GET | `/invites/verify` | - | query `?token=` | `200 {valid, invite}` / `400` / `404` |
| POST | `/mfa/usb/register/start` | Bearer JWT | - | `200 {challenge_id, challenge}` - challenge 32 byte random, TTL 5 menit |
| POST | `/mfa/usb/register/verify` | Bearer JWT | `{challenge_id, signature, public_key, label?}` | `201 {message, credential}` - verifikasi ECDSA P-256 |
| POST | `/mfa/usb/authenticate/start` | - (identifier-based) | `{identifier}` | `200 {challenge_id, challenge, allowCredentials[], user}` - mulai MFA login USB token |
| POST | `/mfa/usb/authenticate/verify` | - | `{challenge_id, credential_id, signature}` | `200 {message, token, user}` - verifikasi MFA login USB token, return JWT |
| GET | `/mfa/usb/list` | Bearer JWT | - | `200 {credentials}` - daftar USB token user |
| POST | `/mfa/usb/{id}/revoke` | Bearer JWT | - | `200 {message}` - nonaktifkan token |
| POST | `/mfa/usb/{id}/label` | Bearer JWT | `{label}` | `200 {message, label}` - update label |

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

---
 
## 7. Database Schema
 
12 tabel total - `database/migrations/001_init.sql` (10 tabel) + `002_invites.sql` + `003_usb_tokens.sql` + `004_usb_challenges.sql` + `005_webauthn_challenges.sql` + `006_biometric_last_used.sql`:
 
| Tabel | Sprint | Keterangan |
| --- | --- | --- |
| `users` | 1 ✅ | id, username, email, password_hash, role (admin/voter), is_active |
| `invites` | 2 ✅ | Undangan pendaftaran - token, email (nullable), role, status (pending/accepted/revoked), expires_at, created_by, used_by |
| `biometric_credentials` | 4 | WebAuthn/FIDO2 - FK ke users (termasuk last_used_at) |
| `webauthn_challenges` | 4 | Challenge WebAuthn (TTL 5 menit, single-use) - registration & authentication |
| `usb_token_credentials` | 4 | **USB Token (software token di flashdisk) - ECDSA P-256 public key storage** |
| `usb_challenges` | 4 | **Challenge sementara untuk register/authenticate USB token (TTL 5 menit, single-use)** |
| `elections` | 2 | Pemilihan - FK ke users (created_by) |
| `candidates` | 2 | Kandidat - FK ke elections |
| `voters` | 2 | Partisipasi (has_voted tapi BUKAN isi suara) - FK ke users + elections |
| `ballots` | 2 | **TIDAK ada FK ke users** - privacy by design |
| `encrypted_messages` | 3 | Modul kriptografi |
| `encrypted_files` | 3 | File terenkripsi |
| `blocks` | 3 | Blockchain sederhana |
 
**Penting:** `ballots` tidak punya FK ke `users` atau `voters` secara sengaja - suara dan identitas pemilih terpisah.

---

## 8. Auth Flow

```
1. Admin POST /invites → buat undangan (token random, expiry 7 hari, role + email opsional)
2. Calon pengguna buka /daftar?undangan=<token> → frontend cek GET /invites/verify
3. User POST /auth/register dengan invite_token → undangan divalidasi
   (pending + belum kedaluwarsa) → password di-hash Argon2id → simpan ke DB
   → undangan ditandai accepted (UPDATE bersyarat, atomik)
4. User POST /auth/login → verifikasi Argon2id → generate JWT HS256
5. Frontend simpan token di localStorage key: 'tc_token'
6. Request ke endpoint protected → kirim header: Authorization: Bearer <token>
7. middleware/auth.php → requireAuth() / requireAdmin() → verifyJwt() → return payload
8. Logout → frontend hapus 'tc_token' dari localStorage
```

**Tanpa undangan valid, `POST /auth/register` → 403** - pendaftaran publik ditutup.
Role akun baru mengikuti role di undangan (`voter` default, admin bisa undang admin).
Undangan terikat email → email akun dipaksa mengikuti email undangan.

**JWT Payload:**

```json
{ "sub": 1, "username": "admin", "email": "...", "role": "admin", "iat": ..., "exp": ... }
```

**Username dari token di frontend:**

```js
const payload = JSON.parse(atob(token.split('.')[1]))
payload.username  // "admin"
```

---

## 9. Konvensi Kode

### PHP

- Tidak pakai framework - semua native
- Setiap endpoint adalah file terpisah di `api/<modul>/<action>.php`
- `require_once` di setiap file, bukan autoloader
- `jsonResponse()` selalu dipakai untuk output JSON - tidak pernah `echo json_encode()` langsung
- PDO prepared statements - tidak pernah string interpolasi untuk query

### React / JS

- Function components only - tidak ada class component
- CSS Modules tidak dipakai - file `.css` per halaman di folder yang sama
- State management: React `useState` + `localStorage` - belum ada Context/Redux
- Fetch native dipakai (bukan axios) di Sprint 1
- Animasi lewat CSS keyframes + `IntersectionObserver` hook - tidak ada Framer Motion

### CSS

- CSS custom properties (variables) di `:root` tiap file - belum ada design token global
- Mobile-first dengan breakpoint `768px`, `860px`, `1024px`, `1440px`
- Animasi menggunakan `cubic-bezier(0.22, 1, 0.36, 1)` sebagai `--ease-out` utama
- `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` untuk efek bounce

---

## 10. Easter Egg Dashboard

Brand "TrueCount" di dashboard adalah `<button>` (bukan teks). Klik 5x:

1. Counter 1–4: muncul 5 titik di sebelah brand, mengisi satu per satu (merah)
2. Klik ke-5: Web Audio API beep 880→440Hz, overlay merah muncul
3. Overlay: 3 lingkaran merah mengembang dari tengah (ripple), card notif pop-in dengan username
4. Username diambil dari JWT di localStorage via `atob(token.split('.')[1])`

---

## 11. Desktop (Tauri)

Desktop app **sudah bisa di-build dan berjalan** - installer `.msi` + `.exe` (NSIS) sukses dihasilkan:

- Rust + Cargo sudah terinstall di mesin developer.
- Icons: sudah di-generate dari `frontend/public/raise_hand.jpg` via
  `npx tauri icon public/raise_hand.jpg --fit cover`.
- Backend PHP **di-spawn otomatis** oleh Rust saat app start (bukan lagi proses terpisah).
- Folder `backend/` di-bundle ke installer sebagai resource
  (`"resources": { "../../backend": "backend" }` di `tauri.conf.json`).

### Auto-spawn PHP - sudah diimplementasi di `src-tauri/src/lib.rs`

1. Startup: cek port 8000 - kalau sudah ada server lain, skip spawn.
2. Cari folder backend: resource dir (production) → relatif lokasi exe → cwd (dev).
3. Spawn `php -S 127.0.0.1:8000 -t <backend> <backend>/index.php` dengan
   `CREATE_NO_WINDOW` (tanpa konsol) di Windows.
4. Saat app ditutup (`RunEvent::Exit`): child process PHP di-kill.
5. Path `\\?\` (Windows extended-length path dari Tauri) di-strip dulu -
   PHP tidak bisa membuka file dengan prefix itu.
6. **PHP harus terinstall di mesin user & ada di PATH** - belum di-bundle
   sebagai sidecar binary (masih rencana Sprint 4).

### Konfigurasi penting `src-tauri/`

- `Cargo.toml`: `tauri = { version = "2", features = ["wry"], default-features = false }`
  - fitur `dialog` di-disable karena butuh `TaskDialogIndirect` yang tidak ada
  di Windows lama (error "Entry Point Not Found").
- `main.rs`: `windows_subsystem = "windows"` - release build tanpa window konsol.
- `lib.rs`: `tauri::Builder::<tauri::Wry>::default()` - type runtime explicit
  karena `default-features = false`.
- `vite.config.js`: minifier **terser**, target `['es2020', 'chrome90', 'safari13']`
  - kombinasi yang kompatibel dengan Vite 8 (esbuild & terser keduanya devDependency).
- `frontend/src/pages/LoginPage.jsx` (baris ~355): deteksi lingkungan Tauri pakai
  `'__TAURI_INTERNALS__' in window` — **bukan** `window.__TAURI__`.
  `window.__TAURI__` hanya tersedia kalau `app.withGlobalTauri` di `tauri.conf.json`
  di-set `true` (belum ada di proyek ini). `__TAURI_INTERNALS__` selalu tersedia
  saat berjalan di Tauri (dev & build), konsisten dengan `hooks/useUsbToken.ts`.
  Jika pakai `window.__TAURI__`, tombol "Dongle Keamanan" di halaman masuk akan
  selalu **disabled** di app desktop.

### Logging (untuk debugging)

| File | Lokasi (Windows) |
| --- | --- |
| Log app (spawn, path, error) | `%LOCALAPPDATA%\com.truecount.app\logs\truecount.log` |
| Log PHP server | `%LOCALAPPDATA%\com.truecount.app\logs\php.log` |

---

## 11.5. USB Token System (Sprint 4)

> **Status:** Registrasi & manajemen token sudah jalan di dasbor (daftar, revoke, label). **Belum dipakai untuk login MFA** — flow autentikasi saat login akan ditambahkan nanti setelah review.

### Arsitektur

| Komponen | File | Fungsi |
|----------|------|--------|
| **Rust Monitor** | `src-tauri/src/usb_token.rs` | Background task polling drive removable tiap 2 detik, scan file `.truecount_token`, emit event `usb-token-detected` (include `is_valid` flag) |
| **Tauri Command** | `decrypt_usb_token_private_key` | Decrypt private key PKCS#8 (AES-256-GCM + PBKDF2) dari file USB, return JWK untuk Web Crypto API |
| **Tauri Command** | `scan_usb_tokens` | Scan aktif semua drive removable → return daftar token ditemukan (include `is_valid` flag untuk deteksi corrupt) |
| **Tauri Command** | `list_usb_drives` | Daftar SEMUA drive removable (termasuk yang belum ada token) — untuk UI pemilihan drive saat buat token |
| **Tauri Command** | `create_usb_token_file` | Buat file token BARU di USB: generate keypair P-256 → encrypt PKCS#8 (PBKDF2+AES-GCM) → tulis `.truecount_token`. **TANPA registrasi** — daftar terpisah |
| **Frontend Hook** | `frontend/src/hooks/useUsbToken.ts` | Listen event Tauri, polling scan, state management, crypto helpers (importKey, sign, verify) |
| **Panel Dasbor** | `frontend/src/components/UsbTokenPanel.jsx` | Panel "USB Token" di dasbor: daftar token, register flow (modal), **buat token baru (modal)**, revoke, label |
| **Test Page** | `frontend/src/pages/UsbTokenTestPage.jsx` | Halaman `/usb-token-test` - UI deteksi token, input PIN, dekripsi, challenge-response test |
| **Generator** | `database/generate_test_token.php` | CLI generate file `.truecount_token` untuk testing (alternatif dev) |
| **Migration** | `database/migrations/003_usb_tokens.sql` + `004_usb_challenges.sql` | Tabel `usb_token_credentials` (public key) + `usb_challenges` (challenge TTL 5 menit) |

### Format File Token (`.truecount_token`)

```json
{
  "v": 1,
  "uid": 1,
  "alg": "ES256",
  "pk": "base64url(SPKI_DER_public_key)",
  "sk_enc": "base64url(AES256_GCM(PKCS8_DER_private_key))",
  "salt": "base64url(PBKDF2_salt)",
  "iv": "base64url(AES_GCM_iv)"
}
```

- **Kriptografi**: ECDSA P-256 (secp256r1) — sama dengan WebAuthn/FIDO2
- **Enkripsi Private Key**: AES-256-GCM + PBKDF2-HMAC-SHA256 (100k iterasi)
- **Credential ID**: SHA-256(SPKI public key) — identifier unik per token

### Flow Test

```
1. Generate token: php database/generate_test_token.php H:/ 1 "123456"
2. Colok USB → app desktop scan tiap 2 detik (frontend polling scan_usb_tokens)
3. Buka dasbor → "Daftarkan USB Baru" → auto-detect → input PIN
4. Verify signature di backend → token terdaftar ke akun login
5. Panel "USB Token" menampilkan token + bisa revoke/label
```

### Tauri Config (Permission FS)

> ⚠️ **Format lama (`scope` di `plugins.fs`) TIDAK berlaku lagi** — Tauri v2 memindahkan permission ke folder `capabilities/`. Config lama menyebabkan error `PluginInitialization("fs", ... unknown field 'scope')`.

**1. `tauri.conf.json` (hanya ini yang valid):**
```json
"plugins": {
  "fs": {
    "requireLiteralLeadingDot": false
  }
}
```

**2. `capabilities/default.json` (permission file system):**
```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "fs:default",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$REMOVABLE/**" },
        { "path": "$REMOVABLE/.truecount_token" }
      ]
    }
  ]
}
```

**3. Commands Rust (tidak butuh permission FS)** — monitor & decrypt membaca file langsung dari Rust (`std::fs`), bukan lewat plugin FS JS. Permission FS di atas hanya untuk pemakaian JS langsung ke filesystem di masa depan.

### Database Migration Baru

```sql
-- database/migrations/003_usb_tokens.sql
CREATE TABLE `usb_token_credentials` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `credential_id` VARBINARY(32) NOT NULL,  -- SHA-256(SPKI)
  `public_key` VARBINARY(200) NOT NULL,    -- SPKI DER
  `label` VARCHAR(100),
  `aaguid` BINARY(16),
  `sign_count` INT UNSIGNED DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` TIMESTAMP NULL,
  `revoked_at` TIMESTAMP NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_user_credential` (`user_id`, `credential_id`)
);

-- database/migrations/004_usb_challenges.sql
-- Tabel usb_challenges: challenge random 32 byte (TTL 5 menit, single-use)
-- untuk flow register & authenticate
```

### Cara Membuat Token USB (Panduan Lengkap)

> **Syarat:** Flashdisk biasa apa pun (FAT32/NTFS/exFAT, kosong atau berisi file lain — tidak akan dihapus). Butuh OpenSSL terinstall di PATH.

**Langkah 1 — Colok flashdisk & cari huruf drive**

Buka Windows Explorer → lihat huruf drive flashdisk (misal `E:`, `F:`, `H:`).

Cek dari PowerShell:
```powershell
Get-WmiObject Win32_Volume | Where-Object { $_.DriveType -eq 2 } | Select DriveLetter, Label
```
Drive dengan `DriveType = 2` = removable (flashdisk).

**Langkah 2 — Generate file token**

```bash
php database/generate_test_token.php <drive> <user_id> <pin>
```

| Argumen | Contoh | Keterangan |
| --- | --- | --- |
| `<drive>` | `H:/` | Path flashdisk (Windows: `H:/`, Linux: `/media/user/USB`, macOS: `/Volumes/USB`) |
| `<user_id>` | `1` | User ID (hanya untuk tampilan deteksi, bukan binding akun) |
| `<pin>` | `"123456"` | PIN MFA — wajib diinput setiap pakai token |

Contoh lengkap:
```bash
# Flashdisk di H:, hint user_id=1, PIN 123456
php database/generate_test_token.php H:/ 1 "123456"
```

Output sukses:
```
[→] Generate ECDSA P-256 keypair via openssl CLI...
    OK - keypair generated (138 bytes private, 91 bytes public)
[✓] Token file dibuat: H:/.truecount_token
    User ID: 1
    PIN: 123456
    Credential ID: 9ac1e993...2851
```

**Langkah 3 — Verifikasi file ada**

```powershell
# File .truecount_token tersembunyi (attrib +h), cek dengan:
dir /a H:\.truecount_token
```

**Langkah 4 — Gunakan di aplikasi**

1. Jalankan app desktop: `cd frontend && npm run desktop:dev`
2. Login → Dasbor → **"Daftarkan USB Baru"**
3. App auto-detect flashdisk (scan tiap 2 detik) → input PIN
4. Token terdaftar ke akun yang sedang login

### Apa Isi File `.truecount_token`

```json
{
  "v": 1,
  "uid": 1,
  "alg": "ES256",
  "pk": "MFkwEw...",       ← public key SPKI (aman dibaca siapapun)
  "sk_enc": "O0aFAhQ...",  ← private key PKCS#8 TERENKRIPSI AES-256-GCM
  "salt": "uciOgXS...",    ← salt PBKDF2
  "iv": "w4wTCZ8C..."      ← IV AES-GCM
}
```

Kriptografi: PBKDF2-HMAC-SHA256 (100k iterasi, PIN → key) → AES-256-GCM (private key) → ECDSA P-256 (signature challenge).

### Troubleshooting Token USB

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| App tidak mendeteksi flashdisk | File token belum dibuat | Jalankan `generate_test_token.php` ke drive yang benar |
| Drive tidak muncul di Explorer | Flashdisk belum ke-mount | Cabut → colok ulang |
| "USB dicabut" saat register | Flashdisk dilepas di tengah flow | Colok lagi — UI otomatis kembali ke state menunggu (fix Sprint 4) |
| Decrypt gagal "wrong PIN" | PIN salah / file dari flashdisk lain | PIN default generator: `123456` |
| **Status dongle kuning (warning)** | File `.truecount_token` corrupt / field hilang / bukan JSON valid | Hapus file → buat ulang via "＋ Buat Token di USB" atau CLI |
| App di browser tidak auto-detect | Auto-detect hanya di Tauri desktop | Jalankan `npm run desktop:dev`, bukan browser |
| Event terlewat (USB dicolok sebelum app buka) | Event hanya emit 1x per drive | Fixed: frontend aktif polling `scan_usb_tokens` tiap 2 detik |
| **Tombol "Buat Token" tolak / error overwrite** | Flashdisk sudah punya token, belum centang konfirmasi | Centang "Saya paham, timpa token lama" lalu coba lagi |
| **Error "missing required key userId"** | Tauri v2 rename snake_case → camelCase | Sudah fix: `#[tauri::command(rename_all = "snake_case")]` |

### Keamanan & Keterbatasan (Testing Only)

| Aspek | Status |
|-------|--------|
| Private key tidak pernah ke server | ✅ Hanya di memory frontend sesaat |
| Challenge-response replay protection | ✅ Challenge random 32 byte, single-use |
| User verification (PIN) | ✅ Wajib untuk decrypt |
| File token bisa di-copy | ⚠️ Ya — ini software token, bukan hardware secure element |
| PIN bisa di-keylog | ⚠️ Ya — inherent ke software token |
| Tidak ada user presence (touch) | ⚠️ Beda dengan FIDO2 hardware key |
| **Integrasi ke auth MFA** | ❌ **BELUM** — nanti pakai backend verify signature |

---

## 12. State Sprint

### Sprint 1 - SELESAI ✅

- Struktur proyek (backend + frontend)
- Database schema (11 tabel) + migration runner
- Auth API: register, login, logout, me
- **Pendaftaran via undangan (invite-only) ✅** - publik ditutup, admin buat undangan via `/invites`, halaman `/daftar` hanya terbuka lewat tautan `?undangan=<token>`, dasbor admin punya panel referal (stats: menunggu/diterima/kedaluwarsa + form buat undangan + salin tautan)
- Landing Page (artsy, raise_hand.jpg, Jakarta Sans, #F13C35) - tombol Daftar dihapus, hanya Masuk (dengan ikon) di kanan nav
- Login + Register pages (split layout, animasi)
- Dashboard (easter egg + panel undangan admin)
- Test otomatis: `php tests/api_test.php` (41 test, 100% pass)

### Sprint 2 - Election Management ([Nama Orang 2])

Endpoints yang perlu dibangun:

- `GET /elections` - daftar pemilihan aktif
- `POST /elections` - buat pemilihan (admin)
- `GET /elections/:id` - detail pemilihan + kandidat
- `POST /elections/:id/vote` - berikan suara (voter)
- `GET /elections/:id/results` - hasil pemilihan

### Sprint 3 - Cryptography ([Nama Orang 3])

- Enkripsi pesan: Vigenere, AES-256-GCM, ChaCha20
- Enkripsi file upload
- Blockchain log sederhana

### Sprint 4 - MFA (Rio Meidi Ataurrahman)

- WebAuthn biometrics (Windows Hello) ✅ — register, list, revoke via `/auth/webauthn/*`
- **Profile Settings Page ✅** (`/pengaturan`) — halaman terpusat untuk:
  - Change Password (Argon2id)
  - Windows Hello management (WebAuthn)
  - USB Token management (dipindahkan dari dasbor)
- **USB Token Test System ✅** (deteksi auto, decrypt, challenge-response test di `/usb-token-test`)
- **USB Token Login MFA ✅** (login pakai USB token via `/mfa/usb/authenticate/*` - identifier-based challenge → sign → verify → JWT)
- **USB Token Management ✅** (daftar/revoke/label token di halaman pengaturan via `/mfa/usb/*` - register flow sudah end-to-end: challenge → sign → verify)
- **USB Token Creation ✅** (User bikin token sendiri via UI "＋ Buat Token di USB" — generate keypair + encrypt + tulis file — **tanpa registrasi**, registrasi terpisah via "Daftarkan USB Baru")
- Auto-spawn PHP dari Tauri untuk standalone desktop ✅ (selesai - catatan: masih butuh PHP terinstall di sistem user; bundling `php.exe` sebagai sidecar belum dilakukan)

**Catatan MFA USB:**
- Flow register token memakai ECDSA P-256 signature (raw r||s 64 bytes → backend convert ke DER untuk openssl_verify)
- PHP 8.4: `openssl_pkey_get_public/private` TIDAK menerima DER binary langsung, harus wrap PEM
- Challenge disimpan di tabel `usb_challenges` (TTL 5 menit, single-use)
- Browser mode (non-Tauri): decrypt fallback pakai Web Crypto langsung (untuk dev tanpa Tauri)
- **Pembuatan token & pendaftaran terpisah** — `create_usb_token_file` (Rust) hanya tulis file, registrasi via `/mfa/usb/register/*` (backend). User bikin token sendiri dari UI panel, tidak perlu CLI admin
- **Validasi format token** — `scan_usb_tokens` return `is_valid` flag; frontend tampilkan status **kuning (warning)** kalau file corrupt/format invalid
- **Overwrite protection** — UI wajib centang konfirmasi sebelum menimpa token lama di flashdisk yang sudah berisi token
- Generator CLI `database/generate_test_token.php` tetap ada sebagai alternatif dev

---

## 13. File yang Harus Diperbarui saat Sprint 2+

Saat menambahkan endpoint baru, selalu update:

1. `backend/index.php` - tambah route baru ke match()
2. `database/migrations/` - file SQL baru kalau butuh tabel
3. `README.md` - seksi API Endpoints
4. `tests/api_test.php` - tambah test case
5. `docs/dev/knowledge_transfer.md` - update State Sprint

---

## 14. Hal-hal yang Perlu Diperhatikan

1. **CORS** - origin web dikunci di `.env` key `FRONTEND_ORIGIN`. Kalau port frontend berubah, update ini. Origin Tauri (`http://tauri.localhost`, `tauri://localhost`, `http://localhost`, `http://127.0.0.1`) sudah diizinkan otomatis di `helpers/response.php` untuk desktop app.
2. **JWT Secret** - ada di `.env` key `JWT_SECRET`. Nilai default di `.env.example` JANGAN dipakai di production.
3. **Password admin default** - `Admin@1234`. Hash-nya di-generate ulang setiap `php database/migrate.php --seed` dijalankan.
4. **`ballots` tidak punya FK ke users** - ini by design, jangan ditambahkan.
5. **Tauri icons** - sudah di-generate dari `frontend/public/icon/TrueCount_logo_transparent.png`. Kalau ganti desain logo: copy file PNG baru ke `src-tauri/icons/icon.png`, lalu jalankan `npx tauri icon src-tauri/icons/icon.png` untuk generate semua format platform (`.ico` Windows, `.icns` macOS, PNG, dll.).
6. **axios belum dipakai** - diinstall tapi Sprint 1 pakai `fetch` native. Sprint 2 boleh migrasi ke axios atau tetap pakai fetch.
7. **`draft_user` belum ada** - reset password, email verification, dan roles lanjutan belum diimplementasi.
8. **Vite 8 + minifier** - jangan set `minify: 'esbuild'`; pakai `terser`. Target build jangan lebih tinggi dari `es2020`/`chrome90`/`safari13` atau transform destructuring akan gagal.
9. **Tauri `default-features = false`** - jangan enable fitur `dialog` Tauri (butuh `TaskDialogIndirect`, error di Windows lama). Kalau butuh dialog native, pakai plugin terpisah.
10. **Path `\\?\`** - Tauri resource dir mengembalikan Windows extended path; selalu strip prefix `\\?\` sebelum dipakai sebagai argumen proses PHP.
11. **Pendaftaran publik ditutup** - akun baru hanya lewat undangan admin (`POST /invites`). Undangan kedaluwarsa otomatis sesuai `INVITE_EXPIRE_DAYS` (default 7 hari, bisa diatur di `.env`). Jangan buka `POST /auth/register` tanpa validasi `invite_token`.
