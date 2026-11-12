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
| **Status** | Semua sprint selesai (Sprint 1–4 + 4b) ✅ |
| **Repositori** | Monorepo - backend PHP + frontend React dalam satu folder |
| **Tujuan** | Proyek Akhir Mata Kuliah Kriptografi |
| **Universitas** | UPN "Veteran" Yogyakarta - Program Studi Informatika |
| **Angkatan** | 2024 |

### Tim Pengembang

| # | Nama | Peran | Fokus Sprint |
| --- | ------ | ------- | -------------- |
| 1 | **Rio Meidi Ataurrahman** | Authentication & User Management | Sprint 1 (Auth, Invite, Dashboard) · Sprint 4 (MFA: WebAuthn, USB Token) · **Sprint 4b (Auth Security Layer: Session Mgmt, Failed Attempts, Camera Enforcement)** |
| 2 | **Muhamad Ifsal Fadhilah** | Election Management & Voting System | **Sprint 2 (Election CRUD, Voting, Results) ✅ SELESAI** |
| 3 | **Erlan Rifqi Davin D** | Cryptography & Advanced Security | **Sprint 3 (Vigenere, AES-256-GCM, ChaCha20, Blockchain, Steganografi) ✅ SELESAI** |

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

### Kursor Kustom (Custom Cursor)

TrueCount pakai kumpulan kursor kustom untuk berbagai state interaksi, agar aplikasi punya identitas visual yang konsisten dan terasa lebih native.

- **Asset:** `frontend/public/assets/CursorTrueCount/TrueCount_cursor_full_set/` (file `.cur` + PNG 32px/64px per state)
- **Style:** `frontend/src/styles/cursor.css` — diimpor di `frontend/src/main.jsx` sehingga berlaku aplikasi-wide
- **State yang tersedia:** `normal`, `link`, `tombol`, `pilih`, `text`, `text_v`, `crosshair`, `move`, `resize_ew/ns/nwse/nesw`, `grab`, `grabbing`, `zoom_in/out`, `copy`, `menu`, `wait`, `loading`, `help`, `nope`
- **Fallback:** Tiap kursor punya PNG 32px (utama) + 64px (layar tinggi DPI), lalu fallback ke cursor bawaan browser (`auto`, `pointer`, `text`, dll.)
- **Aksesibilitas:** Animasi kursor dimatikan untuk pengguna yang mengaktifkan `prefers-reduced-motion: reduce`
- **Pemakaian class utility:** `.tc-loading`, `.tc-copy`, `.tc-grab`, `.tc-grabbing`, `.tc-zoom-in`, `.tc-zoom-out`, `.tc-help`, `.tc-not-allowed`, `.tc-text`, `.tc-crosshair`, dll.

### Detail Visual: Status Indicator Dot (Kamera Verifikasi)

Di `LoginPage` (`/masuk`), indikator status kamera menggunakan titik kecil (`.status-dot` dalam `.camera-status-indicator`) yang **berkedip warna hijau ↔ abu-abu** selama kamera diverifikasi aktif:

- File CSS: `frontend/src/pages/AuthPage.css`
- Animasi: `statusBlink` (1.5s, infinite)
- Warna hijau: `#2a7a3b` (kamera aktif / terverifikasi)
- Warna abu-abu: `#9ca3af` (fase blink)
- Elemen HTML: `<span className="status-dot" aria-hidden="true"></span>` + teks "verifikasi kamera"
- `prefers-reduced-motion: reduce` mematikan animasi → titik tetap hijau statis

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
backend/config/env.php       - Baca variabel .env (DB_HOST, DB_NAME, JWT_SECRET, ENCRYPTION_KEY_B64, dll.)
backend/helpers/response.php - jsonResponse() + CORS multi-origin (FRONTEND_ORIGIN + origin Tauri)
backend/helpers/logger.php   - tc_log() file logger → backend/storage/logs/app.log
backend/helpers/jwt.php      - generateJwt() + verifyJwt() - HS256 manual
backend/helpers/datetime.php - Helper tanggal/WIB (Asia/Jakarta)
backend/helpers/webauthn.php - Helper WebAuthn (attestation/verifikasi)
backend/helpers/election_scheduler.php - Jadwal pemilihan (start/end time)
backend/middleware/auth.php  - requireAuth() / requireAdmin() → return payload atau exit 401
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
backend/api/auth/security_setup.php  - GET /auth/security-setup - cek status keamanan user (wajib setup)
backend/api/auth/security_status.php - POST /auth/security-status - cek status keamanan by identifier (publik)
backend/api/auth/attempts_log.php    - POST /auth/attempts/log - log attempt login (internal backend)
backend/api/auth/attempts_reset.php  - POST /auth/attempts/reset - reset failed attempts
backend/api/auth/attempts_list.php   - GET /auth/attempts/list - daftar percobaan login (admin audit)
backend/api/auth/attempts_photo.php  - GET /auth/attempts/{id}/photo - foto kamera percobaan login
backend/api/invites/create.php  - POST /invites (admin) buat undangan
backend/api/invites/list.php    - GET /invites (admin) daftar + stats status
backend/api/invites/verify.php  - GET /invites/verify?token= (publik)
backend/api/invites/revoke.php  - POST /invites/{id}/revoke - batalkan undangan
backend/api/mfa/usb/register_start.php  - POST /mfa/usb/register/start - generate challenge
backend/api/mfa/usb/register_verify.php - POST /mfa/usb/register/verify - verify ECDSA + simpan credential
backend/api/mfa/usb/authenticate_start.php - POST /mfa/usb/authenticate/start - challenge login MFA USB
backend/api/mfa/usb/authenticate_verify.php - POST /mfa/usb/authenticate/verify - verifikasi signature → JWT
backend/api/mfa/usb/list.php    - GET /mfa/usb/list - daftar token user
backend/api/mfa/usb/revoke.php  - POST /mfa/usb/{id}/revoke - nonaktifkan token
backend/api/mfa/usb/label.php   - POST /mfa/usb/{id}/label - update label
backend/api/elections/create.php    - POST /elections - buat pemilihan (admin)
backend/api/elections/list.php      - GET /elections - daftar pemilihan
backend/api/elections/show.php      - GET /elections/:id - detail pemilihan
backend/api/elections/update.php    - PUT /elections/:id - ubah pemilihan (admin)
backend/api/elections/delete.php    - DELETE /elections/:id - hapus pemilihan (admin)
backend/api/elections/results.php   - GET /elections/:id/results - hasil tally
backend/api/elections/vote.php      - POST /elections/:id/vote - kirim suara (voter)
backend/api/elections/candidates/create.php    - POST /elections/:id/candidates - tambah kandidat
backend/api/elections/candidates/list.php      - GET /elections/:id/candidates - daftar kandidat
backend/api/elections/candidates/show_photo.php - GET /elections/:id/candidates/:cid/photo - foto kandidat
backend/api/elections/candidates/upload_photo.php - POST /elections/:id/candidates/:cid/photo - upload foto
backend/api/elections/candidates/update.php    - PUT /elections/:id/candidates/:cid - ubah kandidat
backend/api/elections/candidates/delete.php    - DELETE /elections/:id/candidates/:cid - hapus kandidat
backend/api/elections/voters/list.php      - GET /elections/:id/voters - daftar voter
backend/api/elections/voters/register.php  - POST /elections/:id/voters - daftarkan voter
backend/api/elections/voters/delete.php    - DELETE /elections/:id/voters/:userId - keluarkan voter
backend/api/elections/blockchain-seal.php  - POST /elections/blockchain/seal - seal block
backend/api/elections/blockchain-verify.php - GET /elections/blockchain/verify - verifikasi blockchain
backend/api/users/voters.php    - GET /users/voters - daftar semua voter aktif (admin)
backend/api/users/search.php    - GET /users/search?q= - cari pengguna (admin)
backend/api/encrypted-messages/create.php  - POST /encrypted-messages - buat pesan terenkripsi
backend/api/encrypted-messages/get.php     - GET /encrypted-messages/:id - ambil pesan terenkripsi
backend/services/crypto/AESGCMService.php        - Enkripsi AES-256-GCM (ballot, file)
backend/services/crypto/ChaCha20Poly1305Service.php - Enkripsi ChaCha20-Poly1305 (pesan, file)
backend/services/crypto/VigenereCipherService.php - Enkripsi Vigenere (pesan klasik)
backend/services/crypto/SteganographyService.php  - Sembunyikan pesan dalam gambar (LSB)
backend/services/crypto/FileEncryptionService.php - Enkripsi file upload (nonce, auth_tag, mime_type)
backend/services/crypto/EncryptedMessageService.php - Service pesan terenkripsi
backend/services/crypto/BlockchainService.php     - Blockchain sederhana (seal & verify hasil pemilihan)
backend/services/crypto/BallotService.php         - Enkripsi/dekripsi ballot suara
backend/services/crypto/BallotTallyService.php    - Tally hasil pemilihan
```

### Frontend

``` 
frontend/src/App.jsx            - BrowserRouter + Routes + AuthProvider + FailedAttemptsProvider
frontend/src/hooks/
  useUsbToken.ts          - Hook USB token: listen event Tauri, decrypt, sign, register API
  useWebAuthn.ts          - Hook WebAuthn (Windows Hello): login & register flow
  useAuth.ts              - Hook auth umum: changePassword, webauthn register/list/revoke
  useAuthSecurity.tsx     - **Hook keamanan auth: failed attempts tracking, camera permission, auth guard, security setup check**
  useAuthSession.tsx      - **Hook session management: AuthProvider, useAuth, useApi (auto 401 handling, token expiry)**
  useFaceDetection.ts     - **Hook deteksi wajah/kamera: verifikasi frame tidak gelap/shutter tertutup (canvas sampling)**
