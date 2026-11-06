# Pembagian Jobdesk Tim --- Secure E-Voting System

**Jumlah anggota:** 3 orang\
**Project Type:** Web-Based Application\
**Backend:** Python (Flask)\
**Frontend:** HTML, CSS, JavaScript, Bootstrap\
**Database:** MySQL

## 1. Pembagian Jobdesk

### Orang 1 --- Authentication & User Management

**Fokus:** Backend dan keamanan autentikasi.

Tanggung jawab: - Membuat sistem register dan login. -
Mengimplementasikan password hashing menggunakan Argon2id. - Membuat
session management. - Mengimplementasikan Role-Based Access Control
(RBAC) untuk Admin dan Voter. - Mengintegrasikan autentikasi biometrik
menggunakan WebAuthn / Windows Hello. - Mengimplementasikan USB Dongle
Verification. - Mengelola tabel database: - `users` -
`biometric_credentials` - `usb_tokens` - Melakukan pengujian keamanan
autentikasi.

**Output:** Authentication Module.

### Orang 2 --- Election Management & Voting System

**Fokus:** Fitur utama aplikasi pemungutan suara.

Tanggung jawab: - Membuat dashboard Admin dan Voter. - Membuat fitur
CRUD Election (tambah, lihat, ubah, dan hapus pemilihan). - Membuat
fitur CRUD Candidate. - Membuat registrasi dan pengelolaan voter. -
Mengatur jadwal dan status pemilihan. - Membuat halaman voting. -
Mengimplementasikan validasi satu pemilih hanya dapat memberikan satu
suara. - Memisahkan data partisipasi pemilih dari isi ballot. -
Mengintegrasikan enkripsi ballot. - Mengimplementasikan penghitungan
hasil pemilihan. - Mengelola tabel database: - `elections` -
`candidates` - `voters` - `ballots`

**Output:** Election Management & Voting Module.

### Orang 3 --- Cryptography & Advanced Security

**Fokus:** Implementasi algoritma kriptografi dan fitur keamanan
tambahan.

Tanggung jawab: - Mengimplementasikan Vigenere Cipher. -
Mengimplementasikan AES-256-GCM. - Mengimplementasikan
ChaCha20-Poly1305. - Mengimplementasikan SHA-256. - Membuat Database
Encryption Module. - Membuat fitur File Encryption & Decryption. -
Mengimplementasikan Steganografi menggunakan metode LSB. -
Mengimplementasikan Simple Blockchain. - Membuat fungsi validasi
blockchain. - Melakukan pengujian enkripsi, steganografi, dan
blockchain. - Mengelola tabel database: - `encrypted_messages` -
`encrypted_files` - `blocks`

**Output:** Cryptography, Steganography & Blockchain Module.

------------------------------------------------------------------------

## 2. Pembagian Pekerjaan Tambahan

  Pekerjaan                Penanggung Jawab
  ------------------------ ------------------------------------------
  Database design & ERD    Orang 2, dengan masukan Orang 1 dan 3
  UI/UX Design             Orang 2
  Backend integration      Semua anggota
  Testing authentication   Orang 1
  Testing voting           Orang 2
  Testing security         Orang 3
  Dokumentasi teknis       Semua anggota sesuai modul masing-masing
  README & deployment      Dikerjakan bersama

------------------------------------------------------------------------

## 3. Urutan Pengerjaan

### Tahap 1 --- Persiapan Fondasi

Semua anggota: - Menyepakati struktur project Flask. - Menyiapkan
database MySQL. - Menyepakati struktur folder dan pembagian modul. -
Menyiapkan repository Git dan aturan workflow.

### Tahap 2 --- Pengembangan Modul Secara Paralel

-   **Orang 1:** Mengembangkan Authentication & User Management.
-   **Orang 2:** Mengembangkan Election Management & Voting System.
-   **Orang 3:** Mengembangkan modul Cryptography.

### Tahap 3 --- Integrasi

Semua anggota: - Menghubungkan authentication dengan aplikasi utama. -
Menghubungkan voting dengan database. - Mengintegrasikan enkripsi pada
proses penyimpanan ballot. - Mengintegrasikan blockchain dengan
aktivitas pemilihan.

### Tahap 4 --- Advanced Features

-   Mengintegrasikan biometrik dan USB dongle.
-   Mengembangkan steganografi.
-   Menyelesaikan blockchain dan validasinya.
-   Memastikan seluruh fitur dapat digunakan melalui aplikasi.

### Tahap 5 --- Testing & Finalisasi

Semua anggota: - Menguji seluruh fitur. - Memperbaiki bug. - Menguji
keamanan dasar. - Menyelesaikan dokumentasi teknis. - Menyiapkan
aplikasi untuk demonstrasi.

------------------------------------------------------------------------

## 4. Catatan Pembagian Beban Kerja

Orang 3 memiliki cakupan pekerjaan yang cukup luas karena menangani
beberapa algoritma dan fitur keamanan. Agar beban lebih seimbang:

-   Orang 1 membantu Orang 3 dalam pengujian integrasi autentikasi dan
    USB dongle.
-   Orang 2 membantu Orang 3 dalam mengintegrasikan enkripsi ke proses
    voting.
-   Fitur blockchain dan steganografi dikerjakan setelah fitur voting
    dasar selesai.

## 5. Rekomendasi

Pembagian ini menggunakan pendekatan berdasarkan modul agar setiap
anggota memiliki tanggung jawab dan hasil kerja yang jelas serta dapat
diuji secara terpisah. Walaupun tugas dibagi per modul, seluruh anggota
tetap perlu memahami alur sistem secara keseluruhan.

**Catatan keamanan:** Sistem ini merupakan simulasi akademik. Pemisahan
data partisipasi dan isi ballot harus tetap dijaga agar identitas
pemilih tidak terhubung langsung dengan pilihan yang diberikan.
