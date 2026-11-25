---
target: Step Foto ID regis KTP (RegisterPage + IdPhotoCapture)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
p2_count: 3
p3_count: 1
target_identity: "file:D:\\3_Coding\\3_Project\\trueCount\\Truecount\\frontend\\src\\pages\\RegisterPage.jsx"
target_fingerprint: "sha256:5e0918d40badf9fb39ad984813d6d7480793737bd0f24629c33e6708b3c8e727"
target_path: "D:\\3_Coding\\3_Project\\trueCount\\Truecount\\frontend\\src\\pages\\RegisterPage.jsx"
timestamp: 2026-11-23T16-53-57Z
slug: frontend-src-pages-registerpage-jsx
---
# Critique — Step Foto ID (Regis KTP), frontend/src/pages/RegisterPage.jsx

Mode: Operate. Assessment A (inline design review) + Assessment B (CLI detector + pengukuran statis) sekuensial single-context karena spawn sub-agent gagal (limit kuota).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:-----:|-----------|
| 1 | Visibility of System Status | 3 | Stepper, pill "Kamera Aktif", spinner, badge "Terekam", CTA disabled — bagus; error muncul jauh dari tombolnya |
| 2 | Match System / Real World | 3 | "muka" (overlay) vs "wajah" (checklist) vs "Foto ID" (stepper) vs "Foto KTP" (CTA) |
| 3 | User Control and Freedom | 3 | Batal, Ambil Ulang, Ubah Foto ID, ganti kamera; tidak ada alternatif upload foto |
| 4 | Consistency and Standards | 2 | Instruksi sama dikemas 3 kali dalam 3 kontainer, wording berbeda |
| 5 | Error Prevention | 3 | CTA disabled sampai kamera siap; tidak ada cegah foto blur/tertutup |
| 6 | Recognition Rather Than Recall | 3 | Contoh visual tepat, tapi crop memotong kartu KTP-nya sendiri |
| 7 | Flexibility and Efficiency | 2 | Satu jalur kaku; wajib kamera, tidak ada "sudah punya foto" |
| 8 | Aesthetic and Minimalist Design | 2 | Brand fit kuat; duplikasi instruksi + crop salah menurunkan step |
| 9 | Error Recovery | 3 | Pesan jelas + retake langsung; error dirender di bawah aksi |
| 10 | Help and Documentation | 3 | Bantuan kontekstual di titik keputusan; terlalu banyak teks sejenis |
| **Total** | | **27/40 (68%)** | **Acceptable — batas bawah Good** |

n/a heuristics: none. Applicable max: 40.

Cognitive load: 2 kegagalan (single focus, visual hierarchy) -> moderate.

Emotional journey: puncak = ilustrasi halftone merah-krem + badge hijau "Terekam"; lembah = kotak hitam 420px + instruksi kedua yang mengulang, setelah 5,37 MB harus turun dulu.

## Design Specificity Verdict

LLM: berasa dibuat untuk TrueCount (palet merah/krem/hitam, halftone, copy Indonesia), tapi struktural masih pola generik "instruksi + kamera + CTA"; satu momen autoreh (dua ilustrasi panduan) justru di-crop sampai kartu KTP-nya kepotong.

Deterministic scan: `impeccable detect --json` pada RegisterPage.jsx + IdPhotoCapture.jsx -> `[]` (exit 0), 0 temuan. Tapi detector tidak mencakup kontras/ukuran target sentuh: 2 kegagalan kontras dan 3 kontrol < 44px ditemukan lewat pengukuran. Tanpa false positive.

Visual overlays: tidak tersedia (tidak ada browser automation dengan injeksi skrip mutabel). Fallback: screenshot headless Edge statis 1280/900/600.

## Overall Impression

Fondasi benar (satu aksi utama jelas, progres 2 langkah, contoh visual cerdas), card 760px terjustifikasi. Masalahnya redundansi dan detail yang belum dicek ulang: instruksi 3x, crop memotong subjek, target sentuh 38-41px, 5 MB gambar di titik paling rawan batal daftar.

## What's Working

1. Ilustrasi sebagai bantuan, bukan hiasan — contoh foto tepat sebelum kamera; recognition mengalahkan recall, gaya nyambung dengan palet.
2. Satu aksi utama tidak ambigu — "Ambil Foto KTP" full-width merah, disabled sampai kamera siap, aria-busy.
3. Card 760px terjustifikasi — preview 675x420 terpakai; transisi ke form akun 520px terasa sebagai perubahan konteks.

