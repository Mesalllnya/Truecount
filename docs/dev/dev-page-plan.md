# Halaman Dev TrueCount — Rencana Implementasi & Pitch Deck

> Halaman eksklusif untuk **Admin** dan **Developer**. Berisi visualisasi 3D isometrik interaktif yang menjelaskan cara kerja aplikasi TrueCount dari awal hingga akhir, serta algoritma kriptografi yang diterapkan. Cocok digunakan sebagai dokumentasi teknis untuk tim dan materi presentasi (pitch deck) untuk evaluator.

---

## 1. Tujuan Halaman Dev

| Aspek | Deskripsi |
|-------|-----------|
| **Akses** | Hanya user dengan role `admin` atau `dev` |
| **URL** | `/dev` (alias `/pengembang`) |
| **Isi Utama** | Visualisasi 3D isometrik: Flow Aplikasi + Algoritma Kriptografi |
| **Target Pengguna** | Tim pengembangan, dosen penguji, evaluator proyek akhir |
| **Dapat Dipakai Sebagai** | Dokumentasi teknis interaktif & materi pitch deck |

---

## 2. Prasyarat Sistem (Backend)

Sebelum membangun halaman dev, perlu ditambahkan role `dev` dan middleware autentikasi baru.

### 2.1 Tambah Role `dev`

Saat ini role yang ada: `admin`, `voter`. Tambahkan `dev`.

| File | Perubahan |
|------|-----------|
| `database/migrations/012_add_dev_role.sql` | `ALTER TABLE users MODIFY role ENUM('admin','voter','dev')` + index `idx_users_role` |
| `database/seeds/003_dev_user.sql` | Seed user dev: `dev` / `Dev@1234` / role `dev` |
| `backend/middleware/auth.php` | Tambah fungsi `requireDevOrAdmin()` |
| `backend/index.php` | Tambah route `/dev/flow` dan `/dev/crypto` |

### 2.2 Middleware Baru (`requireDevOrAdmin`)

File: `backend/middleware/auth.php`

```php
/**
 * Paksa autentikasi + role admin atau dev.
 * Jika bukan admin/dev → 403 Forbidden.
 */
function requireDevOrAdmin(): array
{
    $user = requireAuth();

    $role = $user['role'] ?? '';
    if ($role !== 'admin' && $role !== 'dev') {
        jsonResponse(['error' => 'Akses ditolak. Hanya admin atau developer yang diizinkan.'], 403);
    }

    return $user;
}
```

### 2.3 Endpoint Data (Opsional)

Bisa diambil dari database atau hardcode di frontend.

| Method | Path | Auth | Keterangan |
|--------|------|------|------------|
| GET | `/dev/flow` | admin/dev | Data alur aplikasi (nodes & edges) |
| GET | `/dev/crypto` | admin/dev | Data algoritma kriptografi |

File: `backend/api/dev/flow.php` dan `backend/api/dev/crypto.php`

---

## 3. Struktur Frontend

### 3.1 File Baru

| File | Fungsi |
|------|--------|
| `frontend/src/pages/DevPage.jsx` | Halaman utama dev |
| `frontend/src/pages/DevPage.css` | Styling halaman dev |
| `frontend/src/components/RoleGuard.jsx` | Route guard untuk role admin/dev |
| `frontend/src/components/IsometricFlow.jsx` | Visualisasi 3D isometrik: Flow Aplikasi |
| `frontend/src/components/IsometricCrypto.jsx` | Visualisasi 3D isometrik: Algoritma Kriptografi |
| `frontend/src/hooks/useRole.js` (opsional) | Helper cek role user dari JWT |

### 3.2 Routing (`App.jsx`)

Tambahkan di dalam `<Route element={<AuthGuard />}>`:

```jsx
import DevPage from './pages/DevPage'
import RoleGuard from './components/RoleGuard'

<Route element={<AuthGuard />}>
  <Route element={<RoleGuard allowedRoles={['admin', 'dev']} />}>
    <Route path="/dev" element={<DevPage />} />
  </Route>
</Route>
```

