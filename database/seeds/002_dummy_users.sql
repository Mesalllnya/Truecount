-- =============================================================
-- TrueCount - Seed: Pemilih default (pemilih1, pemilih2)
--
-- Passwords:
--   pemilih1 → Pemilih@123
--   pemilih2 → Pemilih@123
-- Hash Argon2id (memory=65536, time=4, threads=2)
-- =============================================================

USE `truecount_db`;

-- Hanya sisakan admin, pemilih1, pemilih2, dev — hapus user dummy lain
DELETE FROM `users`
WHERE `username` NOT IN ('admin','pemilih1','pemilih2','dev');

-- Pastikan pemilih1 & pemilih2 ada
INSERT INTO `users` (`username`, `email`, `password_hash`, `role`)
VALUES
    ('pemilih1', 'pemilih1@truecount.local',
     '$argon2id$v=19$m=65536,t=4,p=2$eE5GUzA5TnZsMk5PN09NTA$EqzUrMGxMdp9y5FjkuM/+QGUOQEwUqU6Kx4OtNHdOtA',
     'voter'),
    ('pemilih2', 'pemilih2@truecount.local',
     '$argon2id$v=19$m=65536,t=4,p=2$WW9zZUZRVjl5U3VqUUtMQg$Jecv2BKckq2xPLIgrYwnRA5ta2N9KvGfRx7csDzJmjU',
     'voter')
ON DUPLICATE KEY UPDATE
    `password_hash` = VALUES(`password_hash`),
    `role`          = VALUES(`role`),
    `updated_at`    = NOW();
