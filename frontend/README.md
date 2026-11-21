# Frontend TrueCount

Frontend React 19 + Vite 8 untuk TrueCount. Mendukung web browser dan aplikasi desktop (Tauri).

## Stack

- React 19 + Vite 8
- Tauri v2 (Rust) untuk desktop
- Plus Jakarta Sans (font)

## Development

```bash
npm install
npm run dev:full   # PHP backend + Vite sekaligus
# atau
npm run dev         # Vite saja (backend harus jalan terpisah)
```

## Build

```bash
# Web
npm run build

# Desktop (Tauri)
npm run desktop:build
```

## Struktur

```
frontend/
├── src/
│   ├── pages/           # Halaman: Landing, Masuk, Daftar, Dasbor, Pilih, Hasil, dll.
│   ├── components/      # Nav, AuthGuard, ElectionModals, HealthMonitor, dll.
│   ├── hooks/           # useAuth, useAuthSecurity, useUsbToken, useWebAuthn
│   ├── styles/          # cursor.css
│   ├── utils/           # webauthn.ts
│   └── src-tauri/       # Tauri (desktop wrapper)
├── public/              # Aset statis
└── vite.config.js
```

## Lihat Juga

- [`../README.md`](../README.md) — Dokumentasi lengkap TrueCount
- [`../docs/desktop/desktop.md`](../docs/desktop/desktop.md) — Panduan desktop Tauri
- [`../docs/deploy/deploy.md`](../docs/deploy/deploy.md) — Panduan deploy