### 3.3 RoleGuard (Frontend)

Cek `user.role` dari JWT payload. Jika bukan `admin` atau `dev`, redirect ke `/masuk` atau tampilkan halaman 403.

---

## 4. Konten Halaman Dev (2 Section)

### Section A: Flow Aplikasi (3D Isometrik)

Visualisasi alur lengkap aplikasi dari awal hingga akhir.

**Alur Singkat:**

```
[Pengguna] → [Login] → [Setup Keamanan] → [Dasbor]
   ↓                              ↓
[Register via Undangan]     [Admin: Undangan, Pemilihan, Blockchain]
                              ↓
                         [Pemilih: Pilih Kandidat → Input Suara]
                              ↓
                         [Hasil Pemilihan + Verifikasi Blockchain]
```

**Komponen `IsometricFlow.jsx` akan menampilkan:**
- Node-node utama sebagai "blok" 3D isometrik
- Panah alur antar node
- Klik node → detail penjelasan (tooltip / modal)
- Warna berbeda per peran:
  - 🟠 **Admin** = Oranye
  - 🔵 **Pemilih** = Biru
  - 🟢 **Sistem** = Hijau

**Talking Points (untuk pitch deck):**
1. Pendaftaran hanya lewat undangan (tidak ada register bebas)
2. Setup keamanan wajib sebelum masuk dashboard (Windows Hello atau Dongle USB)
3. Admin mengelola undangan, pemilihan, kandidat, dan blockchain audit
4. Pemilih memilih kandidat, input suara terenkripsi, dan lihat hasil
5. Semua percobaan login tercatat dengan foto kamera sebagai audit trail

---

### Section B: Algoritma Kriptografi (3D Isometrik)

Visualisasi algoritma kriptografi yang diterapkan di TrueCount.

**Tabel Algoritma:**

