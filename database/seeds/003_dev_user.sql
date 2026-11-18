-- =============================================================
-- TrueCount - Seed: User Developer (Sprint 5 / Dev Page)
--
-- Password default: Dev@1234
-- Hash Argon2id (memory=65536, time=4, threads=2)
--
-- Jalankan setelah migration:
--   mysql -u root -p truecount_db < database/seeds/003_dev_user.sql
-- =============================================================

USE `truecount_db`;

INSERT INTO `users` (`username`, `email`, `password_hash`, `role`)
VALUES (
    'dev',
    'dev@truecount.local',
    '$argon2id$v=19$m=65536,t=4,p=2$TVNHTkQ3dVpUZFRkcDh4aA$dYjAwrzcyhvU+VuZQkZeofF7tCO/ptmohaTAdFPf2lA',
    'dev'
)
ON DUPLICATE KEY UPDATE
    `password_hash` = VALUES(`password_hash`),
    `role`          = VALUES(`role`),
    `updated_at`    = NOW();
