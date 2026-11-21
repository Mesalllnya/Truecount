# TrueCount Server CLI - Specification

**Repository:** `truecount-server-cli` (new, separate from main repo)  
**Language:** Rust (recommended - shares Tauri/backend logic) or PHP CLI (no new deps)  
**Status:** Specification phase - not yet implemented

---

## Problem Statement

Currently TrueCount server runs via multiple paths with different storage locations:

| Path | PHP runs from | `storage/auth_photos` location |
|------|---------------|--------------------------------|
| `npm run dev:full` / `dev:backend` | `repo/backend/` | `repo/backend/storage/auth_photos/` |
| `scripts/deploy-server.ps1` | `repo/backend/` | `repo/backend/storage/auth_photos/` |
| `npm run desktop:dev` (Tauri) | `%APPDATA%\com.truecount.app\backend` | `%APPDATA%\com.truecount.app\backend\storage\auth_photos\` |
| Installed app | `%APPDATA%\com.truecount.app\backend` | `%APPDATA%\com.truecount.app\backend\storage\auth_photos\` |

**Issues:**
1. **Storage fragmented** - same DB but photos in different locations → "missing photos" when switching servers
2. **Port 8000 conflicts** - Tauri holds port; `spawn_php_backend` skips spawn AND code copy when port busy → stale code runs silently
3. **No unified status command** - can't easily check: which server runs, from where, storage location, health
4. `deploy-server.ps1` is one-time setup, not daily ops tool

---

## Solution: `tc-server` CLI

A single CLI tool to manage TrueCount server end-to-end with **unified storage via `TC_STORAGE_ROOT`**.

### MVP Commands

```bash
# Start server with explicit source & unified storage
tc-server start [--port 8000] [--bind 0.0.0.0] [--from repo|appdata]

# Stop server gracefully
tc-server stop

# Restart server
tc-server restart

# Show comprehensive status
tc-server status
# Output:
#   PID: 12345
#   Bind: 0.0.0.0:8000
#   Source: %APPDATA%\com.truecount.app\backend (copied from repo at commit abc123)
#   TC_STORAGE_ROOT: D:\TrueCount\storage
#   Photo storage: D:\TrueCount\storage\auth_photos
#   Code version: abc123def (2026-01-15)
#   Health: OK (HTTP 200, DB connected, 0 missing photos)

# Health check: /health + DB + photo audit
tc-server health
# Output:
#   HTTP /health: 200 OK (12ms)
#   Database: connected (truecount_db)
#   Photos: 142/142 files present (0 missing)

# Run migrations
tc-server migrate [--seed] [--fresh]

# View logs
tc-server logs [-f]

# Port management
tc-server ports
# Shows: 5173 (Vite), 5183 (HMR), 8000 (PHP) - with PIDs
# Offers to free them
```

### Advanced Commands

```bash
# Full preflight check
tc-server doctor
# Checks: PHP version, extensions (gd/fileinfo/openssl/pdo_mysql),
# .env valid, ENCRYPTION_KEY_B64 32 bytes, migrations up-to-date,
# storage writable, port 8000 free

# Unify fragmented storage
tc-server storage unify --target <path>
# Copies photos from all known locations (repo, %APPDATA%) to target
# Sets TC_STORAGE_ROOT in config

# Audit storage vs DB
tc-server storage audit
# Reports: orphan files (in storage not in DB), broken refs (in DB not in storage)
```

### Configuration

`server.toml` (or `server.json`):
```toml
# Paths
backend_source = "repo"           # "repo" | "appdata" | "/custom/path"
tc_storage_root = "D:/TrueCount/storage"

# Network
port = 8000
bind = "0.0.0.0"                  # "127.0.0.1" for standalone

# PHP
php_binary = "php"                # or full path