| Algoritma | Digunakan Untuk | File PHP |
|-----------|-----------------|----------|
| **Argon2id** | Hash password | `backend/helpers/` + `password_hash()` |
| **JWT HS256** | Token otentikasi | `backend/helpers/jwt.php` |
| **AES-256-GCM** | Enkripsi suara + file | `backend/services/crypto/AESGCMService.php` |
| **ChaCha20-Poly1305** | Enkripsi pesan/file | `backend/services/crypto/ChaCha20Poly1305Service.php` |
| **Vigenere** | Enkripsi pesan klasik | `backend/services/crypto/VigenereCipherService.php` |
| **Steganografi (LSB)** | Sembunyikan pesan dalam gambar | `backend/services/crypto/SteganographyService.php` |
| **Blockchain sederhana** | Integritas hasil pemilihan | `backend/services/crypto/BlockchainService.php` |
| **ECDSA P-256** | USB Token / WebAuthn signature | `backend/services/crypto/` + `webauthn.php`` |

**Komponen `IsometricCrypto.jsx` akan menampilkan:**
- Setiap algoritma sebagai blok 3D dengan ikon
- Panah: Data Masuk → Proses → Data Keluar
- Klik algoritma → detail implementasi (file PHP, ukuran key, mode operasi)

**Talking Points (untuk pitch deck):**
1. Password tidak tersimpan plain text — di-hash dengan Argon2id
2. Sesi login menggunakan JWT HS256 (tanpa library eksternal)
3. Suara pemilih dienkripsi AES-256-GCM sebelum masuk database
4. Tidak ada hubungan suara dengan identitas pemilih (privacy by design)
5. Hasil pemilihan divalidasi dengan blockchain (tidak bisa diubah-ubah)
6. USB Token menggunakan ECDSA P-256 untuk signature challenge-response

---

## 5. Teknologi 3D Isometrik (Pilihan)

| Opsi | Library | Kelebihan | Kekurangan |
|------|---------|-----------|------------|
| **CSS 3D Transform** | Tanpa library tambahan | Ringan, tidak butuh build step, cocok untuk isometrik sederhana | Terbatas pada efek 3D di bidang 2D |
| **React Three Fiber** | `@react-three/fiber`, `three` | 3D benar, interaktif, banyak contoh | Bundle size lebih besar, butuh pembelajaran |
| **Isometric CSS + SVG** | Tanpa library | Cepat dikembangkan, cocok untuk diagram alur | Tidak benar-benar 3D |

**Rekomendasi:** Mulai dengan **CSS 3D Transform + SVG** — lebih ringan, cocok untuk diagram, dan konsisten dengan stack saat ini (belum ada Three.js).

---

## 6. Langkah Implementasi (Checklist)

### Fase 1: Backend
- [ ] Tambah role `dev` ke migration dan seed
- [ ] Tambah `requireDevOrAdmin()` di `backend/middleware/auth.php`
- [ ] Buat endpoint `backend/api/dev/flow.php` dan `backend/api/dev/crypto.php`
- [ ] Tambah route di `backend/index.php`
- [ ] Uji endpoint dengan token admin dan dev

### Fase 2: Frontend
- [ ] Buat `frontend/src/components/RoleGuard.jsx`
- [ ] Buat `frontend/src/pages/DevPage.jsx` + `DevPage.css`
- [ ] Buat `frontend/src/components/IsometricFlow.jsx`
- [ ] Buat `frontend/src/components/IsometricCrypto.jsx`
- [ ] Tambah route `/dev` di `App.jsx` dengan `AuthGuard` + `RoleGuard`
- [ ] Uji akses: admin (boleh), dev (boleh), voter (ditolak 403/redirect)

### Fase 3: Konten
- [ ] Isi data flow aplikasi (node, edge, deskripsi tiap tahap)
- [ ] Isi data algoritma kripto (nama, fungsi, file PHP, parameter)
- [ ] Tambah animasi transisi antar section
- [ ] Pastikan responsive (mobile-friendly)

### Fase 4: Dokumentasi
- [ ] Update `README.md` (seksi URL Routing + dokumentasi)
- [ ] Update `docs/dev/knowledge_transfer.md` (seksi State Sprint / Struktur File)
- [ ] Update `docs/dev/user-flow.md` (tambah halaman dev)

---

## 7. Contoh Struktur Komponen (Konsep)

```jsx
// IsometricFlow.jsx — konsep struktur
function IsometricFlow() {
  const nodes = [
    { id: 'user', label: 'Pengguna', x: 0, y: 0 },
    { id: 'login', label: 'Login / Masuk', x: 2, y: 0 },
    { id: 'setup', label: 'Setup Keamanan', x: 4, y: 0 },
    { id: 'dashboard', label: 'Dasbor', x: 6, y: 0 },
    { id: 'vote', label: 'Input Suara', x: 6, y: -2 },
    { id: 'result', label: 'Hasil + Blockchain', x: 6, y: -4 },
  ]

  return (
    <div className="isometric-container">
      {nodes.map(node => (
        <div key={node.id} className="isometric-node" style={nodeStyle(node)}>
          {node.label}
        </div>
      ))}
      {/* panah antar node */}
    </div>
  )
}
```

---

## 8. Estimasi Waktu

| Fase | Estimasi |
|------|----------|
| Backend (role + endpoint) | 2–4 jam |
| Frontend (RoleGuard + halaman dasar) | 4–6 jam |
| Komponen 3D Isometrik Flow | 6–8 jam |
| Komponen 3D Isometrik Crypto | 6–8 jam |
| Testing & dokumentasi | 2–4 jam |
| **Total** | **20–30 jam** |

---

## 9. Catatan Penting

- Role `dev` harus ditambahkan secara eksplisit di database dan middleware; tidak boleh di-asumsikan otomatis ada.
- Halaman dev berisi informasi teknis internal — **read-only**, tidak boleh mengubah data produksi dari halaman ini.
- Visualisasi 3D harus tetap ringan agar tidak mengganggu performa halaman lain.
- Semua akses ke halaman dev harus tercatat di log (`auth_attempts` atau log khusus) untuk audit.
- Cocok digunakan sebagai materi presentasi (pitch deck) saat sidang proyek akhir.
