-- =============================================================
-- TrueCount - Migration: Add role 'dev' (Sprint 5 / Dev Page)
-- =============================================================

USE `truecount_db`;

-- Tambah role 'dev' ke ENUM role di tabel users
ALTER TABLE `users`
    MODIFY COLUMN `role` ENUM('admin', 'voter', 'dev') NOT NULL DEFAULT 'voter';

-- Tambah index untuk mempercepat filter berdasarkan role.
-- MySQL 8 tidak mendukung `CREATE INDEX IF NOT EXISTS` (sintaks MariaDB),
-- jadi cek dulu lewat information_schema.
SET @ddl = IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND INDEX_NAME = 'idx_users_role') = 0,
    'CREATE INDEX `idx_users_role` ON `users` (`role`)',
    'DO 0'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
