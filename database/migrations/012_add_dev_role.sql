-- =============================================================
-- TrueCount - Migration: Add role 'dev' (Sprint 5 / Dev Page)
-- =============================================================

USE `truecount_db`;

-- Tambah role 'dev' ke ENUM role di tabel users
ALTER TABLE `users`
    MODIFY COLUMN `role` ENUM('admin', 'voter', 'dev') NOT NULL DEFAULT 'voter';

-- Tambah index untuk mempercepat filter berdasarkan role
CREATE INDEX IF NOT EXISTS `idx_users_role` ON `users` (`role`);
