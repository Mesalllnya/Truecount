-- =============================================================
-- TrueCount — Seed: Admin Default (Sprint 1)
--
-- Password default: Admin@1234
-- Hash dibuat dengan Argon2id. GANTI password ini sebelum production.
--
-- Jalankan setelah migration:
--   mysql -u root -p truecount_db < database/seeds/001_admin.sql
-- =============================================================

USE `truecount_db`;

INSERT INTO `users` (`username`, `email`, `password_hash`, `role`)
VALUES (
    'admin',
    'admin@truecount.local',
    -- Argon2id hash dari: Admin@1234
    -- Generate ulang via PHP: password_hash('Admin@1234', PASSWORD_ARGON2ID)
    '$argon2id$v=19$m=65536,t=4,p=2$PLACEHOLDER_HASH_GANTI_INI',
    'admin'
)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();
