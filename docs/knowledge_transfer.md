# TrueCount — Knowledge Transfer

> **Untuk AI / developer baru:** Baca dokumen ini sebelum menyentuh kode apapun.
> Berisi semua keputusan desain, konvensi, state proyek saat ini, dan konteks yang tidak terlihat dari kode saja.

---

## 1. Identitas Proyek

| Atribut | Nilai |
|---|---|
| **Nama** | TrueCount |
| **Tipe** | Aplikasi e-voting akademik (bukan production-critical) |
| **Bahasa UI** | Indonesia (Bahasa Indonesia penuh, termasuk path URL) |
| **Status** | Sprint 1 selesai |
| **Repositori** | Monorepo — backend PHP + frontend React dalam satu folder |

---

## 2. Tech Stack & Versi

### Frontend
| Package | Versi | Catatan |
|---|---|---|
| React | 19.x | Pakai function components + hooks |
| Vite | 8.x | Dev server port **5173**, HMR port 5183 |
| esbuild | 0.28.x | DevDependency — Vite 8 TIDAK lagi bundle esbuild, harus diinstall terpisah |
| terser | 5.x | Minifier production build (esbuild minify tidak kompatibel dengan target lama) |
| concurrently | 9.x | Jalankan PHP + Vite sekaligus: `npm run dev:full` |
| react-router-dom | 7.x | URL Bahasa Indonesia: `/masuk`, `/daftar`, `/dasbor` |
| axios | 1.x | Diinstall tapi belum dipakai — fetch native dipakai di Sprint 1 |
| @tauri-apps/cli | 2.x | Desktop wrapper, opsional |
| @tauri-apps/api | 2.x | JS bindings untuk Tauri commands |

**Script npm penting:**
- `npm run dev` — hanya frontend Vite (backend PHP HARUS dijalankan manual)
- `npm run dev:backend` — hanya backend PHP di :8000
- `npm run dev:full` — PHP + Vite sekaligus dalam satu terminal (pakai concurrently)
- `npm run free-ports` — bebasin port 5173/5183/8000 kalau kena "Port already in use" (script: `scripts/free-ports.ps1`)

### Backend
| Teknologi | Versi | Catatan |
|---|---|---|
| PHP | 8.1+ | Native, tanpa framework |
| MySQL | 8.0+ | atau MariaDB 10.6+ |
| JWT | HS256 | Implementasi custom di `helpers/jwt.php` — tanpa library |
| Password hash | Argon2id | `password_hash(..., PASSWORD_ARGON2ID)` |

---

## 3. Desain System

### Font
- **Plus Jakarta Sans** — diload via Google Fonts di `index.html`
- Weight yang dipakai: 300 (italic accent), 400, 500, 600, 700, 800

### Palette
| Token CSS | Nilai | Penggunaan |
|---|---|---|
| `--red` | `#F13C35` | CTA, aksen, error state, icon hover |
| `--red-dark` | `#c72e27` | Hover state button merah |
| `--black` | `#0d0d0d` | Teks utama, background dark section |
| `--cream` | `#fafaf8` | Background halaman utama |
| `--white` | `#ffffff` | Card, nav |
| `--border` | `#e4e4e1` | Divider, input border |
| `--muted` | `#6a6a67` | Teks sekunder |

### Design Language
- **Artsy / editorial** — terinspirasi gambar halftone pop-art (`raise_hand.jpg`)
- Heading besar dengan weight 800, line-height < 1.0, letter-spacing negatif
- Kata kunci di h1 hero dibuat *italic* weight 300 warna merah
- Animasi purposeful: `heroIn` (slide up), `rippleGrow` (easter egg), `tagPop` (spring)
- Semua section-reveal pakai `IntersectionObserver` dengan threshold 0.12–0.15

---

## 4. Struktur File Kunci

### Backend
```
backend/index.php           — Router utama, match() berdasarkan $uri + access log + exception handler
backend/helpers/response.php — jsonResponse() + CORS multi-origin (FRONTEND_ORIGIN + origin Tauri)
backend/helpers/logger.php   — tc_log() file logger → backend/storage/logs/app.log
backend/helpers/jwt.php      — generateJwt() + verifyJwt() — HS256 manual
backend/config/database.php  — getDB() singleton PDO
backend/config/app.php       — Konstanta JWT_SECRET, JWT_EXPIRE, ARGON2_*
backend/middleware/auth.php  — requireAuth() → return payload atau exit 401
backend/api/auth/register.php   — invite-gated (wajib invite_token valid)
backend/api/auth/login.php
backend/api/auth/logout.php
backend/api/auth/me.php
backend/api/invites/create.php  — POST /invites (admin) buat undangan
backend/api/invites/list.php    — GET /invites (admin) daftar + stats status
backend/api/invites/verify.php  — GET /invites/verify?token= (publik)
```