## Priority Issues

**[P1] 5,37 MB PNG di atas lipatan** — formatFotoWebcam.png 2.938.183 B (1672x941) + formatFotoSelfie.png 2.437.274 B (1024x1536) = 5.375.457 B, dirender ~320x200 (4x oversized). Titik drop-off tertinggi, kemungkinan dari HP. Fix: `magick ... -resize 1280x -quality 82 formatFotoWebcam.webp` (~150-250 KB), PNG jadi sumber, width/height eksplisit. Command: $impeccable optimize.

**[P1] Satu instruksi dikemas tiga kali dengan tiga wording** — kepala kartu panduan; pill `.guide-label` "Posisikan muka dan KTP sejajar"; kartu `.id-photo-instructions` "Posisikan wajah dan KTP sejajar" + 2 bullet; caption thumbnail "KTP di samping wajah" / "KTP sejajar dagu". Tiga pernyataan untuk satu syarat dibaca sebagai tiga syarat. Fix: checklist di kartu panduan jadi satu-satunya sumber, hapus kartu instruksi terpisah, pendekkan/hapus pill overlay, samakan "muka"/"wajah". Command: $impeccable distill.

**[P2] Crop memotong kartu KTP** — `object-fit: cover` + `object-position: center 40%` memotong sisi kanan kedua thumbnail, tepat di lokasi kartu KTP. Fix: `object-fit: contain` di latar #fafaf8, atau `object-position` per gambar (webcam 70% 45%, selfie 65% 45%), atau ekspor ulang 4:3 dengan kartu utuh. Command: $impeccable polish.

**[P2] Target sentuh < 44px** — `.type-btn` ~41px (desktop) / ~38px (<=420px), `.btn-submit` ~41px, `.back-btn` 34x34. Salah sentuh toggle KTP/SIM me-reset foto (dataUrl dibuang). Fix: min-height 44px pada semua kontrol interaktif step ini. Command: $impeccable adapt.

**[P2] Dua kegagalan kontras WCAG AA** — `.type-btn.active` putih di #F13C35 = 3,86:1 pada 14px/600 (butuh 4,5:1); label stepper #8a8a85 di putih = 3,47:1. Fix: aktif pakai #c72e27 (5,46:1) atau teks #0d0d0d (5,03:1); label stepper -> #6a6a67 (5,43:1). Command: $impeccable audit.

**[P3] Hierarki & ritme lebar antar blok** — h1 weight 300 vs h2 700 (terbalik); toggle 250px melayang di card 760px sementara blok lain 675px; pesan error di bawah tombol, bukan di sumber. Fix: samakan berat/skala, jadikan toggle selebar konten, tempel error di atas aksi pemotretan. Command: $impeccable layout.

## Persona Red Flags

Jordan (First-Timer): pill "Posisikan muka dan KTP sejajar" vs list "Posisikan wajah dan KTP sejajar" + caption "di samping wajah" vs "sejajar dagu" = empat instruksi spasial untuk satu pose; akan mengulang foto yang sudah benar.

Sam (Aksesibilitas): tombol aktif 3,86:1; label stepper 3,47:1; toggle 41px, capture ~41px; figure/figcaption tidak terasosiasi programatik (alt sudah deskriptif); urutan heading h1-h2-h3 benar.

Casey (Mobile): 5,37 MB sebelum panduan; CTA di bawah viewport 360px butuh scroll; toggle 38px rawan salah sentuh yang me-reset foto; state aman saat berpindah app.

## Minor Observations

- loading="lazy" tidak efektif untuk gambar di viewport awal; pakai width/height eksplisit + fetchpriority="low".
- hover translateY(-2px) pada thumbnail menyiratkan bisa diklik; hilangkan atau buat lightbox.
- bingkai merah ter-cetak di dalam PNG membuat dua lapis border pada card.
- pill kuning "Foto KTP wajib diambil untuk melanjutkan." mengulang state tombol disabled.
- caption 0,72rem menanggung detail paling berguna sementara judul panduan lebih besar — bobot tipografi terbalik.

## Questions to Consider

- Apa yang membuat step ini terasa sebagai satu aksi terpandu, bukan form dengan instruksi?
- Kalau overlay kamera sudah membingkai bidikan, apakah kartu panduan yang redundan — atau overlay-nya?
- Bagaimana kalau tombol capture hidup di thumb zone, tepat di bawah preview?
