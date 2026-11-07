# TrueCount — Secure E-Voting System

Aplikasi web pemungutan suara yang aman untuk keperluan akademik.

## Tech Stack

| Layer    | Teknologi                     |
|----------|-------------------------------|
| Frontend | React.js (Vite)               |
| Backend  | PHP (Native, no framework)    |
| Database | MySQL                         |

## Struktur Proyek

```
Truecount/
├── backend/            # PHP API
│   ├── api/
│   │   ├── auth/       # Register, Login, Logout, Me
│   │   └── election/   # Election endpoints (Sprint 2)
│   ├── config/         # database.php, app.php
│   ├── helpers/        # response.php (CORS + JSON)
│   ├── middleware/     # JWT auth middleware
│   ├── models/         # DB query classes
│   ├── services/       # Business logic
│   └── index.php       # Entry point
│
├── database/
│   ├── migrations/     # SQL schema files
│   ├── seeds/          # SQL seed files
│   └── migrate.php     # Migration runner CLI
│
├── frontend/           # React + Vite
│   └── src/
│       ├── pages/      # LandingPage, Login, Register, Dashboard
│       ├── components/ # Layout, UI components
│       ├── services/   # API calls (axios)
│       ├── context/    # AuthContext
│       └── hooks/      # useAuth, dll.
│
├── docs/               # Dokumentasi teknis
├── .env.example        # Template environment variables
└── README.md
```

## Quick Start

### 1. Setup Database

```bash
# Copy dan sesuaikan .env
cp .env.example .env

# Jalankan migration
php database/migrate.php

# (Opsional) Jalankan migration + seeding admin default
php database/migrate.php --seed
```

### 2. Jalankan Backend

```bash
php -S localhost:8000 -t backend backend/index.php
```

API tersedia di: `http://localhost:8000`

Health check: `GET http://localhost:8000/health`

### 3. Jalankan Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend tersedia di: `http://localhost:5173`

## API Endpoints (Sprint 1)

| Method | Endpoint          | Keterangan              |
|--------|-------------------|-------------------------|
| GET    | /health           | Health check            |
| POST   | /auth/register    | Daftar akun baru        |
| POST   | /auth/login       | Login, dapat JWT        |
| POST   | /auth/logout      | Logout (invalidate JWT) |
| GET    | /auth/me          | Info user dari JWT      |

## Deploy

Panduan lengkap untuk setup lokal, konfigurasi server production, Nginx/Apache, HTTPS, dan checklist sebelum demo tersedia di:

👉 [`docs/deploy.md`](docs/deploy.md)

## Pembagian Jobdesk

- **Orang 1** — Authentication & User Management
- **Orang 2** — Election Management & Voting System
- **Orang 3** — Cryptography & Advanced Security

Lihat [`docs/pembagian_jobdesk_secure_e_voting.md`](docs/pembagian_jobdesk_secure_e_voting.md) untuk detail lengkap.
