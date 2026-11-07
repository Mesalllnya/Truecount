-- =============================================================
-- TrueCount - Seed: Dummy Users (Sprint 4 - untuk testing MFA)
--
-- Password hash dibuat dengan Argon2id (memory=65536, time=4, threads=2)
-- Jalankan setelah migration:
--   php database/migrate.php --seed
-- =============================================================

INSERT INTO `users` (`username`, `email`, `password_hash`, `role`)
VALUES
    ('rio', 'rio@truecount.local', '$argon2id$v=19$m=65536,t=4,p=2$bHo5WkNMRXZNOC90Q0FXTQ$lvrVUHSwjoqsO1H0OGlaZyBPMJWZFY0cV/eW5gRqrj0', 'voter'),
    ('pemilih1', 'pemilih1@truecount.local', '$argon2id$v=19$m=65536,t=4,p=2$eE5GUzA5TnZsMk5PN09NTA$EqzUrMGxMdp9y5FjkuM/+QGUOQEwUqU6Kx4OtNHdOtA', 'voter'),
    ('pemilih2', 'pemilih2@truecount.local', '$argon2id$v=19$m=65536,t=4,p=2$WW9zZUZRVjl5U3VqUUtMQg$Jecv2BKckq2xPLIgrYwnRA5ta2N9KvGfRx7csDzJmjU', 'voter')
ON DUPLICATE KEY UPDATE
    `password_hash` = VALUES(`password_hash`),
    `updated_at`    = NOW();