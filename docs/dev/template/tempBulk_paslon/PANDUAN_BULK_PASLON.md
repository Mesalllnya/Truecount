# Panduan Bulk Import Calon Paslon

Folder `docs/dev/template/tempBulk_paslon/` berisi template dan script CLI untuk memasukkan data pemilihan dan calon paslon sekaligus, termasuk pemrosesan foto (steganografi + enkripsi file), sehingga developer **tidak perlu menambah satu per satu lewat UI admin**.

## Isi folder template

```
docs/dev/template/tempBulk_paslon/
├── dataPaslon.json      # Data pemilihan + daftar calon paslon
├── PANDUAN_BULK_PASLON.md # Panduan ini
└── img/                 # Tempat gambar paslon (belum dienkripsi)
    ├── paslon_01_raka.jpg
    ├── paslon_02_siti.jpg
    └── ...
```

## Alur kerja singkat

1. Siapkan gambar calon paslon di folder `img/`.
2. Isi `dataPaslon.json` dengan data pemilihan dan daftar calon.
3. Jalankan script impor:
   ```bash
   php scripts/bulk_import_paslon.php docs/dev/template/tempBulk_paslon
   ```
4. Script akan membuat/menggunakan pemilihan, menyimpan calon, dan memproses foto masing-masing calon (termasuk enkripsi).

---

## 1. Format file gambar (`img/`)

Letakkan semua foto calon paslon di subfolder `img/`. File gambar **belum dienkripsi** (asli). Script akan mengonversi, menyisipkan metadata lewat steganografi, dan mengenkripsi sebelum menyimpan.

### Konvensi nama file

Sebaiknya gunakan pola:

```
paslon_<urutan>_<nama-singkat>.jpg
```

Contoh:
- `paslon_01_raka.jpg`
- `paslon_02_siti.jpg`
- `paslon_03_andi.png`

Nama file tersebut kemudian disebutkan di kolom `image_file` dalam `dataPaslon.json`.

### Persyaratan gambar

| Aspek | Ketentuan |
|-------|-----------|
| Format | JPEG, PNG, atau WebP |
| Maksimal ukuran | 2 MB |
| Tidak dienkripsi dulu | Script yang menangani enkripsi |

---

## 2. Isi `dataPaslon.json`

Berikut adalah template lengkap dengan keterangan setiap kolom:

```json
{
  // ID admin yang bertanggung jawab (created_by dan uploaded_by foto).
  // Cek di tabel users; default admin biasanya id 1.
  "admin_user_id": 1,

  "election": {
    // Jika sudah ada pemilihan draft, isi id-nya. Kolom di bawah diabaikan.
    "election_id": null,

    "title": "Pemilihan Ketua HIMTI 2026",
    "description": "Pemilihan ketua HIMTI periode 2026-2027.",
    "start_time": "2026-12-01 08:00:00",
    "end_time": "2026-12-05 17:00:00",
    "status": "draft"
  },

  "candidates": [
    {
      "name": "Raka Pratama",
      "vision": "Inovasi dan kemajuan bagi semua mahasiswa.",
      "mission": "Meningkatkan fasilitas kampus dan apresiasi prestasi akademik.",
      "image_file": "paslon_01_raka.jpg"
    },
    {
      "name": "Siti Rahayu",
      "vision": "Kampus yang lebih inklusif dan berdaya saing.",
      "mission": "Membuka lebih banyak kesempatan beasiswa dan magang.",
      "image_file": "paslon_02_siti.jpg"
    }
  ]
}
```

### Rincian kolom

| Kolom | Wajib? | Keterangan |
|-------|--------|------------|
| `admin_user_id` | ✅ | ID admin dari tabel `users`. Foto akan di-upload sebagai admin ini. |
| `election.election_id` | ❌ | Biarkan `null` untuk membuat pemilihan baru. Isi id jika ingin menambah calon ke pemilihan draft yang sudah ada. |
| `election.title` | ✅ | Judul pemilihan (abaikan jika `election_id` diisi). |
| `election.description` | ❌ | Deskripsi pemilihan. |
| `election.start_time` | ✅ | Format `YYYY-MM-DD HH:MM:SS`. |
| `election.end_time` | ✅ | Format `YYYY-MM-DD HH:MM:SS`. |
| `election.status` | ❌ | Default `draft`. Hanya pemilihan dengan status `draft` yang boleh ditambah calon. |
| `candidates[].name` | ✅ | Nama calon (maksimal 150 karakter). |
| `candidates[].vision` | ❌ | Visi calon. |
| `candidates[].mission` | ❌ | Misi calon. |
| `candidates[].image_file` | ❌ | Nama file gambar di folder `img/` (hanya nama file, tanpa folder). |

---

## 3. Jalankan script impor

Dari folder root proyek `Truecount`:

```bash
# Linux / macOS / Git Bash
php scripts/bulk_import_paslon.php docs/dev/template/tempBulk_paslon

# Windows (PowerShell / CMD)
php scripts/bulk_import_paslon.php docs\dev\template\tempBulk_paslon
```

### Contoh output sukses

```
Gunakan pemilihan id #5 - Pemilihan Ketua HIMTI 2026
  [+] Calon #12: Raka Pratama
       Foto diproses (photo_file_id #89)
  [+] Calon #13: Siti Rahayu
       Foto diproses (photo_file_id #90)

=== Hasil impor ===
Berhasil    : 2
Dilewati    : 0
Error       : 0
```

Jika ada error, script akan mencantumkannya di bagian bawah dan keluar dengan kode error.

---

## 4. Persyaratan sistem

Sebelum menjalankan script, pastikan:

1. **File `.env` sudah diisi** di root proyek, termasuk:
   - `ENCRYPTION_KEY_B64` (untuk enkripsi file foto)
   - `CHACHA20_KEY_B64` (untuk steganografi)
   - Kredensial database (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`)
2. **Migrasi database sudah dijalankan** (termasuk `009_add_photo_file_id_to_candidates.sql`):
   ```bash
   php database/migrate.php
   ```
3. **Ekstensi PHP aktif**: `gd` dan `fileinfo`.
4. **Admin user** yang disebutkan di `admin_user_id` sudah ada dan memiliki role `admin`.

---

## 5. Apa yang terjadi di belakang layar

Untuk setiap calon paslon, script menjalankan pipeline yang sama dengan endpoint upload foto admin (`POST /elections/{id}/candidates/{cid}/photo`):

1. Gambar dikonversi ke **PNG** via PHP GD.
2. Metadata (election_id, candidate_id, uploaded_by, uploaded_at) disisipkan ke gambar lewat **steganografi LSB** (`SteganographyService`).
3. Gambar stego dienkripsi dengan **ChaCha20-Poly1305** (`FileEncryptionService`) dan disimpan di tabel `encrypted_files`.
4. ID file terenkripsi disimpan ke kolom `candidates.photo_file_id`.

Hasilnya sama persis dengan calon yang ditambah lewat UI admin — foto terlindungi dan tidak bisa dibaca langsung dari storage tanpa dekripsi.

---

## Catatan

- Script ini **tidak mengubah path database** (`photo_path` tetap `NULL`, data foto disimpan lewak `photo_file_id` → `encrypted_files`).
- Kalau ingin import ulang ke pemilihan yang sama, pastikan calon belum duplikat atau bersihkan tabel `candidates` untuk pemilihan tersebut terlebih dahulu.
- Untuk melihat hasil, buka halaman dasbor admin → pemilihan → detail pemilihan → daftar kandidat.
