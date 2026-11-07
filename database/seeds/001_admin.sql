-- =============================================================
-- TrueCount — Seed: Admin Default (Sprint 1)
--
-- Password default: Admin@1234
-- Hash dibuat dengan Argon2id (memory=65536, time=4, threads=2)
--
-- Jalankan setelah migration:
--   mysql -u root -p truecount_db < database/seeds/001_admin.sql
-- =============================================================

USE `truecount_db`;

INSERT INTO `users` (`username`, `email`, `password_hash`, `role`)
VALUES (
    'admin',
    'admin@truecount.local',
    '$argon2id$v=19$m=65536,t=4,p=2$NXdRMk9qbkxLQ1NZY3AueA$Ji5VARai/2fuItogoN0go3Mk8gzzOuj+LUOj0S593Xw',
    'admin'
)
ON DUPLICATE KEY UPDATE
    `password_hash` = VALUES(`password_hash`),
    `updated_at`    = NOW();