### Frontend
```
frontend/src/App.jsx            — BrowserRouter + Routes
frontend/src/pages/
  LandingPage.jsx + .css        — Hero dengan raise_hand.jpg + nav link tengah, tombol Masuk (ikon) di kanan
  LoginPage.jsx                 — Form login (card center), fetch ke /auth/login + status dongle (dummy, tombol Demo) + banner sukses registrasi
  RegisterPage.jsx              — Form register INVITE-ONLY: verifikasi ?undangan=<token> via GET /invites/verify, state "pendaftaran ditutup" tanpa token
  AuthPage.css                  — Shared CSS untuk Login + Register + state panel undangan
  DashboardPage.jsx + .css      — Dasbor + easter egg 5-klik + auth guard; admin lihat panel undangan (stats + tabel status + form buat undangan + salin tautan)
  VotePage.jsx + .css          — Halaman pemilihan (/pilih): kandidat demo, tombol besar berwarna + ikon SVG + auth guard
frontend/src/components/
  HealthMonitor.jsx             — Render null; polling /health di background, error → console (bukan UI)
frontend/src/index.css          — Reset global + font family
frontend/src/main.jsx           — ReactDOM.createRoot — tidak diubah
```

### Database
```
database/migrations/001_init.sql  — 10 tabel (lihat seksi DB)
database/seeds/001_admin.sql      — Admin: username=admin, password=Admin@1234
database/migrate.php              — php database/migrate.php [--seed] [--fresh]
```

---

## 5. URL Routing Frontend

| Path | Komponen | Keterangan |
|---|---|---|
| `/` | `LandingPage` | Halaman utama |
| `/masuk` | `LoginPage` | Login |
| `/daftar` | `RegisterPage` | Pendaftaran — invite-only, wajib query `?undangan=<token>`; tanpa token tampil state "hanya melalui undangan" |
| `/dasbor` | `DashboardPage` | Dasbor (blank + easter egg, ada auth guard) |
| `/pilih` | `VotePage` | Halaman pemilihan — demo kandidat, tombol besar berwarna (Sprint 2, ada auth guard) |
| `/login` | Redirect → `/masuk` | Alias lama |
| `/register` | Redirect → `/daftar` | Alias lama |
| `/dashboard` | Redirect → `/dasbor` | Alias lama |
| `*` | Redirect → `/` | Catchall |

---

## 6. API Endpoints

Base URL: `http://localhost:8000`

| Method | Path | Auth | Request Body | Response |
|---|---|---|---|---|
| GET | `/health` | — | — | `{status, app, database, ip}` — status `ok`/`degraded`, dipakai indikator status di frontend |
| POST | `/auth/register` | Invite token | `{username, email, password, invite_token}` | `201 {message, user}` — publik TIDAK bisa daftar bebas |
| POST | `/auth/login` | — | `{identifier, password}` | `200 {message, token, user}` |
| POST | `/auth/logout` | — | — | `200 {message}` |
| GET | `/auth/me` | Bearer JWT | — | `200 {user}` |
| GET | `/invites` | Bearer JWT (admin) | — | `200 {stats, invites}` — status: `menunggu`/`diterima`/`kedaluwarsa`/`dibatalkan` |
| POST | `/invites` | Bearer JWT (admin) | `{email?, role?}` | `201 {message, invite}` — `invite.link` = `/daftar?undangan=<token>` |
| GET | `/invites/verify` | — | query `?token=` | `200 {valid, invite}` / `400` / `404` |

### Error Format
Semua error menggunakan format: `{ "error": "Pesan error dalam Bahasa Indonesia." }`

### HTTP Status Codes yang dipakai
- `200` — OK
- `201` — Created (register berhasil / undangan dibuat)
- `401` — Unauthorized (token invalid / credentials salah)
- `403` — Forbidden (akun nonaktif / bukan admin / daftar tanpa undangan)
- `404` — Not found (endpoint atau undangan tidak ada)
- `405` — Method not allowed
- `409` — Conflict (username/email duplikat)
- `422` — Unprocessable Entity (validasi gagal)

---

## 7. Database Schema

