# Ringkasan Pembaruan & Perubahan Sistem TrueCount

Dokumen ini merangkum seluruh perubahan, penyesuaian fitur, perbaikan bug, dan optimasi antarmuka (UI/UX) yang telah diterapkan pada proyek TrueCount.

---

## 1. Pembaruan Halaman Tentang (About Page)
* **Hero Visual Tab Tentang**:
  - Mengganti visual generik pada tab **Tentang** dengan gambar ilustrasi resmi `3jari.png` yang bersumber dari asset frontend (`/3jari.png`).
  - Menyesuaikan proporsi dan styling gambar agar responsif serta selaras dengan tata letak hero section.

---

## 2. Navigasi & Branding
* **Konsistensi Ukuran Logo TrueCount**:
  - Memperbaiki perilaku logo navbar di file `frontend/src/components/Nav.css`.
  - Logo kini mempertahankan ukuran tetap (`height: 55px`) secara konsisten dan tidak lagi mengecil atau berubah dimensi saat halaman di-scroll (`.nav--scrolled`).

---

## 3. Manajemen Kandidat / Pasangan Calon (Admin)
* **Validasi Ukuran Foto Paslon (Maksimal 2 MB)**:
  - **Frontend**: Menambahkan pengecekan ukuran file foto sebelum diunggah di `ElectionModals.jsx`. Jika ukuran melebihi 2 MB, proses upload otomatis dibatalkan, form dibersihkan, dan sistem memunculkan pesan error eksplisit yang menginstruksikan pengguna untuk mengunggah ulang foto di bawah 2 MB.
  - **Backend**: Menambahkan pengecekan ukuran file pada endpoint upload kandidat (`candidates/upload_photo.php` & `candidates/update.php`) untuk memastikan file > 2 MB ditolak di sisi server dengan kode status HTTP 422.
* **Validasi Lengkap Form Tambah & Update Paslon**:
  - Memastikan seluruh field: **Nama**, **Visi**, **Misi**, dan **Foto Paslon** wajib diisi (*mandatory*).
  - Jika terdapat bagian yang belum terisi saat proses tambah atau pembaruan, sistem akan menolak submit dan menampilkan peringatan spesifik untuk melengkapi field yang belum terisi.

---

## 4. Manajemen Pemilih (Voters Management)
* **Checkbox & Batch Selection Pemilih**:
  - Mengimplementasikan fitur checkbox multi-select pada modal pemilih (`VotersModal`) sehingga admin dapat memilih banyak akun pengguna sekaligus.
  - Menambahkan fitur *Pilih Semua* (*Select All*) dan *Batalkan Pilihan* (*Deselect All*) untuk mempermudah operasional massal.
* **Perbaikan Error React Hooks (`useMemo`)**:
  - Memperbaiki `ReferenceError: useMemo is not defined` pada `ElectionModals.jsx` dengan menambahkan impor `useMemo` dari React.
* **Penghapusan Massal & Endpoint Batch Delete Pemilih**:
  - Menambahkan endpoint backend `POST /elections/voters/batch-delete` (`voters/delete.php` & routing di `backend/index.php`).
  - Menyediakan tombol hapus akses massal untuk mengeluarkan banyak pemilih terdaftar sekaligus tanpa menimbulkan error.
* **Daftar Pemilih Scrollable & Tampilan Konsisten**:
  - Mengatur kontainer daftar akun pemilih yang tersedia maupun terdaftar menjadi scrollable dengan batas ketinggian maksimal agar modal tetap proporsional dan tidak memanjang ke luar layar.

---

## 5. Pembersihan CSS & Kompatibilitas Browser
* **Perbaikan Warning CSS Vendor Prefix**:
  - Menambahkan standar properti `appearance: none;` di samping `-webkit-appearance: none;` dan `-moz-appearance: none;` pada file `AuthPage.css` (baris 182) guna menjamin kepatuhan standar web modern dan kompatibilitas lintas browser.

---