frontend/src/pages/
  LandingPage.jsx + .css        - Hero dengan raise_hand.jpg + nav link tengah, tombol Masuk (ikon) di kanan
  LoginPage.jsx                 - Form login (card center), fetch ke /auth/login + status dongle (DETEKSI USB ASLI via scanForTokens, polling 2 detik) + banner sukses registrasi + **password fallback setelah 5 gagal + kamera wajib untuk Windows Hello + camera auto-off saat pindah halaman**
  UserSecurityLogPage.jsx + .css - **Halaman Log Keamanan Pengguna (/log-keamanan/:id): riwayat percobaan login beserta foto kamera, hanya bisa diakses admin via pencarian user di dasbor**
  RegisterPage.jsx              - Form register INVITE-ONLY: verifikasi ?undangan=<token> via GET /invites/verify, state "pendaftaran ditutup" tanpa token
  SecuritySetupPage.tsx         - **Halaman setup keamanan wajib (/atur-keamanan): user pilih Windows Hello atau Dongle sebelum akses dashboard**
  AuthPage.css                  - Shared CSS untuk Login + Register + SecuritySetup + state panel undangan
  DashboardPage.jsx + .css      - Dasbor + easter egg 5-klik + auth guard; admin lihat panel undangan (stats + tabel status + form buat undangan + salin tautan)
  VotePage.jsx + .css          - Halaman pemilihan (/pilih): kandidat demo, tombol besar berwarna + ikon SVG + auth guard
  ProfileSettingsPage.jsx + .css - Halaman pengaturan (/pengaturan): change password, Windows Hello, USB token management
  UsbTokenTestPage.jsx + .css  - Halaman test USB token (/usb-token-test): deteksi, decrypt, challenge-response
  AboutPage.jsx                - Halaman tentang aplikasi (/tentang): informasi proyek, tim, stack teknologi
  ResultsPage.jsx + .css       - Halaman hasil pemilihan (/hasil/:id): tally suara, verifikasi blockchain, statistik partisipasi
  EncryptedMessagesPage.jsx    - Halaman pesan terenkripsi (/pesan-terenkripsi): buat & lihat pesan terenkripsi (Vigenere, AES-256-GCM, ChaCha20)
  DevPage.jsx + DevPage.css    - **Halaman Dev (/dev): visualisasi 3D isometrik flow aplikasi + algoritma kriptografi, hanya Admin + Dev**
frontend/src/components/
  HealthMonitor.jsx             - Render null; polling /health di background, error → console (bukan UI)
  Skeleton.jsx + .css           - Komponen loading placeholder
  UsbTokenPanel.jsx + .css      - Panel kelola USB token
  AuthGuard.jsx                 - **Route guard: redirect ke /atur-keamanan jika belum setup Windows Hello/Dongle**
  RoleGuard.jsx                 - **Route guard: hanya izinkan role yang diizinkan (admin/dev untuk /dev)**
  Nav.jsx                       - **Navigation dengan user menu + logout saat authenticated**
  DashNav.jsx                   - **Nav khusus halaman terlindungi**
  ElectionModals.jsx            - **Modal CRUD pemilihan & kandidat di dasbor admin**
  IsometricFlow.jsx             - **Visualisasi 3D isometrik: Flow Aplikasi (GET /dev/flow)**
  IsometricCrypto.jsx           - **Visualisasi 3D isometrik: Algoritma Kriptografi (GET /dev/crypto)**