11 tabel total — `database/migrations/001_init.sql` (10 tabel) + `002_invites.sql` (1 tabel):

| Tabel | Sprint | Keterangan |
|---|---|---|
| `users` | 1 ✅ | id, username, email, password_hash, role (admin/voter), is_active |
| `invites` | 2 ✅ | Undangan pendaftaran — token, email (nullable), role, status (pending/accepted/revoked), expires_at, created_by, used_by |
| `biometric_credentials` | 4 | WebAuthn/FIDO2 — FK ke users |
| `usb_tokens` | 4 | USB dongle — FK ke users |
| `elections` | 2 | Pemilihan — FK ke users (created_by) |
| `candidates` | 2 | Kandidat — FK ke elections |
| `voters` | 2 | Partisipasi (has_voted tapi BUKAN isi suara) — FK ke users + elections |
| `ballots` | 2 | **TIDAK ada FK ke users** — privacy by design |
| `encrypted_messages` | 3 | Modul kriptografi |
| `encrypted_files` | 3 | File terenkripsi |
| `blocks` | 3 | Blockchain sederhana |

**Penting:** `ballots` tidak punya FK ke `users` atau `voters` secara sengaja — suara dan identitas pemilih terpisah.

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

**Tanpa undangan valid, `POST /auth/register` → 403** — pendaftaran publik ditutup.
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
- Tidak pakai framework — semua native
- Setiap endpoint adalah file terpisah di `api/<modul>/<action>.php`
- `require_once` di setiap file, bukan autoloader
- `jsonResponse()` selalu dipakai untuk output JSON — tidak pernah `echo json_encode()` langsung
- PDO prepared statements — tidak pernah string interpolasi untuk query

### React / JS
- Function components only — tidak ada class component
- CSS Modules tidak dipakai — file `.css` per halaman di folder yang sama
- State management: React `useState` + `localStorage` — belum ada Context/Redux
- Fetch native dipakai (bukan axios) di Sprint 1
- Animasi lewat CSS keyframes + `IntersectionObserver` hook — tidak ada Framer Motion

### CSS
- CSS custom properties (variables) di `:root` tiap file — belum ada design token global
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

Desktop app **sudah bisa di-build dan berjalan** — installer `.msi` + `.exe` (NSIS) sukses dihasilkan:
- Rust + Cargo sudah terinstall di mesin developer.
- Icons: sudah di-generate dari `frontend/public/raise_hand.jpg` via
  `npx tauri icon public/raise_hand.jpg --fit cover`.
- Backend PHP **di-spawn otomatis** oleh Rust saat app start (bukan lagi proses terpisah).
- Folder `backend/` di-bundle ke installer sebagai resource
  (`"resources": { "../../backend": "backend" }` di `tauri.conf.json`).

### Auto-spawn PHP — sudah diimplementasi di `src-tauri/src/lib.rs`
1. Startup: cek port 8000 — kalau sudah ada server lain, skip spawn.
2. Cari folder backend: resource dir (production) → relatif lokasi exe → cwd (dev).
3. Spawn `php -S 127.0.0.1:8000 -t <backend> <backend>/index.php` dengan
   `CREATE_NO_WINDOW` (tanpa konsol) di Windows.
