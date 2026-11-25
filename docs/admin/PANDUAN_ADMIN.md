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
8. [Pesan Suara Admin](#8-pesan-suara-admin)
9. [Troubleshooting](#9-troubleshooting)
10. [Log Keamanan (Audit Login)](#10-log-keamanan-audit-login)
11. [Profil Pengguna & Foto Identitas](#11-profil-pengguna--foto-identitas)

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
| Pesan suara terenkripsi antar-admin (rekam & putar) | ✅ |
| Keamanan auth (Windows Hello, kamera, failed attempts, log keamanan) | ✅ Sprint 4b |
| Foto identitas (KTP/SIM) saat registrasi + halaman profil pengguna | ✅ |
| Pesan teks terenkripsi AES-256-GCM / ChaCha20-Poly1305 / Vigenère | ✅ |

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
4. Setelah masuk, **menu akun di kanan atas navbar** menampilkan avatar inisial, nama, dan peran Anda. Klik untuk membuka menu akun:
   - **Pengaturan** — ganti kata sandi, Windows Hello, kelola USB token
   - **Profil** — lihat data akun, foto KTP/SIM, dan ajukan perubahan data (lihat [bagian 11](#11-profil-pengguna--foto-identitas))
   - **Log Keamanan Saya** — riwayat percobaan login akun Anda sendiri (khusus akun **Admin**; akun lain tidak melihat item ini karena endpoint log dibatasi admin)
   - **Keluar** — tutup sesi lalu klik **Masuk** lagi untuk ganti akun

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
3. Pilih mode pembuatan:
   - **Satu email** — isi email calon (opsional; kalau diisi, undangan **hanya bisa dipakai email itu**)
   - **Bulk email** — tempel beberapa email sekaligus
   - **Bulk count** — buat 1–100 link undangan anonim sekaligus
4. Pilih **Peran akun** — `Pemilih` atau `Admin` (role `Dev` hanya dibuat lewat seed, tidak lewat undangan)
5. Klik **"Buat undangan"**
6. Tautan undangan muncul → klik **"Salin"** (atau **Salin Semua Link** untuk bulk) → kirim ke calon pengguna

**Tautan bentuknya:**
```
http://localhost:5173/daftar?undangan=<token>
```

> **Kirim juga kode undangan untuk pengguna desktop.** Aplikasi desktop (Tauri) tidak bisa membuka
> link undangan langsung dari email/chat. Selain tautan di atas, admin boleh mengirim **kode undangan**
> saja (token 48 karakter setelah `undangan=`). Pengguna tinggal klik tombol **"Daftar dengan undangan"**
> (di beranda atau halaman **Masuk**) → menempelkan link ATAU kode tersebut di kolom **"Link atau kode undangan"**,
> lalu klik **"Lanjutkan"**.

**Aturan undangan:**
- Berlaku **7 hari** (bisa diubah di `.env` → `INVITE_EXPIRE_DAYS`)
- **Sekali pakai** — setelah dipakai mendaftar, status jadi "Diterima"
- Bisa **dibatalkan** kapan saja selama belum dipakai

**Yang dilakukan calon pengguna setelah membuka undangan:**
1. **Foto KTP/SIM** lewat kamera (wajib; bisa pilih KTP atau SIM, ganti kamera, dan ambil ulang)
2. Isi **username, email, password** — validasi langsung per field saat pindah kolom:
   - Username minimal 3 karakter (huruf kecil, angka, underscore) dan dicek ketersediaan
   - Password minimal 8 karakter, mengandung minimal 1 angka dan 1 karakter khusus
3. Klik **Buat akun** → diarahkan ke halaman Masuk

> Foto identitas disimpan **terenkripsi** dan hanya bisa dilihat oleh pemilik akun atau admin lewat halaman **Profil**.

---

## 6. Mengelola Undangan

Di tab **Undangan** dasbor admin tersedia:

| Aksi | Cara |
| --- | --- |
| Lihat statistik | Kartu berwarna + ikon: total (merah), menunggu (kuning), diterima (hijau), kedaluwarsa (merah gelap), dibatalkan (abu-abu) |
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

## 8. Pesan Suara Admin

Fitur **Pesan Suara** kini menjadi tab di halaman **Pesan Terenkripsi** (`/pesan-terenkripsi?tab=suara`) dan dipakai admin untuk mengirim rekaman audio terenkripsi ke admin lain. Tab ini hanya muncul setelah login sebagai **admin**; URL lama `/pesan-suara` otomatis diarahkan ke tab tersebut.

### 8.1. Mengirim Pesan Suara

1. Buka menu **Pesan Terenkripsi** di navigasi, lalu pilih tab **Pesan Suara**.
2. Pilih **Penerima** dari dropdown (hanya admin aktif selain akun sendiri).
3. Klik **Mulai Rekam** → izinkan akses mikrofon saat browser/aplikasi meminta.
4. Klik **Hentikan Rekaman** setelah selesai (durasi maksimal **5 menit**).
5. Putar pratinjau untuk memastikan rekaman sudah benar.
6. Klik **Kirim Audio**.

Rekaman dienkripsi di server dengan **ChaCha20-Poly1305** sebelum disimpan. File tidak pernah disimpan dalam bentuk audio mentah.

### 8.2. Mendengarkan Pesan Masuk

1. Panel **Inbox Voice Messages** menampilkan pesan dari admin lain.
2. Klik tombol **Putar** untuk mengunduh dan memutar audio.
3. Pesan otomatis ditandai **Dibaca** setelah diputar.
4. Hanya penerima pesan yang dapat mengakses audionya; admin lain akan mendapat `404`.

### 8.3. Batasan

| Batasan | Nilai |
| --- | --- |
| Durasi maksimal | 300 detik (5 menit) |
| Ukuran file maksimal | 20 MB |
| Format yang diterima | WebM, OGG, MP3, WAV, M4A, AAC, FLAC |
| Akses audio | Hanya penerima pesan |

> Jika tombol **Mulai Rekam** tidak berfungsi, pastikan mikrofon diizinkan di pengaturan browser/aplikasi dan tidak sedang dipakai aplikasi lain (lihat [Troubleshooting](#9-troubleshooting)).

---

## 9. Troubleshooting

| Masalah | Solusi |
| --- | --- |
| App tidak mendeteksi flashdisk | 1) Pastikan file `.truecount_token` dibuat di drive yang benar · 2) Cabut-colok flashdisk · 3) Pastikan pakai app desktop, bukan browser |
| "USB dicabut" muncul | Colok flashdisk kembali — flow lanjut otomatis |
| PIN ditolak | PIN default generator: `123456`. Kalau lupa, generate ulang file token |
| **Status dongle kuning (warning)** | File `.truecount_token` corrupt / field hilang / bukan JSON valid → hapus file → buat ulang via "＋ Buat Token di USB" |
| **Tombol "Buat Token" tolak** | Flashdisk sudah punya token, belum centang konfirmasi → centang "Saya paham, timpa token lama" lalu coba lagi |
| Tidak bisa daftar akun | Pendaftaran ditutup publik — minta tautan undangan ke admin |
| Tautan undangan "tidak valid" | Undangan mungkin kedaluwarsa (7 hari) atau sudah dipakai/dibatalkan |
| Tidak bisa membuka link undangan di aplikasi desktop | Di halaman **Masuk**, klik tombol **"Daftar dengan undangan"**, tempel link/kode undangan di kolom **"Link atau kode undangan"**, lalu klik **"Lanjutkan"** |
| Server tidak tersambung | Pastikan backend jalan (`npm run dev:full` atau app desktop otomatis spawn PHP). Kalau server jalan tapi tetap "tidak dapat terhubung": cek `DB_HOST=127.0.0.1` di `.env` (bukan `localhost`), dan untuk akses dari PC/HP lain pastikan firewall port 8000 terbuka (`deploy-server.ps1 -OpenFirewall`) serta semua perangkat satu Wi-Fi — lihat [deploy.md](../deploy/deploy.md) bagian Troubleshooting |
| Kamera tetap menyala setelah pindah dari halaman login | Sudah diatasi: kamera **hanya nyala di halaman Masuk**. Semua stream kamera terdaftar di registry global dan dipaksa mati otomatis saat pindah ke halaman lain (landing, dasbor, dll). Kalau masih terjadi, tutup buka ulang aplikasi. |
| Foto tidak muncul di Log Keamanan | Foto hanya disimpan untuk percobaan login **setelah** perbaikan diterapkan. Percobaan lama tidak memiliki foto (placeholder kamera akan ditampilkan). |
| Tombol **Mulai Rekam** tidak bereaksi / error mikrofon | Izinkan akses mikrofon untuk situs/aplikasi, pastikan tidak ada aplikasi lain yang memakai mikrofon, lalu muat ulang halaman. Di browser, fitur rekam butuh `https://` atau `localhost`. |
| Rekaman berhenti sendiri | Durasi mencapai batas 5 menit — kirim rekaman atau rekam ulang bagian yang diperlukan. |
| Kirim audio gagal / error server | Pastikan migrasi DB sudah dijalankan (`php database/migrate.php`) agar tabel `voice_messages` tersedia, lalu cek backend masih berjalan. |

---

## 10. Log Keamanan (Audit Login)

Admin dapat melihat riwayat percobaan login setiap pengguna, lengkap dengan foto kamera yang diambil saat mencoba masuk.

### 10.1. Cara Melihat Log Keamanan

1. Login sebagai **admin** → buka **Dasbor**
2. Di tab **Log Keamanan** dasbor admin, cari username atau email pengguna
3. Klik baris pengguna → akan dibuka halaman **"Log Keamanan Pengguna"**
4. Halaman menampilkan tabel riwayat:
   - **Foto** — tangkapan kamera saat percobaan login (klik untuk memperbesar)
   - **Waktu** — tanggal & jam percobaan
   - **Metode** — Windows Hello / Dongle USB / Kata Sandi
   - **Status** — Berhasil / Gagal
   - **IP Address** — alamat IP pengguna saat login
   - **Keterangan** — pesan hasil login (mis. "Login berhasil" atau "Autentikasi dibatalkan...")

> **Log akun sendiri:** buka **menu akun** di kanan atas navbar → **Log Keamanan Saya** (langsung ke `/log-keamanan/{id}` milik Anda, tanpa lewat dasbor).

> **Catatan:** Foto hanya tersimpan untuk percobaan login yang dilakukan **setelah** fitur kamera aktif. Percobaan lama sebelum fitur ini akan menampilkan placeholder kamera (tanpa gambar).

---

## 11. Profil Pengguna & Foto Identitas

Menu **Profil** di navbar (atau URL `/profil`) menampilkan data akun beserta foto identitas yang diunggah saat mendaftar.

### 11.1. Melihat Profil

1. Buka **menu akun** di kanan atas → **Profil**
2. Tampil: username, peran (role), email, telepon, alamat, dan tanggal bergabung
3. **Foto Identitas (KTP/SIM)** ditampilkan dari storage terenkripsi — klik foto untuk memperbesar (lightbox)

### 11.2. Mengubah Data Profil

Data profil **tidak bisa diubah langsung**. Setiap perubahan diajukan sebagai permintaan:

1. Di halaman Profil, isi form **Ajukan Perubahan Data**
2. Pilih field: **username / email / telepon / alamat**
3. Isi nilai baru + alasan pengajuan → klik kirim
4. Permintaan tersimpan di tabel `change_requests` untuk ditinjau admin

> Peninjauan permintaan saat ini **manual lewat database** (belum ada tombol approve/reject di UI). Setelah disetujui, ubah data langsung lewat SQL lalu beri tahu pengguna.

### 11.3. Melihat Profil Pengguna Lain (Admin)

Admin bisa membuka profil user lain lewat URL `/profil/{user_id}` — berguna saat memverifikasi foto identitas atau mencari data pengguna.

### 11.4. Catatan Keamanan

| Aspek | Keterangan |
| --- | --- |
| Penyimpanan foto ID | Terenkripsi **AES-256-GCM** di `storage/id_photos/` — file mentah tidak pernah tersimpan |
| Siapa yang bisa melihat | Hanya pemilik akun dan admin |
| Jenis identitas | KTP atau SIM (dipilih saat registrasi) |
| Ganti foto ID | Belum tersedia — foto mengikuti data saat registrasi |

---

## Keamanan & Keterbatasan (Wajib Dibaca)

| Aspek | Status |
| --- | --- |
| USB token = simulasi MFA software | File token bisa di-copy ke flashdisk lain |
| PIN melindungi private key | Tapi PIN bisa dicuri keylogger |
| **Bukan hardware security key** | Untuk produksi nyata disarankan FIDO2 (YubiKey, dll) |

> USB token di TrueCount adalah **media pembelajaran kriptografi** (ECDSA P-256, AES-256-GCM, PBKDF2, challenge-response). Bukan pengganti hardware security key sungguhan.
