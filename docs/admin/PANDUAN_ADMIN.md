# Panduan Admin & Panitia — TrueCount

> **Untuk siapa:** Admin sistem & panitia pemilihan yang mengoperasikan TrueCount.
> **Catatan:** Dokumen ini panduan pemakaian. Detail teknis untuk developer ada di [knowledge_transfer.md](../dev/knowledge_transfer.md).

---

## Daftar Isi

1. [Apa Itu TrueCount](#1-apa-itu-truecount)
2. [Menjalankan Aplikasi](#2-menjalankan-aplikasi)
3. [Login](#3-login)
4. [Akun yang Tersedia](#4-akun-yang-tersedia)
5. [Membuat Undangan](#5-membuat-undangan)
6. [Mengelola Undangan](#6-mengelola-undangan)
7. [USB Token (MFA)](#7-usb-token-mfa)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Apa Itu TrueCount

TrueCount adalah aplikasi **e-voting akademik** dengan fitur keamanan berbasis kriptografi. Saat ini (Sprint 4) fitur yang sudah jalan:

| Fitur | Status |
| --- | --- |
| Login & registrasi via undangan (invite-only) | ✅ |
| Dasbor admin (kelola undangan) | ✅ |
| USB Token MFA (daftar, kelola, pakai flashdisk sebagai faktor kedua) | ✅ |
| Pemilihan / voting (Election CRUD, kandidat, suara, hasil) | ✅ Sprint 2 |
| Enkripsi pesan & file, blockchain | ✅ Sprint 3 |
| Keamanan auth (Windows Hello, kamera, failed attempts, log keamanan) | ✅ Sprint 4b |

**Prinsip pendaftaran:** Publik **tidak bisa** daftar sendiri. Calon pengguna hanya bisa membuat akun lewat **tautan undangan** yang dibuat admin.

---

## 2. Menjalankan Aplikasi

### Mode Desktop (rekomendasi — fitur USB lengkap)

```bash
cd frontend
npm run desktop:dev        # development
npm run desktop:build      # build installer (.msi/.exe)
```

### Mode Web (fitur USB auto-detect TIDAK tersedia)

```bash
cd frontend
npm run dev:full           # PHP :8000 + Vite :5173
# Buka http://localhost:5173
```

> ⚠️ **Mode web tidak bisa auto-deteksi USB** (batasan keamanan browser). Fitur USB token hanya jalan penuh di aplikasi desktop.

---

## 3. Login

1. Buka aplikasi → klik **Masuk** (ikon di kanan atas)
2. Masukkan username/email + kata sandi
3. Klik "Masuk" → diarahkan ke dasbor

> **Status dongle di halaman login:** Indikator "Dongle terpasang / tidak terdeteksi" menunjukkan deteksi USB token secara otomatis. Di **aplikasi desktop**, tombol "Dongle Keamanan" bisa dipilih untuk login pakai USB token (MFA). Di **mode browser**, tombol ini disabled karena auto-detect USB hanya tersedia di Tauri desktop (batasan keamanan browser).

---

## 4. Akun yang Tersedia

| Username | Kata Sandi | Peran | Keterangan |
| --- | --- | --- | --- |
| `admin` | `Admin@1234` | Admin | Akun utama — buat undangan, kelola sistem |
| `dev` | `Dev@1234` | Dev | Akses ke halaman dev (`/dev`) — visualisasi flow & kriptografi |
| `pemilih1` | `Pemilih@123` | Pemilih | Akun uji coba |
| `pemilih2` | `Pemilih@123` | Pemilih | Akun uji coba |

> **Ganti kata sandi admin** sebelum dipakai serius. Fitur ganti kata sandi tersedia di halaman **Pengaturan** (`/pengaturan`) setelah login.

---

## 5. Membuat Undangan

Pendaftaran publik ditutup — semua akun baru masuk lewat undangan.

1. Login sebagai **admin** → buka **Dasbor**
2. Di panel **Undangan**, klik **"+ Buat undangan"**
3. Isi formulir:
   - **Email calon** (opsional) — kalau diisi, undangan **hanya bisa dipakai email itu**
   - **Peran akun** — `Pemilih`, `Admin`, atau `Dev`
4. Klik **"Buat undangan"**
5. Tautan undangan muncul → klik **"Salin"** → kirim ke calon pengguna

**Tautan bentuknya:**
```
http://localhost:5173/daftar?undangan=<token>
```

**Aturan undangan:**
- Berlaku **7 hari** (bisa diubah di `.env` → `INVITE_EXPIRE_DAYS`)
- **Sekali pakai** — setelah dipakai mendaftar, status jadi "Diterima"
- Bisa **dibatalkan** kapan saja selama belum dipakai

---

## 6. Mengelola Undangan

Di panel **Undangan** dasbor admin tersedia:

| Aksi | Cara |
| --- | --- |
| Lihat statistik | Kartu: total / menunggu / diterima / kedaluwarsa / dibatalkan |
| Cari undangan | Kotak pencarian (email, token, pembuat) |
| Filter status | Dropdown filter |
| Salin tautan | Tombol "Salin" di baris undangan |
| Batalkan undangan | Tombol ✕ di baris undangan berstatus "Menunggu" |

---

## 7. USB Token (MFA)

TrueCount memakai **flashdisk biasa** sebagai faktor autentikasi kedua (simulasi MFA berbasis kriptografi — bukan hardware security key).

### 7.1. Membuat Token Baru (dari Aplikasi — Cara Utama)

Setiap pengguna bisa membuat tokennya sendiri, langsung dari aplikasi. **Tidak perlu bantuan admin.**

1. Colok flashdisk ke komputer (isi flashdisk tidak akan dihapus)
2. Login → buka **Dasbor** → panel **"USB Token (MFA)"**
3. Klik **"＋ Buat Token di USB"**
4. Pilih flashdisk dari dropdown (sistem mendeteksi otomatis ±2 detik)
5. Masukkan **PIN MFA baru** (minimal 4 karakter) + ulangi PIN
6. Klik **"🔑 Buat Token"** → file `.truecount_token` tertulis ke flashdisk

> ⚠️ **Membuat token ≠ mendaftarkan.** Setelah token dibuat, akun belum terikat. Lanjut ke langkah 7.2 untuk mendaftarkannya.

> **Simpan PIN baik-baik** — tanpa PIN, file token tidak bisa dipakai. PIN tidak disimpan di mana pun, kalau lupa harus membuat token baru.

### 7.2. Mendaftarkan Token ke Akun

1. Login dengan akun yang mau diberi token
2. Buka **Dasbor** → panel **"USB Token (MFA)"** → klik **"+ Daftarkan USB Baru"**
3. Colok flashdisk yang sudah berisi token → sistem mendeteksi otomatis (±2 detik)
4. Masukkan **PIN** → klik **"Daftarkan Token"**
5. Selesai — token muncul di daftar

**Token terikat ke akun yang sedang login saat mendaftar.**

### 7.3. Membuat Token via Terminal (Alternatif Developer)

Kalau tidak bisa lewat aplikasi desktop (misal hanya ada mode web), token bisa dibuat manual:

```bash
php database/generate_test_token.php H:/ 1 "123456"
```

| Argumen | Keterangan |
| --- | --- |
| `H:/` | Huruf drive flashdisk (ganti sesuai punyamu) |
| `1` | Label pengenal flashdisk (bebas angka berapa pun; hanya untuk tampilan notifikasi, bukan penentu akun) |
| `"123456"` | **PIN MFA** — wajib diinput tiap kali memakai token |

Output sukses:
```
[✓] Token file dibuat: H:/.truecount_token
    PIN: 123456
```

### 7.4. Mengelola Token

| Aksi | Cara |
| --- | --- |
| Lihat daftar | Panel USB Token di dasbor |
| Ubah label | Tombol "Ubah Label" → ketik nama baru → "Simpan" |
| Nonaktifkan | Tombol ✕ → konfirmasi (misal flashdisk hilang) |

### 7.5. Peringatan & Indikator

| Indikator | Artinya | Aksi |
| --- | --- | --- |
| 🟢 **Hijau** "TrueCount Token · H:\" | Token valid & siap dipakai | Lanjut daftarkan / gunakan |
| 🟡 **Kuning** "Format token tidak valid · H:\" | File corrupt / field hilang / bukan JSON valid | Hapus file → buat ulang via "＋ Buat Token di USB" |
| 🔴 **Abu-abu** "Dongle tidak terdeteksi" | Tidak ada token di flashdisk | Buat token baru atau colok flashdisk benar |
| ⚠️ **Peringatan overwrite** | Flashdisk sudah punya token, akan ditimpa | Centang konfirmasi → klik "Buat Token" |

> **Penting:** Token yang ditimpa **tidak bisa dipulihkan**. Jika token lama sudah didaftarkan ke akun, nonaktifkan manual di daftar sebelum membuat token baru.

---

## 8. Troubleshooting

| Masalah | Solusi |
| --- | --- |
| App tidak mendeteksi flashdisk | 1) Pastikan file `.truecount_token` dibuat di drive yang benar · 2) Cabut-colok flashdisk · 3) Pastikan pakai app desktop, bukan browser |
| "USB dicabut" muncul | Colok flashdisk kembali — flow lanjut otomatis |
| PIN ditolak | PIN default generator: `123456`. Kalau lupa, generate ulang file token |
| **Status dongle kuning (warning)** | File `.truecount_token` corrupt / field hilang / bukan JSON valid → hapus file → buat ulang via "＋ Buat Token di USB" |
| **Tombol "Buat Token" tolak** | Flashdisk sudah punya token, belum centang konfirmasi → centang "Saya paham, timpa token lama" lalu coba lagi |
| Tidak bisa daftar akun | Pendaftaran ditutup publik — minta tautan undangan ke admin |
| Tautan undangan "tidak valid" | Undangan mungkin kedaluwarsa (7 hari) atau sudah dipakai/dibatalkan |
| Server tidak tersambung | Pastikan backend jalan (`npm run dev:full` atau app desktop otomatis spawn PHP) |
| Kamera tetap menyala setelah pindah dari halaman login | Masalah sudah diatasi: kamera otomatis dimatikan saat navigasi keluar halaman login. Kalau masih terjadi, tutup buka ulang aplikasi. |
| Foto tidak muncul di Log Keamanan | Foto hanya disimpan untuk percobaan login **setelah** perbaikan diterapkan. Percobaan lama tidak memiliki foto (placeholder kamera akan ditampilkan). |

---

## 9. Log Keamanan (Audit Login)

Admin dapat melihat riwayat percobaan login setiap pengguna, lengkap dengan foto kamera yang diambil saat mencoba masuk.

### 9.1. Cara Melihat Log Keamanan

1. Login sebagai **admin** → buka **Dasbor**
2. Di panel pencarian user (bagian bawah dasbor), cari username atau email pengguna
3. Klik baris pengguna → akan dibuka halaman **"Log Keamanan Pengguna"**
4. Halaman menampilkan tabel riwayat:
   - **Foto** — tangkapan kamera saat percobaan login (klik untuk memperbesar)
   - **Waktu** — tanggal & jam percobaan
   - **Metode** — Windows Hello / Dongle USB / Kata Sandi
   - **Status** — Berhasil / Gagal
   - **IP Address** — alamat IP pengguna saat login
   - **Keterangan** — pesan hasil login (mis. "Login berhasil" atau "Autentikasi dibatalkan...")

> **Catatan:** Foto hanya tersimpan untuk percobaan login yang dilakukan **setelah** fitur kamera aktif. Percobaan lama sebelum fitur ini akan menampilkan placeholder kamera (tanpa gambar).

---

## Keamanan & Keterbatasan (Wajib Dibaca)

| Aspek | Status |
| --- | --- |
| USB token = simulasi MFA software | File token bisa di-copy ke flashdisk lain |
| PIN melindungi private key | Tapi PIN bisa dicuri keylogger |
| **Bukan hardware security key** | Untuk produksi nyata disarankan FIDO2 (YubiKey, dll) |

> USB token di TrueCount adalah **media pembelajaran kriptografi** (ECDSA P-256, AES-256-GCM, PBKDF2, challenge-response). Bukan pengganti hardware security key sungguhan.