4. Saat app ditutup (`RunEvent::Exit`): child process PHP di-kill.
5. Path `\\?\` (Windows extended-length path dari Tauri) di-strip dulu —
   PHP tidak bisa membuka file dengan prefix itu.
6. **PHP harus terinstall di mesin user & ada di PATH** — belum di-bundle
   sebagai sidecar binary (masih rencana Sprint 4).

### Konfigurasi penting `src-tauri/`
- `Cargo.toml`: `tauri = { version = "2", features = ["wry"], default-features = false }`
  — fitur `dialog` di-disable karena butuh `TaskDialogIndirect` yang tidak ada
  di Windows lama (error "Entry Point Not Found").
- `main.rs`: `windows_subsystem = "windows"` — release build tanpa window konsol.
- `lib.rs`: `tauri::Builder::<tauri::Wry>::default()` — type runtime explicit
  karena `default-features = false`.
- `vite.config.js`: minifier **terser**, target `['es2020', 'chrome90', 'safari13']`
  — kombinasi yang kompatibel dengan Vite 8 (esbuild & terser keduanya devDependency).

### Logging (untuk debugging)
| File | Lokasi (Windows) |
|---|---|
| Log app (spawn, path, error) | `%LOCALAPPDATA%\com.truecount.app\logs\truecount.log` |
| Log PHP server | `%LOCALAPPDATA%\com.truecount.app\logs\php.log` |

---

## 12. State Sprint

### Sprint 1 — SELESAI ✅
- Struktur proyek (backend + frontend)
- Database schema (11 tabel) + migration runner
- Auth API: register, login, logout, me
- **Pendaftaran via undangan (invite-only) ✅** — publik ditutup, admin buat undangan via `/invites`, halaman `/daftar` hanya terbuka lewat tautan `?undangan=<token>`, dasbor admin punya panel referal (stats: menunggu/diterima/kedaluwarsa + form buat undangan + salin tautan)
- Landing Page (artsy, raise_hand.jpg, Jakarta Sans, #F13C35) — tombol Daftar dihapus, hanya Masuk (dengan ikon) di kanan nav
- Login + Register pages (split layout, animasi)
- Dashboard (easter egg + panel undangan admin)
- Test otomatis: `php tests/api_test.php` (41 test, 100% pass)

### Sprint 2 — Election Management (Orang 2)
Endpoints yang perlu dibangun:
- `GET /elections` — daftar pemilihan aktif
- `POST /elections` — buat pemilihan (admin)
- `GET /elections/:id` — detail pemilihan + kandidat
- `POST /elections/:id/vote` — berikan suara (voter)
- `GET /elections/:id/results` — hasil pemilihan

### Sprint 3 — Cryptography (Orang 3)
- Enkripsi pesan: Vigenere, AES-256-GCM, ChaCha20
- Enkripsi file upload
- Blockchain log sederhana

### Sprint 4 — MFA (Orang 1 lanjutan)
- WebAuthn biometrics
- USB token
- Auto-spawn PHP dari Tauri untuk standalone desktop ✅ (selesai — catatan: masih butuh PHP terinstall di sistem user; bundling `php.exe` sebagai sidecar belum dilakukan)

---

## 13. File yang Harus Diperbarui saat Sprint 2+

Saat menambahkan endpoint baru, selalu update:
1. `backend/index.php` — tambah route baru ke match()
2. `database/migrations/` — file SQL baru kalau butuh tabel
3. `README.md` — seksi API Endpoints
4. `tests/api_test.php` — tambah test case
5. `docs/knowledge_transfer.md` — update State Sprint

---

## 14. Hal-hal yang Perlu Diperhatikan

1. **CORS** — origin web dikunci di `.env` key `FRONTEND_ORIGIN`. Kalau port frontend berubah, update ini. Origin Tauri (`http://tauri.localhost`, `tauri://localhost`, `http://localhost`, `http://127.0.0.1`) sudah diizinkan otomatis di `helpers/response.php` untuk desktop app.
2. **JWT Secret** — ada di `.env` key `JWT_SECRET`. Nilai default di `.env.example` JANGAN dipakai di production.
3. **Password admin default** — `Admin@1234`. Hash-nya di-generate ulang setiap `php database/migrate.php --seed` dijalankan.
4. **`ballots` tidak punya FK ke users** — ini by design, jangan ditambahkan.
5. **Tauri icons** — sudah di-generate dari `frontend/public/raise_hand.jpg`. Kalau ganti desain logo: `npx tauri icon public/raise_hand.jpg --fit cover` (source harus square atau pakai `--fit`).
6. **axios belum dipakai** — diinstall tapi Sprint 1 pakai `fetch` native. Sprint 2 boleh migrasi ke axios atau tetap pakai fetch.
7. **`draft_user` belum ada** — reset password, email verification, dan roles lanjutan belum diimplementasi.
8. **Vite 8 + minifier** — jangan set `minify: 'esbuild'`; pakai `terser`. Target build jangan lebih tinggi dari `es2020`/`chrome90`/`safari13` atau transform destructuring akan gagal.
9. **Tauri `default-features = false`** — jangan enable fitur `dialog` Tauri (butuh `TaskDialogIndirect`, error di Windows lama). Kalau butuh dialog native, pakai plugin terpisah.
10. **Path `\\?\`** — Tauri resource dir mengembalikan Windows extended path; selalu strip prefix `\\?\` sebelum dipakai sebagai argumen proses PHP.
11. **Pendaftaran publik ditutup** — akun baru hanya lewat undangan admin (`POST /invites`). Undangan kedaluwarsa otomatis sesuai `INVITE_EXPIRE_DAYS` (default 7 hari, bisa diatur di `.env`). Jangan buka `POST /auth/register` tanpa validasi `invite_token`.