frontend/src/index.css          - Reset global + font family
frontend/src/main.jsx           - ReactDOM.createRoot + impor `cursor.css` agar kursor kustom TrueCount berlaku di seluruh aplikasi
frontend/src/styles/cursor.css  - Kumpulan aturan kursor kustom untuk state normal, link, tombol, teks, resize, grab, grabbing, zoom, copy, menu, wait, loading, help, dan nope (PNG 32/64px + fallback bawaan browser)
```

### Database

```
database/migrations/001_init.sql  - 10 tabel (lihat seksi DB)
database/seeds/001_admin.sql      - Admin: username=admin, password=Admin@1234
database/seeds/002_dummy_users.sql - User dummy: pemilih1, pemilih2 (lihat seksi 4.5)
database/seeds/003_dev_user.sql    - User dev: username=dev, password=Dev@1234, role=dev
database/migrate.php              - php database/migrate.php [--seed] [--fresh]
```

### Akun User (untuk testing)

| Username | Password | Role | Email | Keterangan |
| --- | --- | --- | --- | --- |
| `admin` | `Admin@1234` | admin | admin@truecount.local | Akun utama (seed 001) |
| `pemilih1` | `Pemilih@123` | voter | pemilih1@truecount.local | Dummy - testing pemilihan |
| `pemilih2` | `Pemilih@123` | voter | pemilih2@truecount.local | Dummy - testing pemilihan |
| `dev` | `Dev@1234` | dev | dev@truecount.local | Akses halaman dev (`/dev`) - seed 003 |

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
| `/tentang` | `AboutPage` | Halaman tentang aplikasi (proyek, tim, stack) |
| `/masuk` | `LoginPage` | Login |
| `/daftar` | `RegisterPage` | Pendaftaran - invite-only, wajib query `?undangan=<token>`; tanpa token tampil state "hanya melalui undangan" |
| `/atur-keamanan` | `SecuritySetupPage` | **Setup keamanan wajib (Windows Hello/Dongle) — redirect dari AuthGuard** |
| `/dasbor` | `DashboardPage` | Dasbor (easter egg 5-klik, panel undangan admin, ada auth guard) |
| `/pilih` | `VotePage` | Halaman pemilihan - kandidat, tombol besar berwarna (Sprint 2 ✅, ada auth guard) |
| `/hasil/:id` | `ResultsPage` | Hasil pemilihan + verifikasi blockchain (Sprint 2 ✅, ada auth guard) |
| `/pengaturan` | `ProfileSettingsPage` | Pengaturan profil: change password, Windows Hello, USB token |
| `/usb-token-test` | `UsbTokenTestPage` | Halaman test USB token: deteksi, decrypt, challenge-response (ada auth guard) |
| `/pesan-terenkripsi` | `EncryptedMessagesPage` | Buat & lihat pesan terenkripsi (Sprint 3 ✅, ada auth guard) |
| `/log-keamanan/:id` | `UserSecurityLogPage` | **Riwayat percobaan login + foto kamera (audit admin)** |
| `/dev` | `DevPage` | **Halaman Dev - visualisasi 3D isometrik flow + kriptografi (hanya admin + dev)** |
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
| GET | `/auth/security-setup` | Bearer JWT | - | `200 {has_webauthn, has_dongle, requires_setup, user_id}` - **cek status keamanan user** |
| POST | `/auth/security-status` | - | `{identifier}` | `200 {found, has_webauthn, has_dongle, requires_setup}` - **cek status keamanan by identifier (publik)** |
| POST | `/auth/attempts/log` | - | `{identifier, method, success, error?, user_agent?}` | `200 {message}` - **log attempt login ke DB (dipanggil oleh backend secara internal saat login; frontend TIDAK lagi memanggil ini langsung untuk mencegah duplikasi baris)** |
| POST | `/auth/attempts/reset` | - | `{identifier}` | `200 {message}` - **reset failed attempts (dipanggil backend setelah login berhasil)** |
| GET | `/auth/attempts/list` | Bearer JWT (admin) | - | `200 {attempts}` - **daftar riwayat percobaan login (audit admin)** |
| GET | `/auth/attempts/{id}/photo` | Bearer JWT (admin) | - | `image/*` - **foto kamera percobaan login** |
| GET | `/invites` | Bearer JWT (admin) | - | `200 {stats, invites}` - status: `menunggu`/`diterima`/`kedaluwarsa`/`dibatalkan` |
| POST | `/invites` | Bearer JWT (admin) | `{email?, role?}` | `201 {message, invite}` - `invite.link` = `/daftar?undangan=<token>` |
| GET | `/invites/verify` | - | query `?token=` | `200 {valid, invite}` / `400` / `404` |
| POST | `/invites/{id}/revoke` | Bearer JWT (admin) | - | `200 {message}` - batalkan undangan |
| POST | `/mfa/usb/register/start` | Bearer JWT | - | `200 {challenge_id, challenge}` - challenge 32 byte random, TTL 5 menit |
| POST | `/mfa/usb/register/verify` | Bearer JWT | `{challenge_id, signature, public_key, label?}` | `201 {message, credential}` - verifikasi ECDSA P-256 |
| POST | `/mfa/usb/authenticate/start` | - (identifier-based) | `{identifier}` | `200 {challenge_id, challenge, allowCredentials[], user}` - mulai MFA login USB token |
| POST | `/mfa/usb/authenticate/verify` | - | `{challenge_id, credential_id, signature}` | `200 {message, token, user}` - verifikasi MFA login USB token, return JWT |
| GET | `/mfa/usb/list` | Bearer JWT | - | `200 {credentials}` - daftar USB token user |
| POST | `/mfa/usb/{id}/revoke` | Bearer JWT | - | `200 {message}` - nonaktifkan token |
| POST | `/mfa/usb/{id}/label` | Bearer JWT | `{label}` | `200 {message, label}` - update label |
| GET | `/elections` | Bearer JWT | - | `200 {elections}` - daftar pemilihan |
| POST | `/elections` | Bearer JWT (admin) | `{title, description, start_time, end_time, status?}` | `201 {election}` - buat pemilihan baru |
| GET | `/elections/:id` | Bearer JWT | - | `200 {election, candidates}` - detail pemilihan + kandidat |
| PUT | `/elections/:id` | Bearer JWT (admin) | `{title, description, start_time, end_time, status?}` | `200 {message}` - ubah pemilihan |
| DELETE | `/elections/:id` | Bearer JWT (admin) | - | `200 {message}` - hapus pemilihan |
| GET | `/elections/:id/candidates` | Bearer JWT | - | `200 {candidates}` - daftar kandidat |
| POST | `/elections/:id/candidates` | Bearer JWT (admin) | `{name, vision, mission, photo_path?}` | `201 {candidate}` - tambah kandidat |
| GET | `/elections/:id/candidates/:cid/photo` | Bearer JWT | - | `image/*` - foto kandidat terenkripsi |
| POST | `/elections/:id/candidates/:cid/photo` | Bearer JWT (admin) | form-data `photo` | `200 {message, photo_path}` - upload foto kandidat |
| PUT | `/elections/:id/candidates/:cid` | Bearer JWT (admin) | `{name, vision, mission}` | `200 {message}` - ubah kandidat |
| DELETE | `/elections/:id/candidates/:cid` | Bearer JWT (admin) | - | `200 {message}` - hapus kandidat |
| GET | `/elections/:id/voters` | Bearer JWT (admin) | - | `200 {voters}` - daftar voter terdaftar |
| POST | `/elections/:id/voters` | Bearer JWT (admin) | `{user_id}` | `201 {voter}` - daftarkan voter ke pemilihan |
| DELETE | `/elections/:id/voters/:userId` | Bearer JWT (admin) | - | `200 {message}` - keluarkan voter dari pemilihan |
| GET | `/elections/:id/results` | Bearer JWT | - | `200 {results, total_votes}` - hasil tally pemilihan |
| POST | `/elections/:id/vote` | Bearer JWT | `{candidate_id, encrypted_vote, nonce, integrity_hash}` | `201 {message}` - kirim suara (voter) |
| POST | `/elections/blockchain/seal` | Bearer JWT (admin) | - | `200 {block}` - seal block blockchain |
| GET | `/elections/blockchain/verify` | Bearer JWT | - | `200 {valid, blocks}` - verifikasi integritas blockchain |
| GET | `/users/voters` | Bearer JWT (admin) | - | `200 {voters}` - daftar semua voter aktif di sistem |
| GET | `/users/search?q=` | Bearer JWT (admin) | - | `200 {users}` - cari pengguna (admin, untuk log keamanan) |
| POST | `/encrypted-messages` | Bearer JWT | `{algorithm, ciphertext, iv_nonce?}` | `201 {message}` - buat pesan terenkripsi |
| GET | `/encrypted-messages/:id` | Bearer JWT | - | `200 {message}` - ambil pesan terenkripsi |
| GET | `/dev/flow` | Bearer JWT (admin/dev) | - | `200 {flow: [...]}` - data alur aplikasi (nodes & edges) untuk halaman dev |
| GET | `/dev/crypto` | Bearer JWT (admin/dev) | - | `200 {algorithms: [...]}` - data algoritma kriptografi untuk halaman dev |

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
 
16 tabel - `database/migrations/001_init.sql` (10 tabel) + `002_invites.sql` + `003_usb_tokens.sql` + `004_usb_challenges.sql` + `005_webauthn_challenges.sql` + `006_biometric_last_used.sql` + `007_auth_attempts.sql` + `008_sprint2_marker.sql` + `009_add_photo_path_to_auth_attempts.sql` + `010_add_crypto_version.sql` + `011_add_encrypted_files_columns.sql` + `012_add_dev_role.sql`:

| Tabel | Sprint | Keterangan |
| --- | --- | --- |
| `users` | 1 ✅ | id, username, email, password_hash, role (admin/voter), is_active |
| `biometric_credentials` | 4 | WebAuthn/FIDO2 - FK ke users (termasuk last_used_at) |
| `usb_tokens` | 4 | USB Token (legacy table dari migration 001) |
| `usb_token_credentials` | 4 | **USB Token (software token di flashdisk) - ECDSA P-256 public key storage** |
| `webauthn_challenges` | 4 | Challenge WebAuthn (TTL 5 menit, single-use) - registration & authentication |
| `usb_challenges` | 4 | **Challenge sementara untuk register/authenticate USB token (TTL 5 menit, single-use)** |
| `auth_attempts` | 4b | **Log percobaan login: user_id, identifier, method (webauthn/dongle/password), success, error, ip_address, user_agent, photo_path, created_at** |
| `invites` | 2 ✅ | Undangan pendaftaran - token, email (nullable), role, status (pending/accepted/revoked), expires_at, created_by, used_by |
| `elections` | 2 ✅ | Pemilihan - FK ke users (created_by) |
| `candidates` | 2 ✅ | Kandidat - FK ke elections (termasuk photo_path) |
| `voters` | 2 ✅ | Partisipasi (has_voted tapi BUKAN isi suara) - FK ke users + elections |
| `ballots` | 2 ✅ | **TIDAK ada FK ke users** - privacy by design (encrypted_vote, nonce, integrity_hash) |
| `encrypted_messages` | 3 ✅ | Modul kriptografi (Vigenere, AES-256-GCM, ChaCha20) |
| `encrypted_files` | 3 ✅ | File terenkripsi (nonce, auth_tag, file_size, mime_type via migration 011) |
| `blocks` | 3 ✅ | Blockchain sederhana (seal & verify hasil pemilihan) |

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
5. Frontend simpan token di localStorage key: 'tc_token' + AuthContext
6. Request ke endpoint protected → kirim header: Authorization: Bearer <token>
7. middleware/auth.php → requireAuth() / requireAdmin() → verifyJwt() → return payload
8. Logout → frontend hapus 'tc_token' dari localStorage

=== Auth Security Layer (Sprint 4b) ===
9. Saat akses route protected (/dasbor, /pilih, /pengaturan, dll):
   - AuthGuard cek GET /auth/security-setup (pakai JWT)
   - Jika requires_setup=true → redirect ke /atur-keamanan (simpan returnTo)
10. Di /atur-keamanan:
    - User WAJIB setup minimal 1 metode: Windows Hello (butuh kamera) ATAU Dongle
    - Setelah setup → redirect balik ke returnTo (default /dasbor)
11. Saat login di /masuk:
    - Default: Windows Hello (jika tersedia & kamera aktif)
    - Dongle: jika Tauri desktop
    - Kata Sandi: HIDDEN by default
      → Muncul jika: 5+ percobaan gagal (lock 15 menit) ATAU user belum setup keamanan (onboarding)
    - Semua attempt (success/gagal) di-log ke DB **oleh backend secara internal** di `login.php`, `webauthn_login_verify.php`, dan `authenticate_verify.php` (single source of truth — frontend hanya simpan counter lokal untuk UI lockout/password fallback)
    - Kamera wajib aktif untuk Windows Hello (verifikasi frame bukan gelap/shutter tertutup)
    - Foto kamera ditangkap sebelum auth dikirim (simpan ke `auth_attempts.photo_path`)
12. Auto-session management:
    - Cek JWT expiry client-side tiap 30 detik → auto-logout jika expired
    - Intercept fetch → 401 → auto-logout + redirect /masuk
    - Nav bar: tampil user menu + logout button saat authenticated
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

## 8.5. Flow Aplikasi (End-to-End)

Berikut alur lengkap penggunaan aplikasi dari awal hingga akhir, menurut peran pengguna:

### A. Alur Admin / Panitia

```
1. Login → /masuk (Windows Hello / Dongle / Kata Sandi fallback)
2. AuthGuard cek security setup → jika belum setup, redirect /atur-keamanan
3. Masuk /dasbor → lihat panel undangan (stats: menunggu/diterima/kedaluwarsa/dibatalkan)
4. Buat undangan: POST /invites → dapatkan link /daftar?undangan=<token>
5. Bagikan tautan undangan ke calon pemilih
6. Buat pemilihan: POST /elections → atur judul, deskripsi, waktu mulai/selesai, status
7. Kelola kandidat: POST /elections/:id/candidates (+ upload foto)
8. Daftarkan voter ke pemilihan: POST /elections/:id/voters
9. Saat voting berjalan: pantau hasil di /hasil/:id (tally + blockchain verify)
10. Setelah selesai: seal blok: POST /elections/blockchain/seal
11. Verifikasi integritas: GET /elections/blockchain/verify
12. Audit: lihat log keamanan lewat /users/search → /log-keamanan/:id
13. Logout → hapus token dari localStorage
```

### B. Alur Pemilih (Voter)

```
1. Menerima tautan undangan dari admin: /daftar?undangan=<token>
2. Cek validitas undangan: GET /invites/verify?token=...
3. Daftar akun: POST /auth/register (dengan invite_token) → password di-hash Argon2id
4. Login: /masuk (Windows Hello default jika tersedia, else Dongle, else Kata Sandi)
5. Kamera diverifikasi aktif (untuk Windows Hello / Kata Sandi)
6. Jika belum setup keamanan → redirect /atur-keamanan (wajib setup Windows Hello atau Dongle)
7. Masuk /pilih → lihat kandidat pemilihan yang aktif
8. Kirim suara: POST /elections/:id/vote (terenkripsi AES-256-GCM, tanpa FK ke user)
9. Lihat hasil: /hasil/:id (tally + verifikasi blockchain)
10. Kelola keamanan pribadi: /pengaturan (ganti password, kelola Windows Hello, kelola USB token)
11. (Opsional) Daftarkan USB token di /usb-token-test untuk MFA login
12. Logout
```

### C. Alur Login dengan Security Layer (Sprint 4b)

```
1. User buka /masuk
2. Default method: Windows Hello (jika supported + kamera aktif), Dongle (Tauri), Kata Sandi (HIDDEN)
3. Input identifier (username/email)
4. POST /auth/security-status → cek user punya WebAuthn/Dongle?
   - Belum punya → Kata Sandi TAMPIL (onboarding)
5. Pilih method:
   a. Windows Hello → kamera wajib aktif (canvas sampling) → ambil foto → loginWithWindowsHello
   b. Dongle → start USB auth → input PIN → sign challenge → verify → JWT
   c. Kata Sandi → kamera tetap diverifikasi → POST /auth/login + photo
6. Success → login(token, user) → navigate /dasbor
7. Gagal 5x → lock 15 menit → Kata Sandi TAMPIL (emergency fallback)
8. Berhasil → reset counter lokal + backend reset attempts
```

### D. Alur USB Token (Sprint 4)

```
1. Colok flashdisk → app desktop scan tiap 2 detik (scan_usb_tokens)
2. Buat token baru: "＋ Buat Token di USB" → generate keypair P-256 → encrypt → tulis .truecount_token
   (atau via CLI: php database/generate_test_token.php <drive> <user_id> <pin>)
3. Daftarkan token: /mfa/usb/register/start (challenge) → input PIN → sign → /mfa/usb/register/verify
4. Token terdaftar ke akun login → tampil di panel USB token (daftar, revoke, label)
5. Login MFA: /mfa/usb/authenticate/start → wait USB → input PIN → sign → /mfa/usb/authenticate/verify → JWT
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

> **Status:** Registrasi & manajemen token sudah jalan. **Login MFA via USB token juga sudah diimplementasi** (`/mfa/usb/authenticate/*`) — identifier-based challenge → sign → verify → JWT. Lihat Section 12 (Sprint 4) untuk detail lengkap.

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
| **Integrasi ke auth MFA** | ✅ Sudah terintegrasi — login via `/mfa/usb/authenticate/*` (challenge → sign → verify → JWT) |

---

## 12. State Sprint

### Sprint 1 - SELESAI ✅ (Rio Meidi Ataurrahman)

- Struktur proyek (backend + frontend monorepo)
- Database schema (10 tabel di migration 001) + migration runner (`database/migrate.php`)
- Auth API: register, login, logout, me, change-password
- **Pendaftaran via undangan (invite-only) ✅** - publik ditutup, admin buat undangan via `/invites`, halaman `/daftar` hanya terbuka lewat tautan `?undangan=<token>`, dasbor admin punya panel referal (stats: menunggu/diterima/kedaluwarsa/dibatalkan + form buat undangan + salin tautan)
- Landing Page (artsy, raise_hand.jpg, Jakarta Sans, #F13C35) - tombol Daftar dihapus, hanya Masuk (dengan ikon) di kanan nav
- Login + Register pages (split layout, animasi)
- Dashboard (easter egg 5-klik + panel undangan admin)
- Test otomatis: `php tests/api_test.php` (41 test, 100% pass)

### Sprint 2 - SELESAI ✅ (Muhamad Ifsal Fadhilah)

- **Election Management & Voting System sudah diimplementasikan sepenuhnya**
- Endpoint: `GET/POST /elections`, `GET/PUT/DELETE /elections/:id`, `GET/POST /elections/:id/candidates`, `GET/POST /elections/:id/candidates/:cid/photo`, `PUT/DELETE /elections/:id/candidates/:cid`, `GET/POST /elections/:id/voters`, `DELETE /elections/:id/voters/:userId`, `GET /elections/:id/results`, `POST /elections/:id/vote`, `POST/GET /elections/blockchain/seal|verify`
- Frontend: `VotePage` (`/pilih`), `ResultsPage` (`/hasil/:id`), `ElectionModals.jsx` (CRUD modal), `DashNav.jsx`
- Tabel: `elections`, `candidates`, `voters`, `ballots` (privacy by design: ballots tanpa FK ke users)
- Integrasi auth guard di halaman voting, JWT middleware
- Enkripsi ballot (AES-256-GCM) + blockchain seal/verify untuk integritas hasil

### Sprint 3 - SELESAI ✅ (Erlan Rifqi Davin D)

- **Modul Kriptografi & Keamanan Lanjutan sudah diimplementasikan sepenuhnya**
- Enkripsi pesan: Vigenere, AES-256-GCM, ChaCha20-Poly1305
- Enkripsi file upload (ChaCha20-Poly1305 dengan nonce, auth_tag, file_size, mime_type)
- Simple Blockchain (logging aktivitas pemilihan)
- Frontend: `EncryptedMessagesPage` (`/pesan-terenkripsi`)
- Tabel: `encrypted_messages`, `encrypted_files`, `blocks`
- Endpoint: `POST/GET /encrypted-messages`, `POST/GET /elections/blockchain/seal|verify`

### Sprint 4 - SELESAI ✅ (Rio Meidi Ataurrahman)

- WebAuthn biometrics (Windows Hello) ✅ — register, list, revoke via `/auth/webauthn/*`
- **Profile Settings Page ✅** (`/pengaturan`) — halaman terpusat untuk:
  - Change Password (Argon2id)
  - Windows Hello management (WebAuthn)
  - USB Token management (dipindahkan dari dasbor)
- **USB Token Test System ✅** (deteksi auto, decrypt, challenge-response test di `/usb-token-test`)
- **USB Token Login MFA ✅** (login pakai USB token via `/mfa/usb/authenticate/*` - identifier-based challenge → sign → verify → JWT)
- **USB Token Management ✅** (daftar/revoke/label token via `/mfa/usb/*` - register flow end-to-end: challenge → sign → verify)
- **USB Token Creation ✅** (User bikin token sendiri via UI "＋ Buat Token di USB" — generate keypair + encrypt + tulis file — **tanpa registrasi**, registrasi terpisah via "Daftarkan USB Baru")
- Auto-spawn PHP dari Tauri untuk standalone desktop ✅ (selesai - catatan: masih butuh PHP terinstall di sistem user; bundling `php.exe` sebagai sidecar belum dilakukan)
- **Auth Security Layer (Sprint 4b) ✅**:
  - **AuthProvider & useAuth** (`hooks/useAuthSession.tsx`) — session management global, auto-expiry check, fetch interceptor 401
  - **useAuthSecurity** (`hooks/useAuthSecurity.tsx`) — failed attempts tracking, camera permission + frame validation, security setup check
  - **AuthGuard** (`components/AuthGuard.jsx`) — route guard redirect ke `/atur-keamanan` jika user belum setup keamanan
  - **SecuritySetupPage** (`pages/SecuritySetupPage.tsx`) — halaman setup keamanan wajib (Windows Hello/Dongle)
  - **LoginPage Updated** — password fallback logic, camera verification, photo capture (fixed: use captured photo directly, not stale state), **camera auto-off saat pindah halaman**, useAuth login()
  - **Nav Updated** — user menu + logout button saat authenticated
  - **Backend**: `/auth/security-setup`, `/auth/security-status`, `/auth/attempts/log`, `/auth/attempts/reset`, `/auth/attempts/list`, `/auth/attempts/{id}/photo`
  - **Database**: `auth_attempts` table (migration 007 + 009 photo_path)
  - **Camera enforcement**: real-time frame validation via canvas sampling, periodic re-check, Lenovo shutter detection
  - **Password fallback**: hanya muncul setelah 5 gagal (lock 15 menit) atau user belum setup keamanan (onboarding)
  - **Audit logging**: semua attempt di-log ke DB oleh backend secara internal (single source of truth, mencegah duplikasi baris); frontend simpan counter lokal untuk UI lockout/password fallback + photo capture
- Flow register token memakai ECDSA P-256 signature (raw r||s 64 bytes → backend convert ke DER untuk openssl_verify)
- PHP 8.4: `openssl_pkey_get_public/private` TIDAK menerima DER binary langsung, harus wrap PEM
- Challenge disimpan di tabel `usb_challenges` (TTL 5 menit, single-use)
- Browser mode (non-Tauri): decrypt fallback pakai Web Crypto langsung (untuk dev tanpa Tauri)
- **Pembuatan token & pendaftaran terpisah** — `create_usb_token_file` (Rust) hanya tulis file, registrasi via `/mfa/usb/register/*` (backend). User bikin token sendiri dari UI panel, tidak perlu CLI admin
- **Validasi format token** — `scan_usb_tokens` return `is_valid` flag; frontend tampilkan status **kuning (warning)** kalau file corrupt/format invalid
- **Overwrite protection** — UI wajib centang konfirmasi sebelum menimpa token lama di flashdisk yang sudah berisi token
- Generator CLI `database/generate_test_token.php` tetap ada sebagai alternatif dev

---

## 11.6. Auth Security Layer (Sprint 4b)

> **Tujuan:** Memastikan user memiliki keamanan berlapis (Windows Hello ATAU Dongle) sebelum akses dashboard, dengan fallback password yang terkendali dan logging audit trail lengkap.

### Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **Mandatory Security Setup** | User WAJIB setup Windows Hello atau Dongle di `/atur-keamanan` sebelum akses dashboard |
| **Camera Enforcement** | Windows Hello butuh kamera aktif & frame valid (bukan gelap/shutter tertutup) — verifikasi real-time via canvas sampling |
| **Password Fallback Controlled** | Kata Sandi hanya muncul setelah: 5+ percobaan gagal (lock 15 menit) ATAU user belum setup keamanan (onboarding) |
| **Failed Attempts Tracking** | Semua attempt (success/gagal) di-log ke DB oleh backend secara internal; frontend hanya menyimpan counter lokal untuk UI lockout & password fallback, mencegah duplikasi baris log |
| **Auto Session Management** | Cek JWT expiry tiap 30 detik → auto-logout; intercept fetch 401 → auto-logout + redirect |
| **Audit Photo Capture** | Ambil foto webcam sebelum auth attempt (simpan ke `auth_attempts.photo_path`) |

### Arsitektur

| Komponen | File | Fungsi |
|----------|------|--------|
| **AuthProvider** | `hooks/useAuthSession.tsx` | Global auth state via Context: login/logout/refreshUser, auto-expiry check, fetch interceptor 401 |
| **useAuth** | `hooks/useAuthSession.tsx` | Hook akses auth state: user, token, isAuthenticated, login(), logout() |
| **useApi** | `hooks/useAuthSession.tsx` | Wrapper fetch dengan auto auth header + 401 handling |
| **useAuthSecurity** | `hooks/useAuthSecurity.tsx` | Failed attempts tracking (localStorage + server), camera permission + frame validation, security setup check |
| **AuthGuard** | `components/AuthGuard.jsx` | Route guard: cek `/auth/security-setup`, redirect ke `/atur-keamanan` jika requires_setup |
| **SecuritySetupPage** | `pages/SecuritySetupPage.tsx` | UI setup keamanan wajib: pilih Windows Hello (butuh kamera) atau Dongle (butuh Tauri) |
| **LoginPage** | `pages/LoginPage.jsx` | Updated: password fallback logic, camera verification, photo capture, useAuth login() |

### Database Migration Baru

```sql
-- database/migrations/007_auth_attempts.sql
CREATE TABLE `auth_attempts` (
    `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `identifier` VARCHAR(255) NOT NULL,
    `method` ENUM('webauthn', 'dongle', 'password') NOT NULL,
    `success` TINYINT(1) NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `photo_path` VARCHAR(500) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_identifier` (`identifier`),
    INDEX `idx_created_at` (`created_at`),
    
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Backend Endpoints Baru

| Method | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| GET | `/auth/security-setup` | Bearer JWT | Cek status keamanan user (has_webauthn, has_dongle, requires_setup) |
| POST | `/auth/attempts/log` | - | Log attempt login (identifier, method, success, error, user_agent, photo) |
| POST | `/auth/attempts/reset` | - | Reset failed attempts untuk identifier |
| POST | `/auth/security-status` | - | Cek status keamanan by identifier (publik, untuk login page) |

### Flow Login dengan Security Layer

```
1. User buka /masuk
2. Default method: Windows Hello (jika supported + platform available + kamera aktif)
   Dongle (jika Tauri desktop)
   Kata Sandi: HIDDEN
3. User input identifier (username/email)
4. POST /auth/security-status → cek user punya Windows Hello/Dongle?
   - Belum punya → identifierNeedsSetup = true → Kata Sandi TAMPIL (onboarding)
5. User pilih method:
   a. Windows Hello:
      - Kamera wajib aktif (verifyCameraActive via canvas sampling)
      - Ambil foto (captureAuthPhoto)
      - loginWithWindowsHello(identifier, photo)
      - Success → login(token, user) via useAuth → navigate /dasbor
   b. Dongle:
      - Start USB auth → wait USB → input PIN → sign challenge → verify
      - Success → login(token, user) → navigate /dasbor
   c. Kata Sandi (jika tersedia):
      - Kamera tetap diverifikasi aktif
      - POST /auth/login + photo
      - Success → login(token, user) → navigate /dasbor
6. Semua attempt → `increment()` di frontend (counter lokal untuk UI lockout/password fallback) + backend log ke `auth_attempts` secara internal (tidak ada duplikasi baris)
7. Gagal 5x → lock 15 menit → `showPasswordFallback = true` → Kata Sandi TAMPIL
8. Berhasil → `reset()` → counter lokal direset + backend `POST /auth/attempts/reset` (hapus baris gagal untuk identifier tersebut)

Protected Routes (/dasbor, /pilih, /pengaturan, dll):
- AuthGuard → GET /auth/security-setup (pakai JWT)
- requires_setup=true → redirect /atur-keamanan (state returnTo)
- Di /atur-keamanan: user setup Windows Hello/Dongle → complete → navigate returnTo
```

### Camera Verification Logic

```typescript
// Frame sampling via canvas (checkFrameHasContent)
- Sample ~1000 pixels per frame
- Check: nonBlackPercent ≥ 15%, avgBrightness > 20, contrast > 30, stdDev > 25
- Need ≥ 2 valid frames out of 5 checks
- Periodic re-check every 3s when shutter closed (auto-recover)
- Continuous monitoring every 2s during active session (detect shutter close mid-session)
- Lenovo gray shutter detection: low variance (stdDev ≤ 25) = FAIL
```

### Password Fallback Rules

| Kondisi | Kata Sandi Tampil? |
|---------|-------------------|
| User belum setup Windows Hello/Dongle | ✅ Ya (onboarding) |
| 5+ percobaan gagal (lock aktif) | ✅ Ya (emergency fallback) |
| Lock expired tapi count ≥ 5 | ✅ Ya |
| Normal (punya keamanan, <5 gagal) | ❌ Tidak |

---

## 12. Dev Page (Sprint 5) — Halaman Eksklusif Admin + Dev

### Tujuan

Halaman eksklusif untuk role `admin` dan `dev` di URL `/dev` (alias `/pengembang`). Berisi visualisasi 3D isometrik interaktif yang menjelaskan cara kerja aplikasi TrueCount dari awal hingga akhir, serta algoritma kriptografi yang diterapkan. Cocok digunakan sebagai dokumentasi teknis untuk tim dan materi presentasi (pitch deck) untuk evaluator.

### Akses & Middleware

- Role `dev` ditambahkan ke migration `012_add_dev_role.sql` (`ALTER TABLE users MODIFY role ENUM('admin','voter','dev')` + index `idx_users_role`) dan seed `003_dev_user.sql` (user `dev` / `Dev@1234` / role `dev`).
- Backend middleware `requireDevOrAdmin()` di `backend/middleware/auth.php` — paksa autentikasi + role admin atau dev, jika bukan → 403 Forbidden.
- Frontend `RoleGuard` (`components/RoleGuard.jsx`) — cek `user.role` dari JWT, jika bukan `admin`/`dev` redirect ke `/masuk` atau tampilkan 403.
- Route di `frontend/src/App.jsx` — `RoleGuard allowedRoles={['admin','dev']}` di dalam `AuthGuard`.

### Endpoint Data

| Method | Path | Auth | Keterangan |
|--------|------|------|------------|
| GET | `/dev/flow` | Bearer JWT (admin/dev) | Data alur aplikasi (nodes & edges) — dari `backend/api/dev/flow.php` |
| GET | `/dev/crypto` | Bearer JWT (admin/dev) | Data algoritma kriptografi — dari `backend/api/dev/crypto.php` |

### Komponen Frontend Baru

| File | Fungsi |
|------|--------|
| `frontend/src/pages/DevPage.jsx` | Halaman utama dev — 2 tab: Flow Aplikasi + Algoritma Kriptografi |
| `frontend/src/pages/DevPage.css` | Styling CSS 3D isometrik (kubus via CSS Transform, tidak butuh library eksternal) |
| `frontend/src/components/RoleGuard.jsx` | Route guard untuk role admin/dev |
| `frontend/src/components/IsometricFlow.jsx` | Visualisasi 3D isometrik: Flow Aplikasi (6 node: Pengguna → Login → Setup Keamanan → Dasbor → Input Suara → Hasil + Blockchain) |
| `frontend/src/components/IsometricCrypto.jsx` | Visualisasi 3D isometrik: 8 algoritma kripto (Argon2id, JWT HS256, AES-256-GCM, ChaCha20-Poly1305, Vigenere, Steganografi LSB, Blockchain, ECDSA P-256) |

### Teknologi 3D

CSS 3D Transform + SVG (rekomendasi dari `docs/dev/dev-page-plan.md`): ringan, tidak butuh build step tambahan, cocok untuk diagram alur isometrik, konsisten dengan stack saat ini (belum ada Three.js).

### Catatan Penting

- Halaman dev bersifat **read-only**, tidak boleh mengubah data produksi.
- Visualisasi 3D tetap ringan agar tidak mengganggu performa halaman lain.
- Cocok sebagai materi presentasi (pitch deck) saat sidang proyek akhir.

---

## 13. File yang Harus Diperbarui saat Sprint 2+

Saat menambahkan endpoint baru, selalu update:

1. `backend/index.php` - tambah route baru ke match()
2. `database/migrations/` - file SQL baru kalau butuh tabel
3. `README.md` - seksi API Endpoints
4. `tests/api_test.php` - tambah test case
5. `docs/dev/knowledge_transfer.md` - update State Sprint
6. `docs/dev/pembagian_jobdesk_secure_e_voting.md` - update pembagian tugas (file ada di `docs/dev/`, BUKAN `docs/project/`)

---

## 14. Hal-hal yang Perlu Diperhatikan

1. **CORS** - origin web dikunci di `.env` key `FRONTEND_ORIGIN`. Kalau port frontend berubah, update ini. Origin Tauri (`http://tauri.localhost`, `tauri://localhost`, `http://localhost`, `http://127.0.0.1`) sudah diizinkan otomatis di `helpers/response.php` untuk desktop app.
2. **JWT Secret** - ada di `.env` key `JWT_SECRET`. Nilai default di `.env.example` JANGAN dipakai di production.
3. **Password akun seed (HARDCODED)** - `admin`=`Admin@1234`, `dev`=`Dev@1234`, `pemilih1`/`pemilih2`=`Pemilih@123`. Hash Argon2id-nya **hardcoded** di `database/seeds/*.sql` (bukan di-generate ulang saat `--seed`). Jika ingin mengubah password default, generate hash baru via `password_hash('...', PASSWORD_ARGON2ID, ['memory_cost'=>65536,'time_cost'=>4,'threads'=>2])` lalu update file seed-nya — pastikan hash sesuai password (jangan copy-paste antar seed, karena bisa menyebabkan login gagal seperti kasus user `dev`).
4. **`ballots` tidak punya FK ke users** - ini by design, jangan ditambahkan.
5. **Tauri icons** - sudah di-generate dari `frontend/public/icon/TrueCount_logo_transparent.png`. Kalau ganti desain logo: copy file PNG baru ke `src-tauri/icons/icon.png`, lalu jalankan `npx tauri icon src-tauri/icons/icon.png` untuk generate semua format platform (`.ico` Windows, `.icns` macOS, PNG, dll.).
6. **axios belum dipakai** - diinstall tapi Sprint 1 pakai `fetch` native. Sprint 2 boleh migrasi ke axios atau tetap pakai fetch.
7. **`draft_user` belum ada** - reset password, email verification, dan roles lanjutan belum diimplementasi.
8. **Vite 8 + minifier** - jangan set `minify: 'esbuild'`; pakai `terser`. Target build jangan lebih tinggi dari `es2020`/`chrome90`/`safari13` atau transform destructuring akan gagal.
9. **Tauri `default-features = false`** - jangan enable fitur `dialog` Tauri (butuh `TaskDialogIndirect`, error di Windows lama). Kalau butuh dialog native, pakai plugin terpisah.
10. **Path `\\?\`** - Tauri resource dir mengembalikan Windows extended path; selalu strip prefix `\\?\` sebelum dipakai sebagai argumen proses PHP.
11. **Pendaftaran publik ditutup** - akun baru hanya lewat undangan admin (`POST /invites`). Undangan kedaluwarsa otomatis sesuai `INVITE_EXPIRE_DAYS` (default 7 hari, bisa diatur di `.env`). Jangan buka `POST /auth/register` tanpa validasi `invite_token`.

12. **Auth Security Layer (Sprint 4b)** - User WAJIB setup Windows Hello atau Dongle di `/atur-keamanan` sebelum akses dashboard. Password hanya muncul setelah 5 gagal (lock 15 menit) atau onboarding. Semua attempt di-log ke DB + photo. Kamera wajib aktif untuk Windows Hello (verifikasi frame real-time). Auto-session expiry check tiap 30 detik + fetch interceptor 401.
13. **Log Waktu Lokal (WIB)** - Semua log backend (app.log) menggunakan zona waktu Asia/Jakarta (UTC+7/WIB) via `date_default_timezone_set('Asia/Jakarta')` di `backend/index.php` dan `backend/helpers/logger.php`. Akses log dan error log mencatat semua request termasuk timestamp WIB.
14. **Verifikasi Gambar/Foto** - LoginPage menampilkan pratinjau foto yang ditangkap (`photo-preview` dengan `photo-thumbnail`) sebelum auth dikirimkan, sehingga user dapat memastikan gambar benar-benar tertangkap. Ada tombol "Ulangi" untuk menangkap foto ulang.
15. **Fix: Waktu Log Keamanan (WIB)** - Kolom `auth_attempts.created_at` bertipe `TIMESTAMP` dibaca MySQL dalam zona waktu server (UTC+7), lalu diformat backend sebagai UTC → waktu tampil maju 7 jam di browser. Perbaikan di `backend/api/auth/attempts_list.php`: baca sebagai Unix timestamp (UTC) lalu format `gmdate(DATE_ATOM)`.
16. **Fix: Duplikasi Baris Log Login** - Sebelumnya setiap login membuat 2 baris di `auth_attempts` (frontend POST `/auth/attempts/log` + backend `logAuthAttempt()` internal). Perbaikan di `frontend/src/hooks/useAuthSecurity.tsx`: frontend `increment()` hanya simpan counter lokal (UI lockout/password fallback), DB logging sepenuhnya tanggung backend sebagai single source of truth.
