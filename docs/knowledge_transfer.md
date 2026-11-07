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
| react-router-dom | 7.x | URL Bahasa Indonesia: `/masuk`, `/daftar`, `/dasbor` |
| axios | 1.x | Diinstall tapi belum dipakai — fetch native dipakai di Sprint 1 |
| @tauri-apps/cli | 2.x | Desktop wrapper, opsional |
| @tauri-apps/api | 2.x | JS bindings untuk Tauri commands |

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
backend/index.php           — Router utama, match() berdasarkan $uri
backend/helpers/response.php — jsonResponse() + CORS multi-origin (FRONTEND_ORIGIN + origin Tauri)
backend/helpers/jwt.php      — generateJwt() + verifyJwt() — HS256 manual
backend/config/database.php  — getDB() singleton PDO
backend/config/app.php       — Konstanta JWT_SECRET, JWT_EXPIRE, ARGON2_*
backend/middleware/auth.php  — requireAuth() → return payload atau exit 401
backend/api/auth/register.php
backend/api/auth/login.php
backend/api/auth/logout.php
backend/api/auth/me.php
```

### Frontend
```
frontend/src/App.jsx            — BrowserRouter + Routes
frontend/src/pages/
  LandingPage.jsx + .css        — Hero dengan raise_hand.jpg, mosaic dihapus
  LoginPage.jsx                 — Form login, fetch ke /auth/login
  RegisterPage.jsx              — Form register, fetch ke /auth/register
  AuthPage.css                  — Shared CSS untuk Login + Register
  DashboardPage.jsx + .css      — Dasbor blank + easter egg 5-klik
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
| `/daftar` | `RegisterPage` | Register |
| `/dasbor` | `DashboardPage` | Dasbor (blank, Sprint 2) |
| `/login` | Redirect → `/masuk` | Alias lama |
| `/register` | Redirect → `/daftar` | Alias lama |
| `/dashboard` | Redirect → `/dasbor` | Alias lama |
| `*` | Redirect → `/` | Catchall |

---

## 6. API Endpoints

Base URL: `http://localhost:8000`

| Method | Path | Auth | Request Body | Response |
|---|---|---|---|---|
| GET | `/health` | — | — | `{status, app}` |
| POST | `/auth/register` | — | `{username, email, password}` | `201 {message, user}` |
| POST | `/auth/login` | — | `{identifier, password}` | `200 {message, token, user}` |
| POST | `/auth/logout` | — | — | `200 {message}` |
| GET | `/auth/me` | Bearer JWT | — | `200 {user}` |

### Error Format
Semua error menggunakan format: `{ "error": "Pesan error dalam Bahasa Indonesia." }`

### HTTP Status Codes yang dipakai
- `200` — OK
- `201` — Created (register berhasil)
- `401` — Unauthorized (token invalid / credentials salah)
- `403` — Forbidden (akun nonaktif)
- `404` — Not found (endpoint tidak ada)
- `405` — Method not allowed
- `409` — Conflict (username/email duplikat)
- `422` — Unprocessable Entity (validasi gagal)

---

## 7. Database Schema

10 tabel total — semua ada di `database/migrations/001_init.sql`:

| Tabel | Sprint | Keterangan |
|---|---|---|
| `users` | 1 ✅ | id, username, email, password_hash, role (admin/voter), is_active |
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
1. User POST /auth/register → password di-hash Argon2id → simpan ke DB
2. User POST /auth/login → verifikasi Argon2id → generate JWT HS256
3. Frontend simpan token di localStorage key: 'tc_token'
4. Request ke endpoint protected → kirim header: Authorization: Bearer <token>
5. middleware/auth.php → requireAuth() → verifyJwt() → return payload
6. Logout → frontend hapus 'tc_token' dari localStorage
```

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
- Database schema (10 tabel) + migration runner
- Auth API: register, login, logout, me
- Landing Page (artsy, raise_hand.jpg, Jakarta Sans, #F13C35)
- Login + Register pages (split layout, animasi)
- Dashboard blank (easter egg)
- Test otomatis: `php tests/api_test.php` (20 test, 100% pass)

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
2. `README.md` — seksi API Endpoints
3. `tests/api_test.php` — tambah test case
4. `docs/knowledge_transfer.md` — update State Sprint

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