# Logging
log_level = "info"                # debug|info|warn|error
```

---

## Technical Design

### Language Choice: Rust

**Pros:**
- Reuse Tauri backend logic (`spawn_php_backend`, `prepare_runtime_backend`, `runtime_root`)
- Single binary, no runtime deps
- Cross-platform (Windows/Linux/macOS)
- Can embed as library if needed

**Cons:**
- New language for PHP-heavy team
- Build step required

**Alternative: PHP CLI**
- No new deps (PHP already required)
- Can directly include `backend/helpers/storage.php`, `backend/config/database.php`
- Slower startup, but acceptable for CLI

### Storage Unification (`TC_STORAGE_ROOT`)

The key to fixing "missing photos" is enforcing **one storage root** across all server modes.

```rust
// In CLI: always set TC_STORAGE_ROOT before spawning PHP
std::env::set_var("TC_STORAGE_ROOT", config.tc_storage_root);

// In PHP (backend/helpers/storage.php):
function storageRoot(): string {
    $override = getenv('TC_STORAGE_ROOT');
    if ($override) return rtrim($override, "/\\");
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
}
```

All file operations (`auth_photos`, `id_photos`, `encrypted_files`, `logs`) use `storagePath()` helper → single root.

### Process Management

```rust
// Start: spawn PHP with explicit bind, capture PID
// Store PID in ~/.config/tc-server/server.pid (or %APPDATA%\tc-server\server.pid)
// On stop: read PID, send SIGTERM, wait for port free
// On restart: stop → start

// Port conflict resolution:
//   tc-server ports → lists PIDs on 5173/5183/8000
//   tc-server stop → kills only TrueCount PHP (by PID file)
//   tc-server start --from repo → always fresh copy to appdata, then spawn
```

### Health Check Implementation

```rust
// 1. HTTP GET /health → expect 200 + {"status":"ok","database":"connected"}
// 2. If /health ok, run DB query: SELECT 1
// 3. Photo audit: SELECT id, photo_path FROM auth_attempts WHERE photo_path IS NOT NULL
//    For each: check file exists at TC_STORAGE_ROOT/photo_path
//    Report: total, present, missing
```

---

## Integration with Existing Tools

| Existing Tool | Relationship |
|---------------|--------------|
| `deploy-server.ps1` | Unchanged - still does one-time setup (migrate, seed, firewall). CLI takes over daily ops. |
| `npm run desktop:dev` | Still works - Tauri spawns PHP. CLI `status`/`health` can monitor it. |
| `npm run dev:full` | Still works for frontend dev. CLI `ports` can free ports if stuck. |
| `scripts/free-ports.ps1` | Wrapped by `tc-server ports` |
| Tauri `lib.rs` (`spawn_php_backend`) | Reference implementation for CLI's spawn logic |

---

## Acceptance Criteria

- [ ] `tc-server status` answers: "which server, from where, storage where, healthy?"
- [ ] All start modes (`--from repo|appdata`) use same `TC_STORAGE_ROOT` → **photos never "lost" due to server switch**
- [ ] `health`/`audit` detect missing photos (like issue #36 case) and report in Indonesian
- [ ] README with install, quickstart, command examples
- [ ] Doesn't break `deploy-server.ps1` or `desktop:dev`

---

## File Structure (Rust)

```
truecount-server-cli/
├── Cargo.toml
├── README.md
├── src/
│   ├── main.rs           # CLI entry (clap)
│   ├── config.rs         # server.toml parsing
│   ├── commands/
│   │   ├── start.rs
│   │   ├── stop.rs
│   │   ├── status.rs
│   │   ├── health.rs
│   │   ├── migrate.rs
│   │   ├── logs.rs
│   │   ├── ports.rs
│   │   ├── doctor.rs
│   │   └── storage.rs
│   ├── php/
│   │   ├── spawn.rs      # Ported from Tauri lib.rs
│   │   └── health.rs     # HTTP + DB + photo checks
│   ├── storage/
│   │   └── unify.rs      # Copy from fragmented locations
│   └── utils/
│       ├── pid_file.rs
│       └── port_check.rs
├── server.toml.example
└── xtask/                # Build scripts (optional)
```

---

## Next Steps

1. **Create repo** `truecount-server-cli` (Rust project)
2. **Port spawn logic** from `frontend/src-tauri/src/lib.rs` → `src/php/spawn.rs`
3. **Implement MVP commands** in order: `start`, `stop`, `status`, `health`, `migrate`, `logs`, `ports`
4. **Add `doctor` and `storage` commands**
5. **Write README** with Windows/Linux install instructions
6. **Test integration** with existing `deploy-server.ps1` and Tauri app