## 6. Dasbor Admin (Dashboard UI/UX Enhancements)
* **Daftar Pemilihan (Elections Panel)**:
  - Membuat daftar pemilihan dapat di-scroll vertikal (`max-height: 430px`) sehingga maksimal 5 item terlihat langsung dan sisanya dapat di-scroll dengan rapi.
  - Menjaga tombol aksi status (*Edit*, *Buka/Tutup/Hasil*, dan *Hapus*) tetap konsisten berdampingan di sisi kanan bersama tombol *Paslon* dan *Peserta*.
* **Penyelarasan Spasi Antar Fitur (Uniform Feature Spacing)**:
  - Menghapus margin inline acak (`style={{ marginTop: '3rem' }}`) pada panel pemilihan, audit blockchain, dan log keamanan.
  - Menyeragamkan jarak vertikal antar fitur dasbor admin menggunakan aturan CSS `.admin-panel + .admin-panel { margin-top: 2.25rem; }`.
* **Elevasi Posisi Konten Dasbor**:
  - Menaikkan posisi konten dasbor sebesar 50% dengan memangkas padding atas dari `3rem` menjadi `1.5rem` (`.dash-main` dan `.dash-main--admin`).

---

## 7. Pembaruan Tabel Undangan (Invites Table)
* **Header Tabel Bergaya Kapsul / Tab Merah**:
  - Mengubah header tabel menjadi blok kapsul/tab terpisah per kolom dengan sudut melengkung di atas (`border-radius: 12px 12px 0 0`) dan latar belakang merah (`var(--red)`).
  - Teks header menggunakan font berwarna putih (`#ffffff`), tebal (`font-weight: 700`), serta posisinya rata tengah sempurna (*center-aligned*) secara horizontal dan vertikal.
* **Penyesuaian Proporsi Kolom & Rata Tengah Isi Tabel**:
  - Mengurangi proporsi lebar kolom **Email** dan **Pembuat** guna memberikan ruang yang lebih lega bagi kolom **Kedaluwarsa** dan **Aksi**.
  - Seluruh data baris di dalam tabel kini berposisi rata tengah (*centered*).
* **Konversi dari Scrollable ke Sistem Halaman (Pagination)**:
  - Mengganti scroll vertikal pada tabel undangan dengan sistem paginasi (5 data per halaman).
  - Dilengkapi navigasi tombol *Sebelumnya*, *Selanjutnya*, nomor halaman aktif, serta indikator total data.
* **Audit & Tampilan Email Akun pada Undangan Terbuka**:
  - Memperbarui query backend di `backend/api/invites/list.php` dengan relasi `LEFT JOIN users u ON u.id = i.used_by`.
  - Jika undangan terbuka (yang saat dibuat belum memiliki email) telah berhasil diklaim oleh pengguna untuk mendaftar, tabel undangan secara otomatis menampilkan email pengguna yang mendaftar tersebut.
  - Memperbarui fitur pencarian agar dapat mendeteksi username maupun email pengklaim undangan terbuka.
* **Penyederhanaan Teks Informasi Masa Berlaku**:
  - Menghapus referensi teknis `INVITE_EXPIRE_DAYS di .env.` pada catatan kaki tabel undangan sehingga teks menjadi lebih bersih dan ramah pengguna: *"Undangan yang belum diklaim otomatis kedaluwarsa setelah 7 hari."*.

---

## 8. Pembersihan Emotikon / Emoji ke Standar Profesional
* Menghapus seluruh emotikon/emoji grafis di seluruh modul kode frontend agar antarmuka tampak bersih, formal, dan konsisten:
  - **Modal Paslon & Pemilih**: Menghapus emoji `👥`, `📋`, `✏️`, `➕`, dan mengganti emoji `👤` pada fallback avatar paslon dengan ikon SVG vektor.
  - **Halaman Voting & Hasil**: Menghapus emoji `✓`, `✎`, `💡`, `⏳` dari status pemilihan, badge konfirmasi, dan tips voting.
  - **Panel USB Token & Profil**: Menghapus emoji `✅`, `❌`, `🔌`, `🔑`, `⚠️`, `⏳` dari tombol aksi, notifikasi toast, dan status deteksi perangkat.
  - **Halaman Dev & Flow Isometrik**: Menghapus emoji navigasi node (`🗺️`, `🔐`, `🛡️`, `📊`, `🗳️`, `⛓️`, `👤`).
