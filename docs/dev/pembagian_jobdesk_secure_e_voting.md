# Pembagian Jobdesk Tim - TrueCount (Secure E-Voting)

**Jumlah anggota:** 3 orang  
**Project Type:** Web & Desktop Application (Monorepo)  
**Backend:** PHP 8.1+ (Native, no framework)  
**Frontend:** React 19 + Vite 8  
**Desktop:** Tauri v2 (Rust)  
**Database:** MySQL 8 / MariaDB 10.6  
**Auth:** JWT HS256 (custom) + Argon2id  
**Tujuan:** Proyek Akhir Mata Kuliah Kriptografi - UPN "Veteran" Yogyakarta, Angkatan 2024

---

## 1. Pembagian Jobdesk

### Orang 1 - Rio Meidi Ataurrahman

**Peran:** Authentication & User Management  
**Fokus:** Backend auth, keamanan akses, integrasi MFA

**Tanggung jawab:**

- Sistem register & login (invite-only)
- Password hashing Argon2id
- JWT HS256 custom implementation
- Role-Based Access Control (Admin / Voter)
- Middleware `requireAuth()` & `requireAdmin()`
- Integrasi WebAuthn / Windows Hello (biometrik) - Sprint 4
- USB Dongle Verification - Sprint 4
- Auto-spawn PHP backend via Tauri (desktop) - Sprint 4 ✅
- **Auth Security Layer (Sprint 4b): Session Mgmt, Failed Attempts, Camera Enforcement, Security Setup wajib ✅**
- Pengelolaan tabel: `users`, `biometric_credentials`, `usb_tokens`, `invites`, `auth_attempts`
- Pengujian keamanan autentikasi (41 test case pass)

**Output:** Authentication Module + Invite System + MFA (Sprint 4) + Auth Security Layer (Sprint 4b)

---

### Orang 2 - Muhamad Ifsal Fadhilah

**Peran:** Election Management & Voting System  
**Fokus:** Fitur inti pemungutan suara

**Tanggung jawab:**

- Dashboard Admin & Voter
- CRUD Election (buat, lihat, ubah, hapus pemilihan)
- CRUD Candidate
- Registrasi & pengelolaan voter
- Jadwal & status pemilihan (aktif, selesai, dll)
- Halaman voting (`/pilih`)
- Validasi satu pemilih = satu suara
- Pemisahan data partisipasi (`voters`) dari isi ballot (`ballots`) - privacy by design
- Integrasi enkripsi ballot (dengan Orang 3)
- Perhitungan hasil pemilihan
- Pengelolaan tabel: `elections`, `candidates`, `voters`, `ballots`

**Output:** Election Management & Voting Module (Sprint 2) ✅ SELESAI

---

### Orang 3 - [Erlan Rifki Davin D]

**Peran:** Cryptography & Advanced Security  
**Fokus:** Implementasi algoritma kriptografi & fitur keamanan lanjutan

**Tanggung jawab:**

- Vigenere Cipher
- AES-256-GCM
- ChaCha20-Poly1305
- SHA-256
- Database Encryption Module
- File Encryption & Decryption
- Steganografi (metode LSB)
- Simple Blockchain (logging aktivitas)
- Validasi blockchain
- Pengujian enkripsi, steganografi, blockchain
- Pengelolaan tabel: `encrypted_messages`, `encrypted_files`, `blocks`

**Output:** Cryptography, Steganography & Blockchain Module (Sprint 3) ✅ SELESAI

---

## 2. Pembagian Pekerjaan Tambahan

| Pekerjaan | Penanggung Jawab |
| ----------- | ------------------ |
| Database design & ERD | Orang 2, dengan masukan Orang 1 dan 3 |
| UI/UX Design | Orang 2 |
| Backend integration | Semua anggota |
| Testing authentication | Orang 1 |
| Testing voting | Orang 2 |
| Testing security/crypto | Orang 3 |
| Dokumentasi teknis | Semua anggota sesuai modul |
| README & deployment | Dikerjakan bersama |
| Tauri desktop wrapper | Orang 1 |

---

## 3. Urutan Pengerjaan

### Tahap 1 - Persiapan Fondasi (Selesai)

Semua anggota:

- Menyepakati struktur project PHP + React monorepo
- Menyiapkan database MySQL + migration runner
- Menyepakati struktur folder & pembagian modul
- Menyiapkan repository Git & workflow

### Tahap 2 - Sprint 1: Authentication & Invite System (Selesai ✅)

- **Orang 1:** Auth API, invite system, dashboard, landing page, login/register UI, easter egg, Tauri auto-spawn PHP

### Tahap 3 - Sprint 2: Election Management & Voting (Orang 2) ✅ SELESAI

- **Orang 2:** Election CRUD, Candidate CRUD, Voter registration, Voting page, Result tallying
- **Orang 1:** Integrasi auth guard di halaman voting, JWT middleware
- **Orang 3:** Siapkan interface enkripsi ballot

### Tahap 4 - Sprint 3: Cryptography & Security (Orang 3) ✅ SELESAI

- **Orang 3:** Vigenere, AES-256-GCM, ChaCha20, File encryption, Steganografi, Blockchain
- **Orang 2:** Integrasi enkripsi ke proses voting & ballot
- **Orang 1:** Integrasi auth dengan modul kriptografi

### Tahap 5 - Sprint 4 & 4b: MFA, Desktop Polish & Auth Security Layer (Orang 1) ✅ SELESAI

- **Orang 1:** WebAuthn biometrik, USB token, Tauri desktop build polish, PHP sidecar bundling
- **Orang 2 & 3:** Testing integrasi, bug fixing, dokumentasi final

### Tahap 6 - Testing & Finalisasi (Semua)

- Menguji seluruh fitur end-to-end
- Memperbaiki bug
- Security audit dasar
- Menyelesaikan dokumentasi teknis
- Menyiapkan aplikasi untuk demonstrasi

---

## 4. Catatan Pembagian Beban Kerja

- **Orang 3** memiliki cakupan luas (banyak algoritma). Untuk menyeimbangkan:
  - Orang 1 membantu testing integrasi auth + USB dongle + WebAuthn
  - Orang 2 membantu integrasi enkripsi ke proses voting
  - Fitur blockchain & steganografi dikerjakan setelah voting dasar selesai

- **Orang 1** sudah menyelesaikan Sprint 1 + auto-spawn PHP Tauri (bagian Sprint 4)

---

## 5. Rekomendasi

Pembagian berbasis modul agar setiap anggota memiliki tanggung jawab jelas & output teruji terpisah. Seluruh anggota tetap wajib memahami alur sistem keseluruhan.

**Catatan keamanan:** Sistem ini simulasi akademik. Pemisahan `voters` (partisipasi) dan `ballots` (isi suara) **wajib dijaga** - tidak ada FK dari `ballots` ke `users`/`voters` by design.
